import { Telegraf } from "telegraf";

export function createBot(): Telegraf | null {
  const token = process.env.APOL_BOT_TOKEN;
  if (!token) {
    console.log("[bot] No APOL_BOT_TOKEN found — bot disabled");
    return null;
  }

  const bot = new Telegraf(token);

  bot.command("scan", (ctx) => {
    ctx.reply("🔍 APOL Engine Reset: Connection established. Send me a CA to test the new simulator.");
  });

  bot.command("start", (ctx) => {
    ctx.reply("🦍 APOL Agent online. Use /scan <contract address> to begin.");
  });

  return bot;
}
