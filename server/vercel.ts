/**
 * Vercel serverless entry point.
 *
 * Mirrors the middleware and route setup in index.ts but:
 *  - does NOT call server.listen()        (Vercel owns the HTTP listener)
 *  - does NOT run DB table migrations     (use `npm run db:push` at deploy time)
 *  - does NOT start background intervals  (webhook health-checks, tweet scheduler)
 *  - does NOT call serveStatic            (Vercel CDN serves dist/public directly)
 *
 * Keep this file in sync with index.ts when adding new middleware or limiters.
 */

import express, { type Request, Response, NextFunction } from "express";
import type { IncomingMessage, ServerResponse } from "http";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { createBot } from "./bot";

function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const app = express();
app.set("trust proxy", 1);

// ── Rate limiting ─────────────────────────────────────────────────────────────
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Scan rate limit exceeded. Please wait before scanning again." },
});

const agentAnalyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Agent analyze rate limit exceeded. Please wait before scanning again." },
});

// ── Concurrency guards ────────────────────────────────────────────────────────
// NOTE: these are per-instance; in serverless they reset on every cold start.
const MAX_CONCURRENT_SCAN = 3;
const MAX_CONCURRENT_AGENT = 2;

function makeConcurrencyGuard(maxConcurrent: number, label: string) {
  const inFlight = new Map<string, number>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? "unknown";
    const current = inFlight.get(ip) ?? 0;
    if (current >= maxConcurrent) {
      return res
        .status(429)
        .json({ error: `Too many concurrent ${label} requests. Please wait for previous scan to complete.` });
    }
    inFlight.set(ip, current + 1);
    res.on("finish", () => {
      const after = (inFlight.get(ip) ?? 1) - 1;
      if (after <= 0) inFlight.delete(ip);
      else inFlight.set(ip, after);
    });
    next();
  };
}

const scanConcurrencyGuard = makeConcurrencyGuard(MAX_CONCURRENT_SCAN, "scan");
const agentConcurrencyGuard = makeConcurrencyGuard(MAX_CONCURRENT_AGENT, "agent analyze");

app.use("/api", generalApiLimiter);
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.use("/api/detective/analyze",      scanLimiter,         scanConcurrencyGuard);
app.use("/api/scanx",                  scanLimiter,         scanConcurrencyGuard);
app.use("/api/agent/analyze",          agentAnalyzeLimiter, agentConcurrencyGuard);
app.use("/api/x402/detective/analyze", scanLimiter,         scanConcurrencyGuard);
app.use("/api/x402/scanx",             scanLimiter,         scanConcurrencyGuard);
app.use("/api/x402/agent/analyze",     agentAnalyzeLimiter, agentConcurrencyGuard);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

// ── Async initialization (routes + bot) ───────────────────────────────────────
// Resolved once on the first cold start; warm invocations skip it instantly.
const ready: Promise<void> = (async () => {
  await registerRoutes(app);

  // ── Telegram bot webhook (receive only — no health-check intervals) ──────
  const bot = createBot();

  if (bot) {
    const tkn = process.env.APOL_BOT_TOKEN!;
    const WEBHOOK_PATH = `/bot-webhook-${tkn}`;

    try {
      bot.botInfo = await bot.telegram.getMe();
      log(`Bot identity loaded: @${bot.botInfo.username} (id: ${bot.botInfo.id})`, "bot");
    } catch (e: any) {
      log(`bot.telegram.getMe() failed — webhook updates will be dropped: ${(e as Error)?.message}`, "bot");
    }

    app.post(WEBHOOK_PATH, (req, res) => {
      const update = req.body;
      res.sendStatus(200);
      const msgText: string = update?.message?.text ?? "(no text)";
      log(`Webhook HIT: "${msgText.slice(0, 80)}" from chat ${update?.message?.chat?.id ?? "?"}`, "bot");
      bot.handleUpdate(update).catch((err: any) => {
        log(`handleUpdate error: ${err?.message || err}`, "bot");
      });
    });
  }

  // ── Error handler ────────────────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });
})();

// ── Vercel handler ────────────────────────────────────────────────────────────
// @vercel/node invokes this for every request.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready;
  app(req as any, res as any);
}
