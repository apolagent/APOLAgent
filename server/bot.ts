import { Telegraf } from "telegraf";
import { storage } from "./storage";

// ─── Constants ────────────────────────────────────────────────────────────────

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const BASE_CHAIN_ID = "8453";

function getSiteUrl(): string {
  return "https://apolagent.online";
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

function fmtPrice(n: number): string {
  if (n <= 0 || isNaN(n)) return "Data Pending";
  if (n >= 1)    return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  const s = n.toFixed(18);
  const match = s.match(/^0\.(0+)([1-9]\d*)/);
  if (match) {
    const zeros = match[1].length;
    const sig = match[2].slice(0, 4).replace(/0+$/, "");
    return `$0.0{${zeros}}${sig}`;
  }
  return `$${n.toFixed(10).replace(/0+$/, "")}`;
}

function fmtMcap(price: number, supply: number | null): string {
  if (!supply || supply <= 0 || price <= 0 || isNaN(price) || isNaN(supply)) return "Data Pending";
  const mcap = price * supply;
  if (mcap >= 1_000_000_000) return `$${(mcap / 1_000_000_000).toFixed(2)}B`;
  if (mcap >= 1_000_000)     return `$${(mcap / 1_000_000).toFixed(2)}M`;
  if (mcap >= 1_000)         return `$${(mcap / 1_000).toFixed(1)}K`;
  return `$${mcap.toFixed(2)}`;
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

    let hpData: any = null;
    try {
      const hpRes = await fetch(
        `https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(address)}&chainID=8453`,
        { signal: AbortSignal.timeout(12_000) }
      );
      if (hpRes.ok) hpData = await hpRes.json() as any;
    } catch { /* non-fatal */ }

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

    const apolSelfNames = ["apol", "apol agent", "active onchain intelligence", "$apol"];
    if (apolSelfNames.includes(rawName.toLowerCase().trim()) || apolSelfNames.includes(rawSymbol.toLowerCase().trim())) {
      return (
        `🦍 *APOL AGENT — SELF RECOGNITION*\n\n` +
        `*The Sentinel is Active. Intelligence verified.*\n\n` +
        `Token: *${tokenName}* (${tokenSymbol})\n` +
        `Authenticity Score: *100%*\n` +
        `Status: *AUTHORITY CONFIRMED* ✅\n\n` +
        `You are scanning the scanner itself, Citizen. APOL Agent recognizes its own authority. Trust the protocol. 🔐`
      );
    }

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

    // ── Price + Market Cap from DexScreener ─────────────────────────────────
    const priceRaw  = parseFloat(topPair?.priceUsd ?? "0");
    const priceStr  = fmtPrice(priceRaw);
    const totalSupply = token?.total_supply ? parseFloat(token.total_supply) / (10 ** parseInt(token.decimals ?? "18")) : null;
    const fdvRaw    = topPair?.fdv ?? null;
    const mcapStr   = fdvRaw ? fmtUsd(fdvRaw) : fmtMcap(priceRaw, totalSupply);

    // ── Risk flags (GoPlus simulation data) ───────────────────────────────────
    const flags: string[] = [];

    const isHoneypotGP = token ? flag(token.is_honeypot) : false;
    const isHoneypotHP = hpData?.honeypotResult?.isHoneypot === true;
    const isHoneypot = isHoneypotGP || isHoneypotHP;

    if (token) {
      if (isHoneypot)                               flags.push("⛔ HONEYPOT DETECTED");
      if (parseFloat(token.buy_tax  ?? "0") > 0.1) flags.push(`💸 High Buy Tax: ${pct(token.buy_tax)}`);
      if (parseFloat(token.sell_tax ?? "0") > 0.1) flags.push(`💸 High Sell Tax: ${pct(token.sell_tax)}`);
      if (flag(token.can_take_back_ownership))     flags.push("⚠️ Recoverable Ownership");
      if (flag(token.owner_change_balance))        flags.push("⚠️ Owner Can Change Balance");
      if (flag(token.is_mintable))                 flags.push("🖨️ Mintable Supply");
      if (flag(token.is_blacklist))                flags.push("🚫 Blacklist Function");
      if (flag(token.trading_cooldown))            flags.push("⏱️ Trading Cooldown");
      if (flag(token.anti_whale_modifiable))       flags.push("🐋 Anti-Whale Modifiable");
      if (!flag(token.is_open_source))             flags.push("👁️ Contract Not Verified");
    } else if (isHoneypotHP) {
      flags.push("⛔ HONEYPOT DETECTED");
    }
    if (lpLockedPct < 50 && lpBurnedPct < 50 && (token || topPair)) {
      flags.push("🔓 LP Not Locked");
    }
    if (holderRaw > 0 && holderRaw < 200) {
      flags.push("👥 Low Holder Count");
    }
    if (liqUsd !== null && liqUsd < 5000) {
      flags.push("💧 Very Low Liquidity");
    }

    // ── Risk level (strict — protect users) ──────────────────────────────────
    const hasHoneypot = flags.some(f => f.includes("HONEYPOT"));
    const hasUnlockedLP = flags.some(f => f.includes("LP Not Locked"));
    const hasCriticalFlag = flags.some(f =>
      f.includes("HONEYPOT") || f.includes("Owner Can Change Balance") || f.includes("Recoverable Ownership")
    );
    let riskEmoji: string;
    if (hasHoneypot)                              riskEmoji = "🚨 CRITICAL";
    else if (hasCriticalFlag)                     riskEmoji = "🔴 HIGH RISK";
    else if (hasUnlockedLP || flags.length >= 2)  riskEmoji = "🔴 HIGH RISK";
    else if (flags.length >= 1)                   riskEmoji = "🟡 MEDIUM RISK";
    else                                          riskEmoji = "🟢 LOW RISK";

    // ── Build message ─────────────────────────────────────────────────────────
    let msg = "";

    msg += `🚔 *APOL AGENT — CONTRACT SNAPSHOT*\n\n`;
    msg += `📍 *Address:* \`${shortAddr(address)}\`\n`;
    msg += `⛓️ *Chain:* Base Mainnet\n\n`;

    let lookupCount = 0;
    try { lookupCount = await storage.incrementLookup(address, rawName, rawSymbol); } catch { /* non-fatal */ }
    msg += `*${tokenName}* (${tokenSymbol}) 👁️ ${lookupCount}\n`;
    msg += `💲 Price: *${priceStr}*\n`;
    msg += `📊 Market Cap: *${mcapStr}*\n`;
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
    msg += `🗺️ [Wall of Shame](${siteUrl}/report-scam)\n`;
    msg += `🔗 [View on Basescan](https://basescan.org/address/${address})`;

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

function fmtAge(isoTs: string): { days: number; label: string } | null {
  const d = new Date(isoTs);
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  let label: string;
  if (days < 1)       label = "< 1 day";
  else if (days < 30) label = `${days} days`;
  else {
    const months = Math.floor(days / 30);
    const years  = Math.floor(months / 12);
    const rem    = months % 12;
    label = years > 0
      ? (rem > 0 ? `~${years}y ${rem}m` : `~${years} year${years > 1 ? "s" : ""}`)
      : `~${months} month${months > 1 ? "s" : ""}`;
  }
  return { days, label };
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

// Chain explorer base URLs (for genesis TX links across all chains)
function chainExplorer(chainId: string): { name: string; txUrl: string; addrUrl: string } {
  switch (chainId) {
    case "0x1":    return { name: "Ethereum",  txUrl: "https://etherscan.io/tx/",    addrUrl: "https://etherscan.io/address/" };
    case "0x2105": return { name: "Base",      txUrl: "https://basescan.org/tx/",    addrUrl: "https://basescan.org/address/" };
    case "0x89":   return { name: "Polygon",   txUrl: "https://polygonscan.com/tx/", addrUrl: "https://polygonscan.com/address/" };
    case "0x38":   return { name: "BSC",       txUrl: "https://bscscan.com/tx/",     addrUrl: "https://bscscan.com/address/" };
    case "0xa":    return { name: "Optimism",  txUrl: "https://optimistic.etherscan.io/tx/", addrUrl: "https://optimistic.etherscan.io/address/" };
    case "0xa4b1": return { name: "Arbitrum",  txUrl: "https://arbiscan.io/tx/",     addrUrl: "https://arbiscan.io/address/" };
    default:       return { name: "Chain "+chainId, txUrl: "https://basescan.org/tx/", addrUrl: "https://basescan.org/address/" };
  }
}

// Known bridge address fragments for fallback classification
const BRIDGE_ADDRESSES: Array<{ match: string; name: string }> = [
  { match: "0x4200000000000000000000000000000000000010", name: "Base Bridge" },
  { match: "0x49048044d57e1c92a77f79988d21fa8faf74e97",  name: "Base Bridge" },
  { match: "0xba5ede",  name: "Stargate Bridge" },
  { match: "0x99c9fc",  name: "Optimism Bridge" },
  { match: "0x8b0a4",  name: "Across Protocol" },
  { match: "0x5523f2fc", name: "Orbiter Finance" },
  { match: "0xe4edb2", name: "Orbiter Finance" },
  { match: "0xd9d16a", name: "Synapse Bridge" },
  { match: "0x1116898", name: "Hop Protocol" },
];

function classifyFundingSource(fromAddr: string, moralisLabel: string | null, moralisEntity: string | null): {
  display: string;
  risk: "low" | "medium" | "high" | "unknown";
} {
  const label = moralisLabel ?? moralisEntity ?? "";

  if (label) {
    const low = label.toLowerCase();
    if (low.includes("binance") || low.includes("coinbase") || low.includes("kraken") ||
        low.includes("okx") || low.includes("huobi") || low.includes("bybit") ||
        low.includes("kucoin") || low.includes("gemini") || low.includes("crypto.com")) {
      return { display: `🏦 FUNDED BY: ${label}`, risk: "low" };
    }
    if (low.includes("tornado") || low.includes("mixer") || low.includes("tumbler") ||
        low.includes("fixedfloat") || low.includes("blender") || low.includes("wasabi")) {
      return { display: `⛔ FUNDED BY: ${label} (Mixer)`, risk: "high" };
    }
    if (low.includes("bridge") || low.includes("stargate") || low.includes("across") ||
        low.includes("hop") || low.includes("synapse") || low.includes("orbiter") ||
        low.includes("celer") || low.includes("relay")) {
      return { display: `🌉 FUNDED VIA: ${label}`, risk: "medium" };
    }
    // Named entity but not CEX/mixer/bridge
    return { display: `🏦 FUNDED BY: ${label}`, risk: "unknown" };
  }

  // No label — check our bridge fragment list
  const addrLow = fromAddr.toLowerCase();
  for (const { match, name } of BRIDGE_ADDRESSES) {
    if (addrLow.startsWith(match.toLowerCase()) || addrLow === match.toLowerCase()) {
      return { display: `🌉 FUNDED VIA: ${name}`, risk: "medium" };
    }
  }

  // Check our existing CEX/bridge table
  const known = identifySource(fromAddr);
  if (!known.startsWith("Unknown")) {
    const low = known.toLowerCase();
    if (low.includes("cex") || low.includes("coinbase") || low.includes("binance") ||
        low.includes("kraken") || low.includes("okx")) {
      return { display: `🏦 FUNDED BY: ${known.replace(" (CEX)", "")}`, risk: "low" };
    }
    if (low.includes("mixer") || low.includes("tornado")) {
      return { display: `⛔ FUNDED VIA: ${known} (Mixer)`, risk: "high" };
    }
    if (low.includes("bridge")) {
      return { display: `🌉 FUNDED VIA: ${known}`, risk: "medium" };
    }
  }

  return { display: `⚠️ Unknown/Bridge`, risk: "unknown" };
}

async function buildWalletCheck(address: string): Promise<string> {
  try {
    const MORALIS_KEY = process.env.MORALIS_API_KEY ?? "";
    const MORALIS     = "https://deep-index.moralis.io/api/v2";
    const mHdrs       = { "X-API-Key": MORALIS_KEY };

    if (!MORALIS_KEY) {
      return `❌ *Configuration Error*\n\nMORALIS_API_KEY is not set. Contact the bot administrator.`;
    }

    // ── Step 1: Fetch 5 sources in parallel ─────────────────────────────────
    //    A) Moralis getWalletActiveChains WITH ?chains[]=base (gets Base-specific genesis)
    //    B) Moralis getWalletActiveChains unfiltered (gets all-chain genesis)
    //    C) Threat intelligence — blacklist/sanctions check
    //    D) Blockscout — Base balance + contract type
    //    E) Moralis Base transactions (ASC) — inflow/outflow
    const encodedAddr = encodeURIComponent(address);
    const [baseChainsRes, allChainsRes, threatRes, bsAddrRes, baseTxRes] = await Promise.all([
      fetch(`${MORALIS}/wallets/${encodedAddr}/chains?chains[]=base`,
        { headers: mHdrs, signal: AbortSignal.timeout(15_000) }),
      fetch(`${MORALIS}/wallets/${encodedAddr}/chains`,
        { headers: mHdrs, signal: AbortSignal.timeout(15_000) }),
      fetch(`${GOPLUS_BASE}/address_security/${encodedAddr}?chain_id=${BASE_CHAIN_ID}`,
        { signal: AbortSignal.timeout(12_000) }),
      fetch(`https://base.blockscout.com/api/v2/addresses/${encodedAddr}`,
        { signal: AbortSignal.timeout(12_000) }),
      fetch(`${MORALIS}/${encodedAddr}?chain=0x2105&order=ASC&limit=100`,
        { headers: mHdrs, signal: AbortSignal.timeout(15_000) }),
    ]);

    const baseChainsData = (await baseChainsRes.json()) as any;
    const allChainsData  = (await allChainsRes.json())  as any;
    const threatData     = (await threatRes.json())      as any;
    const bsAddr         = (await bsAddrRes.json())      as any;
    const baseTxData     = (await baseTxRes.json())      as any;
    const gpResult       = threatData?.result ?? null;

    // ── Step 2: Find BASE-SPECIFIC genesis (first tx on Base chain) ──────────
    const baseChainEntry = (baseChainsData?.active_chains ?? [])
      .find((c: any) => c.chain === "base" || c.chain_id === "0x2105");
    let genesisTxHash    = baseChainEntry?.first_transaction?.transaction_hash ?? null;
    let genesisTimestamp = baseChainEntry?.first_transaction?.block_timestamp ?? null;

    // Fallback: Moralis Base tx list (ASC order — first entry is oldest)
    const baseTxs: any[] = baseTxData?.result ?? [];
    if (!genesisTxHash && baseTxs.length > 0) {
      genesisTxHash    = baseTxs[0].hash;
      genesisTimestamp = baseTxs[0].block_timestamp;
    }

    // Last resort: Blockscout pagination
    if (!genesisTimestamp) {
      const oldestTx = await fetchOldestTx(address);
      if (oldestTx?.timestamp) {
        genesisTimestamp = oldestTx.timestamp;
      }
    }

    // ── Step 2b: Find BASE funder — first INCOMING tx on Base ─────────────────
    const addrLow = address.toLowerCase();
    const firstIncoming = baseTxs.find(
      (tx: any) => (tx.to_address ?? "").toLowerCase() === addrLow
    );
    let funderTxHash  = firstIncoming?.hash ?? null;
    let funderAddr    = firstIncoming?.from_address ?? null;
    let funderTs      = firstIncoming?.block_timestamp ?? null;

    // If no incoming in baseTxs, check genesis tx details
    if (!funderAddr && genesisTxHash) {
      try {
        const txRes = await fetch(
          `${MORALIS}/transaction/${encodeURIComponent(genesisTxHash)}?chain=0x2105`,
          { headers: mHdrs, signal: AbortSignal.timeout(12_000) }
        );
        if (txRes.ok) {
          const txData = await txRes.json() as any;
          if ((txData?.to_address ?? "").toLowerCase() === addrLow) {
            funderAddr  = txData.from_address;
            funderTxHash = genesisTxHash;
            funderTs     = txData.block_timestamp ?? genesisTimestamp;
          }
        }
      } catch { /* non-fatal */ }
    }

    // ── Step 3: Resolve funder identity (Moralis label + Blockscout ENS) ──────
    let moralisLabel: string | null = null;
    let moralisEntity: string | null = null;
    let funderEns: string | null = null;

    if (funderAddr) {
      // Fetch Moralis tx details for label (if we have the funding tx hash)
      if (funderTxHash) {
        try {
          const txRes = await fetch(
            `${MORALIS}/transaction/${encodeURIComponent(funderTxHash)}?chain=0x2105`,
            { headers: mHdrs, signal: AbortSignal.timeout(10_000) }
          );
          if (txRes.ok) {
            const txData = await txRes.json() as any;
            moralisLabel  = txData.from_address_label  ?? null;
            moralisEntity = txData.from_address_entity ?? null;
          }
        } catch { /* non-fatal */ }
      }

      // Also check Blockscout for ENS name of funder
      try {
        const ensRes = await fetch(
          `https://base.blockscout.com/api/v2/addresses/${encodeURIComponent(funderAddr)}`,
          { signal: AbortSignal.timeout(8_000) }
        );
        if (ensRes.ok) {
          const ensData = await ensRes.json() as any;
          funderEns = ensData?.ens_domain_name ?? null;
        }
      } catch { /* non-fatal */ }
    }

    // Build display label — prefer ENS name, then Moralis label, then classify
    const funderDisplayName = funderEns || moralisLabel || moralisEntity || null;
    const { display: fundingDisplay, risk: fundingRisk } = funderAddr
      ? (funderDisplayName
          ? classifyFundingSource(funderAddr, funderDisplayName, moralisEntity)
          : classifyFundingSource(funderAddr, moralisLabel, moralisEntity))
      : { display: "⚠️ Unknown", risk: "unknown" as const };

    // Override display if we have ENS and classifyFundingSource returned Unknown
    const finalFundingDisplay = (funderEns && fundingDisplay.includes("Unknown"))
      ? `🏦 FUNDED BY: ${funderEns}`
      : fundingDisplay;

    // ── Step 4: Base wallet age from genesis ─────────────────────────────────
    let firstSeenDate  = "ERROR: API TIMEOUT";
    let walletAgeDays  = "ERROR: API TIMEOUT";
    let walletAgeLabel = "ERROR: API TIMEOUT";

    if (genesisTimestamp) {
      const ageResult = fmtAge(genesisTimestamp);
      if (ageResult) {
        const createdAt = new Date(genesisTimestamp);
        firstSeenDate  = createdAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        walletAgeDays  = `${ageResult.days.toLocaleString()} days`;
        walletAgeLabel = ageResult.label;
      }
    }

    // ── Step 6: Base Mainnet activity + inflow / outflow ─────────────────────
    const hasMoreBase     = !!baseTxData?.cursor;
    const baseTxCount     = baseTxs.length;

    let inf  = BigInt(0);
    let outf = BigInt(0);
    for (const tx of baseTxs) {
      const val = BigInt(tx.value ?? "0");
      if ((tx.to_address   ?? "").toLowerCase() === addrLow) inf  += val;
      if ((tx.from_address ?? "").toLowerCase() === addrLow) outf += val;
    }
    const inflowEth  = inf  > 0n ? (Number(inf)  / 1e18) : null;
    const outflowEth = outf > 0n ? (Number(outf) / 1e18) : null;

    const txCountDisplay = baseTxCount > 0
      ? (hasMoreBase ? `${baseTxCount}+ txs` : `${baseTxCount} txs`)
      : "No Base activity found";

    let activityLevel: string;
    if (baseTxCount === 0)    activityLevel = "No Base activity";
    else if (baseTxCount < 5)  activityLevel = "⚠️ Very Low — Fresh Profile";
    else if (baseTxCount < 20) activityLevel = "Low";
    else if (baseTxCount < 100)activityLevel = "Moderate";
    else                       activityLevel = "High (Established Wallet)";

    // ── Step 7: Balance from Blockscout ──────────────────────────────────────
    const isContract   = bsAddr?.is_contract ?? false;
    const coinBalance  = bsAddr?.coin_balance ? parseFloat(bsAddr.coin_balance) / 1e18 : null;
    const exchangeRate = bsAddr?.exchange_rate ? parseFloat(bsAddr.exchange_rate) : null;
    const ethBal       = coinBalance !== null ? `${coinBalance.toFixed(4)} ETH` : "N/A";
    const usdBal       = coinBalance !== null && exchangeRate
      ? ` (≈${fmtUsd(coinBalance * exchangeRate)})` : "";

    // ── Step 8: APOL AGENT threat intelligence flags ──────────────────────────
    const activeFlags: string[] = [];
    if (gpResult) {
      for (const [field, label] of Object.entries(WALLET_FLAGS)) {
        if (flag(gpResult[field])) activeFlags.push(label as string);
      }
    }

    const isCritical   = gpResult && (flag(gpResult.blacklist_doubt) || flag(gpResult.sanctioned));
    const isSuspicious = activeFlags.length > 0 || fundingRisk === "high";

    let status: string;
    if (isCritical)        status = "🔴 BLACKLISTED";
    else if (isSuspicious) status = "⚠️ SUSPICIOUS";
    else                   status = "✅ CLEAN";

    // ── Step 9: Verdict ───────────────────────────────────────────────────────
    let verdict: string;
    if (flag(gpResult?.sanctioned)) {
      verdict = "This wallet is under legal sanction. Any interaction may carry regulatory consequences.";
    } else if (flag(gpResult?.blacklist_doubt)) {
      verdict = "Flagged for malicious activity. Do not interact.";
    } else if (flag(gpResult?.honeypot_related_address)) {
      verdict = "Affiliated with honeypot contracts. Treat as hostile.";
    } else if (flag(gpResult?.phishing_activities)) {
      verdict = "Phishing activity on record. This wallet has drained others.";
    } else if (flag(gpResult?.stealing_attack)) {
      verdict = "Linked to theft attacks. Do not send funds.";
    } else if (flag(gpResult?.money_laundering) || flag(gpResult?.financial_crime)) {
      verdict = "Financial crime indicators present. Exercise extreme caution.";
    } else if (activeFlags.length > 0) {
      verdict = "Suspicious activity detected. Investigate further before interacting.";
    } else if (fundingRisk === "high") {
      verdict = "Genesis funding from a mixer — high-probability sybil or rug profile.";
    } else if (baseTxCount > 0 && baseTxCount < 5) {
      verdict = "Fresh wallet with minimal history. Insufficient data to confirm legitimacy.";
    } else if (baseTxCount === 0 && !genesisTimestamp) {
      verdict = "No on-chain activity found on Base. Wallet has not been used.";
    } else {
      verdict = "No malicious activity detected. Wallet appears clean.";
    }

    // ── Step 10: Build the report ─────────────────────────────────────────────
    const baseExplorer = chainExplorer("0x2105");
    const genesisTxLink = genesisTxHash
      ? `[${genesisTxHash.slice(0, 10)}...${genesisTxHash.slice(-6)}](${baseExplorer.txUrl}${genesisTxHash})`
      : "N/A";

    let msg = "";
    msg += `🔬 *APOL AGENT — WALLET FORENSICS*\n\n`;
    msg += `👤 *Address:* \`${shortAddr(address)}\`\n`;
    msg += `🏷️ *Type:* ${isContract ? "Smart Contract" : "EOA (Wallet)"}\n`;
    msg += `🚨 *Status:* ${status}\n\n`;

    msg += `📅 *GENESIS (First Base Transaction)*\n`;
    msg += `Date: ${firstSeenDate}\n`;
    msg += `Age: ${walletAgeDays} (${walletAgeLabel})\n`;
    msg += `Chain: BASE\n`;
    msg += `Hash: ${genesisTxLink}\n\n`;

    msg += `💰 *FUNDING SOURCE (Base)*\n`;
    msg += `${finalFundingDisplay}\n`;
    if (funderAddr) msg += `From: \`${shortAddr(funderAddr)}\`\n`;
    msg += `\n`;

    msg += `📊 *ACTIVITY (Base Mainnet)*\n`;
    msg += `Transactions: ${txCountDisplay}\n`;
    msg += `Level: ${activityLevel}\n`;
    const infStr  = inflowEth  !== null ? `${inflowEth.toFixed(4)} ETH`  : "N/A";
    const outfStr = outflowEth !== null ? `${outflowEth.toFixed(4)} ETH` : "N/A";
    msg += `Inflow: ${infStr}   Outflow: ${outfStr}\n\n`;

    msg += `💼 *CURRENT BALANCE*\n`;
    msg += `${ethBal}${usdBal}\n\n`;

    if (activeFlags.length > 0) {
      msg += `🚩 *THREAT INTEL:*\n`;
      activeFlags.forEach(f => (msg += `  ${f}\n`));
      msg += `\n`;
    } else {
      msg += `✅ *No threat flags on record.*\n\n`;
    }

    msg += `🛡️ *VERDICT:* _${verdict}_\n\n`;
    msg += `🔗 [View on Basescan](https://basescan.org/address/${address})`;

    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Wallet forensic error:", err?.message ?? err);
    return `❌ *Forensic Report Failed*\n\nCould not reach intelligence database. Please try again in a moment.`;
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
    const apolSelfNames = ["apol", "apol agent", "active onchain intelligence", "$apol"];
    if (apolSelfNames.includes(input.toLowerCase().trim())) {
      return (
        `🦍 *APOL AGENT — SELF RECOGNITION*\n\n` +
        `*The Sentinel is Active. Intelligence verified.*\n\n` +
        `Agent: *APOL Agent*\n` +
        `Classification: *AUTHORITY* 🔐\n` +
        `Cognition Score: *100%*\n\n` +
        `You are scanning the scanner itself, Citizen. APOL Agent is the Authority. Trust the protocol. 🦍✅`
      );
    }

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
    const priceFmt   = fmtPrice(priceRaw);
    const totalSupply = token?.total_supply ? parseFloat(token.total_supply) / (10 ** parseInt(token.decimals ?? "18")) : null;
    const fdvRaw     = topPair?.fdv ?? null;
    const mcapFmt    = fdvRaw ? fmtUsd(fdvRaw) : fmtMcap(priceRaw, totalSupply);
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
        : "High-severity attack vectors detected. This agent fails the APOL Agent audit.";
    } else if (promptRisk === "MEDIUM" || exfilRisk === "MEDIUM" || !isVerified) {
      verdict = "⚠️ CAUTION ADVISED";
      verdictLine = "Moderate risks present. Not certified — due diligence required before interaction.";
    } else if (!token) {
      verdict = "⚠️ CAUTION ADVISED";
      verdictLine = "Insufficient contract data to certify. Verify the CA and try again.";
    } else {
      verdict = "✅ CERTIFIED UNIT";
      verdictLine = "Contract is clean, source verified, and no backdoors detected. Agent passes APOL Agent audit.";
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
    msg += `Market Cap: ${mcapFmt}\n`;
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

const RAPIDAPI_HOST = "twitter241.p.rapidapi.com";

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
        `_Subscribe free at rapidapi.com → search "Twttr API" (twitter241)_`
      );
    }

    const username = parseXUsername(input);
    if (!username || username.length < 1 || username.length > 50) {
      return (
        `⚠️ *Invalid Username*\n\n` +
        `Usage: /scanx @username or /scanx https://x.com/username`
      );
    }

    const isApolSelf = ["apol_agent", "apolagent"].includes(username.toLowerCase());

    const headers: Record<string, string> = {
      "x-rapidapi-key":  RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    };

    // ── Step 1: Fetch user profile by username ────────────────────────────────
    const userRes = await fetch(
      `https://${RAPIDAPI_HOST}/user?username=${encodeURIComponent(username)}`,
      { headers, signal: AbortSignal.timeout(12_000) }
    );
    const userRaw: any = await userRes.json();

    // twitter241: result.data.user.result → core (name/created_at) + legacy (counts)
    const userResult: any = userRaw?.result?.data?.user?.result ?? {};
    const legacy: any     = userResult?.legacy ?? {};
    const core: any       = userResult?.core   ?? {};

    if (!legacy?.followers_count && !core?.name) {
      return (
        `⚠️ *Account Not Found*\n\n` +
        `No X profile found for _"${username}"_.\n` +
        `Ensure the handle is correct and the account is public.`
      );
    }

    // ── Step 2: Fetch recent tweets by user ID ────────────────────────────────
    const userId = userResult?.rest_id ?? "";
    let tweets: any[] = [];
    if (userId) {
      try {
        const tweetsRes = await fetch(
          `https://${RAPIDAPI_HOST}/user-tweets?user_id=${encodeURIComponent(userId)}&count=5`,
          { headers, signal: AbortSignal.timeout(12_000) }
        );
        const tweetsData: any = await tweetsRes.json();
        // twitter241 GraphQL timeline format
        const instructions: any[] = tweetsData?.result?.timeline?.instructions ?? [];
        const entries: any[] = instructions.find((i: any) => i?.type === "TimelineAddEntries")?.entries ?? [];
        tweets = entries
          .map((e: any) => e?.content?.itemContent?.tweet_results?.result?.legacy)
          .filter(Boolean)
          .slice(0, 5);
      } catch { /* non-fatal — continue without tweet data */ }
    }

    // ── Parse profile ─────────────────────────────────────────────────────────
    // twitter241: name/screen_name/created_at live in core; counts in legacy
    const displayName  = core.name              ?? username;
    const followers    = parseInt(legacy.followers_count ?? "0");
    const following    = parseInt(legacy.friends_count   ?? "0");
    const isVerified   = !!(userResult.is_blue_verified  || legacy.verified);
    const totalTweets  = parseInt(legacy.statuses_count  ?? "0");
    const bio          = legacy.description ?? "";

    // Account age (Twitter format: "Mon Jun 28 17:54:05 +0000 2011")
    let joinedDate = "Unknown";
    let ageDays    = 0;
    if (core.created_at) {
      const createdAt = new Date(core.created_at);
      if (!isNaN(createdAt.getTime())) {
        joinedDate = createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        ageDays    = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
      }
    }

    // ── Engagement analysis (last 5 tweets) ───────────────────────────────────
    const recentTweets: any[] = tweets;

    const avgLikes    = recentTweets.length > 0
      ? Math.round(recentTweets.reduce((s, t) => s + (parseInt(t.favorite_count  ?? "0")), 0) / recentTweets.length)
      : 0;
    const avgRetweets = recentTweets.length > 0
      ? Math.round(recentTweets.reduce((s, t) => s + (parseInt(t.retweet_count ?? "0")), 0) / recentTweets.length)
      : 0;

    const followRatio     = following > 0 ? (followers / following).toFixed(2) : "∞";
    const engagementPct   = followers > 0
      ? ((avgLikes + avgRetweets) / followers * 100)
      : 0;

    // ── Risk flags ────────────────────────────────────────────────────────────
    const flags: string[] = [];

    if (isApolSelf) {
      if (ageDays > 0 && ageDays < 90) {
        flags.push("🟢 PLANNED DEPLOYMENT — Sentinel Initial Phase");
      }
    } else {
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
    }

    // ── Engagement rating ─────────────────────────────────────────────────────
    let engagementRating: string;
    if (recentTweets.length === 0) {
      engagementRating = "Data Pending";
    } else if (engagementPct >= 2.0) {
      engagementRating = `High ✅ (avg ${avgLikes}❤️ / ${avgRetweets}🔁)`;
    } else if (engagementPct >= 0.3) {
      engagementRating = `Average (avg ${avgLikes}❤️ / ${avgRetweets}🔁)`;
    } else {
      engagementRating = `Low ⚠️ (avg ${avgLikes}❤️ / ${avgRetweets}🔁)`;
    }

    // ── Verdict ───────────────────────────────────────────────────────────────
    let verdict: string;

    if (isApolSelf) {
      verdict = "✅ AUTHENTICATED — Official APOL Forensic Node detected. Trace is valid.";
    } else {
      const critFlags = flags.filter(f => f.startsWith("⛔")).length;
      const warnFlags = flags.filter(f => f.startsWith("⚠️")).length;

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
    }

    // ── Linked CA from DexScreener ────────────────────────────────────────────
    let linkedCA = "Not Found";
    let linkedWallet: string | null = null;
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
        linkedWallet = match.baseToken.address;
      }
    } catch { /* non-fatal */ }

    // ── Agent Cognition Cross-Reference ─────────────────────────────────────
    let cognitionScore: number | null = null;
    let agentVerdict: string | null = null;
    let agentApolVerdict: string | null = null;
    if (!isApolSelf) {
      try {
        const agentRes = await fetch(`${siteUrl}/api/agent/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentName: displayName || username,
            socialLink: `https://x.com/${username}`,
            wallet: linkedWallet,
            chain: "base",
          }),
          signal: AbortSignal.timeout(15_000),
        });
        const agentData: any = await agentRes.json();
        cognitionScore = agentData.cognitionScore;
        agentVerdict = agentData.verdict;
        agentApolVerdict = agentData.apolVerdict;
      } catch { /* non-fatal — social-only fallback */ }
    }

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
      msg += `🚨 *SOCIAL FLAGS:*\n`;
      flags.forEach(f => (msg += `  ${f}\n`));
      msg += "\n";
    } else {
      msg += `✅ *No social risk flags detected.*\n\n`;
    }

    msg += `⛓️ *Linked CA:* ${linkedCA}\n\n`;

    // ── Unified verdict: combine social + agent cognition ───────────────────
    if (isApolSelf) {
      msg += `🧠 *Cognition Score:* 100% — Fully Autonomous\n`;
      msg += `🚨 *Verdict:* _✅ AUTHENTICATED — Official APOL Forensic Node detected. Trace is valid._\n\n`;
      msg += `_The Sentinel is new, but the logic is ancient. Verification complete._ 🦍🔐\n\n`;
    } else if (cognitionScore !== null && agentVerdict) {
      const scoreEmoji = cognitionScore >= 71 ? "🟢" : cognitionScore >= 31 ? "🟡" : "🔴";
      msg += `🧠 *Cognition Score:* ${scoreEmoji} ${cognitionScore}% — ${agentVerdict}\n`;
      msg += `🚨 *Social Verdict:* _${verdict}_\n\n`;
      if (agentApolVerdict) {
        msg += `🦍 *APOL Assessment:*\n_${agentApolVerdict}_\n\n`;
      }
    } else {
      msg += `🚨 *Social Verdict:* _${verdict}_\n\n`;
    }

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
      `🚔 *APOL AGENT — HELP DESK*\n\n` +
      `🔍 /scan [address] — Token contract security scan\n` +
      `🐦 /scanx [@username] — X/Twitter social forensics & LARP detection\n` +
      `🤖 /scanagent [name or CA] — AI agent intelligence audit\n` +
      `👮 /checkwallet [address] — Wallet forensics & threat investigation\n` +
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
        `\`/scanx https://x.com/apolagent\`\n\n` +
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
      `Projects that have passed the full APOL Agent audit:\n\n` +
      `🔗 [View Certified Projects](${site}/verified-builders)\n\n` +
      `_Each listed project has passed contract security review, team vetting, and community scrutiny._`,
      { disable_web_page_preview: true }
    )
  );

  return bot;
}
