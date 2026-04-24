import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import {
  WETH, QUOTER_V2, V3_FACTORY, SIM_AMOUNT, MICRO_AMOUNT, HARD_TIMEOUT, FEE_TIERS,
  BURN_ADDRS, PLATFORM_MAP, LOCKER_MAP, CREATION_LOG_SIGNATURES, MANAGED_PROTOCOLS,
  DEPLOYER_CHAIN_KEYWORDS, BLOCKSCOUT_BASE, DEXSCREENER_BASE, GOPLUS_BASE, BASE_CHAIN_ID,
  VERIFIED_AGENTS, CLANKER_API_BASE, SERIAL_DEPLOYER_THRESHOLD, SERIAL_DEPLOYER_WINDOW_DAYS,
} from "./constants";

const BASE_RPC = process.env.BASE_RPC_URL || "";

function pad32(hex: string): string {
  return hex.replace(/^0x/i, "").padStart(64, "0");
}
function uint256Hex(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

async function rpcCall(method: string, params: any[]): Promise<any> {
  const resp = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await resp.json()) as any;
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.result;
}

async function rpcBatch(calls: { method: string; params: any[] }[]): Promise<any[]> {
  const body = calls.map((c, i) => ({ jsonrpc: "2.0", id: i + 1, method: c.method, params: c.params }));
  const resp = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const results = (await resp.json()) as any[];
  results.sort((a: any, b: any) => a.id - b.id);
  return results.map((r: any) => (r.error ? null : r.result));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)),
  ]);
}

async function findBestPool(token: string): Promise<{ pool: string; fee: number } | null> {
  const addr = token.toLowerCase();
  const [t0, t1] = addr < WETH.toLowerCase() ? [addr, WETH.toLowerCase()] : [WETH.toLowerCase(), addr];
  const selector = "0x1698ee82";
  const calls = FEE_TIERS.map((fee) => ({
    method: "eth_call" as const,
    params: [{ to: V3_FACTORY, data: selector + pad32(t0) + pad32(t1) + uint256Hex(BigInt(fee)) }, "latest"],
  }));
  const results = await rpcBatch(calls);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r || r === "0x" || r === "0x" + "0".repeat(64)) continue;
    const poolAddr = "0x" + r.slice(26, 66);
    if (poolAddr === "0x0000000000000000000000000000000000000000") continue;
    return { pool: poolAddr, fee: FEE_TIERS[i] };
  }
  return null;
}

async function simRoundTrip(addr: string, amount: bigint, fee: number): Promise<{ tokensReceived: bigint; ethBack: bigint } | "buy_fail" | "sell_fail"> {
  const sel = "0xc6a5026a";
  const buyData = sel + pad32(WETH) + pad32(addr) + uint256Hex(amount) + uint256Hex(BigInt(fee)) + uint256Hex(BigInt(0));
  let buyResult: string;
  try { buyResult = await rpcCall("eth_call", [{ to: QUOTER_V2, data: buyData }, "latest"]); }
  catch { return "buy_fail"; }
  if (!buyResult || buyResult === "0x") return "buy_fail";
  const tokensReceived = BigInt("0x" + buyResult.slice(2, 66));
  if (tokensReceived === BigInt(0)) return "buy_fail";

  const sellData = sel + pad32(addr) + pad32(WETH) + uint256Hex(tokensReceived) + uint256Hex(BigInt(fee)) + uint256Hex(BigInt(0));
  let sellResult: string;
  try { sellResult = await rpcCall("eth_call", [{ to: QUOTER_V2, data: sellData }, "latest"]); }
  catch { return "sell_fail"; }
  if (!sellResult || sellResult === "0x") return "sell_fail";
  const ethBack = BigInt("0x" + sellResult.slice(2, 66));
  return { tokensReceived, ethBack };
}

async function rpcSimulate(tokenAddress: string): Promise<{ isHoneypot: boolean; buyTax: number; sellTax: number; simulationSuccess: boolean; feeTier: number | null; tokensReceived: bigint }> {
  const addr = tokenAddress.toLowerCase();
  const poolInfo = await findBestPool(addr);
  if (!poolInfo) return { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0) };
  const { fee } = poolInfo;
  const expectedPoolFees = (fee / 10000) * 2;

  let taxFromMicro: number | null = null;

  const microResult = await simRoundTrip(addr, MICRO_AMOUNT, fee);
  if (microResult !== "buy_fail" && microResult !== "sell_fail" && microResult.ethBack > BigInt(0)) {
    const microIn = Number(MICRO_AMOUNT) / 1e18;
    const microOut = Number(microResult.ethBack) / 1e18;
    const microLoss = ((microIn - microOut) / microIn) * 100;
    taxFromMicro = Math.max(0, microLoss - expectedPoolFees);
  }

  const mainResult = await simRoundTrip(addr, SIM_AMOUNT, fee);
  if (mainResult === "buy_fail") {
    if (microResult === "buy_fail") return { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: fee, tokensReceived: BigInt(0) };
    if (microResult === "sell_fail") return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived: BigInt(0) };
    return { isHoneypot: false, buyTax: parseFloat(((taxFromMicro || 0) / 2).toFixed(2)), sellTax: parseFloat(((taxFromMicro || 0) / 2).toFixed(2)), simulationSuccess: true, feeTier: fee, tokensReceived: microResult.tokensReceived };
  }
  if (mainResult === "sell_fail") return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived: BigInt(0) };
  if (mainResult.ethBack === BigInt(0)) return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived: mainResult.tokensReceived };

  let netTax: number;
  if (taxFromMicro !== null) {
    netTax = taxFromMicro;
  } else {
    const ethIn = Number(SIM_AMOUNT) / 1e18;
    const ethOut = Number(mainResult.ethBack) / 1e18;
    const roundTripLoss = ((ethIn - ethOut) / ethIn) * 100;
    netTax = Math.max(0, roundTripLoss - expectedPoolFees);
  }

  const buyTax = parseFloat((netTax / 2).toFixed(2));
  const sellTax = parseFloat((netTax / 2).toFixed(2));

  return { isHoneypot: false, buyTax, sellTax, simulationSuccess: true, feeTier: fee, tokensReceived: mainResult.tokensReceived };
}

async function getTokenInfo(addr: string): Promise<{ name: string; symbol: string; totalSupply: bigint; decimals: number }> {
  const results = await rpcBatch([
    { method: "eth_call", params: [{ to: addr, data: "0x06fdde03" }, "latest"] },
    { method: "eth_call", params: [{ to: addr, data: "0x95d89b41" }, "latest"] },
    { method: "eth_call", params: [{ to: addr, data: "0x18160ddd" }, "latest"] },
    { method: "eth_call", params: [{ to: addr, data: "0x313ce567" }, "latest"] },
  ]);
  const decodeName = (hex: string | null): string => {
    if (!hex || hex === "0x" || hex.length < 130) return "";
    try {
      const offset = parseInt(hex.slice(2, 66), 16) * 2;
      const len = parseInt(hex.slice(2 + offset, 2 + offset + 64), 16);
      const raw = hex.slice(2 + offset + 64, 2 + offset + 64 + len * 2);
      return Buffer.from(raw, "hex").toString("utf8");
    } catch { return ""; }
  };
  const rawSupply = results[2] ? BigInt(results[2]) : BigInt(0);
  const decimals = results[3] ? Number(BigInt(results[3])) : 18;
  const divisor = BigInt(10) ** BigInt(decimals);
  return {
    name: decodeName(results[0]) || "Unknown",
    symbol: decodeName(results[1]) || "???",
    totalSupply: divisor > 0 ? rawSupply / divisor : BigInt(0),
    decimals,
  };
}

async function getDeployer(addr: string): Promise<string | null> {
  if (BASE_RPC) {
    try {
      const resp = await fetch(BASE_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers",
          params: [{ fromBlock: "0x0", toBlock: "latest", contractAddresses: [addr], category: ["erc20"], maxCount: "0x1", order: "asc" }]
        }),
        signal: AbortSignal.timeout(6000),
      });
      const data = await resp.json() as any;
      const firstTx = data?.result?.transfers?.[0];
      if (firstTx?.hash) {
        const receipt = await fetch(BASE_RPC, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_getTransactionReceipt", params: [firstTx.hash] }),
          signal: AbortSignal.timeout(4000),
        }).then(r => r.json()) as any;
        const txTo = receipt?.result?.to?.toLowerCase();
        const txFrom = receipt?.result?.from?.toLowerCase();
        if (txTo && txTo !== addr.toLowerCase()) return txTo;
        if (txFrom) return txFrom;
      }
    } catch {}
  }

  try {
    const data = await fetch(`${BLOCKSCOUT_BASE}/api/v2/addresses/${addr}`, { signal: AbortSignal.timeout(4000) })
      .then((r) => (r.ok ? (r.json() as any) : null));
    if (data?.creator_address_hash) return data.creator_address_hash.toLowerCase();
  } catch {}
  return null;
}

async function getHolderCount(addr: string): Promise<number> {
  try {
    const data = await fetch(`${BLOCKSCOUT_BASE}/api/v2/tokens/${addr}/counters`, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? (r.json() as any) : null));
    return parseInt(data?.token_holders_count || "0", 10);
  } catch { return 0; }
}

async function getTopHolders(addr: string): Promise<{ address: string; percent: number }[]> {
  try {
    const data = await fetch(`${BLOCKSCOUT_BASE}/api/v2/tokens/${addr}/holders?limit=10`, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? (r.json() as any) : null));
    if (!data?.items) return [];
    return data.items.map((h: any) => ({ address: (h.address?.hash || "").toLowerCase(), percent: parseFloat(h.percentage || "0") }));
  } catch { return []; }
}

const routesDexCache = new Map<string, { data: { priceUsd: number; liquidity: number }; timestamp: number }>();
let routesEthCache: { price: number; timestamp: number } | null = null;
const ROUTES_CACHE_TTL = 60000;

