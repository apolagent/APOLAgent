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

  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPL_DEPLOYMENT;
  const bot = createBot();

  // ── Telegram Bot webhook route — MUST be before static/vite catch-all ──────
  if (bot && isProduction) {
    const tkn = process.env.APOL_BOT_TOKEN!;
    const WEBHOOK_PATH = `/bot-webhook-${tkn.slice(-10)}`;

    app.post(WEBHOOK_PATH, (req, res) => {
      bot.handleUpdate(req.body, res).catch(() => {
        if (!res.headersSent) res.sendStatus(200);
      });
    });
  }

  // ── Error handler ──────────────────────────────────────────────────────────
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

  // ── Telegram Bot webhook registration (after server is listening) ──────────
  if (bot && isProduction) {
    const tkn = process.env.APOL_BOT_TOKEN!;
    const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN || "apolagent.online";
    const WEBHOOK_PATH = `/bot-webhook-${tkn.slice(-10)}`;
    const WEBHOOK_URL = `https://${WEBHOOK_DOMAIN}${WEBHOOK_PATH}`;

    const setupWebhook = async (attempt = 1): Promise<void> => {
      if (attempt > 5) {
        log("Max webhook setup attempts reached. Bot will not start.", "bot");
        return;
      }
      try {
        log(`Setting up webhook (attempt ${attempt})...`, "bot");

        await fetch(`https://api.telegram.org/bot${tkn}/deleteWebhook?drop_pending_updates=true`,
          { signal: AbortSignal.timeout(5000) });
        await new Promise(r => setTimeout(r, 500));

        const setRes = await fetch(`https://api.telegram.org/bot${tkn}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: WEBHOOK_URL,
            drop_pending_updates: true,
            allowed_updates: ["message", "callback_query"],
          }),
          signal: AbortSignal.timeout(10000),
        });
        const setData = await setRes.json() as any;

        if (setData.ok) {
          log(`Webhook active → ${WEBHOOK_URL}`, "bot");

          bot.telegram.setMyCommands([
            { command: "scan",        description: "Detailed CA investigation (Taxes, Liquidity, Honeypot)" },
            { command: "scanx",       description: "X/Twitter social forensics & LARP detection" },
            { command: "scanagent",   description: "Verify AI Agent authenticity and security" },
            { command: "checkwallet", description: "Forensic wallet audit (Age, Funding, Volume)" },
            { command: "map",         description: "Access the APOL Wall of Shame" },
            { command: "verified",    description: "View APOL Certified Hero Projects" },
          ]).then(() => log("Telegram command menu registered", "bot")).catch(() => {});
        } else {
          log(`Webhook setWebhook failed: ${JSON.stringify(setData)}`, "bot");
          await new Promise(r => setTimeout(r, 5000));
          return setupWebhook(attempt + 1);
        }
      } catch (err: any) {
        log(`Webhook setup error (attempt ${attempt}): ${err?.message || err}`, "bot");
        await new Promise(r => setTimeout(r, 5000));
        return setupWebhook(attempt + 1);
      }
    };

    setTimeout(() => setupWebhook(), 3000);

    const shutdown = () => {
      fetch(`https://api.telegram.org/bot${tkn}/deleteWebhook?drop_pending_updates=true`,
        { signal: AbortSignal.timeout(3000) }).catch(() => {});
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
