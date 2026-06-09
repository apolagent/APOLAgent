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

import path from "path";
import fs from "fs";
import express, { type Request, Response, NextFunction } from "express";
import type { IncomingMessage, ServerResponse } from "http";
import rateLimit from "express-rate-limit";

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
let initError: Error | null = null;

const ready: Promise<void> = (async () => {
  try {
  const { registerRoutes } = await import("./routes");
  const { createBot } = await import("./bot");

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

  // ── Debug endpoint (temporary — remove after cwd is confirmed) ──────────
  app.get("/debug-cwd", (_req, res) => {
    const cwd = process.cwd();
    const dirname = __dirname;
    const cwdFiles = fs.existsSync(cwd) ? fs.readdirSync(cwd) : ["(unreadable)"];
    const distExists = fs.existsSync(path.join(cwd, "dist"));
    const distPublicExists = fs.existsSync(path.join(cwd, "dist", "public"));
    res.json({ cwd, dirname, cwdFiles, distExists, distPublicExists });
  });

  // ── Static files (Vite build output) ────────────────────────────────────
  // process.cwd() is /var/task in the Vercel Lambda runtime, which is the
  // project root — the same location that includeFiles bundles dist/public into.
  const distPath = path.resolve(process.cwd(), "dist", "public");
  app.use(express.static(distPath));
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  // ── Error handler ────────────────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });
  } catch (err: any) {
    initError = err;
    console.error("APOL init failed:", err);
  }
})();

// ── Vercel handler ────────────────────────────────────────────────────────────
// @vercel/node invokes this for every request.
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ready;
  if (initError) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: initError.message, stack: initError.stack }));
    return;
  }
  app(req as any, res as any);
}
