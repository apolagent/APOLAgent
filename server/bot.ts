import { Telegraf } from "telegraf";

// ─── Constants ────────────────────────────────────────────────────────────────

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const BASE_CHAIN_ID = "8453";

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

    // ── Critical check values ─────────────────────────────────────────────────

    // Liquidity status
    const lpHolders: any[] = token?.lp_holders ?? [];
    const lpBurnedPct = lpHolders
      .filter(h => (h.tag ?? "").toLowerCase().includes("burn") || (h.address ?? "").toLowerCase() === "0x000000000000000000000000000000000000dead")
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);
    const lpLockedPct = lpHolders
      .filter(h => flag(h.is_locked))
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);

    let liquidityStatus: string;
    if (lpBurnedPct >= 50)       liquidityStatus = `Burned (${lpBurnedPct.toFixed(0)}%) ✅`;
    else if (lpLockedPct >= 50)  liquidityStatus = `Locked (${lpLockedPct.toFixed(0)}%) ✅`;
    else if (lpLockedPct > 0)    liquidityStatus = `Partially Locked (${lpLockedPct.toFixed(0)}%) ⚠️`;
    else if (!token)             liquidityStatus = `N/A`;
    else                         liquidityStatus = `Unlocked ⚠️`;

    // Mint function
    const mintable = token ? flag(token.is_mintable) : false;
    const mintStatus = mintable ? "Active ⚠️" : "Disabled ✅";

    // Tax
    const buyTax  = token ? pct(token.buy_tax)  : "—";
    const sellTax = token ? pct(token.sell_tax) : "—";
    const taxLine = `Buy ${buyTax} / Sell ${sellTax}`;

    // Top 10 holders % of supply
    const holders: any[] = token?.holders ?? [];
    const top10Pct = holders
      .slice(0, 10)
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);
    const top10Line = token ? `${top10Pct.toFixed(1)}% of Supply` : "—";

    // ── Risk level ────────────────────────────────────────────────────────────
    const isHoneypot   = token ? flag(token.is_honeypot) : false;
    const highTax      = token ? (parseFloat(token.buy_tax ?? "0") > 0.1 || parseFloat(token.sell_tax ?? "0") > 0.1) : false;
    const unverified   = token ? !flag(token.is_open_source) : false;
    const ownerRisk    = token ? (flag(token.can_take_back_ownership) || flag(token.owner_change_balance)) : false;

    const riskScore =
      (isHoneypot   ? 10 : 0) +
      (lpLockedPct < 50 && lpBurnedPct < 50 && !!token ? 2 : 0) +
      (mintable      ? 2 : 0) +
      (highTax       ? 1 : 0) +
      (ownerRisk     ? 2 : 0) +
      (unverified    ? 1 : 0) +
      (top10Pct > 70 ? 1 : 0);

    let riskLevel: string;
    if (isHoneypot)      riskLevel = "🚨 CRITICAL";
    else if (riskScore >= 4) riskLevel = "🔴 HIGH";
    else if (riskScore >= 2) riskLevel = "🟡 MEDIUM";
    else                     riskLevel = "🟢 LOW";

    // ── Agent verdict (rule-based) ────────────────────────────────────────────
    let verdict: string;
    if (isHoneypot) {
      verdict = "Contract is flagged as a honeypot — funds sent in cannot be withdrawn.";
    } else if (mintable && lpLockedPct < 50 && lpBurnedPct < 50 && !!token) {
      verdict = "Active mint function combined with unlocked liquidity represents a critical rug risk.";
    } else if (lpLockedPct < 50 && lpBurnedPct < 50 && !!token && highTax) {
      verdict = "Unlocked liquidity and elevated taxes are a common signature of exit scam setups.";
    } else if (lpLockedPct < 50 && lpBurnedPct < 50 && !!token) {
      verdict = "Liquidity is not locked — the team can remove funds from the pool at any time.";
    } else if (mintable) {
      verdict = "Mint function is active — the team retains the ability to inflate token supply.";
    } else if (ownerRisk) {
      verdict = "Owner privileges are elevated — balance or ownership can be modified post-launch.";
    } else if (highTax) {
      verdict = "Tax levels are above normal — verify these are intentional before trading.";
    } else if (unverified) {
      verdict = "Contract source code is not verified — the code cannot be independently audited.";
    } else if (!token) {
      verdict = "No token data found on Base chain — verify this is a valid contract address.";
    } else {
      verdict = "No major red flags detected — this contract appears clean on Base chain.";
    }

    // ── Token identity ────────────────────────────────────────────────────────
    const tokenName   = token?.token_name   ?? "Unknown";
    const tokenSymbol = token?.token_symbol ? `$${token.token_symbol}` : "Unknown";

    // ── Build message ─────────────────────────────────────────────────────────
    let msg = "";
    msg += `📑 *APOL INVESTIGATION REPORT*\n\n`;
    msg += `🏷️ *Project:* ${tokenName} (${tokenSymbol})\n`;
    msg += `🚨 *Risk Level:* ${riskLevel}\n\n`;
    msg += `🔍 *CRITICAL CHECKS:*\n\n`;
    msg += `Liquidity: ${liquidityStatus}\n`;
    msg += `Mint Function: ${mintStatus}\n`;
    msg += `Tax: ${taxLine}\n`;
    msg += `Top 10 Holders: ${top10Line}\n\n`;
    msg += `🛡️ *AGENT VERDICT:* ${verdict}\n\n`;
    msg += `🔗 [Full Deep Dive on Website](${siteUrl}/agent-scanner)`;

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

  const bot  = new Telegraf(token);
  const site = getSiteUrl();

  // ── Global error handler ──────────────────────────────────────────────────
  bot.catch((err: any, ctx: any) => {
    const code = err?.response?.error_code ?? err?.code;
    if (code === 403) return;
    if (code === 401) { console.error("[APOL Bot] Unauthorized (401) — check token."); return; }
    if (code === 404) return;
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
      `🚔 *APE POLICE — HELP DESK*\n\n` +
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
        `❓ *Usage:* /scan [contract address]\n\nExample: \`/scan 0x1234...abcd\``
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
      `🚩 *REPORT A SCAM OR LARP*\n\n` +
      `Submit your evidence securely via the APOL Evidence Portal:\n\n` +
      `🔗 [Submit Evidence](${site}/report-scam)\n\n` +
      `_Your report will be reviewed by APOL officers. Confirmed cases are added to the Wall of Shame._`,
      { disable_web_page_preview: true }
    )
  );

  // ── /map ──────────────────────────────────────────────────────────────────
  bot.command("map", ctx =>
    ctx.replyWithMarkdown(
      `🗺️ *WALL OF SHAME*\n\n` +
      `Live database of confirmed scammers, rug pullers, and LARP agents on Base:\n\n` +
      `🔗 [View Wall of Shame](${site}/report-scam)\n\n` +
      `_Updated in real-time as reports are verified by APOL officers._`,
      { disable_web_page_preview: true }
    )
  );

  // ── /verified ─────────────────────────────────────────────────────────────
  bot.command("verified", ctx =>
    ctx.replyWithMarkdown(
      `🛡️ *APOL VERIFIED BUILDERS*\n\n` +
      `Projects that have passed the full Ape Police audit:\n\n` +
      `🔗 [View Certified Projects](${site}/verified-builders)\n\n` +
      `_Each listed project has passed contract security review, team vetting, and community scrutiny._`,
      { disable_web_page_preview: true }
    )
  );

  return bot;
}
