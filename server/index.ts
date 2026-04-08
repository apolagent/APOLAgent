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
    const myId = `${process.pid}-${Date.now()}`;

    const forceClosePolling = async () => {
      try {
        await fetch(`https://api.telegram.org/bot${tkn}/deleteWebhook?drop_pending_updates=true`,
          { signal: AbortSignal.timeout(3000) });
        await fetch(`https://api.telegram.org/bot${tkn}/getUpdates?offset=-1&limit=1&timeout=0`,
          { signal: AbortSignal.timeout(5000) });
        await new Promise(r => setTimeout(r, 500));
        await fetch(`https://api.telegram.org/bot${tkn}/getUpdates?offset=-1&limit=1&timeout=0`,
          { signal: AbortSignal.timeout(5000) });
        log("Cleared old polling session", "bot");
      } catch { /* non-fatal */ }
    };

    const launchBot = async (attempt = 1): Promise<void> => {
      if (attempt > 8) {
        log("Max bot launch attempts reached. Bot will not start.", "bot");
        return;
      }
      try {
        log(`[${myId}] Bot launch attempt ${attempt}...`, "bot");

        await forceClosePolling();
        const preDelay = Math.min(2000 + (attempt - 1) * 2000, 15000);
        await new Promise(r => setTimeout(r, preDelay));

        await bot.launch({ dropPendingUpdates: true, allowedUpdates: ["message", "callback_query"] });
        log("Telegram bot polling started successfully ✓", "bot");

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
          const backoff = Math.min(5000 + (attempt - 1) * 3000, 20000);
          log(`409 conflict — force-clearing and retrying in ${backoff / 1000}s...`, "bot");
          await forceClosePolling();
          await new Promise(r => setTimeout(r, backoff));
          return launchBot(attempt + 1);
        }
        log(`Retrying in 10s...`, "bot");
        await new Promise(r => setTimeout(r, 10_000));
        return launchBot(attempt + 1);
      }
    };

    setTimeout(() => launchBot(), 5000);

    const shutdown = () => {
      try { bot.stop("SIGTERM"); } catch {}
      forceClosePolling().catch(() => {});
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
