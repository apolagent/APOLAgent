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

// Known funding source labels keyed by partial address match or name
const KNOWN_SOURCES: Array<{ match: string; label: string }> = [
  { match: "0xd3a5b", label: "Binance (CEX)" },
  { match: "0x3f5ce", label: "Binance (CEX)" },
  { match: "0x28c6c0", label: "Binance (CEX)" },
  { match: "0xa9d1e", label: "Binance (CEX)" },
  { match: "0x564286", label: "Binance (CEX)" },
  { match: "0xa910f9", label: "Coinbase (CEX)" },
  { match: "0x503828", label: "Coinbase (CEX)" },
  { match: "0x71660c", label: "Coinbase (CEX)" },
  { match: "0x77696c", label: "Coinbase (CEX)" },
  { match: "0xd68a82", label: "Coinbase (CEX)" },
  { match: "0x66f820", label: "Kraken (CEX)" },
  { match: "0x2910d8", label: "Kraken (CEX)" },
  { match: "0x0a869d", label: "OKX (CEX)" },
  { match: "0x98ec05", label: "OKX (CEX)" },
  { match: "0xd882cf", label: "Huobi (CEX)" },
  { match: "0xadb2b4", label: "Tornado Cash (Mixer)" },
  { match: "0x910cbd", label: "Tornado Cash (Mixer)" },
  { match: "0x12d66f", label: "Tornado Cash (Mixer)" },
  { match: "0x47ce0c", label: "Tornado Cash (Mixer)" },
  { match: "0x23773e", label: "Tornado Cash (Mixer)" },
  { match: "0x4736dc", label: "FixedFloat (Mixer/Swap)" },
  { match: "0xba5ede", label: "Stargate Bridge" },
  { match: "0x4200000000000000000000000000000000000010", label: "Base Bridge (Official)" },
  { match: "0x49048044d57e1c92a77f79988d21fa8faf74e97", label: "Base Bridge (Official)" },
  { match: "0x8498b2", label: "Base Bridge (Official)" },
  { match: "0x99c9fc", label: "Optimism Bridge" },
];

function identifySource(fromAddr: string): string {
  const lower = fromAddr.toLowerCase();
  for (const { match, label } of KNOWN_SOURCES) {
    if (lower.startsWith(match.toLowerCase())) return label;
  }
  return `Unknown (${shortAddr(fromAddr)})`;
}

