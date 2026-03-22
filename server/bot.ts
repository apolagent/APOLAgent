import { Telegraf } from "telegraf";

// ─── Constants ────────────────────────────────────────────────────────────────

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const BASE_CHAIN_ID = "8453";

// Derive the public URL from environment (works on Replit deployments & dev)
function getSiteUrl(): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const primary = domains.split(",")[0].trim();
    return `https://${primary}`;
  }
  return "https://ape-police.replit.app";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/i.test(addr.trim());
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function pct(raw: string | undefined): string {
  const n = parseFloat(raw || "0");
  return isNaN(n) ? "0%" : `${(n * 100).toFixed(1)}%`;
}

function flag(v: any): boolean {
  return v === "1" || v === 1 || v === true;
}

// ─── Police Snapshot Scanner ─────────────────────────────────────────────────

async function buildSnapshot(address: string, siteUrl: string): Promise<string> {
  try {
    const [tokenRes, secRes] = await Promise.all([
      fetch(`${GOPLUS_BASE}/token_security/${BASE_CHAIN_ID}?contract_addresses=${encodeURIComponent(address)}`, {
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${GOPLUS_BASE}/address_security/${encodeURIComponent(address)}`, {
        signal: AbortSignal.timeout(10_000),
      }),
    ]);

    const tokenData = (await tokenRes.json()) as any;
    const secData  = (await secRes.json()) as any;

    const tKey  = Object.keys(tokenData?.result ?? {})[0];
    const token = tKey ? (tokenData.result[tKey] as any) : null;
    const sec   = (secData?.result ?? {}) as Record<string, any>;

    // ── Risk flags ────────────────────────────────────────────────────────────
    const flags: string[] = [];

    if (token) {
      if (flag(token.is_honeypot))               flags.push("⛔ HONEYPOT DETECTED");
      if (parseFloat(token.buy_tax  ?? "0") > 0.1) flags.push(`💸 Buy Tax: ${pct(token.buy_tax)}`);
      if (parseFloat(token.sell_tax ?? "0") > 0.1) flags.push(`💸 Sell Tax: ${pct(token.sell_tax)}`);
      if (flag(token.can_take_back_ownership))   flags.push("⚠️ Recoverable Ownership");
      if (flag(token.owner_change_balance))      flags.push("⚠️ Owner Can Change Balance");
      if (flag(token.is_mintable))               flags.push("🖨️ Mintable Supply");
      if (flag(token.is_blacklist))              flags.push("🚫 Blacklist Function");
      if (flag(token.trading_cooldown))          flags.push("⏱️ Trading Cooldown");
      if (flag(token.anti_whale_modifiable))     flags.push("🐋 Anti-Whale Modifiable");
      if (!flag(token.is_open_source))           flags.push("👁️ Contract Not Verified");
    }

    const secFlagKeys = Object.keys(sec).filter(k =>
      flag(sec[k]) && !["contract_address", "chainId"].includes(k)
    );
    secFlagKeys.forEach(k => flags.push(`🔍 ${k.replace(/_/g, " ")}`));

    // ── Risk level ────────────────────────────────────────────────────────────
    let riskEmoji: string;
    if (flags.some(f => f.includes("HONEYPOT")))            riskEmoji = "🚨 CRITICAL";
    else if (flags.length >= 3)                              riskEmoji = "🔴 HIGH RISK";
    else if (flags.length >= 1)                              riskEmoji = "🟡 MEDIUM RISK";
    else                                                     riskEmoji = "🟢 LOW RISK";

    // ── Token metadata ────────────────────────────────────────────────────────
    const isContract   = !!tKey;
    const tokenName    = token?.token_name   ?? "—";
    const tokenSymbol  = token?.token_symbol ? `$${token.token_symbol}` : "—";
    const holderCount  = token?.holder_count ? parseInt(token.holder_count).toLocaleString() : "—";
    const buyTaxFmt    = token ? pct(token.buy_tax)  : "—";
    const sellTaxFmt   = token ? pct(token.sell_tax) : "—";

    const lpHolders: any[] = token?.lp_holders ?? [];
    const lpLocked = lpHolders
      .filter(h => flag(h.is_locked))
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);

    // ── Build message ─────────────────────────────────────────────────────────
    const divider = "━━━━━━━━━━━━━━━━━━━━━━━━";
    let msg = "";

    msg += `🚔 *APE POLICE — POLICE SNAPSHOT*\n`;
    msg += `${divider}\n\n`;
    msg += `📍 *Address:* \`${shortAddr(address)}\`\n`;
    msg += `⛓️ *Chain:* Base Mainnet\n`;
    msg += `🏷️ *Type:* ${isContract ? `Token Contract` : "Wallet Address"}\n`;

    if (isContract && token) {
      msg += `\n`;
      msg += `*${tokenName}* (${tokenSymbol})\n`;
      msg += `👥 Holders: *${holderCount}*\n`;
      msg += `💰 Buy Tax: *${buyTaxFmt}*  |  Sell Tax: *${sellTaxFmt}*\n`;
      msg += `🔒 LP Locked: *${lpLocked.toFixed(0)}%*\n`;
    }

    msg += `\n${divider}\n`;
    msg += `*RISK LEVEL: ${riskEmoji}*\n`;
    msg += `${divider}\n`;

    if (flags.length > 0) {
      msg += `\n🚩 *FLAGS DETECTED:*\n`;
      flags.slice(0, 8).forEach(f => (msg += `  ${f}\n`));
      if (flags.length > 8) msg += `  _(+${flags.length - 8} more)_\n`;
    } else {
      msg += `\n✅ *No flags detected on Base chain.*\n`;
    }

    msg += `\n${divider}\n`;
    msg += `🔍 [Full Scan](${siteUrl}/agent-scanner)   `;
    msg += `🗺️ [Wall of Shame](${siteUrl}/report-scam)   `;
    msg += `🛡️ [Verified Builders](${siteUrl}/verified-builders)`;

    return msg;
  } catch (err: any) {
    console.error("[APOL Bot] Scan error:", err?.message ?? err);
    return (
      `❌ *Scan Failed*\n\n` +
      `Could not reach the security database. Please try again in a moment.\n` +
      `If the problem persists, try the full scanner at [ape-police.app](${siteUrl}/agent-scanner).`
    );
  }
}

// ─── Bot Factory ─────────────────────────────────────────────────────────────

export function createBot(): Telegraf | null {
  const token = process.env.APOL_BOT_TOKEN;
  if (!token) {
    console.log("[APOL Bot] APOL_BOT_TOKEN not set — Telegram bot disabled.");
    return null;
  }

  const bot    = new Telegraf(token);
  const site   = getSiteUrl();
  const div    = "━━━━━━━━━━━━━━━━━━━━━━━━";

  // ── Global error handler ──────────────────────────────────────────────────
  bot.catch((err: any, ctx: any) => {
    const code = err?.response?.error_code ?? err?.code;
    if (code === 403) return; // Bot was kicked — silent
    if (code === 401) { console.error("[APOL Bot] Unauthorized (401) — check token."); return; }
    if (code === 404) return; // Message/chat not found — silent
    if (code === 400 && err?.message?.includes("message is not modified")) return;
    console.error(`[APOL Bot] Unhandled error (${ctx?.updateType}):`, err?.message ?? err);
  });

  // ── /start ────────────────────────────────────────────────────────────────
  bot.start(ctx =>
    ctx.replyWithMarkdown(
      `🚨 *APOL AGENT ONLINE*\n` +
      `Protecting the Base trenches.\n\n` +
      `Use /scan [address] to check a contract or /report to flag a larp.\n\n` +
      `*AVAILABLE COMMANDS*\n` +
      `🔍 /scan [contract] — Security check\n` +
      `🚩 /report — Submit scam evidence\n` +
      `🗺️ /map — Wall of Shame\n` +
      `🛡️ /verified — Certified projects\n` +
      `❓ /help — Help`
    ).catch(() => ctx.reply(
      "🚨 APOL AGENT ONLINE.\nUse /scan [address] to check a contract or /report to flag a larp.\n\nCommands: /scan /report /map /verified /help"
    ))
  );

  // ── /help ─────────────────────────────────────────────────────────────────
  bot.help(ctx =>
    ctx.replyWithMarkdown(
      `🚔 *APE POLICE — HELP DESK*\n` +
      `${div}\n\n` +
      `🔍 /scan [address] — Run a security check on any contract or wallet\n` +
      `🚩 /report — Report a suspected scam or LARP agent\n` +
      `🗺️ /map — View the Wall of Shame\n` +
      `🛡️ /verified — Browse APOL-certified projects\n\n` +
      `_Questions? Join the community._`,
      { disable_web_page_preview: true }
    )
  );

  // ── /scan [address] ───────────────────────────────────────────────────────
  bot.command("scan", async ctx => {
    const parts   = (ctx.message.text ?? "").trim().split(/\s+/);
    const address = parts[1]?.trim();

    if (!address) {
      return ctx.replyWithMarkdown(
        `❓ *Usage:* /scan \\[contract address\\]\n\nExample:\n\`/scan 0x1234...abcd\``,
        { parse_mode: "MarkdownV2" }
      );
    }

    if (!isEvmAddress(address)) {
      return ctx.replyWithMarkdown(
        `⚠️ *Invalid address.*\n\nPlease provide a valid EVM address starting with \`0x\` (42 chars).`
      );
    }

    let loadingMsgId: number | null = null;
    try {
      const loading = await ctx.replyWithMarkdown(
        `🔄 *Scanning* \`${shortAddr(address)}\`\n_Consulting APOL intelligence database..._`
      );
      loadingMsgId = loading.message_id;
    } catch { /* non-fatal */ }

    const snapshot = await buildSnapshot(address, site);

    if (loadingMsgId !== null) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsgId); } catch { /* non-fatal */ }
    }

    return ctx.replyWithMarkdown(snapshot, { disable_web_page_preview: true });
  });

  // ── /report ───────────────────────────────────────────────────────────────
  bot.command("report", ctx =>
    ctx.replyWithMarkdown(
      `🚩 *REPORT A SCAM OR LARP*\n` +
      `${div}\n\n` +
      `Submit your evidence securely via the APOL Evidence Portal:\n\n` +
      `🔗 [Submit Evidence](${site}/report-scam)\n\n` +
      `_Your report will be reviewed by APOL officers. Confirmed cases are added to the Wall of Shame._`,
      { disable_web_page_preview: true }
    )
  );

  // ── /map ──────────────────────────────────────────────────────────────────
  bot.command("map", ctx =>
    ctx.replyWithMarkdown(
      `🗺️ *WALL OF SHAME*\n` +
      `${div}\n\n` +
      `Live database of confirmed scammers, rug pullers, and LARP agents on Base:\n\n` +
      `🔗 [View Wall of Shame](${site}/report-scam)\n\n` +
      `_Updated in real-time as reports are verified by APOL officers._`,
      { disable_web_page_preview: true }
    )
  );

  // ── /verified ─────────────────────────────────────────────────────────────
  bot.command("verified", ctx =>
    ctx.replyWithMarkdown(
      `🛡️ *APOL VERIFIED BUILDERS*\n` +
      `${div}\n\n` +
      `Projects that have passed the full Ape Police audit:\n\n` +
      `🔗 [View Certified Projects](${site}/verified-builders)\n\n` +
      `_Each listed project has passed contract security review, team vetting, and community scrutiny._`,
      { disable_web_page_preview: true }
    )
  );

  return bot;
}
