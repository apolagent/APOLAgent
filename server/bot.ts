import { Telegraf } from "telegraf";

// ─── Constants ────────────────────────────────────────────────────────────────

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const BASE_CHAIN_ID = "8453";

function getSiteUrl(): string {
  if (process.env.DOMAIN_URL) return process.env.DOMAIN_URL.replace(/\/$/, "");
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const primary = domains.split(",")[0].trim();
    return `https://${primary}`;
  }
  return "https://apepolice.online";
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

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

// ─── Police Snapshot Scanner ─────────────────────────────────────────────────

async function buildSnapshot(address: string, siteUrl: string): Promise<string> {
  try {
    // ── Fetch all sources in parallel ─────────────────────────────────────────
    const [goplusRes, dexRes] = await Promise.all([
      fetch(
        `${GOPLUS_BASE}/token_security/${BASE_CHAIN_ID}?contract_addresses=${encodeURIComponent(address)}`,
        { signal: AbortSignal.timeout(12_000) }
      ),
      fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        { signal: AbortSignal.timeout(12_000) }
      ),
    ]);

    const goplusData = (await goplusRes.json()) as any;
    const dexData    = (await dexRes.json())    as any;

    // ── Parse GoPlus ──────────────────────────────────────────────────────────
    const tKey  = Object.keys(goplusData?.result ?? {})[0];
    const token = tKey ? (goplusData.result[tKey] as any) : null;

    // ── Parse DexScreener — filter for Base chain pairs only ─────────────────
    const allPairs: any[] = dexData?.pairs ?? [];
    const basePairs = allPairs
      .filter((p: any) => p.chainId === "base")
      .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const topPair = basePairs[0] ?? null;

    // ── Not found on either source ────────────────────────────────────────────
    if (!token && !topPair) {
      return (
        `⚠️ *INVESTIGATION STALLED*\n\n` +
        `Contract not found on Base Mainnet. Ensure the CA is correct.\n\n` +
        `\`${address}\``
      );
    }

    // ── Token identity (GoPlus primary, DexScreener fallback) ─────────────────
    const rawName   = token?.token_name   ?? topPair?.baseToken?.name   ?? "Unknown";
    const rawSymbol = token?.token_symbol ?? topPair?.baseToken?.symbol ?? "?";
    const tokenName   = rawName;
    const tokenSymbol = `$${rawSymbol}`;

    // ── Holder count (GoPlus — show Data Pending if missing or zero) ──────────
    const holderRaw = parseInt(token?.holder_count ?? "0");
    const holderCount = holderRaw > 0 ? holderRaw.toLocaleString() : "Data Pending";

    // ── Taxes from GoPlus simulation (most accurate source) ───────────────────
    const buyTaxFmt  = token ? pct(token.buy_tax)  : "Data Pending";
    const sellTaxFmt = token ? pct(token.sell_tax) : "Data Pending";

    // ── Liquidity from DexScreener (real-time USD) ────────────────────────────
    const liqUsd: number | null = topPair?.liquidity?.usd ?? null;
    const liqFormatted = liqUsd !== null ? fmtUsd(liqUsd) : "Data Pending";

    // ── LP lock status from GoPlus on-chain data ───────────────────────────────
    const lpHolders: any[] = token?.lp_holders ?? [];
    const lpBurnedPct = lpHolders
      .filter(h =>
        (h.tag ?? "").toLowerCase().includes("burn") ||
        (h.address ?? "").toLowerCase() === "0x000000000000000000000000000000000000dead"
      )
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);
    const lpLockedPct = lpHolders
      .filter(h => flag(h.is_locked))
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);

    let lpStatus: string;
    if (lpBurnedPct >= 50)      lpStatus = `Burned (${lpBurnedPct.toFixed(0)}%) ✅`;
    else if (lpLockedPct >= 50) lpStatus = `Locked (${lpLockedPct.toFixed(0)}%) ✅`;
    else if (lpLockedPct > 0)   lpStatus = `Partially Locked (${lpLockedPct.toFixed(0)}%) ⚠️`;
    else if (!token && !topPair) lpStatus = `Data Pending`;
    else                        lpStatus = `Unlocked ⚠️`;

    // ── Price from DexScreener ────────────────────────────────────────────────
    const priceRaw  = parseFloat(topPair?.priceUsd ?? "0");
    const priceStr  = priceRaw > 0
      ? (priceRaw < 0.0001 ? `$${priceRaw.toExponential(3)}` : `$${priceRaw.toPrecision(5)}`)
      : "Data Pending";

    // ── Risk flags (GoPlus simulation data) ───────────────────────────────────
    const flags: string[] = [];

    if (token) {
      if (flag(token.is_honeypot))                 flags.push("⛔ HONEYPOT DETECTED");
      if (parseFloat(token.buy_tax  ?? "0") > 0.1) flags.push(`💸 High Buy Tax: ${pct(token.buy_tax)}`);
      if (parseFloat(token.sell_tax ?? "0") > 0.1) flags.push(`💸 High Sell Tax: ${pct(token.sell_tax)}`);
      if (flag(token.can_take_back_ownership))     flags.push("⚠️ Recoverable Ownership");
      if (flag(token.owner_change_balance))        flags.push("⚠️ Owner Can Change Balance");
      if (flag(token.is_mintable))                 flags.push("🖨️ Mintable Supply");
      if (flag(token.is_blacklist))                flags.push("🚫 Blacklist Function");
      if (flag(token.trading_cooldown))            flags.push("⏱️ Trading Cooldown");
      if (flag(token.anti_whale_modifiable))       flags.push("🐋 Anti-Whale Modifiable");
      if (!flag(token.is_open_source))             flags.push("👁️ Contract Not Verified");
    }
    if (lpLockedPct < 50 && lpBurnedPct < 50 && (token || topPair)) {
      flags.push("🔓 LP Not Locked");
    }

    // ── Risk level ────────────────────────────────────────────────────────────
    let riskEmoji: string;
    if (flags.some(f => f.includes("HONEYPOT"))) riskEmoji = "🚨 CRITICAL";
    else if (flags.length >= 4)                  riskEmoji = "🔴 HIGH RISK";
    else if (flags.length >= 1)                  riskEmoji = "🟡 MEDIUM RISK";
    else                                         riskEmoji = "🟢 LOW RISK";

    // ── Build message ─────────────────────────────────────────────────────────
    let msg = "";

    msg += `🚔 *APE POLICE — POLICE SNAPSHOT*\n\n`;
    msg += `📍 *Address:* \`${shortAddr(address)}\`\n`;
    msg += `⛓️ *Chain:* Base Mainnet\n\n`;

    msg += `*${tokenName}* (${tokenSymbol})\n`;
    msg += `💲 Price: *${priceStr}*\n`;
    msg += `💧 Liquidity: *${liqFormatted}*\n`;
    msg += `🔒 LP Status: *${lpStatus}*\n`;
    msg += `👥 Holders: *${holderCount}*\n`;
    msg += `💰 Buy Tax: *${buyTaxFmt}*  |  Sell Tax: *${sellTaxFmt}*\n`;

    msg += `\n*RISK LEVEL: ${riskEmoji}*\n`;

    if (flags.length > 0) {
      msg += `\n🚩 *FLAGS DETECTED:*\n`;
      flags.slice(0, 8).forEach(f => (msg += `  ${f}\n`));
      if (flags.length > 8) msg += `  _(+${flags.length - 8} more)_\n`;
    } else {
      msg += `\n✅ *No flags detected on Base chain.*\n`;
    }

    msg += `\n🔍 [Full Scan](${siteUrl}/agent-scanner)   `;
    msg += `🗺️ [Wall of Shame](${siteUrl}/report-scam)   `;
    msg += `🛡️ [Verified Builders](${siteUrl}/verified-builders)`;

    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Scan error:", err?.message ?? err);
    return (
      `❌ *Scan Failed*\n\n` +
      `Could not reach the security database. Please try again in a moment.\n` +
      `If the problem persists, try the full scanner at [${siteUrl}](${siteUrl}/agent-scanner).`
    );
  }
}

