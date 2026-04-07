import express, { type Request, Response, NextFunction } from "express";
import { execFile } from "child_process";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createBot } from "./bot";

const app = express();

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

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(server, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  // ── Telegram Bot ────────────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPL_DEPLOYMENT;
  const bot = createBot();
  if (bot && isProduction) {
    const tkn = process.env.APOL_BOT_TOKEN!;

    const isBotReady = async (): Promise<boolean> => {
      try {
        const r = await fetch(`https://api.telegram.org/bot${tkn}/getMe`, { signal: AbortSignal.timeout(5000) });
        const j = await r.json() as any;
        return j.ok === true;
      } catch { return false; }
    };

    const launchBot = async (attempt = 1): Promise<void> => {
      try {
        log(`Bot launch attempt ${attempt} — checking token status...`, "bot");
        const ready = await isBotReady();
        if (!ready) {
          log("Bot token not ready (likely logged out ban). Waiting 2 minutes silently...", "bot");
          await new Promise(r => setTimeout(r, 2 * 60 * 1000));
          return launchBot(attempt);
        }
        await fetch(`https://api.telegram.org/bot${tkn}/deleteWebhook?drop_pending_updates=true`, { signal: AbortSignal.timeout(5000) }).catch(() => {});
        await new Promise(r => setTimeout(r, 1000));
        await bot.launch({ dropPendingUpdates: true, allowedUpdates: ["message", "callback_query"] });
        log("Telegram bot polling started successfully", "bot");
        bot.telegram.setMyCommands([
          { command: "scan",        description: "Detailed CA investigation (Taxes, Liquidity, Honeypot)" },
          { command: "scanx",       description: "X/Twitter social forensics & LARP detection" },
          { command: "scanagent",   description: "Verify AI Agent authenticity and security" },
          { command: "checkwallet", description: "Forensic wallet audit (Age, Funding, Volume)" },
          { command: "map",         description: "Access the APOL Wall of Shame" },
          { command: "verified",    description: "View APOL Certified Hero Projects" },
        ]).then(() => log("Telegram command menu registered", "bot")).catch(() => {});
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        log(`Bot start failed (attempt ${attempt}): ${msg}`, "bot");
        if (msg.includes("409") || msg.includes("Conflict")) {
          const delay = Math.min(15_000 + attempt * 5_000, 60_000);
          log(`409 conflict — waiting ${delay / 1000}s for old session to expire...`, "bot");
          await new Promise(r => setTimeout(r, delay));
          return launchBot(attempt + 1);
        } else {
          log(`Unexpected error — retrying in 60s...`, "bot");
          await new Promise(r => setTimeout(r, 60_000));
          return launchBot(attempt + 1);
        }
      }
    };
    setTimeout(() => launchBot(), 10_000);

    const shutdown = () => {
      try { bot.stop("SIGTERM"); } catch {}
    };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  } else if (bot) {
    log("Bot skipped in dev — only runs in production to avoid conflicts", "bot");
  }

  // ── Scheduled Tweet Poster (production only) ────────────────────────────────
  if (isProduction) {
    const CHECK_INTERVAL = 10 * 60 * 1000;
    const INITIAL_DELAY = 2 * 60 * 1000;

    const postTweet = () => {
      execFile("python3", ["main.py"], (err, stdout, stderr) => {
        if (err) log(`Tweet script error: ${err.message}`, "scheduler");
        if (stderr) log(`Tweet stderr: ${stderr}`, "scheduler");
        if (stdout) log(stdout.trim(), "scheduler");
      });
    };

    setTimeout(() => {
      postTweet();
      setInterval(postTweet, CHECK_INTERVAL);
    }, INITIAL_DELAY);

    log("Tweet scheduler active — first check in 2min, then every 10min with 11h lockfile guard", "scheduler");
  }
})();