function fmtAge(isoTs: string): string {
  const d = new Date(isoTs);
  if (isNaN(d.getTime())) return "Data Pending";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return "< 1 day (Fresh Wallet)";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return `~${months} month${months > 1 ? "s" : ""}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `~${years}y ${rem}m` : `~${years} year${years > 1 ? "s" : ""}`;
}

async function fetchOldestTx(address: string): Promise<{ timestamp: string; from: string } | null> {
  const BLOCKSCOUT = "https://base.blockscout.com/api/v2";
  const sig = AbortSignal.timeout(14_000);

  // Paginate through transactions (50 per page) up to 5 pages to find oldest
  let nextParams: Record<string, string> | null = null;
  let lastItem: any = null;

  for (let page = 0; page < 5; page++) {
    let url = `${BLOCKSCOUT}/addresses/${encodeURIComponent(address)}/transactions`;
    if (nextParams) {
      const qs = new URLSearchParams(nextParams).toString();
      url += `?${qs}`;
    }
    try {
      const res = await fetch(url, { signal: sig });
      const data = (await res.json()) as any;
      const items: any[] = data?.items ?? [];
      if (items.length > 0) lastItem = items[items.length - 1];
      if (!data?.next_page_params) break;
      nextParams = data.next_page_params;
    } catch {
      break;
    }
  }

  if (!lastItem) return null;
  return {
    timestamp: lastItem.timestamp,
    from: lastItem.from?.hash ?? "",
  };
}

async function buildWalletCheck(address: string): Promise<string> {
  try {
    const BLOCKSCOUT = "https://base.blockscout.com/api/v2";

    // ── Fetch GoPlus + Blockscout address info in parallel ────────────────────
    const [goplusRes, bsAddrRes] = await Promise.all([
      fetch(
        `${GOPLUS_BASE}/address_security/${encodeURIComponent(address)}?chain_id=${BASE_CHAIN_ID}`,
        { signal: AbortSignal.timeout(12_000) }
      ),
      fetch(
        `${BLOCKSCOUT}/addresses/${encodeURIComponent(address)}`,
        { signal: AbortSignal.timeout(12_000) }
      ),
    ]);

    const goplusData = (await goplusRes.json()) as any;
    const bsAddr     = (await bsAddrRes.json()) as any;
    const gpResult   = goplusData?.result ?? null;

    // ── On-chain data from Blockscout ─────────────────────────────────────────
    const isContract  = bsAddr?.is_contract ?? false;
    const coinBalance = bsAddr?.coin_balance ? parseFloat(bsAddr.coin_balance) / 1e18 : null;
    const exchangeRate = bsAddr?.exchange_rate ? parseFloat(bsAddr.exchange_rate) : null;
    const txCount     = bsAddr?.tx_count ?? null;

    const ethBal  = coinBalance !== null ? `${coinBalance.toFixed(4)} ETH` : "Data Pending";
    const usdBal  = coinBalance !== null && exchangeRate
      ? ` (≈${fmtUsd(coinBalance * exchangeRate)})`
      : "";
    const txTotal = txCount !== null ? txCount.toLocaleString() : "Data Pending";

    // Activity classification
    let activityLevel: string;
    if (txCount === null)      activityLevel = "Data Pending";
    else if (txCount < 5)      activityLevel = "⚠️ Fresh / Low Activity (Rug Risk Profile)";
    else if (txCount < 50)     activityLevel = "Low Activity";
    else if (txCount < 500)    activityLevel = "Moderate Activity";
    else                       activityLevel = "High Activity (Established Wallet)";

    // ── Fetch oldest tx for wallet age + funding source ───────────────────────
    const oldestTx = await fetchOldestTx(address);

    const walletAge = oldestTx?.timestamp ? fmtAge(oldestTx.timestamp) : "Data Pending";
    const firstSeenDate = oldestTx?.timestamp
      ? new Date(oldestTx.timestamp).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : "Data Pending";
    const fundingSource = oldestTx?.from ? identifySource(oldestTx.from) : "Data Pending";

    // ── GoPlus threat flags ───────────────────────────────────────────────────
    const activeFlags: string[] = [];
    if (gpResult) {
      for (const [field, label] of Object.entries(WALLET_FLAGS)) {
        if (flag(gpResult[field])) activeFlags.push(label as string);
      }
    }

    // ── Status ────────────────────────────────────────────────────────────────
    const isCritical   = gpResult && (flag(gpResult.blacklist_doubt) || flag(gpResult.sanctioned));
    const isSuspicious = activeFlags.length > 0;

    let status: string;
    if (isCritical)        status = "🔴 BLACKLISTED";
    else if (isSuspicious) status = "⚠️ SUSPICIOUS";
    else                   status = "✅ CLEAN";

    // ── Verdict ───────────────────────────────────────────────────────────────
    let verdict: string;
    if (!gpResult) {
      verdict = "No threat data on record. On-chain forensics above are sourced from Base Mainnet.";
    } else if (flag(gpResult.sanctioned)) {
      verdict = "This wallet is under legal sanction. Any interaction may carry regulatory consequences.";
    } else if (flag(gpResult.blacklist_doubt)) {
      verdict = "This wallet has been flagged for malicious activity. Do not interact.";
    } else if (flag(gpResult.honeypot_related_address)) {
      verdict = "This wallet is affiliated with honeypot contracts. Treat as hostile.";
    } else if (flag(gpResult.phishing_activities)) {
      verdict = "Phishing activity on record. This wallet has been used to drain others.";
    } else if (flag(gpResult.stealing_attack)) {
      verdict = "Theft activity on record. This wallet has been linked to stealing attacks.";
    } else if (flag(gpResult.money_laundering) || flag(gpResult.financial_crime)) {
      verdict = "Financial crime indicators present. Exercise extreme caution.";
    } else if (activeFlags.length > 0) {
      verdict = "Suspicious activity detected. Investigate further before interacting.";
    } else if (txCount !== null && txCount < 5 && fundingSource.includes("Mixer")) {
      verdict = "Fresh wallet funded by a mixer. High probability of coordinated sybil or rug operation.";
    } else if (txCount !== null && txCount < 5) {
      verdict = "Low activity wallet. Insufficient history to confirm legitimacy — proceed with caution.";
    } else {
      verdict = "No malicious activity found. Wallet appears clean on Base Mainnet.";
    }

    // ── Build forensic report ─────────────────────────────────────────────────
    let msg = "";
    msg += `🔬 *APOL FORENSIC WALLET REPORT*\n\n`;
    msg += `👤 *Address:* \`${shortAddr(address)}\`\n`;
    msg += `⛓️ *Chain:* Base Mainnet\n`;
    msg += `🏷️ *Type:* ${isContract ? "Smart Contract" : "EOA (Wallet)"}\n`;
    msg += `🚨 *Status:* ${status}\n\n`;

    msg += `📅 *WALLET AGE*\n`;
    msg += `First Seen: ${firstSeenDate}\n`;
    msg += `Age: ${walletAge}\n\n`;

    msg += `💰 *FUNDING SOURCE*\n`;
    msg += `Genesis Funder: ${fundingSource}\n\n`;

    msg += `📊 *ACTIVITY LEVEL*\n`;
    msg += `Total Transactions: ${txTotal}\n`;
    msg += `Level: ${activityLevel}\n\n`;

    msg += `💼 *CURRENT BALANCE*\n`;
    msg += `ETH: ${ethBal}${usdBal}\n\n`;

    if (activeFlags.length > 0) {
      msg += `🚩 *THREAT FLAGS:*\n`;
      activeFlags.forEach(f => (msg += `  ${f}\n`));
      msg += `\n`;
    } else {
      msg += `✅ *No threat flags on record.*\n\n`;
    }

    msg += `🛡️ *VERDICT:* _${verdict}_`;

    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Wallet forensic error:", err?.message ?? err);
    return (
      `❌ *Forensic Report Failed*\n\n` +
      `Could not reach the intelligence database. Please try again in a moment.`
    );
  }
}

