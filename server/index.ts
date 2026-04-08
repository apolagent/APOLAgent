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

  const bot = createBot();

  if (bot) {
    const tkn = process.env.APOL_BOT_TOKEN!;
    const WEBHOOK_PATH = `/bot-webhook-${tkn}`;
    const WEBHOOK_URL = `https://apolagent.online${WEBHOOK_PATH}`;

    try {
      bot.botInfo = await bot.telegram.getMe();
      log(`Bot identity loaded: @${bot.botInfo.username} (id: ${bot.botInfo.id})`, "bot");
    } catch (e: any) {
      log(`FATAL: bot.telegram.getMe() failed: ${e?.message}`, "bot");
    }

    app.post(WEBHOOK_PATH, (req, res) => {
      const update = req.body;
      console.log("Incoming Webhook:", JSON.stringify(update).slice(0, 300));
      const msgText = update?.message?.text || "(no text)";
      log(`Webhook HIT: "${msgText.slice(0, 80)}" from chat ${update?.message?.chat?.id ?? "?"}`, "bot");
      bot.handleUpdate(update, res).catch((err: any) => {
        log(`handleUpdate error: ${err?.message || err}`, "bot");
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

  if (bot) {
    const tkn = process.env.APOL_BOT_TOKEN!;
    const WEBHOOK_PATH = `/bot-webhook-${tkn}`;
    const WEBHOOK_URL = `https://apolagent.online${WEBHOOK_PATH}`;

    const hardResetWebhook = async (attempt = 1): Promise<void> => {
      if (attempt > 5) {
        log("CRITICAL: Max webhook attempts reached. Bot is DEAD.", "bot");
        return;
      }
      try {
        log(`[HARD RESET] Step 1: Deleting old webhook (attempt ${attempt})...`, "bot");
        const delRes = await fetch(
          `https://api.telegram.org/bot${tkn}/deleteWebhook?drop_pending_updates=true`,
          { signal: AbortSignal.timeout(10000) }
        );
        const delData = await delRes.json() as any;
        log(`[HARD RESET] deleteWebhook response: ${JSON.stringify(delData)}`, "bot");

        log(`[HARD RESET] Step 2: Waiting 5 seconds for Telegram to fully clear...`, "bot");
        await new Promise(r => setTimeout(r, 5000));

        log(`[HARD RESET] Step 3: Verifying webhook is cleared...`, "bot");
        const infoRes = await fetch(
          `https://api.telegram.org/bot${tkn}/getWebhookInfo`,
          { signal: AbortSignal.timeout(10000) }
        );
        const infoData = await infoRes.json() as any;
        log(`[HARD RESET] getWebhookInfo after clear: url="${infoData?.result?.url || "(empty)"}", pending=${infoData?.result?.pending_update_count ?? "?"}`, "bot");

        log(`[HARD RESET] Step 4: Registering webhook → ${WEBHOOK_URL}`, "bot");
        const setRes = await fetch(`https://api.telegram.org/bot${tkn}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: WEBHOOK_URL,
            drop_pending_updates: true,
            allowed_updates: ["message", "callback_query"],
            max_connections: 40,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const setData = await setRes.json() as any;

        if (setData.ok) {
          log(`[HARD RESET] Step 5: Confirming registration...`, "bot");
          const confirmRes = await fetch(
            `https://api.telegram.org/bot${tkn}/getWebhookInfo`,
            { signal: AbortSignal.timeout(10000) }
          );
          const confirmData = await confirmRes.json() as any;
          const confirmedUrl = confirmData?.result?.url || "";
          const lastError = confirmData?.result?.last_error_message || "none";
          log(`[HARD RESET] CONFIRMED: url="${confirmedUrl}", last_error="${lastError}"`, "bot");

          if (confirmedUrl === WEBHOOK_URL) {
            log(`✅ WEBHOOK LIVE → ${WEBHOOK_URL}`, "bot");
          } else {
            log(`⚠️ URL MISMATCH! Expected ${WEBHOOK_URL} but got ${confirmedUrl}`, "bot");
          }

          bot.telegram.setMyCommands([
            { command: "scan",        description: "Detailed CA investigation (Taxes, Liquidity, Honeypot)" },
            { command: "scanx",       description: "X/Twitter social forensics & LARP detection" },
            { command: "scanagent",   description: "Verify AI Agent authenticity and security" },
            { command: "checkwallet", description: "Forensic wallet audit (Age, Funding, Volume)" },
            { command: "map",         description: "Access the APOL Wall of Shame" },
            { command: "verified",    description: "View APOL Certified Hero Projects" },
          ]).then(() => log("Command menu registered ✅", "bot")).catch(() => {});
        } else {
          log(`setWebhook FAILED: ${JSON.stringify(setData)}`, "bot");
          await new Promise(r => setTimeout(r, 5000));
          return hardResetWebhook(attempt + 1);
        }
      } catch (err: any) {
        log(`Webhook setup error (attempt ${attempt}): ${err?.message || err}`, "bot");
        await new Promise(r => setTimeout(r, 5000));
        return hardResetWebhook(attempt + 1);
      }
    };

    setTimeout(() => hardResetWebhook(), 2000);
  }

  const isProduction = process.env.NODE_ENV === "production" || !!process.env.REPL_DEPLOYMENT;
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