// ─── Wallet Investigation ─────────────────────────────────────────────────────

// GoPlus address_security field → human-readable label mapping
const WALLET_FLAGS: Record<string, string> = {
  blacklist_doubt:             "🔴 Blacklist Suspect",
  honeypot_related_address:    "⛔ Scam / Honeypot Affiliated",
  sanctioned:                  "⚠️ Sanctioned (Legal Risk)",
  phishing_activities:         "🎣 Phishing History",
  stealing_attack:             "🦹 Theft / Stealing",
  cybercrime:                  "💻 Cybercrime",
  money_laundering:            "💰 Money Laundering",
  financial_crime:             "🏦 Financial Crime",
  darkweb_transactions:        "🕸️ Dark Web Activity",
  blackmail_activities:        "🚨 Blackmail",
  malicious_mining_activities: "⛏️ Malicious Mining",
  mixer:                       "🌀 Mixer / Tumbler Usage",
  fake_kyc:                    "📋 Fake KYC",
  gas_abuse:                   "⛽ Gas Abuse",
  reinit:                      "🔄 Reinit Attack",
};

async function buildWalletCheck(address: string): Promise<string> {
  try {
    const res = await fetch(
      `${GOPLUS_BASE}/address_security/${encodeURIComponent(address)}?chain_id=${BASE_CHAIN_ID}`,
      { signal: AbortSignal.timeout(12_000) }
    );

    const data = (await res.json()) as any;
    const result = data?.result ?? null;

    // GoPlus returns code 2 or empty result when address not indexed
    if (!result || data?.code !== 1) {
      return (
        `⚠️ *INVESTIGATION STALLED*\n\n` +
        `No intelligence data found for this address on Base Mainnet.\n` +
        `Ensure the address is a valid EVM wallet.\n\n` +
        `\`${address}\``
      );
    }

    // ── Collect active flags ──────────────────────────────────────────────────
    const activeFlags: string[] = [];

    for (const [field, label] of Object.entries(WALLET_FLAGS)) {
      if (flag(result[field])) activeFlags.push(label);
    }

    // ── Determine status ──────────────────────────────────────────────────────
    const isCritical   = flag(result.blacklist_doubt) || flag(result.sanctioned);
    const isSuspicious = activeFlags.length > 0;

    let status: string;
    if (isCritical)    status = "🔴 BLACKLISTED";
    else if (isSuspicious) status = "⚠️ SUSPICIOUS";
    else               status = "✅ CLEAN";

    // ── Verdict sentence ──────────────────────────────────────────────────────
    let verdict: string;
    if (flag(result.sanctioned)) {
      verdict = "This wallet is under legal sanction. Any interaction may carry regulatory consequences.";
    } else if (flag(result.blacklist_doubt)) {
      verdict = "This wallet has been flagged for malicious activity. Do not interact.";
    } else if (flag(result.honeypot_related_address)) {
      verdict = "This wallet is affiliated with honeypot contracts. Treat as hostile.";
    } else if (flag(result.phishing_activities)) {
      verdict = "Phishing activity detected. This wallet has been used to drain other wallets.";
    } else if (flag(result.stealing_attack)) {
      verdict = "Theft activity on record. This wallet has been linked to stealing attacks.";
    } else if (flag(result.money_laundering) || flag(result.financial_crime)) {
      verdict = "Financial crime indicators present. Exercise extreme caution.";
    } else if (activeFlags.length > 0) {
      verdict = "Suspicious activity detected on this wallet. Investigate before interacting.";
    } else {
      verdict = "No malicious activity found. Wallet appears clean on Base Mainnet.";
    }

    // ── Build message ─────────────────────────────────────────────────────────
    let msg = "";
    msg += `👮 *APOL WALLET INVESTIGATION*\n\n`;
    msg += `👤 *Address:* \`${shortAddr(address)}\`\n`;
    msg += `🚨 *Status:* ${status}\n`;

    if (activeFlags.length > 0) {
      msg += `\n🚩 *Red Flags Found:*\n`;
      activeFlags.forEach(f => (msg += `  ${f}\n`));
    } else {
      msg += `\n✅ *No red flags detected.*\n`;
    }

    msg += `\n*Verdict:* _${verdict}_`;

    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Wallet check error:", err?.message ?? err);
    return (
      `❌ *Wallet Check Failed*\n\n` +
      `Could not reach the intelligence database. Please try again in a moment.`
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
      `🔍 /scan [contract] — Token security check\n` +
      `👮 /checkwallet [address] — Wallet investigation\n` +
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
      `🔍 /scan [address] — Token contract security check (GoPlus + DexScreener)\n` +
      `👮 /checkwallet [address] — Malicious wallet investigation (GoPlus)\n` +
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

  // ── /checkwallet [address] ────────────────────────────────────────────────
  bot.command("checkwallet", async ctx => {
    const parts   = (ctx.message.text ?? "").trim().split(/\s+/);
    const address = parts[1]?.trim();

    if (!address) {
      return ctx.replyWithMarkdown(
        `❓ *Usage:* /checkwallet [wallet address]\n\nExample: \`/checkwallet 0x1234...abcd\``
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
        `🔄 *Investigating* \`${shortAddr(address)}\`\n_Checking APOL intelligence records..._`
      );
      loadingMsgId = loading.message_id;
    } catch { /* non-fatal */ }

    const report = await buildWalletCheck(address);

    if (loadingMsgId !== null) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsgId); } catch { /* non-fatal */ }
    }

    return ctx.replyWithMarkdown(report, { disable_web_page_preview: true });
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