// ─── Agent Intelligence Scan ─────────────────────────────────────────────────

async function resolveAgentAddress(input: string): Promise<{ address: string; name: string; symbol: string } | null> {
  // If it's already a valid address, return it directly
  if (isEvmAddress(input)) {
    return { address: input, name: "", symbol: "" };
  }

  // Search DexScreener by name/ticker, pick best Base chain match by liquidity
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(input)}`,
      { signal: AbortSignal.timeout(10_000) }
    );
    const data = (await res.json()) as any;
    const pairs: any[] = data?.pairs ?? [];
    const base = pairs
      .filter((p: any) => p.chainId === "base")
      .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    if (!base[0]) return null;
    return {
      address: base[0].baseToken.address,
      name:    base[0].baseToken.name,
      symbol:  base[0].baseToken.symbol,
    };
  } catch {
    return null;
  }
}

async function buildAgentScan(input: string, siteUrl: string): Promise<string> {
  try {
    // ── Resolve address (accept name or CA) ───────────────────────────────────
    const resolved = await resolveAgentAddress(input);
    if (!resolved) {
      return (
        `⚠️ *AGENT NOT FOUND*\n\n` +
        `No agent matching _"${input}"_ found on Base Mainnet.\n` +
        `Try using the contract address directly.`
      );
    }
    const { address } = resolved;

    // ── Fetch GoPlus token security + DexScreener in parallel ─────────────────
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
    const dexData    = (await dexRes.json()) as any;

    const tKey  = Object.keys(goplusData?.result ?? {})[0];
    const token = tKey ? (goplusData.result[tKey] as any) : null;

    const allPairs: any[] = dexData?.pairs ?? [];
    const basePairs = allPairs
      .filter((p: any) => p.chainId === "base")
      .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const topPair = basePairs[0] ?? null;

    if (!token && !topPair) {
      return (
        `⚠️ *AGENT NOT FOUND*\n\n` +
        `Contract \`${address}\` not found on Base Mainnet.\n` +
        `Ensure the CA is correct.`
      );
    }

    // ── Identity ──────────────────────────────────────────────────────────────
    const agentName   = resolved.name   || token?.token_name   || topPair?.baseToken?.name   || "Unknown Agent";
    const agentSymbol = resolved.symbol || token?.token_symbol || topPair?.baseToken?.symbol || "?";

    // ── Market data ───────────────────────────────────────────────────────────
    const liqUsd     = topPair?.liquidity?.usd ?? null;
    const priceRaw   = parseFloat(topPair?.priceUsd ?? "0");
    const liqFmt     = liqUsd !== null ? fmtUsd(liqUsd) : "Data Pending";
    const priceFmt   = priceRaw > 0
      ? (priceRaw < 0.0001 ? `$${priceRaw.toExponential(3)}` : `$${priceRaw.toPrecision(5)}`)
      : "Data Pending";
    const holderRaw  = parseInt(token?.holder_count ?? "0");
    const holderFmt  = holderRaw > 0 ? holderRaw.toLocaleString() : "Data Pending";

    // Social links from DexScreener
    const website  = topPair?.info?.websites?.[0]?.url ?? null;
    const twitter  = topPair?.info?.socials?.find((s: any) => s.type === "twitter")?.url ?? null;
    const telegram = topPair?.info?.socials?.find((s: any) => s.type === "telegram")?.url ?? null;

    // ── Contract security flags ────────────────────────────────────────────────
    const isHoneypot      = token ? flag(token.is_honeypot)              : false;
    const isVerified      = token ? flag(token.is_open_source)           : false;
    const isMintable      = token ? flag(token.is_mintable)              : false;
    const hasBlacklist    = token ? flag(token.is_blacklist)             : false;
    const ownerRecovery   = token ? flag(token.can_take_back_ownership)  : false;
    const ownerBal        = token ? flag(token.owner_change_balance)     : false;
    const hasCooldown     = token ? flag(token.trading_cooldown)         : false;
    const antiWhale       = token ? flag(token.anti_whale_modifiable)    : false;
    const buyTax          = parseFloat(token?.buy_tax  ?? "0");
    const sellTax         = parseFloat(token?.sell_tax ?? "0");
    const highTax         = buyTax > 0.05 || sellTax > 0.05;

    // ── LP lock ───────────────────────────────────────────────────────────────
    const lpHolders: any[] = token?.lp_holders ?? [];
    const lpBurnedPct = lpHolders
      .filter(h => (h.tag ?? "").toLowerCase().includes("burn") ||
        (h.address ?? "").toLowerCase() === "0x000000000000000000000000000000000000dead")
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);
    const lpLockedPct = lpHolders
      .filter(h => flag(h.is_locked))
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);
    const lpSecure = lpBurnedPct >= 50 || lpLockedPct >= 50;

    // ── AI Threat Assessment ──────────────────────────────────────────────────
    // Prompt Injection Risk: can the agent's logic be covertly altered?
    let promptRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    let promptDetail: string;
    if (isHoneypot) {
      promptRisk = "CRITICAL"; promptDetail = "Honeypot trap detected — agent blocks all exits";
    } else if (!isVerified && (ownerRecovery || ownerBal)) {
      promptRisk = "HIGH"; promptDetail = "Unverified code + privileged owner — logic override possible";
    } else if (!isVerified) {
      promptRisk = "MEDIUM"; promptDetail = "Source not verified — hidden logic cannot be ruled out";
    } else if (ownerRecovery || ownerBal) {
      promptRisk = "MEDIUM"; promptDetail = "Owner can alter contract state after deployment";
    } else {
      promptRisk = "LOW"; promptDetail = "No hidden logic or owner override detected";
    }

    // Data Exfiltration Risk: can the agent drain funds or trap users?
    let exfilRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    let exfilDetail: string;
    if (isHoneypot) {
      exfilRisk = "CRITICAL"; exfilDetail = "Funds sent in cannot be withdrawn — active drain mechanism";
    } else if (isMintable && !lpSecure) {
      exfilRisk = "HIGH"; exfilDetail = "Unlimited mint + unlocked liquidity enables coordinated rug";
    } else if (hasBlacklist && highTax) {
      exfilRisk = "HIGH"; exfilDetail = "Blacklist + elevated tax — users can be trapped and drained";
    } else if (!lpSecure && token) {
      exfilRisk = "MEDIUM"; exfilDetail = "Liquidity not locked — operator can pull pool at any time";
    } else if (isMintable || hasBlacklist) {
      exfilRisk = "MEDIUM"; exfilDetail = "Elevated operator privileges present";
    } else {
      exfilRisk = "LOW"; exfilDetail = "No fund drain mechanisms detected";
    }

    // ── Final verdict ─────────────────────────────────────────────────────────
    const criticalCount  = [promptRisk, exfilRisk].filter(r => r === "CRITICAL").length;
    const highCount      = [promptRisk, exfilRisk].filter(r => r === "HIGH").length;
    const noContract     = !token;
    const tinyLiquidity  = liqUsd !== null && liqUsd < 5_000;

    let verdict: string;
    let verdictLine: string;

    if (isHoneypot || criticalCount >= 1) {
      verdict = "⛔ LARP / THREAT";
      verdictLine = isHoneypot
        ? "Honeypot confirmed. This agent is a financial trap."
        : "Critical backdoor risk. Do not interact with this agent.";
    } else if (highCount >= 1 || (tinyLiquidity && noContract)) {
      verdict = "⛔ LARP / THREAT";
      verdictLine = tinyLiquidity && noContract
        ? "No contract data and negligible liquidity. Likely a LARP operation."
        : "High-severity attack vectors detected. This agent fails the APE POLICE audit.";
    } else if (promptRisk === "MEDIUM" || exfilRisk === "MEDIUM" || !isVerified) {
      verdict = "⚠️ CAUTION ADVISED";
      verdictLine = "Moderate risks present. Not certified — due diligence required before interaction.";
    } else if (!token) {
      verdict = "⚠️ CAUTION ADVISED";
      verdictLine = "Insufficient contract data to certify. Verify the CA and try again.";
    } else {
      verdict = "✅ CERTIFIED UNIT";
      verdictLine = "Contract is clean, source verified, and no backdoors detected. Agent passes APE POLICE audit.";
    }

    const riskEmoji = (r: string) =>
      r === "CRITICAL" ? "🔴 CRITICAL" :
      r === "HIGH"     ? "🔴 HIGH"     :
      r === "MEDIUM"   ? "🟡 MEDIUM"   : "🟢 LOW";

    const verifiedFmt   = token ? (isVerified ? "Verified ✅" : "Unverified ⚠️") : "Data Pending";
    const mintFmt       = token ? (isMintable ? "Active ⚠️"   : "Disabled ✅")   : "Data Pending";
    const ownerFmt      = token
      ? (ownerRecovery || ownerBal ? "Privileged ⚠️" : "Renounced / Safe ✅")
      : "Data Pending";
    const taxFmt        = token
      ? `Buy ${pct(token.buy_tax)} / Sell ${pct(token.sell_tax)}`
      : "Data Pending";

    // ── Build message ─────────────────────────────────────────────────────────
    let msg = "";
    msg += `🤖 *APOL — AGENT INTELLIGENCE SCAN*\n\n`;
    msg += `🏷️ *Agent:* ${agentName} ($${agentSymbol})\n`;
    msg += `📍 *Contract:* \`${shortAddr(address)}\`\n`;
    msg += `⛓️ *Chain:* Base Mainnet\n\n`;

    msg += `🔬 *AGENT CONTRACT ANALYSIS*\n`;
    msg += `Source Code: ${verifiedFmt}\n`;
    msg += `Mint Authority: ${mintFmt}\n`;
    msg += `Owner Controls: ${ownerFmt}\n`;
    msg += `Tax: ${taxFmt}\n\n`;

    msg += `🧠 *AI THREAT ASSESSMENT*\n`;
    msg += `Prompt Injection Risk: ${riskEmoji(promptRisk)}\n`;
    msg += `_${promptDetail}_\n\n`;
    msg += `Data Exfiltration Risk: ${riskEmoji(exfilRisk)}\n`;
    msg += `_${exfilDetail}_\n\n`;

    msg += `💧 *MARKET INTEL*\n`;
    msg += `Liquidity: ${liqFmt}\n`;
    msg += `Price: ${priceFmt}\n`;
    msg += `Holders: ${holderFmt}\n`;

    if (website || twitter || telegram) {
      msg += `\n🔗 *SOCIALS*\n`;
      if (website)  msg += `Web: ${website}\n`;
      if (twitter)  msg += `Twitter: ${twitter}\n`;
      if (telegram) msg += `Telegram: ${telegram}\n`;
    }

    msg += `\n*VERDICT: ${verdict}*\n`;
    msg += `_${verdictLine}_\n\n`;
    msg += `🔍 [Full Deep Dive](${siteUrl}/agent-scanner)`;

    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Agent scan error:", err?.message ?? err);
    return `❌ *Agent Scan Failed*\n\nCould not reach the intelligence database. Please try again in a moment.`;
  }
}