async function getEthUsdPrice(): Promise<number> {
  if (routesEthCache && Date.now() - routesEthCache.timestamp < ROUTES_CACHE_TTL) {
    return routesEthCache.price;
  }
  try {
    const data = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${WETH}`, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? (r.json() as any) : null));
    const price = parseFloat(data?.pairs?.[0]?.priceUsd || "0") || 0;
    if (price > 0) routesEthCache = { price, timestamp: Date.now() };
    return price || routesEthCache?.price || 0;
  } catch { return routesEthCache?.price || 0; }
}

async function getDexScreenerData(addr: string): Promise<{ priceUsd: number; liquidity: number; dexMcap: number; dexFdv: number }> {
  const key = addr.toLowerCase();
  const cached = routesDexCache.get(key);
  if (cached && Date.now() - cached.timestamp < ROUTES_CACHE_TTL) {
    return cached.data;
  }
  try {
    const data = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(6000) }).then((r) => r.ok ? r.json() as any : null);
    const pairs = data?.pairs || [];
    const pair = pairs.length > 1
      ? pairs.reduce((best: any, p: any) => (parseFloat(p?.liquidity?.usd || "0") > parseFloat(best?.liquidity?.usd || "0") ? p : best), pairs[0])
      : pairs[0] || null;
    const result = {
      priceUsd: parseFloat(pair?.priceUsd || "0") || 0,
      liquidity: parseFloat(pair?.liquidity?.usd || "0") || 0,
      dexMcap: parseFloat(pair?.marketCap || "0") || 0,
      dexFdv: parseFloat(pair?.fdv || "0") || 0,
    };
    if (result.priceUsd > 0) routesDexCache.set(key, { data: result, timestamp: Date.now() });
    return result.priceUsd > 0 ? result : cached?.data || result;
  } catch {
    return cached?.data || { priceUsd: 0, liquidity: 0, dexMcap: 0, dexFdv: 0 };
  }
}

async function getDexScreenerSocials(addr: string): Promise<{ twitter: string | null; website: string | null; description: string | null }> {
  try {
    const data = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok ? r.json() as any : null);
    const pair = data?.pairs?.[0];
    const info = pair?.info || {};
    const socials = info.socials || [];
    let twitter: string | null = null;
    let website: string | null = null;
    const description: string | null = info.description || null;
    for (const s of socials) {
      if (s.type === "twitter" && s.url) twitter = s.url.replace(/https?:\/\/(x\.com|twitter\.com)\//i, "").replace(/\/$/, "");
    }
    const websites = info.websites || [];
    if (websites.length > 0) website = websites[0].url || null;
    return { twitter, website, description };
  } catch { return { twitter: null, website: null, description: null }; }
}

interface ClankerData {
  volume24h: number;
  marketCap: number;
  warnings: string[];
  tags: { champagne: boolean; verified: boolean; knownInterfaceDeployer: boolean };
  poolAddress: string | null;
  deployedAt: string | null;
  admin: string | null;
  rewardsAvailable: boolean;
}

async function fetchClankerData(addr: string): Promise<ClankerData | null> {
  try {
    const resp = await fetch(`${CLANKER_API_BASE}/api/tokens/search?q=${addr}`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const tokens = data?.data || [];
    const token = tokens.find((t: any) => t.contract_address?.toLowerCase() === addr.toLowerCase());
    if (!token) return null;
    return {
      volume24h: token.related?.market?.volume24h || 0,
      marketCap: token.related?.market?.marketCap || 0,
      warnings: token.warnings || [],
      tags: { champagne: !!token.tags?.champagne, verified: !!token.tags?.verified, knownInterfaceDeployer: !!token.tags?.knownInterfaceDeployer },
      poolAddress: token.pool_address || null,
      deployedAt: token.deployed_at || null,
      admin: token.admin || null,
      rewardsAvailable: !!token.position_id,
    };
  } catch { return null; }
}

async function checkRecentDeployerTokens(deployer: string): Promise<{ recentCount: number; recentTokens: { name: string; address: string; ageDays: number }[] }> {
  if (!BASE_RPC) return { recentCount: 0, recentTokens: [] };
  try {
    const resp = await fetch(BASE_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers",
        params: [{ fromBlock: "0x0", toBlock: "latest", fromAddress: deployer, category: ["erc20"], maxCount: "0x32", excludeZeroValue: false }] }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await resp.json() as any;
    const transfers = data?.result?.transfers || [];
    const now = Date.now();
    const windowMs = SERIAL_DEPLOYER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const tokenMap = new Map<string, { name: string; blockNum: string }>();
    for (const t of transfers) {
      const addr = t.rawContract?.address?.toLowerCase();
      if (addr && !tokenMap.has(addr)) {
        tokenMap.set(addr, { name: t.asset || "Unknown", blockNum: t.blockNum });
      }
    }
    const entries = [...tokenMap.entries()].slice(0, 15);
    const blockChecks = entries.map(async ([addr, info]) => {
      try {
        const blockData = await rpcCall("eth_getBlockByNumber", [info.blockNum, false]);
        if (blockData?.timestamp) {
          const created = parseInt(blockData.timestamp, 16) * 1000;
          const ageDays = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
          if (now - created <= windowMs) {
            return { name: info.name, address: addr, ageDays };
          }
        }
      } catch {}
      return null;
    });
    const results = (await Promise.all(blockChecks)).filter((r): r is { name: string; address: string; ageDays: number } => r !== null);
    return { recentCount: results.length, recentTokens: results };
  } catch { return { recentCount: 0, recentTokens: [] }; }
}

const AGENT_ABILITY_KEYWORDS: Record<string, string[]> = {
  "Trading": ["trade", "trading", "swap", "dex", "buy", "sell", "snipe", "arbitrage", "mev"],
  "Social": ["tweet", "post", "social", "reply", "engage", "content", "community"],
  "Analytics": ["analyze", "monitor", "track", "scan", "detect", "alert", "report", "data"],
  "DeFi": ["yield", "farm", "lend", "borrow", "stake", "liquidity", "vault", "protocol"],
  "Bridge": ["bridge", "cross-chain", "multichain", "transfer"],
  "Gaming": ["game", "play", "nft", "mint", "breed"],
  "Autonomous": ["autonomous", "self-learning", "ai agent", "artificial intelligence", "machine learning", "neural", "cognitive"],
};

interface AbilityAudit {
  claimedAbilities: string[];
  reasoningUrl: string | null;
  reasoningStatus: "verified" | "mismatch" | "not_found" | "no_source";
  reasoningDetail: string;
  abilityMismatch: string | null;
}

function extractAbilitiesFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const [category, keywords] of Object.entries(AGENT_ABILITY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) found.push(category);
  }
  return found;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]") return false;
    if (host.startsWith("10.") || host.startsWith("192.168.") || host === "169.254.169.254") return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return false;
    return true;
  } catch { return false; }
}

function extractUrlsFromText(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>)\]]+/gi;
  return (text.match(urlRegex) || []).filter(u => !u.includes("x.com") && !u.includes("twitter.com") && !u.includes("t.me") && !u.includes("discord")).filter(isSafeUrl);
}

async function autoAuditAbilities(
  twitterBio: string | null,
  dexDescription: string | null,
  websiteUrl: string | null,
  contractActivity: ContractActivity,
): Promise<AbilityAudit> {
  const allAbilities: string[] = [];
  const allTexts: string[] = [];

  if (twitterBio) { allTexts.push(twitterBio); allAbilities.push(...extractAbilitiesFromText(twitterBio)); }
  if (dexDescription) { allTexts.push(dexDescription); allAbilities.push(...extractAbilitiesFromText(dexDescription)); }

  const claimedAbilities = [...new Set(allAbilities)];

  let reasoningUrl: string | null = null;
  let reasoningStatus: AbilityAudit["reasoningStatus"] = "no_source";
  let reasoningDetail = "No reasoning logs or dashboard URL found.";

  const candidateUrls = extractUrlsFromText(allTexts.join(" "));
  if (websiteUrl && isSafeUrl(websiteUrl)) candidateUrls.unshift(websiteUrl);

  for (const url of candidateUrls.slice(0, 3)) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: "follow" });
      if (!resp.ok) continue;
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/json") && !contentType.includes("text/plain")) continue;
      const reader = resp.body?.getReader();
      if (!reader) continue;
      let body = "";
      const decoder = new TextDecoder();
      while (body.length < 4000) {
        const { done, value } = await reader.read();
        if (done) break;
        body += decoder.decode(value, { stream: true });
      }
      reader.cancel().catch(() => {});
      const snippet = body.slice(0, 3000).toLowerCase();
      const hasReasoningSignals = /log|reason|decision|chose|executed|analyzed|swap|trade|thinking|action|step \d|task/i.test(snippet);
      const hasTimestamps = /\d{4}-\d{2}-\d{2}|\d{10,13}|T\d{2}:\d{2}/.test(snippet);
      const hasDashboardSignals = /dashboard|activity|history|transactions|agent.*status|live.*feed/i.test(snippet);
      if (hasReasoningSignals && hasTimestamps) {
        reasoningUrl = url;
        reasoningStatus = "verified";
        reasoningDetail = "Found reasoning logs with timestamped entries — consistent with autonomous operation.";
        break;
      } else if (hasReasoningSignals || hasDashboardSignals) {
        reasoningUrl = url;
        reasoningStatus = "mismatch";
        reasoningDetail = "Found potential agent dashboard but no clear timestamped reasoning traces.";
      }
    } catch {}
  }

  if (!reasoningUrl && allTexts.length > 0) {
    reasoningStatus = "not_found";
    reasoningDetail = "Scanned linked website and social bios — no reasoning logs or agent dashboard found.";
  }

  let abilityMismatch: string | null = null;
  if (claimedAbilities.includes("Trading") && contractActivity.txCount < 50 && contractActivity.contractAgeDays > 7) {
    abilityMismatch = "Claims trading abilities but contract shows minimal swap/transfer activity.";
  } else if (claimedAbilities.includes("DeFi") && contractActivity.txCount < 20 && contractActivity.contractAgeDays > 7) {
    abilityMismatch = "Claims DeFi capabilities but near-zero protocol interactions detected.";
  } else if (claimedAbilities.length === 0 && allTexts.length > 0) {
    abilityMismatch = "No specific agent abilities claimed in bio or description — vague identity.";
  }

  return { claimedAbilities, reasoningUrl, reasoningStatus, reasoningDetail, abilityMismatch };
}

interface FallbackTokenData {
  holderCount: number;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  totalSupply: string;
  ownerAddress: string | null;
  creatorAddress: string | null;
  lpHolderCount: number;
}

async function getFallbackTokenData(addr: string): Promise<FallbackTokenData | null> {
  try {
    const resp = await fetch(`${GOPLUS_BASE}/api/v1/token_security/${BASE_CHAIN_ID}?contract_addresses=${addr}`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const token = data?.result?.[addr.toLowerCase()];
    if (!token) return null;
    return {
      holderCount: parseInt(token.holder_count || "0", 10),
      isHoneypot: token.is_honeypot === "1",
      buyTax: parseFloat(token.buy_tax || "0") * 100,
      sellTax: parseFloat(token.sell_tax || "0") * 100,
      totalSupply: token.total_supply || "0",
      ownerAddress: token.owner_address || null,
      creatorAddress: token.creator_address || null,
      lpHolderCount: parseInt(token.lp_holder_count || "0", 10),
    };
  } catch { return null; }
}


interface ContractActivity {
  txCount: number;
  contractAgeDays: number;
  hasContractCode: boolean;
  codeSize: number;
  activityPerDay: number;
}

async function getContractActivity(addr: string): Promise<ContractActivity> {
  const result: ContractActivity = { txCount: 0, contractAgeDays: 0, hasContractCode: false, codeSize: 0, activityPerDay: 0 };
  try {
    const [countersData, addrData, codeResult] = await Promise.all([
      fetch(`${BLOCKSCOUT_BASE}/api/v2/addresses/${addr}/counters`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() as any : null),
      fetch(`${BLOCKSCOUT_BASE}/api/v2/addresses/${addr}`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() as any : null),
      rpcCall("eth_getCode", [addr, "latest"]),
    ]);
    if (countersData) {
      const txCount = parseInt(countersData.transactions_count || "0", 10);
      const transferCount = parseInt(countersData.token_transfers_count || "0", 10);
      result.txCount = txCount + transferCount;
    }
    const creationHash = addrData?.creation_transaction_hash || addrData?.creation_tx_hash;
    if (creationHash) {
      try {
        const txData = await fetch(`${BLOCKSCOUT_BASE}/api/v2/transactions/${creationHash}`, { signal: AbortSignal.timeout(4000) }).then(r => r.ok ? r.json() as any : null);
        if (txData?.timestamp) {
          const created = new Date(txData.timestamp).getTime();
          result.contractAgeDays = Math.max(1, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
        }
      } catch {}
    }
    if (result.contractAgeDays === 0) {
      try {
        const transfers = await rpcCall("alchemy_getAssetTransfers", [{
          fromBlock: "0x0", toBlock: "latest",
          contractAddresses: [addr], category: ["erc20"], maxCount: "0x1", order: "asc"
        }]);
        const firstHash = transfers?.transfers?.[0]?.hash;
        if (firstHash) {
          const blockHex = transfers.transfers[0].blockNum;
          const blockData = await rpcCall("eth_getBlockByNumber", [blockHex, false]);
          if (blockData?.timestamp) {
            const created = Number(BigInt(blockData.timestamp)) * 1000;
            result.contractAgeDays = Math.max(1, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
          }
        }
      } catch {}
    }
    if (codeResult && codeResult !== "0x") {
      result.hasContractCode = true;
      result.codeSize = (codeResult.length - 2) / 2;
    }
    if (result.contractAgeDays > 0 && result.txCount > 0) {
      result.activityPerDay = parseFloat((result.txCount / result.contractAgeDays).toFixed(2));
    }
  } catch {}
  return result;
}

async function detectPlatformFromCreationTx(tokenAddr: string): Promise<string | null> {
  try {
    const transfers = await rpcCall("alchemy_getAssetTransfers", [{
      fromBlock: "0x0", toBlock: "latest",
      contractAddresses: [tokenAddr],
      category: ["erc20"], maxCount: "0x1", order: "asc"
    }]);
    const firstTxHash = transfers?.transfers?.[0]?.hash;
    if (!firstTxHash) return null;

    const receipt = await rpcCall("eth_getTransactionReceipt", [firstTxHash]);
    if (!receipt?.logs) return null;

    for (const l of receipt.logs) {
      const logAddr = (l.address || "").toLowerCase();
      if (CREATION_LOG_SIGNATURES[logAddr]) return CREATION_LOG_SIGNATURES[logAddr];
      if (PLATFORM_MAP[logAddr]) return PLATFORM_MAP[logAddr];
    }
    return null;
  } catch { return null; }
}

async function detectPlatformFromProxyImpl(tokenAddr: string): Promise<string | null> {
  try {
    const code = await rpcCall("eth_getCode", [tokenAddr, "latest"]);
    if (!code || code === "0x") return null;
    const c = code.toLowerCase();
    let impl: string | null = null;
    if (c.startsWith("0x363d3d373d3d3d363d73") && c.length >= 62) {
      impl = "0x" + c.slice(22, 62);
    } else if (c.startsWith("0x3d3d3d3d363d3d37363d73") && c.length >= 64) {
      impl = "0x" + c.slice(24, 64);
    }
    if (impl && PLATFORM_MAP[impl]) return PLATFORM_MAP[impl];
    try {
      const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
      const eip1967 = await rpcCall("eth_getStorageAt", [tokenAddr, slot, "latest"]);
      if (eip1967 && eip1967 !== "0x" && eip1967.length >= 66) {
        const addr = "0x" + eip1967.slice(-40).toLowerCase();
        if (addr !== "0x0000000000000000000000000000000000000000" && PLATFORM_MAP[addr]) return PLATFORM_MAP[addr];
      }
    } catch {}
    return null;
  } catch { return null; }
}

async function detectPlatformFromDeployerChain(deployer: string): Promise<string | null> {
  try {
    const resp = await fetch(`${BLOCKSCOUT_BASE}/api/v2/addresses/${deployer}`);
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    if (data.is_contract) {
      if (data.creator_address_hash) {
        const creator = data.creator_address_hash.toLowerCase();
        if (PLATFORM_MAP[creator]) return PLATFORM_MAP[creator];
      }
      const name = (data.name || "").toLowerCase();
      for (const [platform, kw] of Object.entries(DEPLOYER_CHAIN_KEYWORDS)) {
        if (kw.names.some((n: string) => name.includes(n))) return platform;
      }

      try {
        const srcResp = await fetch(`${BLOCKSCOUT_BASE}/api/v2/smart-contracts/${deployer}`);
        if (srcResp.ok) {
          const srcData = await srcResp.json() as any;
          const contractName = (srcData.name || "").toLowerCase();
          for (const [platform, kw] of Object.entries(DEPLOYER_CHAIN_KEYWORDS)) {
            if (kw.names.some((n: string) => contractName.includes(n))) return platform;
          }
          const src = (srcData.source_code || "").slice(0, 5000).toLowerCase();
          for (const [platform, kw] of Object.entries(DEPLOYER_CHAIN_KEYWORDS)) {
            if (kw.sourcePatterns.some((p: string) => src.includes(p))) return platform;
          }
        }
      } catch {}
    }
    return null;
  } catch { return null; }
}

function detectPlatform(addr: string, deployer: string | null, holders: { address: string }[]): string | null {
  const a = addr.toLowerCase();
  if (PLATFORM_MAP[a]) return PLATFORM_MAP[a];
  if (deployer && PLATFORM_MAP[deployer]) return PLATFORM_MAP[deployer];
  for (const h of holders) { if (PLATFORM_MAP[h.address]) return PLATFORM_MAP[h.address]; }
  return null;
}

function detectLpStatus(holders: { address: string; percent: number }[], platform: string | null): string {
  if (platform && MANAGED_PROTOCOLS.has(platform)) return `${platform} Managed`;
  for (const h of holders) {
    if (BURN_ADDRS.has(h.address)) return "BURNED";
    if (LOCKER_MAP[h.address]) return `LOCKED (${LOCKER_MAP[h.address]})`;
  }
  if (platform) return `${platform} Managed`;
  return "OPEN";
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", engine: "APOL Forensic Engine", timestamp: Date.now() });
  });

  app.get("/api/test-agent-logs/autonomous", (_req, res) => {
    const now = Date.now();
    const logs = [
      { timestamp: new Date(now - 3600000 * 24).toISOString(), action: "market_scan", detail: "Analyzing ETH/USDC liquidity depth on Uniswap. Calculated optimal entry at $1,847.32 based on 4h VWAP crossover." },
      { timestamp: new Date(now - 3600000 * 20).toISOString(), action: "risk_assessment", detail: "Decided against PEPE position — sell tax detected at 5.2% via simulation. Chose to skip and monitor." },
      { timestamp: new Date(now - 3600000 * 16).toISOString(), action: "trade_execution", detail: "Executed swap: 0.5 ETH → 1,247,000 AERO via Aerodrome. Slippage 0.3%. Gas optimized to 0.0008 ETH." },
      { timestamp: new Date(now - 3600000 * 12).toISOString(), action: "portfolio_rebalance", detail: "Analyzing portfolio weights. VIRTUAL allocation at 34% exceeds 25% target. Calculated rebalance: sold 15% VIRTUAL, bought GAME and LUNA." },
      { timestamp: new Date(now - 3600000 * 8).toISOString(), action: "alpha_detection", detail: "Detected unusual volume spike on BRETT (+340% in 2h). Cross-referenced with deployer history — clean record, 12 prior tokens. Decided to take small position." },
      { timestamp: new Date(now - 3600000 * 4).toISOString(), action: "social_intelligence", detail: "Parsed 847 tweets mentioning $DEGEN. Sentiment: 72% bullish. Whale wallet 0x3f7a... accumulated 2.1M tokens. Chose to monitor for 4h before action." },
      { timestamp: new Date(now - 3600000 * 2).toISOString(), action: "risk_mitigation", detail: "Stop-loss triggered on AERO position at -8%. Swapped back to ETH. Net loss: 0.04 ETH. Updating risk parameters." },
      { timestamp: new Date(now - 3600000).toISOString(), action: "strategy_update", detail: "Recalculated conviction scores. Top 3: VIRTUAL (87/100), GAME (73/100), LUNA (69/100). Adjusting position sizes based on Kelly criterion." },
      { timestamp: new Date(now - 1800000).toISOString(), action: "on_chain_execution", detail: "Bought 50,000 GAME at $0.0082. Tx: 0xa4f2...c891. Gas: 0.0005 ETH. Reasoning: breakout above 20-day MA with increasing volume." },
      { timestamp: new Date(now - 600000).toISOString(), action: "monitoring", detail: "Active positions: 3. Unrealized PnL: +0.12 ETH. Next rebalance scheduled in 6h. All stop-losses verified on-chain." },
    ];
    res.json({ agent: "APOL Test Agent (Autonomous)", version: "1.0", generatedAt: new Date().toISOString(), entries: logs });
  });

  app.get("/api/test-agent-logs/puppet", (_req, res) => {
    res.json({
      status: "active",
      message: "Agent is running. Check back later for updates.",
      lastUpdate: "recently",
    });
  });

  app.get("/api/agent/activity", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const [logs, total] = await Promise.all([
        storage.getAgentActivityLogs(limit, offset),
        storage.getAgentActivityLogCount(),
      ]);
      res.json({ agent: "APOL Agent", version: "1.0", total, entries: logs });
    } catch (e: any) {
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/detective/flagged", async (_req, res) => {
    try { res.json(await storage.getFlaggedWallets(20)); } catch { res.json([]); }
  });

  app.get("/api/detective/analyze", async (req, res) => {
    const address = (req.query.address as string || "").trim();
    const chain = (req.query.chain as string || "base").trim();
    if (!address || !address.startsWith("0x") || address.length !== 42) {
      return res.status(400).json({ error: "Valid contract address required" });
    }

    try {
      const results = await withTimeout(
        Promise.allSettled([
          rpcSimulate(address),
          getTokenInfo(address),
          getDeployer(address),
          getHolderCount(address),
          getTopHolders(address),
          getEthUsdPrice(),
          getDexScreenerData(address),
        ]),
        HARD_TIMEOUT,
        "detective-analyze",
      );

      const sim = results[0].status === "fulfilled" ? results[0].value : { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0) };
      const tokenInfo = results[1].status === "fulfilled" ? results[1].value : { name: "Unknown", symbol: "???", totalSupply: BigInt(0), decimals: 18 };
      let deployer = results[2].status === "fulfilled" ? results[2].value : null;
      let holderCount = results[3].status === "fulfilled" ? results[3].value : 0;
      const topHolders = results[4].status === "fulfilled" ? results[4].value : [];
      const ethUsd = results[5].status === "fulfilled" ? results[5].value : 0;
      let dexData = results[6].status === "fulfilled" ? results[6].value : { priceUsd: 0, liquidity: 0 };

      let fallbackData: FallbackTokenData | null = null;
      if (holderCount === 0 || (!sim.simulationSuccess && !deployer)) {
        fallbackData = await getFallbackTokenData(address).catch(() => null);
        if (fallbackData) {
          if (holderCount === 0 && fallbackData.holderCount > 0) holderCount = fallbackData.holderCount;
          if (!deployer && fallbackData.creatorAddress) deployer = fallbackData.creatorAddress.toLowerCase();
        }
      }

      let platform = detectPlatform(address, deployer, topHolders);
      if (!platform) {
        const [proxyP, creationP, chainP] = await Promise.all([
          withTimeout(detectPlatformFromProxyImpl(address), 4000, "proxy-impl-detect").catch(() => null),
          withTimeout(detectPlatformFromCreationTx(address), 5000, "creation-platform-detect").catch(() => null),
          deployer ? withTimeout(detectPlatformFromDeployerChain(deployer), 5000, "deployer-chain-detect").catch(() => null) : null,
        ]);
        platform = proxyP || creationP || chainP;
      }
      const scanCount = await storage.incrementLookup(address, tokenInfo.name, tokenInfo.symbol);
      const lpStatus = detectLpStatus(topHolders, platform);
      const isVirtuals = platform === "Virtuals";
      const isManaged = !!(platform && MANAGED_PROTOCOLS.has(platform));

      let buyTax = isManaged ? 0 : sim.buyTax;
      let sellTax = isManaged ? 0 : sim.sellTax;
      let isHoneypot = isManaged ? false : sim.isHoneypot;

      if (!isManaged && !sim.simulationSuccess && fallbackData) {
        buyTax = fallbackData.buyTax;
        sellTax = fallbackData.sellTax;
        isHoneypot = fallbackData.isHoneypot;
      }
      let tokenPriceUsd = dexData.priceUsd;
      if (tokenPriceUsd === 0 && sim.tokensReceived > BigInt(0) && ethUsd > 0) {
        const tokensWholeUnits = Number(sim.tokensReceived) / (10 ** tokenInfo.decimals);
        tokenPriceUsd = tokensWholeUnits > 0 ? (0.001 / tokensWholeUnits) * ethUsd : 0;
      }
      const calculatedMcap = Number(tokenInfo.totalSupply) * tokenPriceUsd;
      const mcap = dexData.dexMcap > 0 ? dexData.dexMcap : (dexData.dexFdv > 0 ? dexData.dexFdv : calculatedMcap);

      const nameUpper = tokenInfo.name.toUpperCase();
      const symbolUpper = tokenInfo.symbol.toUpperCase();
      const isFakeApol = symbolUpper === "APOL" || nameUpper === "APOL" || nameUpper === "APOL AGENT" || nameUpper.includes("APOLAGENT");

      const riskLevel = isFakeApol || isHoneypot || buyTax > 10 || sellTax > 10 ? "High" : buyTax > 0 || sellTax > 0 ? "Caution" : "Clean";

      storage.logAgentActivity({
        action: "contract_scan",
        target: address,
        detail: `Analyzed ${tokenInfo.symbol || "unknown"} contract. Simulation: ${sim.simulationSuccess ? "success" : "failed"}. Risk: ${riskLevel}. ${isHoneypot ? "Honeypot detected." : ""} ${buyTax > 0 || sellTax > 0 ? `Tax: ${buyTax}%/${sellTax}%.` : "No tax."} ${platform ? `Platform: ${platform}.` : ""} Holders: ${holderCount}.`.replace(/\s+/g, " ").trim(),
        verdict: riskLevel,
        source: "web",
        metadata: { tokenSymbol: tokenInfo.symbol, tokenName: tokenInfo.name, isHoneypot, buyTax, sellTax, platform, holderCount, mcap },
      }).catch(() => {});

      res.json({
        address, chain, addressType: "contract",
        riskLevel,
        tokenName: tokenInfo.name, tokenSymbol: tokenInfo.symbol,
        isHoneypot, buyTax, sellTax,
        simulationSuccess: sim.simulationSuccess,
        feeTier: sim.feeTier,
        platform: platform || null,
        lpStatus,
        holderCount,
        priceUsd: tokenPriceUsd,
        mcap,
        liquidity: dexData.liquidity,
        deployer,
        scanCount,
        greenBadge: riskLevel === "Clean" && sim.simulationSuccess && !isFakeApol,
        isFakeApol,
        fakeApolWarning: isFakeApol ? "APOL Agent does NOT have an official token or CA yet. Any $APOL token is a SCAM." : null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Scan failed" });
    }
  });

  app.post("/api/agent/analyze", async (req, res) => {
    try {
      const { agentName, socialLink, wallet, chain = "base", claimedAbilities, logsUrl, viewerWallet } = req.body;
      if (!agentName) return res.status(400).json({ error: "Agent name is required" });

      let scanTier: "free" | "paid" = "free";
      if (typeof viewerWallet === "string" && /^0x[a-fA-F0-9]{40}$/.test(viewerWallet)) {
        const lowerViewer = viewerWallet.toLowerCase();
        if (ADMIN_WALLETS.has(lowerViewer)) {
          scanTier = "paid";
        } else {
          try {
            const sub = await storage.getActiveSubscriptionByWallet(viewerWallet);
            if (sub) scanTier = "paid";
          } catch {}
        }
      }

      const missingData: string[] = [];
      if (!wallet) missingData.push("wallet");
      if (!logsUrl) missingData.push("logsUrl");
      if (!socialLink) missingData.push("socialLink");
      if (!claimedAbilities) missingData.push("claimedAbilities");

      let contractScan: any = null;
      let speedScore = 0;
      let speedDetail = "";
      let traceIsContract = false;
      let traceDetail = "";
      let deployerAddr: string | null = null;
      let deployerContractCount = 0;
      let treasuryEth = 0;
      let treasuryUsd = 0;

      if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        const [simR, tokenR, deployerR] = await Promise.allSettled([
          withTimeout(rpcSimulate(wallet), HARD_TIMEOUT, "sim"),
          withTimeout(getTokenInfo(wallet), HARD_TIMEOUT, "tokenInfo"),
          withTimeout(getDeployer(wallet), 5000, "deployer"),
        ]);

        const sim = simR.status === "fulfilled" ? simR.value
          : { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0) };
        const tokenInfo = tokenR.status === "fulfilled" ? tokenR.value
          : { name: "Unknown", symbol: "???", totalSupply: BigInt(0), decimals: 18 };
        deployerAddr = deployerR.status === "fulfilled" ? deployerR.value : null;

        const [holderCount, topHolders] = await Promise.all([
          getHolderCount(wallet).catch(() => 0),
          getTopHolders(wallet).catch(() => []),
        ]);

        let platform = detectPlatform(wallet, deployerAddr, topHolders);
        if (!platform) {
          const [creationP, chainP] = await Promise.all([
            detectPlatformFromCreationTx(wallet).catch(() => null),
            deployerAddr ? detectPlatformFromDeployerChain(deployerAddr).catch(() => null) : null,
          ]);
          platform = creationP || chainP;
        }
        const isVirtuals = platform === "Virtuals";
        const isManaged = !!(platform && MANAGED_PROTOCOLS.has(platform));
        const buyTax = isManaged ? 0 : sim.buyTax;
        const sellTax = isManaged ? 0 : sim.sellTax;
        const honeypot = isManaged ? false : sim.isHoneypot;

        const lpLockedPercent = (() => {
          let burned = 0;
          let locked = 0;
          for (const h of topHolders) {
            if (BURN_ADDRS.has(h.address)) burned += h.percent;
            else if (LOCKER_MAP[h.address]) locked += h.percent;
          }
          return burned + locked;
        })();

        const lockLocations: string[] = [];
        for (const h of topHolders) {
          if (BURN_ADDRS.has(h.address)) lockLocations.push("Burn Address");
          else if (LOCKER_MAP[h.address]) lockLocations.push(LOCKER_MAP[h.address]);
        }

        contractScan = {
          honeypot, buyTax, sellTax,
          lpLockedPercent,
          lockLocations: [...new Set(lockLocations)],
          topHolders: topHolders.map(h => ({
            address: h.address,
            percent: h.percent,
            tag: BURN_ADDRS.has(h.address) ? "Burn" : LOCKER_MAP[h.address] || PLATFORM_MAP[h.address] || "",
            isBurn: BURN_ADDRS.has(h.address),
          })),
          holderCount,
          protocolLocker: platform || null,
        };

        traceIsContract = sim.simulationSuccess || tokenInfo.name !== "Unknown";
        traceDetail = traceIsContract
          ? `On-chain contract verified: ${tokenInfo.name} ($${tokenInfo.symbol}). ${holderCount} holders.`
          : "Contract address provided but could not verify on-chain token.";

        if (deployerAddr) {
          try {
            if (BASE_RPC) {
              const deplResp = await fetch(BASE_RPC, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers",
                  params: [{ fromBlock: "0x0", toBlock: "latest", fromAddress: deployerAddr, category: ["erc20"], maxCount: "0x32", excludeZeroValue: false }] }),
                signal: AbortSignal.timeout(6000),
              });
              const deplData = await deplResp.json() as any;
              const deplTransfers = deplData?.result?.transfers || [];
              const uniqueContracts = new Set<string>();
              for (const t of deplTransfers) {
                if (t.rawContract?.address) uniqueContracts.add(t.rawContract.address.toLowerCase());
              }
              deployerContractCount = uniqueContracts.size;

              const walletResp = await fetch(BASE_RPC, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "alchemy_getAssetTransfers",
                  params: [{ fromBlock: "0x0", toBlock: "latest", fromAddress: wallet, category: ["external", "erc20"], maxCount: "0x32" }] }),
                signal: AbortSignal.timeout(6000),
              });
              const walletData = await walletResp.json() as any;
              const walletTransfers = walletData?.result?.transfers || [];
              if (walletTransfers.length > 5) {
                const blockNums = walletTransfers.map((t: any) => parseInt(t.blockNum, 16));
                const uniqueBlocks = new Set(blockNums);
                speedScore = Math.min(30, uniqueBlocks.size * 2);
                speedDetail = uniqueBlocks.size >= 20 ? "High on-chain activity detected — consistent with autonomous agent." : uniqueBlocks.size >= 10 ? "Mixed activity patterns — some autonomous behavior." : "Limited activity — likely manual operator.";
              } else {
                speedScore = 5;
                speedDetail = "Insufficient transaction history for timing analysis.";
              }
            }
          } catch {}

          try {
            const [balResult] = await rpcBatch([{ method: "eth_getBalance", params: [deployerAddr, "latest"] }]);
            treasuryEth = balResult ? Number(BigInt(balResult)) / 1e18 : 0;
            const ethUsd = await getEthUsdPrice().catch(() => 0);
            treasuryUsd = treasuryEth * ethUsd;
          } catch {}
        }
      } else if (wallet) {
        traceDetail = "Invalid wallet address format.";
      } else {
        traceDetail = "No wallet address provided — cannot verify on-chain presence.";
        speedDetail = "No wallet address provided — cannot analyze timing patterns.";
      }

      let contractActivity: ContractActivity = { txCount: 0, contractAgeDays: 0, hasContractCode: false, codeSize: 0, activityPerDay: 0 };
      const isClankerPlatform = contractScan?.protocolLocker === "Clanker";
      let clankerData: ClankerData | null = null;
      let recentDeployerData: { recentCount: number; recentTokens: { name: string; address: string; ageDays: number }[] } = { recentCount: 0, recentTokens: [] };
      let dexSocialData: { twitter: string | null; website: string | null; description: string | null } = { twitter: null, website: null, description: null };

      if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        const [activityResult, clankerResult, recentDeployerResult, dexSocialsResult] = await Promise.allSettled([
          getContractActivity(wallet),
          isClankerPlatform ? fetchClankerData(wallet) : Promise.resolve(null),
          deployerAddr ? checkRecentDeployerTokens(deployerAddr) : Promise.resolve({ recentCount: 0, recentTokens: [] }),
          getDexScreenerSocials(wallet),
        ]);
        if (activityResult.status === "fulfilled") contractActivity = activityResult.value;
        if (clankerResult.status === "fulfilled" && clankerResult.value) clankerData = clankerResult.value;
        if (recentDeployerResult.status === "fulfilled") recentDeployerData = recentDeployerResult.value;
        if (dexSocialsResult.status === "fulfilled") dexSocialData = dexSocialsResult.value;
      }

      let autoAbilityAudit: AbilityAudit | null = null;
      let twitterBio: string | null = null;
      if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        try {
          let fetchedBio: string | null = null;
          if (dexSocialData.twitter) {
            try {
              const xRes = await fetch(`https://api.fxtwitter.com/${dexSocialData.twitter}`, { signal: AbortSignal.timeout(5000) });
              if (xRes.ok) {
                const xData = await xRes.json() as any;
                fetchedBio = xData?.user?.description || null;
              }
            } catch {}
          }
          twitterBio = fetchedBio;
          autoAbilityAudit = await autoAuditAbilities(fetchedBio, dexSocialData.description, dexSocialData.website, contractActivity);
        } catch {}
      }

      let socialStatus: "clear" | "suspicious" | "inconclusive" = "inconclusive";
      let socialDetail = "No social link provided.";
      let socialFollowers: number | undefined;
      let socialAgeDays: number | undefined;

      if (socialLink) {
        const handle = socialLink.replace(/https?:\/\/(x\.com|twitter\.com)\//i, "").replace(/^@/, "").split("/")[0].split("?")[0].trim();
        if (handle) {
          try {
            const xRes = await fetch(`https://api.fxtwitter.com/${handle}`, { signal: AbortSignal.timeout(6000) });
            if (xRes.ok) {
              const xData = await xRes.json() as any;
              const u = xData?.user;
              if (u) {
                socialFollowers = u.followers || 0;
                const joinDate = u.joined ? new Date(u.joined) : null;
                socialAgeDays = joinDate ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24)) : undefined;

                const flags: string[] = [];
                if (socialFollowers < 10) flags.push("very few followers");
                if (socialAgeDays !== undefined && socialAgeDays < 14) flags.push("account < 14 days old");
                if ((u.tweets || 0) < 5) flags.push("barely any tweets");
                if (u.following > 0 && socialFollowers / u.following < 0.05) flags.push("suspicious follow ratio");

                if (flags.length >= 2) {
                  socialStatus = "suspicious";
                  socialDetail = `Suspicious social profile: ${flags.join(", ")}. ${socialFollowers} followers, ${socialAgeDays ?? "?"} days old.`;
                } else if (flags.length === 1) {
                  socialStatus = "inconclusive";
                  socialDetail = `Minor concern: ${flags[0]}. ${socialFollowers} followers, ${u.tweets || 0} tweets, ${socialAgeDays ?? "?"} days old.`;
                } else {
                  socialStatus = "clear";
                  socialDetail = `Social profile appears legitimate. ${socialFollowers} followers, ${u.tweets || 0} tweets, account age: ${socialAgeDays ?? "?"} days.`;
                }
              }
            }
          } catch {}
        }
      }

      let contextScore = 0;
      let contextDetail = "No claimed abilities provided for analysis.";
      if (claimedAbilities && claimedAbilities.trim()) {
        const abilities = claimedAbilities.toLowerCase();
        const keywords = ["trade", "trading", "swap", "monitor", "snipe", "analyze", "scan", "track", "alert", "report", "post", "tweet", "bridge", "yield", "farm", "lend", "borrow", "stake"];
        const matches = keywords.filter(k => abilities.includes(k));
        contextScore = Math.min(20, matches.length * 5);
        if (matches.length >= 3) contextDetail = `Strong capability claims: ${matches.slice(0, 4).join(", ")}. Claims appear detailed and specific.`;
        else if (matches.length >= 1) contextDetail = `Some capability claims: ${matches.join(", ")}. Partially verifiable.`;
        else contextDetail = "Claimed abilities are vague or don't match known agent patterns.";
      } else if (autoAbilityAudit && autoAbilityAudit.claimedAbilities.length > 0) {
        contextScore = Math.min(20, autoAbilityAudit.claimedAbilities.length * 5);
        contextDetail = `Auto-detected abilities from socials/description: ${autoAbilityAudit.claimedAbilities.join(", ")}.`;
        if (autoAbilityAudit.abilityMismatch) contextDetail += ` ⚠️ ${autoAbilityAudit.abilityMismatch}`;
      }

      let logsStatus: "verified" | "mismatch" | "inconclusive" = "inconclusive";
      let logsDetail = "No logs URL provided.";
      const logsArr: string[] = [];
      if (!logsUrl && autoAbilityAudit) {
        if (autoAbilityAudit.reasoningStatus === "verified") {
          logsStatus = "verified";
          logsDetail = autoAbilityAudit.reasoningDetail;
          if (autoAbilityAudit.reasoningUrl) logsArr.push(`Auto-discovered: ${autoAbilityAudit.reasoningUrl}`);
        } else if (autoAbilityAudit.reasoningStatus === "mismatch") {
          logsStatus = "inconclusive";
          logsDetail = autoAbilityAudit.reasoningDetail;
        } else if (autoAbilityAudit.reasoningStatus === "not_found") {
          logsStatus = "inconclusive";
          logsDetail = autoAbilityAudit.reasoningDetail;
        }
      }
      if (logsUrl && logsUrl.trim() && isSafeUrl(logsUrl.trim())) {
        try {
          const logsRes = await fetch(logsUrl.trim(), { signal: AbortSignal.timeout(5000) });
          if (logsRes.ok) {
            const text = await logsRes.text();
            logsArr.push(text.slice(0, 500));
            const hasTimestamps = /\d{4}-\d{2}-\d{2}|\d{10,13}|T\d{2}:\d{2}/.test(text);
            const hasReasoningWords = /decided|chose|analyzing|calculated|executed|swapped|bought|sold/i.test(text);
            if (hasTimestamps && hasReasoningWords) {
              logsStatus = "verified";
              logsDetail = "Logs contain timestamped reasoning entries consistent with autonomous operation.";
            } else if (hasTimestamps || hasReasoningWords) {
              logsStatus = "inconclusive";
              logsDetail = "Logs partially verifiable — missing either timestamps or reasoning traces.";
            } else {
              logsStatus = "mismatch";
              logsDetail = "Logs do not contain expected autonomous reasoning patterns.";
            }
          } else {
            logsDetail = "Could not fetch logs URL — returned error.";
          }
        } catch {
          logsDetail = "Could not fetch logs URL — timeout or connection error.";
        }
        if (logsStatus === "inconclusive" && autoAbilityAudit?.reasoningStatus === "verified") {
          logsStatus = "verified";
          logsDetail = autoAbilityAudit.reasoningDetail;
          if (autoAbilityAudit.reasoningUrl) logsArr.push(`Auto-discovered: ${autoAbilityAudit.reasoningUrl}`);
        }
      }

      let activityScore = 0;
      let activityLabel = "Unknown";
      let activityDetail = "No wallet address provided — cannot audit on-chain activity.";
      if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        if (contractActivity.txCount === 0 && contractActivity.contractAgeDays > 3) {
          activityScore = 0;
          activityLabel = "Dead";
          activityDetail = `Contract has zero on-chain transactions over ${contractActivity.contractAgeDays} days. No evidence of autonomous activity.`;
        } else if (contractActivity.txCount > 0 && contractActivity.txCount < 10 && contractActivity.contractAgeDays > 7) {
          activityScore = 3;
          activityLabel = "Dormant";
          activityDetail = `Only ${contractActivity.txCount} transactions in ${contractActivity.contractAgeDays} days. Near-dormant contract with minimal interactions.`;
        } else if (contractActivity.activityPerDay >= 1) {
          activityScore = 15;
          activityLabel = "Active";
          activityDetail = `${contractActivity.txCount.toLocaleString()} transactions over ${contractActivity.contractAgeDays} days (${contractActivity.activityPerDay}/day). Consistent on-chain activity detected.`;
        } else if (contractActivity.txCount >= 10) {
          activityScore = 8;
          activityLabel = "Moderate";
          activityDetail = `${contractActivity.txCount.toLocaleString()} transactions over ${contractActivity.contractAgeDays} days. Some activity present but not highly active.`;
        } else {
          activityScore = 5;
          activityLabel = "Low";
          activityDetail = `${contractActivity.txCount} transactions over ${contractActivity.contractAgeDays || "?"} days. Limited activity detected.`;
        }
      }

      let codeSizeScore = 0;
      let codeSizeLabel = "Unknown";
      let codeSizeDetail = "No wallet provided — cannot check contract code.";
      if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        if (!contractActivity.hasContractCode || contractActivity.codeSize < 500) {
          codeSizeScore = 0;
          codeSizeLabel = "Bare Token";
          codeSizeDetail = `Contract bytecode is ${contractActivity.codeSize > 0 ? `only ${(contractActivity.codeSize / 1024).toFixed(1)}KB` : "empty"}. Standard ERC-20 with no agent logic.`;
        } else if (contractActivity.codeSize >= 5000) {
          codeSizeScore = 10;
          codeSizeLabel = "Complex";
          codeSizeDetail = `Contract bytecode is ${(contractActivity.codeSize / 1024).toFixed(1)}KB. Complex contract code — agent logic possible.`;
        } else {
          codeSizeScore = 5;
          codeSizeLabel = "Moderate";
          codeSizeDetail = `Contract bytecode is ${(contractActivity.codeSize / 1024).toFixed(1)}KB. Some additional logic beyond standard ERC-20.`;
        }
      }

      const traceScore = traceIsContract ? 20 : wallet ? 5 : 0;
      const socialScore = socialStatus === "clear" ? 20 : socialStatus === "suspicious" ? 5 : 10;
      const logsScore = logsStatus === "verified" ? 20 : logsStatus === "mismatch" ? 0 : 5;
      const rawScore = speedScore + traceScore + contextScore + socialScore + logsScore + activityScore + codeSizeScore;

      const hasAutoAbilities = !claimedAbilities && autoAbilityAudit && autoAbilityAudit.claimedAbilities.length > 0;
      const hasAutoLogs = !logsUrl && autoAbilityAudit && (autoAbilityAudit.reasoningStatus === "verified" || autoAbilityAudit.reasoningStatus === "mismatch");
      const scoredTests = [
        wallet ? 1 : 0,
        socialLink ? 1 : 0,
        (logsUrl || hasAutoLogs) ? 1 : 0,
        (claimedAbilities || hasAutoAbilities) ? 1 : 0,
        wallet ? 1 : 0,
      ].reduce((a, b) => a + b, 0);

      const isVerifiedAgent = !!(wallet && VERIFIED_AGENTS[wallet.toLowerCase()]);

      const hasWallet = !!(wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet));
      const zeroAgentTrace = !isVerifiedAgent && hasWallet
        && speedScore === 0
        && codeSizeScore === 0
        && activityScore <= 5
        && socialStatus !== "clear"
        && logsStatus !== "verified"
        && (!autoAbilityAudit || autoAbilityAudit.claimedAbilities.length === 0)
        && !traceIsContract;

      const cognitionScore = isVerifiedAgent ? 100 : zeroAgentTrace ? 0 : (scoredTests >= 2 ? Math.min(100, rawScore) : null);
      const isPartial = isVerifiedAgent ? false : zeroAgentTrace ? false : scoredTests < 3;

      type Verdict = "Confirmed LARP" | "Unverified" | "Semi-Autonomous" | "Fully Autonomous" | "Under Review" | "Insufficient Data" | "Inconclusive";
      let verdict: Verdict;
      if (isVerifiedAgent) verdict = "Fully Autonomous";
      else if (zeroAgentTrace) verdict = "Confirmed LARP";
      else if (scoredTests < 2) verdict = "Insufficient Data";
      else if (cognitionScore !== null && cognitionScore >= 71) verdict = "Fully Autonomous";
      else if (cognitionScore !== null && cognitionScore >= 41) verdict = "Semi-Autonomous";
      else if (cognitionScore !== null && cognitionScore >= 21) verdict = "Under Review";
      else if (cognitionScore !== null && cognitionScore <= 10 && scoredTests >= 4) verdict = "Confirmed LARP";
      else if (cognitionScore !== null) verdict = "Unverified";
      else verdict = "Inconclusive";

      let apolVerdict = "";
      if (isVerifiedAgent) apolVerdict = "Strong evidence of autonomous operation. On-chain activity, social presence, and reasoning logs are consistent with a real AI agent.";
      else if (zeroAgentTrace) apolVerdict = "🚨 100% LARP — ZERO AGENT FOOTPRINT. No on-chain agent activity. No autonomous behavior. No verifiable reasoning. No social presence. No agent logic in contract code. This is a bare token cosplaying as an AI agent. APOL has weighed, measured, and found this to be a complete fraud.";
      else if (verdict === "Confirmed LARP") apolVerdict = "LARP CONFIRMED. Every verifiable data point contradicts autonomous operation. This entity has been weighed, measured, and found to be a fraud.";
      else if (verdict === "Unverified") apolVerdict = "APOL could not verify autonomous operation from the evidence provided. This does not confirm fraud — it means the entity has not proven itself. Proceed with caution.";
      else if (verdict === "Under Review") apolVerdict = "Some indicators present but not enough to confirm autonomous operation. APOL reserves judgment until more evidence is available.";
      else if (verdict === "Semi-Autonomous") apolVerdict = "Mixed signals detected. Some autonomous patterns present but not fully conclusive. Monitor for continued activity.";
      else if (verdict === "Fully Autonomous") apolVerdict = "Strong evidence of autonomous operation. On-chain activity, social presence, and reasoning logs are consistent with a real AI agent.";
      else if (verdict === "Insufficient Data") apolVerdict = "Not enough data to issue a verdict. Provide wallet address for automatic on-chain audit. APOL does not speculate without evidence.";
      else apolVerdict = "No verifiable evidence submitted. APOL makes no claims without data.";

      if (!isVerifiedAgent) {
        if (contractActivity.txCount === 0 && contractActivity.contractAgeDays > 7 && wallet) {
          apolVerdict += " 🚨 DEAD CONTRACT — No on-chain activity found despite contract being live for " + contractActivity.contractAgeDays + " days.";
        }
        if (recentDeployerData.recentCount >= SERIAL_DEPLOYER_THRESHOLD) {
          apolVerdict += ` 🚨 POTENTIAL SERIAL DEPLOYER — ${recentDeployerData.recentCount} tokens launched in the last ${SERIAL_DEPLOYER_WINDOW_DAYS} days.`;
        }
        if (deployerContractCount >= 5) apolVerdict += ` ⚠️ Serial deployer detected: ${deployerContractCount} contracts from the same creator.`;
        if (treasuryEth < 0.005 && wallet) apolVerdict += " ⚠️ Creator treasury is near-empty.";
        if (!contractActivity.hasContractCode && wallet) apolVerdict += " ⚠️ No contract code found — this is a bare token with no agent logic.";
        if (autoAbilityAudit?.abilityMismatch) apolVerdict += ` ⚠️ ${autoAbilityAudit.abilityMismatch}`;
      }
      if (autoAbilityAudit?.reasoningStatus === "verified") apolVerdict += " ✅ Autonomous reasoning logs detected.";
      if (!isVerifiedAgent && autoAbilityAudit?.reasoningStatus === "not_found" && autoAbilityAudit.claimedAbilities.length > 0) apolVerdict += " ⚠️ Claims abilities but no public reasoning logs found.";

      storage.logAgentActivity({
        action: "agent_verification",
        target: agentName.trim(),
        detail: `Verified agent "${agentName.trim()}". Cognition score: ${cognitionScore ?? "N/A"}. Tests scored: ${scoredTests}. ${traceIsContract ? "On-chain contract verified." : "No on-chain contract."} ${autoAbilityAudit?.claimedAbilities?.length ? `Abilities: ${autoAbilityAudit.claimedAbilities.join(", ")}.` : ""} ${autoAbilityAudit?.reasoningStatus === "verified" ? "Reasoning logs verified." : autoAbilityAudit?.reasoningStatus === "mismatch" ? "Reasoning logs mismatch." : "No reasoning logs found."}`.replace(/\s+/g, " ").trim(),
        verdict,
        source: "web",
        metadata: { cognitionScore, scoredTests, wallet, socialLink, abilities: autoAbilityAudit?.claimedAbilities },
      }).catch(() => {});

      const fullResult = {
        agentName: agentName.trim(),
        wallet: wallet || null,
        cognitionScore,
        verdict,
        apolVerdict,
        scoredTests,
        missingData: missingData.length > 0 ? missingData : undefined,
        isPartial,
        speedTest: { scored: !!wallet, score: speedScore, maxScore: 30, label: speedScore >= 15 ? "Active" : "Limited", detail: speedDetail },
        traceabilityTest: { scored: !!wallet, score: traceScore, maxScore: 20, label: traceIsContract ? "Verified" : "Unverified", detail: traceDetail, isContract: traceIsContract },
        contextTest: { scored: !!claimedAbilities, score: contextScore, maxScore: 20, label: contextScore >= 10 ? "Coherent" : "Vague", detail: contextDetail },
        logsTest: { status: logsStatus, detail: logsDetail, logs: logsArr },
        socialTest: { status: socialStatus, detail: socialDetail, followers: socialFollowers, accountAgeDays: socialAgeDays },
        onChainActivityTest: { scored: !!(wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)), score: activityScore, maxScore: 15, label: activityLabel, detail: activityDetail, txCount: contractActivity.txCount, contractAgeDays: contractActivity.contractAgeDays, activityPerDay: contractActivity.activityPerDay },
        codeSizeTest: { scored: !!(wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)), score: codeSizeScore, maxScore: 10, label: codeSizeLabel, detail: codeSizeDetail, codeSize: contractActivity.codeSize, hasCode: contractActivity.hasContractCode },
        contractScan,
        creatorAddress: deployerAddr,
        platformName: contractScan?.protocolLocker || null,
        isKnownFactory: !!contractScan?.protocolLocker,
        abilityAudit: autoAbilityAudit ? {
          claimedAbilities: autoAbilityAudit.claimedAbilities,
          reasoningUrl: autoAbilityAudit.reasoningUrl,
          reasoningStatus: autoAbilityAudit.reasoningStatus,
          reasoningDetail: autoAbilityAudit.reasoningDetail,
          abilityMismatch: autoAbilityAudit.abilityMismatch,
        } : undefined,
        clankerData: clankerData ? {
          volume24h: clankerData.volume24h,
          marketCap: clankerData.marketCap,
          rewardsAvailable: clankerData.rewardsAvailable,
          warnings: clankerData.warnings,
          tags: clankerData.tags,
        } : undefined,
        serialDeployer: recentDeployerData.recentCount >= SERIAL_DEPLOYER_THRESHOLD ? {
          recentCount: recentDeployerData.recentCount,
          windowDays: SERIAL_DEPLOYER_WINDOW_DAYS,
          recentTokens: recentDeployerData.recentTokens,
        } : undefined,
        twitterHandle: dexSocialData.twitter || undefined,
      };

      let slug: string | null = null;
      try {
        const baseSlug = agentName.trim().toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || "agent";
        for (let attempt = 0; attempt < 5; attempt++) {
          const suffix = Math.random().toString(36).slice(2, 8);
          const candidate = `${baseSlug}-${suffix}`;
          try {
            await storage.saveAgentScanResult({
              slug: candidate,
              agentName: agentName.trim(),
              wallet: wallet || null,
              chain,
              twitterHandle: dexSocialData.twitter || null,
              socialLink: typeof socialLink === "string" && socialLink.trim() ? socialLink.trim().slice(0, 500) : null,
              logsUrl: typeof logsUrl === "string" && logsUrl.trim() ? logsUrl.trim().slice(0, 500) : null,
              claimedAbilities: typeof claimedAbilities === "string" && claimedAbilities.trim() ? claimedAbilities.trim().slice(0, 2000) : null,
              resultJson: fullResult,
              tier: scanTier,
            });
            slug = candidate;
            break;
          } catch (e: any) {
            if (!String(e?.message || "").match(/unique|duplicate/i)) throw e;
          }
        }
      } catch (e) {
        // saving is best-effort; never block the scan response
      }

      res.json({ ...fullResult, slug, shareUrl: slug ? `/agent-scanner/${slug}` : null, tier: scanTier });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Agent analysis failed" });
    }
  });

  app.get("/api/agent/result/:slug", async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim();
      if (!/^[a-z0-9-]{3,80}$/.test(slug)) return res.status(400).json({ error: "Invalid slug" });
      const row = await storage.getAgentScanResultBySlug(slug);
      if (!row) return res.status(404).json({ error: "Scan result not found" });
      res.json({
        slug: row.slug,
        agentName: row.agentName,
        wallet: row.wallet,
        chain: row.chain,
        twitterHandle: row.twitterHandle,
        socialLink: row.socialLink,
        logsUrl: row.logsUrl,
        claimedAbilities: row.claimedAbilities,
        createdAt: row.createdAt,
        viewCount: row.viewCount,
        tier: row.tier,
        result: row.resultJson,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to load result" });
    }
  });

  app.post("/api/agent/result/:slug/upgrade", async (req, res) => {
    try {
      const slug = String(req.params.slug || "").trim();
      const wallet = String(req.body?.wallet || "").trim();
      if (!/^[a-z0-9-]{3,80}$/.test(slug)) return res.status(400).json({ error: "Invalid slug" });
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return res.status(400).json({ error: "Invalid wallet" });
      const lower = wallet.toLowerCase();
      let isPaid = ADMIN_WALLETS.has(lower);
      if (!isPaid) {
        const sub = await storage.getActiveSubscriptionByWallet(wallet);
        if (sub) isPaid = true;
      }
      if (!isPaid) return res.status(403).json({ error: "Wallet has no active subscription" });
      const updated = await storage.upgradeAgentScanResultTier(slug, "paid");
      if (!updated) return res.status(404).json({ error: "Scan result not found" });
      res.json({ ok: true, slug: updated.slug, tier: updated.tier });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Upgrade failed" });
    }
  });

  app.get("/api/scanx", async (req, res) => {
    try {
      const raw = (req.query.username as string || "").trim();
      if (!raw) return res.status(400).json({ error: "Username is required" });

      const handle = raw.replace(/https?:\/\/(x\.com|twitter\.com)\//i, "").replace(/^@/, "").split("/")[0].split("?")[0].trim();
      if (!handle) return res.status(400).json({ error: "Invalid handle" });

      const SELF_HANDLES = ["apolagent_", "apolagent", "apol_agent", "apolagentbot"];
      if (SELF_HANDLES.includes(handle.toLowerCase())) {
        return res.json({
          username: handle, displayName: "APOL Agent", bio: "Official security protocol on Base chain. APOL does NOT have an official token or CA yet.", followers: 0, following: 0,
          followRatio: "0:0", joinedDate: "", ageDays: 0, totalTweets: 0, isVerified: true, profileImage: null,
          engagement: { rating: "N/A", avgLikes: 0, avgRetweets: 0 }, flags: [], verdict: "VERIFIED — Official APOL Agent",
          verdictLevel: "green", linkedCA: null, linkedSymbol: null,
          agentAbilities: [], reasoningStatus: "no_source" as const, reasoningDetail: "Official protocol — not applicable.", abilityMismatch: null, reasoningUrl: null,
        });
      }

      const profileResp = await fetch(`https://api.fxtwitter.com/${handle}`, { signal: AbortSignal.timeout(6000) });
      if (!profileResp.ok) return res.status(404).json({ error: "Could not fetch profile" });
      const profileData = await profileResp.json() as any;
      const u = profileData?.user;
      if (!u) return res.status(404).json({ error: "User not found" });

      const joinDate = u.joined ? new Date(u.joined) : null;
      const ageDays = joinDate ? Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const followRatio = u.following > 0 ? `${(u.followers / u.following).toFixed(1)}:1` : u.followers > 0 ? "∞:1" : "0:0";
      const bio: string = u.description || "";

      const flags: { text: string; type: "critical" | "warning" | "info" }[] = [];
      if (ageDays > 0 && ageDays < 30) flags.push({ text: "Account less than 30 days old", type: "critical" });
      if ((u.followers || 0) < 10) flags.push({ text: "Very few followers", type: "critical" });
      if (u.following > 0 && u.followers / u.following < 0.1) flags.push({ text: "Suspicious follow ratio", type: "warning" });
      if ((u.tweets || 0) < 5) flags.push({ text: "Very few tweets", type: "warning" });
      if (bio && /t\.co|http|\.com|\.xyz|\.io/i.test(bio) && (u.followers || 0) < 50) flags.push({ text: "Link-heavy bio with low following", type: "warning" });

      if (ageDays > 180 && (u.followers || 0) >= 100) flags.push({ text: "Established account with history", type: "info" });
      if ((u.tweets || 0) >= 100) flags.push({ text: "Active posting history", type: "info" });

      const bioCAMatch = bio.match(/0x[a-fA-F0-9]{40}/);
      const bioCA = bioCAMatch ? bioCAMatch[0] : null;

      let linkedCA: string | null = null;
      let linkedSymbol: string | null = null;
      try {
        const dexData = await fetch(`${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(handle)}`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() as any : null);
        const pair = dexData?.pairs?.find((p: any) => p.chainId === "base");
        if (pair?.baseToken?.address) {
          linkedCA = pair.baseToken.address;
          linkedSymbol = `${pair.baseToken.name} ($${pair.baseToken.symbol})`;
        }
      } catch {}
      if (!linkedCA && bioCA) { linkedCA = bioCA; linkedSymbol = "From bio"; }

      const abilities = extractAbilitiesFromText(bio);

      let websiteUrl: string | null = null;
      const urlsInBio = (bio.match(/https?:\/\/[^\s"'<>)\]]+/gi) || [])
        .filter((u: string) => !u.includes("x.com") && !u.includes("twitter.com") && !u.includes("t.me") && !u.includes("discord"))
        .filter(isSafeUrl);
      if (urlsInBio.length > 0) websiteUrl = urlsInBio[0];

      let dummyActivity: ContractActivity = { txCount: 0, contractAgeDays: 0, hasContractCode: false, codeSize: 0, activityPerDay: 0 };
      if (linkedCA && /^0x[a-fA-F0-9]{40}$/.test(linkedCA)) {
        try { dummyActivity = await getContractActivity(linkedCA); } catch {}
      }

      const abilityAudit = await autoAuditAbilities(bio, null, websiteUrl, dummyActivity);

      const criticalFlags = flags.filter(f => f.type === "critical").length;
      const warningFlags = flags.filter(f => f.type === "warning").length;
      const infoFlags = flags.filter(f => f.type === "info").length;

      let verdict = "";
      let verdictLevel: "green" | "red" | "yellow" | "grey" = "grey";

      const hasConfirmedLarp = criticalFlags >= 3
        || (criticalFlags >= 2 && warningFlags >= 2)
        || ((u.tweets || 0) < 3 && (u.followers || 0) < 5 && ageDays < 14 && abilities.length === 0);

      const hasStrongEvidence = criticalFlags >= 2 || (criticalFlags >= 1 && warningFlags >= 2);

      if (hasConfirmedLarp) {
        verdict = "LARP CONFIRMED — This account shows zero signs of autonomous operation. Empty shell with no verifiable agent activity.";
        verdictLevel = "red";
      } else if (hasStrongEvidence) {
        verdict = "Suspicious — Multiple risk indicators present. Insufficient evidence to confirm legitimacy.";
        verdictLevel = "red";
      } else if (criticalFlags >= 1 || warningFlags >= 2) {
        verdict = "Inconclusive — Some concerns detected. Not enough data to confirm or deny agent status.";
        verdictLevel = "yellow";
      } else if (infoFlags >= 1 && criticalFlags === 0 && warningFlags === 0) {
        verdict = "Profile appears established. Social presence is consistent but autonomous operation not verified from social data alone.";
        verdictLevel = "green";
      } else {
        verdict = "Inconclusive — Insufficient data to make a determination. Provide additional evidence for a complete assessment.";
        verdictLevel = "grey";
      }

      if (abilityAudit.abilityMismatch && verdictLevel !== "red") {
        verdict += ` Note: ${abilityAudit.abilityMismatch}`;
      }
      if (abilityAudit.reasoningStatus === "verified") {
        verdict += " Autonomous reasoning logs detected at linked endpoint.";
        if (verdictLevel !== "red") verdictLevel = "green";
      }

      storage.logAgentActivity({
        action: "x_agent_scan",
        target: `@${u.screen_name || handle}`,
        detail: `Scanned X agent @${u.screen_name || handle}. ${flags.length} risk flags. ${abilities.length > 0 ? `Abilities: ${abilities.join(", ")}.` : "No abilities detected."} ${abilityAudit.reasoningStatus === "verified" ? "Reasoning logs verified." : abilityAudit.reasoningStatus === "mismatch" ? "Dashboard found but no reasoning traces." : "No reasoning logs."} ${linkedCA ? `Linked token: ${linkedSymbol} (${linkedCA}).` : "No linked token."}`.replace(/\s+/g, " ").trim(),
        verdict: verdictLevel === "red" ? "LARP Indicators" : verdictLevel === "green" ? "Clean" : "Caution",
        source: "web",
        metadata: { handle: u.screen_name || handle, flags: flags.length, abilities, linkedCA, linkedSymbol, reasoningStatus: abilityAudit.reasoningStatus },
      }).catch(() => {});

      res.json({
        username: u.screen_name || handle,
        displayName: u.name || handle,
        bio: bio.slice(0, 300),
        followers: u.followers || 0,
        following: u.following || 0,
        followRatio,
        joinedDate: joinDate ? joinDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown",
        ageDays,
        totalTweets: u.tweets || 0,
        isVerified: u.verified === true || u.verification?.verified === true || false,
        profileImage: u.avatar_url || null,
        engagement: {
          rating: (u.tweets || 0) >= 100 ? "High" : (u.tweets || 0) >= 10 ? "Medium" : "Low",
          avgLikes: 0,
          avgRetweets: 0,
        },
        flags,
        verdict,
        verdictLevel,
        linkedCA,
        linkedSymbol,
        agentAbilities: abilities,
        reasoningStatus: abilityAudit.reasoningStatus,
        reasoningDetail: abilityAudit.reasoningDetail,
        reasoningUrl: abilityAudit.reasoningUrl,
        abilityMismatch: abilityAudit.abilityMismatch,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Scan failed" });
    }
  });

  const PAYMENT_RECEIVER = "0x857aca6a8a743c9262d64819d239f509a1cd0a85";
  const SUBSCRIPTION_PRICE_WEI = BigInt("20000000000000000");
  const ADMIN_WALLETS = new Set<string>([
    "0x3d3ec699d3a7ac26d2cbc83efbe51e742e0bb31a",
    ...String(process.env.ADMIN_WALLETS || "")
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean),
  ]);
  const SUBSCRIPTION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

  async function verifyOnChainPayment(txHash: string): Promise<{ ok: true; from: string; valueWei: bigint } | { ok: false; reason: string }> {
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return { ok: false, reason: "Invalid transaction hash format." };
    try {
      const res = await fetch(`${BLOCKSCOUT_BASE}/api/v2/transactions/${txHash}`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return { ok: false, reason: `Transaction not found on Base (status ${res.status}).` };
      const data: any = await res.json();
      const status = (data?.status || "").toLowerCase();
      const result = (data?.result || "").toLowerCase();
      const txTo = (data?.to?.hash || "").toLowerCase();
      const txFrom = (data?.from?.hash || "").toLowerCase();
      const valueStr = String(data?.value || "0");
      let valueWei: bigint;
      try { valueWei = BigInt(valueStr); } catch { return { ok: false, reason: "Could not parse transaction value." }; }
      const statusOk = status === "ok" || result === "success";
      if (!statusOk) return { ok: false, reason: `Transaction not confirmed (status: "${status || result || "unknown"}"). Wait for it to be mined.` };
      if (txTo !== PAYMENT_RECEIVER) return { ok: false, reason: `Transaction was sent to ${txTo.slice(0, 10)}..., not the APOL payment address.` };
      if (valueWei < SUBSCRIPTION_PRICE_WEI) {
        const sentEth = (Number(valueWei) / 1e18).toFixed(6);
        return { ok: false, reason: `Payment too low — sent ${sentEth} ETH, need 0.02 ETH.` };
      }
      return { ok: true, from: txFrom, valueWei };
    } catch (e: any) {
      return { ok: false, reason: `Verification failed: ${e?.message?.slice(0, 80) || "Network error"}` };
    }
  }

  app.get("/api/subscription/status", async (req, res) => {
    try {
      const wallet = String(req.query.wallet || "").trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) return res.json({ paid: false });
      if (ADMIN_WALLETS.has(wallet.toLowerCase())) {
        return res.json({ paid: true, admin: true, expiresAt: null, txHash: null });
      }
      const sub = await storage.getActiveSubscriptionByWallet(wallet);
      if (!sub) return res.json({ paid: false });
      return res.json({ paid: true, expiresAt: sub.expiresAt, txHash: sub.txHash });
    } catch (e: any) {
      res.status(500).json({ paid: false, error: e?.message || "Status check failed" });
    }
  });

  app.post("/api/subscription/verify", async (req, res) => {
    try {
      const { txHash, wallet } = req.body || {};
      if (typeof txHash !== "string" || typeof wallet !== "string") {
        return res.status(400).json({ ok: false, reason: "Missing txHash or wallet." });
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ ok: false, reason: "Invalid wallet address." });
      }
      const lowerWallet = wallet.toLowerCase();
      const existing = await storage.getSubscriptionByTxHash(txHash);
      if (existing) {
        const ownerMatches =
          (existing.walletAddress && existing.walletAddress.toLowerCase() === lowerWallet) ||
          (existing.fromAddress && existing.fromAddress.toLowerCase() === lowerWallet);
        if (!ownerMatches) {
          return res.status(403).json({ ok: false, reason: "This transaction has already been claimed by another wallet." });
        }
        const stillActive = new Date(existing.expiresAt).getTime() > Date.now();
        if (stillActive) return res.json({ ok: true, expiresAt: existing.expiresAt, alreadyClaimed: true });
        return res.status(400).json({ ok: false, reason: "This transaction has already been used and the subscription has expired." });
      }
      const verify = await verifyOnChainPayment(txHash);
      if (!verify.ok) return res.status(400).json({ ok: false, reason: verify.reason });
      if (verify.from !== wallet.toLowerCase()) {
        return res.status(400).json({ ok: false, reason: `This transaction was sent from ${verify.from.slice(0, 10)}..., but you are connected as ${wallet.slice(0, 10)}.... Connect the wallet that paid.` });
      }
      const expiresAt = new Date(Date.now() + SUBSCRIPTION_DURATION_MS);
      const sub = await storage.createWebSubscription({
        walletAddress: wallet,
        txHash,
        fromAddress: verify.from,
        amountWei: verify.valueWei.toString(),
        expiresAt,
      });
      res.json({ ok: true, expiresAt: sub.expiresAt });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return res.status(400).json({ ok: false, reason: "This transaction has already been used." });
      }
      res.status(500).json({ ok: false, reason: e?.message || "Verification failed" });
    }
  });

  app.get("/skill/skill.md", (_req, res) => {
    const cwd = process.cwd();
    const devPath = path.resolve(cwd, "client/public/skill/skill.md");
    const prodPath = path.resolve(cwd, "dist/public/skill/skill.md");
    const filePath = fs.existsSync(devPath) ? devPath : prodPath;
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.sendFile(filePath, (err) => {
      if (err) res.status(404).send("Skill file not found");
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