// ─── Social Forensics ────────────────────────────────────────────────────────

const RAPIDAPI_HOST = "twitter-api45.p.rapidapi.com";

function parseXUsername(input: string): string {
  let u = input.trim();
  // Strip leading @ if present
  u = u.replace(/^@/, "");
  // Strip full URL: https://twitter.com/username or https://x.com/username
  u = u.replace(/^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\//, "");
  // Strip trailing path and query
  u = u.split("/")[0].split("?")[0].split(" ")[0];
  return u;
}

async function buildSocialScan(input: string, siteUrl: string): Promise<string> {
  try {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

    if (!RAPIDAPI_KEY) {
      return (
        `🐦 *APOL X INVESTIGATION — OFFLINE*\n\n` +
        `The social forensics module is not yet configured.\n` +
        `Admin must add the \`RAPIDAPI_KEY\` secret to enable /scanx.\n\n` +
        `_Subscribe free at rapidapi.com → search "Twitter API v2" (twitter-api45)_`
      );
    }

    const username = parseXUsername(input);
    if (!username || username.length < 1 || username.length > 50) {
      return (
        `⚠️ *Invalid Username*\n\n` +
        `Usage: /scanx @username or /scanx https://x.com/username`
      );
    }

    const headers = {
      "x-rapidapi-key":  RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    };

    // ── Fetch profile + timeline in parallel ──────────────────────────────────
    const [userRes, timelineRes] = await Promise.all([
      fetch(
        `https://${RAPIDAPI_HOST}/user.php?screenname=${encodeURIComponent(username)}`,
        { headers, signal: AbortSignal.timeout(12_000) }
      ),
      fetch(
        `https://${RAPIDAPI_HOST}/timeline.php?screenname=${encodeURIComponent(username)}`,
        { headers, signal: AbortSignal.timeout(12_000) }
      ),
    ]);

    const user:     any = await userRes.json();
    const timeline: any = await timelineRes.json();

    if (user?.error || user?.status === "error" || (!user?.name && !user?.followers_count)) {
      return (
        `⚠️ *Account Not Found*\n\n` +
        `No X profile found for _"${username}"_.\n` +
        `Ensure the handle is correct and the account is public.`
      );
    }

    // ── Parse profile ─────────────────────────────────────────────────────────
    const displayName  = user.name            ?? username;
    const followers    = parseInt(user.followers_count ?? "0");
    const following    = parseInt(user.friends_count   ?? "0");
    const isVerified   = !!(user.verified || user.is_blue_verified || user.ext_is_blue_verified);
    const totalTweets  = parseInt(user.statuses_count  ?? "0");
    const bio          = user.description ?? "";

    // Account age
    let joinedDate = "Unknown";
    let ageDays    = 0;
    if (user.created_at) {
      const createdAt = new Date(user.created_at);
      if (!isNaN(createdAt.getTime())) {
        joinedDate = createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        ageDays    = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
      }
    }

    // ── Engagement analysis (last 5 tweets) ───────────────────────────────────
    const tweets: any[] = Array.isArray(timeline?.timeline)
      ? timeline.timeline.slice(0, 5)
      : [];

    const avgLikes    = tweets.length > 0
      ? Math.round(tweets.reduce((s, t) => s + (parseInt(t.favorite_count  ?? "0")), 0) / tweets.length)
      : 0;
    const avgRetweets = tweets.length > 0
      ? Math.round(tweets.reduce((s, t) => s + (parseInt(t.retweet_count ?? "0")), 0) / tweets.length)
      : 0;

    const followRatio     = following > 0 ? (followers / following).toFixed(2) : "∞";
    const engagementPct   = followers > 0
      ? ((avgLikes + avgRetweets) / followers * 100)
      : 0;

    // ── Risk flags ────────────────────────────────────────────────────────────
    const flags: string[] = [];

    if (ageDays > 0 && ageDays < 30) {
      flags.push("⛔ HIGH RISK FRESH ACCOUNT — Profile less than 30 days old");
    } else if (ageDays > 0 && ageDays < 90) {
      flags.push("⚠️ New account — less than 90 days old");
    }

    if (followers > 10_000 && tweets.length > 0 && avgLikes < 10) {
      flags.push("⛔ BOTTED FOLLOWERS — 10K+ followers but avg < 10 likes");
    }

    if (following > followers * 3 && followers < 2_000) {
      flags.push("⚠️ Follow-back pattern — following far exceeds followers");
    }

    if (totalTweets < 5 && followers > 500) {
      flags.push("⚠️ Ghost account — very few posts for follower count");
    }

    if (engagementPct > 20 && followers > 500) {
      flags.push("⚠️ Unusually high engagement — verify authenticity");
    }

    // ── Engagement rating ─────────────────────────────────────────────────────
    let engagementRating: string;
    if (tweets.length === 0) {
      engagementRating = "Data Pending";
    } else if (engagementPct >= 2.0) {
      engagementRating = `High ✅ (avg ${avgLikes}❤️ / ${avgRetweets}🔁)`;
    } else if (engagementPct >= 0.3) {
      engagementRating = `Average (avg ${avgLikes}❤️ / ${avgRetweets}🔁)`;
    } else {
      engagementRating = `Low ⚠️ (avg ${avgLikes}❤️ / ${avgRetweets}🔁)`;
    }

    // ── Verdict ───────────────────────────────────────────────────────────────
    const critFlags = flags.filter(f => f.startsWith("⛔")).length;
    const warnFlags = flags.filter(f => f.startsWith("⚠️")).length;

    let verdict: string;
    if (critFlags >= 1) {
      verdict = "⛔ WARNING: BOT ACTIVITY DETECTED";
    } else if (warnFlags >= 2) {
      verdict = "⚠️ CAUTION: Multiple Suspicious Patterns";
    } else if (warnFlags === 1) {
      verdict = "⚠️ CAUTION: Suspicious Patterns Detected";
    } else if (ageDays > 365 && followers > 1_000 && engagementPct >= 0.3) {
      verdict = "✅ Likely Authentic";
    } else if (ageDays < 180 || followers < 100) {
      verdict = "⚠️ Inconclusive — Insufficient History";
    } else {
      verdict = "✅ No Red Flags Detected";
    }

    // ── Linked CA from DexScreener ────────────────────────────────────────────
    let linkedCA = "Not Found";
    try {
      const dexSearch: any = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(username)}`,
        { signal: AbortSignal.timeout(8_000) }
      ).then(r => r.json());

      const basePairs: any[] = (dexSearch?.pairs ?? []).filter((p: any) => p.chainId === "base");
      const match = basePairs.find((p: any) =>
        (p.info?.socials ?? []).some((s: any) =>
          s.type === "twitter" && s.url.toLowerCase().includes(username.toLowerCase())
        )
      );
      if (match) {
        linkedCA = `${match.baseToken.symbol} — \`${match.baseToken.address}\``;
      }
    } catch { /* non-fatal */ }

    // ── Build message ─────────────────────────────────────────────────────────
    let msg = "";
    msg += `🐦 *X INVESTIGATION: @${username}*\n\n`;
    msg += `👤 *Name:* ${displayName}\n`;
    if (bio) msg += `📝 *Bio:* _${bio.replace(/\n/g, " ").slice(0, 120)}_\n`;
    msg += `📅 *Joined:* ${joinedDate} (${ageDays} days ago)\n`;
    msg += `✅ *Blue Check:* ${isVerified ? "Verified ✅" : "Not Verified"}\n\n`;

    msg += `👥 *Followers:* ${followers.toLocaleString()}\n`;
    msg += `➡️ *Following:* ${following.toLocaleString()}\n`;
    msg += `📊 *Follow Ratio:* ${followRatio}:1\n`;
    msg += `📈 *Engagement:* ${engagementRating}\n\n`;

    if (flags.length > 0) {
      msg += `🚨 *RISK FLAGS:*\n`;
      flags.forEach(f => (msg += `  ${f}\n`));
      msg += "\n";
    } else {
      msg += `✅ *No risk flags detected.*\n\n`;
    }

    msg += `⛓️ *Linked CA:* ${linkedCA}\n\n`;
    msg += `🚨 *Social Verdict:* _${verdict}_\n\n`;
    msg += `🔍 [Full Report](${siteUrl}/agent-scanner)`;

    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Social scan error:", err?.message ?? err);
    return `❌ *Social Scan Failed*\n\nCould not reach the X intelligence feed. Please try again in a moment.`;
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
      `🐦 /scanx [username] — X/Twitter social forensics\n` +
      `🤖 /scanagent [name or CA] — AI agent audit\n` +
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
      `🐦 /scanx [@username] — X/Twitter social forensics & LARP detection\n` +
      `🤖 /scanagent [name or CA] — AI agent intelligence audit (AgentGuard)\n` +
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

  // ── /scanagent ────────────────────────────────────────────────────────────
  bot.command("scanagent", async ctx => {
    const parts = (ctx.message.text ?? "").trim().split(/\s+/);
    const input = parts.slice(1).join(" ").trim();

    if (!input) {
      return ctx.replyWithMarkdown(
        `❓ *Usage:* /scanagent [Agent Name or CA]\n\n` +
        `Examples:\n` +
        `\`/scanagent AIXBT\`\n` +
        `\`/scanagent 0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825\`\n\n` +
        `_Scans the AI agent's contract for Prompt Injection & Data Exfiltration risks._`
      );
    }

    let loadingMsgId: number | null = null;
    try {
      const loading = await ctx.replyWithMarkdown(
        `🤖 *Scanning agent:* _${input}_\n_Running APOL AgentGuard intelligence..._`
      );
      loadingMsgId = loading.message_id;
    } catch { /* non-fatal */ }

    const report = await buildAgentScan(input, site);

    if (loadingMsgId !== null) {
      try { await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsgId); } catch { /* non-fatal */ }
    }

    return ctx.replyWithMarkdown(report, { disable_web_page_preview: true });
  });

  // ── /scanx ────────────────────────────────────────────────────────────────
  bot.command("scanx", async ctx => {
    const parts = (ctx.message.text ?? "").trim().split(/\s+/);
    const input = parts.slice(1).join(" ").trim();

    if (!input) {
      return ctx.replyWithMarkdown(
        `❓ *Usage:* /scanx [@username or profile link]\n\n` +
        `Examples:\n` +
        `\`/scanx @VitalikButerin\`\n` +
        `\`/scanx https://x.com/apol_base\`\n\n` +
        `_Runs a social forensics investigation: account age, follower quality, engagement, LARP detection._`
      );
    }

    let loadingMsgId: number | null = null;
    try {
      const preview = parseXUsername(input);
      const loading = await ctx.replyWithMarkdown(
        `🐦 *Investigating @${preview}*\n_Running APOL social forensics..._`
      );
      loadingMsgId = loading.message_id;
    } catch { /* non-fatal */ }

    const report = await buildSocialScan(input, site);

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
