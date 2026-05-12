import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { installX402 } from "./x402";
import {
  WETH, QUOTER_V2, V3_FACTORY, SIM_AMOUNT, MICRO_AMOUNT, HARD_TIMEOUT, FEE_TIERS,
  BURN_ADDRS, PLATFORM_MAP, LOCKER_MAP, CREATION_LOG_SIGNATURES, MANAGED_PROTOCOLS,
  DEPLOYER_CHAIN_KEYWORDS, BLOCKSCOUT_BASE, DEXSCREENER_BASE, GOPLUS_BASE, BLOCKAID_BASE, BASE_CHAIN_ID,
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
  const moralisKey = process.env.MORALIS_API_KEY;
  if (moralisKey) {
    try {
      const data = await fetch(
        `https://deep-index.moralis.io/api/v2.2/erc20/${addr}/owners?chain=base&limit=1`,
        { headers: { "X-API-Key": moralisKey }, signal: AbortSignal.timeout(6000) },
      ).then((r) => (r.ok ? (r.json() as any) : null));
      const count = parseInt(data?.total ?? data?.total_count ?? "0", 10);
      if (count > 0) return count;
    } catch {}
  }
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

type DexData = { volume24h: number; pairCreatedAt: number | null; poolVersion: string | null; dexId: string | null };
const routesDexCache = new Map<string, { data: DexData; timestamp: number }>();
let routesEthCache: { price: number; timestamp: number } | null = null;
const ROUTES_CACHE_TTL = 60000;
const routesAlchemyPriceCache = new Map<string, { price: number; timestamp: number }>();
const ROUTES_ALCHEMY_PRICE_TTL = 30000;

function getAlchemyKey(): string {
  const m = BASE_RPC.match(/\/v2\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? "";
}

async function dexFetch(url: string, timeoutMs: number): Promise<any> {
  const headers = { "User-Agent": "Mozilla/5.0 (compatible; APOLAgent/1.0; +https://apolagent.online)" };
  let resp = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  console.log(`[DexScreener] GET ${url} → ${resp.status}`);
  if (resp.status === 429) {
    console.log(`[DexScreener] 429 rate-limited, retrying after 2s…`);
    await new Promise<void>(r => setTimeout(r, 2000));
    resp = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    console.log(`[DexScreener] RETRY ${url} → ${resp.status}`);
  }
  if (!resp.ok) {
    console.log(`[DexScreener] Non-OK response (${resp.status}), returning null`);
    return null;
  }
  return resp.json() as Promise<any>;
}

async function getEthUsdPrice(): Promise<number> {
  if (routesEthCache && Date.now() - routesEthCache.timestamp < ROUTES_CACHE_TTL) {
    return routesEthCache.price;
  }
  const tryAlchemy = async (): Promise<number> => {
    const apiKey = getAlchemyKey();
    if (!apiKey) return 0;
    try {
      const resp = await fetch(`https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept": "application/json" },
        body: JSON.stringify({ addresses: [{ network: "base-mainnet", address: WETH }] }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return 0;
      const data = await resp.json() as any;
      return parseFloat(data?.data?.[0]?.prices?.[0]?.value || "0") || 0;
    } catch { return 0; }
  };
  const tryCoingecko = async (): Promise<number> => {
    try {
      const data = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok ? r.json() as any : null);
      return parseFloat(data?.ethereum?.usd || "0") || 0;
    } catch { return 0; }
  };
  const [alchemyResult, cgResult] = await Promise.all([tryAlchemy(), tryCoingecko()]);
  const price = alchemyResult > 0 ? alchemyResult : cgResult;
  if (price > 0) routesEthCache = { price, timestamp: Date.now() };
  return price || routesEthCache?.price || 0;
}

async function getDexScreenerData(addr: string): Promise<DexData> {
  const key = addr.toLowerCase();
  const cached = routesDexCache.get(key);
  if (cached && Date.now() - cached.timestamp < ROUTES_CACHE_TTL) {
    return cached.data;
  }
  const empty: DexData = { volume24h: 0, pairCreatedAt: null, poolVersion: null, dexId: null };
  try {
    const url = `${DEXSCREENER_BASE}/tokens/v1/base/${addr}`;
    const data = await dexFetch(url, 6000);
    console.log(`[getDexScreenerData] addr=${addr} response=${data === null ? "null" : `${Array.isArray(data) ? data.length : "non-array"} pairs`}`);
    const pairs = Array.isArray(data) ? data : [];
    const pair = pairs.length > 1
      ? pairs.reduce((best: any, p: any) => (parseFloat(p?.liquidity?.usd || "0") > parseFloat(best?.liquidity?.usd || "0") ? p : best), pairs[0])
      : pairs[0] || null;
    if (!pair) return cached?.data || empty;
    const rawDexId: string = (pair?.dexId || "").toLowerCase();
    const labels: string[] = Array.isArray(pair?.labels) ? (pair.labels as string[]).map((l: string) => l.toLowerCase()) : [];
    const poolVersion: string | null = labels.includes("v4") ? "V4" : labels.includes("v3") ? "V3" : "V2";
    const result: DexData = {
      volume24h: parseFloat(pair?.volume?.h24 || "0") || 0,
      pairCreatedAt: pair?.pairCreatedAt ? Number(pair.pairCreatedAt) : null,
      poolVersion,
      dexId: rawDexId || null,
    };
    routesDexCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  } catch (err: any) {
    console.log(`[getDexScreenerData] addr=${addr} error=${err?.message ?? err}`);
    return cached?.data || empty;
  }
}

async function getAlchemyPrice(addr: string): Promise<number> {
  const key = addr.toLowerCase();
  const cached = routesAlchemyPriceCache.get(key);
  if (cached && Date.now() - cached.timestamp < ROUTES_ALCHEMY_PRICE_TTL) return cached.price;
  const apiKey = getAlchemyKey();
  if (!apiKey) return 0;
  try {
    const resp = await fetch(`https://api.g.alchemy.com/prices/v1/${apiKey}/tokens/by-address`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "accept": "application/json" },
      body: JSON.stringify({ addresses: [{ network: "base-mainnet", address: addr }] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return 0;
    const data = await resp.json() as any;
    const price = parseFloat(data?.data?.[0]?.prices?.[0]?.value || "0") || 0;
    if (price > 0) routesAlchemyPriceCache.set(key, { price, timestamp: Date.now() });
    return price;
  } catch { return 0; }
}

interface GoPlusSecurityData {
  isMintable: boolean;
  isProxy: boolean;
  isOpenSource: boolean;
  hasBlacklist: boolean;
  canPause: boolean;
  creatorPercent: number;
  ownerPercent: number;
  goPlusIsHoneypot: boolean;
  goPlusSellSimSuccess: boolean | null;
}

async function getGoPlusSecurityData(addr: string): Promise<GoPlusSecurityData | null> {
  try {
    const resp = await fetch(`${GOPLUS_BASE}/api/v1/token_security/${BASE_CHAIN_ID}?contract_addresses=${addr}`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const token = data?.result?.[addr.toLowerCase()];
    if (!token) return null;
    const goPlusIsHoneypot = token.is_honeypot === "1";
    const goPlusSellSimSuccess = goPlusIsHoneypot ? false
      : token.cannot_sell_all === "1" ? false
      : true;
    return {
      isMintable: token.is_mintable === "1",
      isProxy: token.is_proxy === "1",
      isOpenSource: token.is_open_source === "1",
      hasBlacklist: token.is_blacklisted === "1" || token.is_blacklisted === 1,
      canPause: token.can_take_back_ownership === "1" || token.owner_change_balance === "1",
      creatorPercent: parseFloat(token.creator_percent || "0") * 100,
      ownerPercent: parseFloat(token.owner_percent || "0") * 100,
      goPlusIsHoneypot,
      goPlusSellSimSuccess,
    };
  } catch { return null; }
}

interface HoneypotIsResult {
  isHoneypot: boolean;
  honeypotReason: string | null;
  sellTax: number;
  buyTax: number;
}

async function getHoneypotIs(addr: string): Promise<HoneypotIsResult | null> {
  try {
    const resp = await fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${addr}&chainID=8453`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    return {
      isHoneypot: data.honeypotResult?.isHoneypot === true,
      honeypotReason: data.honeypotResult?.honeypotReason ?? null,
      sellTax: data.simulationResult?.sellTaxPercent ?? 0,
      buyTax: data.simulationResult?.buyTaxPercent ?? 0,
    };
  } catch { return null; }
}

interface DeFiShieldResult {
  risks: string[];
}

async function getDeFiShield(addr: string): Promise<DeFiShieldResult | null> {
  const apiKey = process.env.DEFI_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch(`https://api.de.fi/v1/token-scanner?address=${addr}&chainId=8453`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "(unreadable)");
      console.log(`[getDeFiShield] status=${resp.status} body=${body.slice(0, 300)}`);
      return null;
    }
    const data = await resp.json() as any;
    const issues: any[] = data?.issues ?? data?.risks ?? data?.findings ?? [];
    const risks = (Array.isArray(issues) ? issues : [])
      .map((item: any) => item.impact ?? item.description ?? item.title ?? String(item))
      .filter(Boolean) as string[];
    return { risks };
  } catch { return null; }
}

interface BlockaidTokenResult {
  resultType: "Malicious" | "Suspicious" | "Benign" | "Spam" | null;
  isMalicious: boolean;
  isSuspicious: boolean;
  sellSimulationSuccess: boolean | null;
  sellRevertReason: string | null;
  attackTypes: string[];
}

async function getBlockaidTokenScan(addr: string): Promise<BlockaidTokenResult | null> {
  const apiKey = process.env.BLOCKAID_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch(`${BLOCKAID_BASE}/v0/evm/token/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ chain: "base", address: addr }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const resultType = data?.result_type ?? null;
    const isMalicious = resultType === "Malicious";
    const isSuspicious = resultType === "Suspicious";
    const attackTypes = Object.keys(data?.attack_types ?? {});
    const sellSim = data?.simulation_result?.sell_simulation ?? null;
    const sellSimulationSuccess = sellSim != null ? (sellSim.success ?? null) : null;
    const sellRevertReason = sellSim?.revert_reason ?? null;
    return { resultType, isMalicious, isSuspicious, sellSimulationSuccess, sellRevertReason, attackTypes };
  } catch { return null; }
}

async function getDexScreenerSocials(addr: string): Promise<{ twitter: string | null; website: string | null; description: string | null }> {
  try {
    const data = await dexFetch(`${DEXSCREENER_BASE}/tokens/v1/base/${addr}`, 4000);
    const pair = (Array.isArray(data) ? data : [])[0];
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

function isPrivateOrReservedIPv4(ip: string): boolean {
  if (ip === "0.0.0.0") return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  return false;
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();

    // Strip brackets — URL.hostname includes brackets for IPv6 (e.g. "[::1]")
    const bare = host.replace(/^\[|\]$/g, "");

    // IPv4 checks
    if (bare === "localhost" || bare === "0.0.0.0") return false;
    if (isPrivateOrReservedIPv4(bare)) return false;
    if (bare.endsWith(".local") || bare.endsWith(".internal") || bare.endsWith(".localhost")) return false;

    // IPv6 loopback / unspecified
    if (bare === "::1" || bare === "0:0:0:0:0:0:0:1" || bare === "::" || bare === "0:0:0:0:0:0:0:0") return false;

    // IPv6 link-local and unique-local (fe80::/10, fc00::/7)
    if (bare.startsWith("fe80:") || bare.startsWith("fc") || bare.startsWith("fd")) return false;

    // IPv4-mapped IPv6 — URL canonicalizes to hex groups: ::ffff:xxyy:zzww
    // e.g. ::ffff:169.254.169.254 → ::ffff:a9fe:a9fe
    const hexMappedMatch = bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMappedMatch) {
      const hi = parseInt(hexMappedMatch[1], 16);
      const lo = parseInt(hexMappedMatch[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      if (isPrivateOrReservedIPv4(ipv4)) return false;
    }

    // Dotted-decimal IPv4-mapped form (less common after URL parsing but guard anyway)
    const dotMappedMatch = bare.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (dotMappedMatch && isPrivateOrReservedIPv4(dotMappedMatch[1])) return false;

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
      const resp = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: "error" });
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

interface ActivityPatternResult {
  offHoursPercent: number;
  botScore: number;
  verdict: "BOT-LIKE" | "HUMAN-LIKE" | "MIXED";
  insight: string;
  hourDistribution: number[];
}

function analyzeActivityPattern(timestamps: number[]): ActivityPatternResult {
  const empty: ActivityPatternResult = {
    offHoursPercent: 0,
    botScore: 0,
    verdict: "HUMAN-LIKE",
    insight: "Insufficient transaction data for timing pattern analysis.",
    hourDistribution: new Array(24).fill(0),
  };
  if (timestamps.length < 3) return empty;

  const hourCounts = new Array(24).fill(0);
  for (const ts of timestamps) {
    const h = new Date(ts * 1000).getUTCHours();
    hourCounts[h]++;
  }

  // off-hours: 0–6 and 22–23 UTC (human sleep window)
  const offCount = hourCounts.slice(0, 7).reduce((a, b) => a + b, 0)
                 + hourCounts.slice(22).reduce((a, b) => a + b, 0);
  const offHoursPercent = Math.round((offCount / timestamps.length) * 100);

  // business hours: 8–20 UTC
  const bizCount = hourCounts.slice(8, 21).reduce((a, b) => a + b, 0);
  const bizPercent = Math.round((bizCount / timestamps.length) * 100);

  const activeHours = hourCounts.filter(c => c > 0).length;

  // bot score: 0-100
  // off-hours activity weight: 40pts, 24/7 spread weight: 30pts, anti-business-hours weight: 30pts
  // high-volume flag: +15pts when txs/day > 500 (no human executes 500+ txs manually)
  const baseScore = Math.round((offHoursPercent / 100) * 40)
    + Math.round((activeHours / 24) * 30)
    + Math.round(((100 - bizPercent) / 100) * 30);
  const highVolume = timestamps.length > 0 && (timestamps.length / Math.max(1, (timestamps[timestamps.length - 1] - timestamps[0]) / 86400)) > 500;
  const botScore = Math.min(100, Math.max(0, baseScore + (highVolume ? 15 : 0)));

  const verdict: ActivityPatternResult["verdict"] = botScore >= 65 ? "BOT-LIKE" : botScore <= 35 ? "HUMAN-LIKE" : "MIXED";

  let insight: string;
  if (verdict === "BOT-LIKE") {
    insight = `${offHoursPercent}% of transactions occurred during off-hours across ${activeHours}/24 active hours — strongly consistent with automated bot activity.`;
  } else if (verdict === "HUMAN-LIKE") {
    insight = `${bizPercent}% of transactions occurred during typical business hours with ${activeHours}/24 active hours — consistent with manual human operation.`;
  } else {
    insight = `Mixed timing pattern: ${offHoursPercent}% off-hours, active in ${activeHours}/24 hour slots — partial automation possible but inconclusive.`;
  }

  return { offHoursPercent, botScore, verdict, insight, hourDistribution: hourCounts };
}

interface ReactionTimeResult {
  averageReactionTime: number;
  medianReactionTime: number;
  minReactionTime: number;
  consistencyScore: number;
  subSecondPercent: number;
  reactionPattern: "AUTONOMOUS" | "ASSISTED" | "MANUAL";
  insight: string;
}

function analyzeReactionTime(timestamps: number[]): ReactionTimeResult {
  const empty: ReactionTimeResult = {
    averageReactionTime: 0,
    medianReactionTime: 0,
    minReactionTime: 0,
    consistencyScore: 0,
    subSecondPercent: 0,
    reactionPattern: "MANUAL",
    insight: "Insufficient transaction data for reaction time analysis.",
  };
  if (timestamps.length < 2) return empty;

  const sorted = [...timestamps].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i] - sorted[i - 1];
    if (g > 0) gaps.push(g);
  }
  if (gaps.length === 0) return empty;

  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sortedGaps.length / 2);
  const median = sortedGaps.length % 2 === 0
    ? (sortedGaps[mid - 1] + sortedGaps[mid]) / 2
    : sortedGaps[mid];
  const minGap = sortedGaps[0];

  const subSecondCount = gaps.filter(g => g < 1).length;
  const subSecondPercent = Math.round((subSecondCount / gaps.length) * 100);

  // coefficient of variation: lower = more consistent = more bot-like
  const variance = gaps.reduce((acc, g) => acc + (g - mean) ** 2, 0) / gaps.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  const consistencyScore = Math.min(100, Math.max(0, 100 - Math.round(cv * 50)));

  const reactionPattern: ReactionTimeResult["reactionPattern"] =
    (consistencyScore >= 70 || subSecondPercent >= 20) ? "AUTONOMOUS"
    : (consistencyScore <= 30 && subSecondPercent < 5) ? "MANUAL"
    : "ASSISTED";

  const avgFmt = mean < 1 ? `${Math.round(mean * 1000)}ms` : mean < 60 ? `${mean.toFixed(1)}s` : mean < 3600 ? `${(mean / 60).toFixed(1)} min` : `${(mean / 3600).toFixed(1)} hrs`;
  let insight: string;
  if (reactionPattern === "AUTONOMOUS") {
    const signal = subSecondPercent >= 20
      ? `${subSecondPercent}% of gaps are sub-second`
      : `consistency score of ${consistencyScore}/100`;
    insight = `Reaction pattern is AUTONOMOUS — ${signal}, with an average gap of ${avgFmt} between transactions.`;
  } else if (reactionPattern === "MANUAL") {
    insight = `Reaction pattern is MANUAL — high timing variability (consistency ${consistencyScore}/100) and average gap of ${avgFmt} suggest human operation.`;
  } else {
    insight = `Mixed reaction pattern — average gap of ${avgFmt} with ${subSecondPercent}% sub-second transactions and consistency score ${consistencyScore}/100.`;
  }

  return { averageReactionTime: mean, medianReactionTime: median, minReactionTime: minGap, consistencyScore, subSecondPercent, reactionPattern, insight };
}

interface GasPatternResult {
  averageGasPrice: number;
  gasVariance: number;
  optimalGasPercent: number;
  gasConsistencyScore: number;
  overpayPercent: number;
  gasPattern: "OPTIMIZED" | "VARIABLE" | "INEFFICIENT";
  insight: string;
}

function analyzeGasPatterns(samples: { gasPrice: number; baseFee: number | null }[]): GasPatternResult {
  const empty: GasPatternResult = {
    averageGasPrice: 0, gasVariance: 0, optimalGasPercent: 0,
    gasConsistencyScore: 0, overpayPercent: 0, gasPattern: "INEFFICIENT",
    insight: "Insufficient gas data for pattern analysis.",
  };
  if (samples.length < 2) return empty;

  const prices = samples.map(s => s.gasPrice);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((acc, p) => acc + (p - mean) ** 2, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;
  const gasConsistencyScore = Math.min(100, Math.max(0, 100 - Math.round(cv * 50)));

  const samplesWithBase = samples.filter(s => s.baseFee !== null && s.baseFee > 0);
  const optimalCount = samplesWithBase.filter(s => s.gasPrice <= (s.baseFee! * 1.1) + 2).length;
  const optimalGasPercent = samplesWithBase.length > 0
    ? Math.round((optimalCount / samplesWithBase.length) * 100)
    : 0;

  const overpayThreshold = samplesWithBase.length > 0 ? null : mean * 2;
  const overpayCount = samples.filter(s =>
    s.baseFee !== null && s.baseFee > 0
      ? s.gasPrice > s.baseFee * 2
      : overpayThreshold !== null && s.gasPrice > overpayThreshold,
  ).length;
  const overpayPercent = Math.round((overpayCount / samples.length) * 100);

  const gasPattern: GasPatternResult["gasPattern"] =
    gasConsistencyScore >= 65 ? "OPTIMIZED"
    : gasConsistencyScore <= 30 ? "INEFFICIENT"
    : "VARIABLE";

  const avgFmt = `${mean.toFixed(2)} gwei`;
  let insight: string;
  if (gasPattern === "OPTIMIZED") {
    insight = `Gas usage is OPTIMIZED — consistency score ${gasConsistencyScore}/100 with average ${avgFmt}${optimalGasPercent > 0 ? `, ${optimalGasPercent}% of transactions priced within 10% of base fee` : ""}.`;
  } else if (gasPattern === "INEFFICIENT") {
    insight = `Gas usage is INEFFICIENT — high variance (consistency ${gasConsistencyScore}/100) with ${overpayPercent}% of transactions significantly overpaying at average ${avgFmt}.`;
  } else {
    insight = `Gas usage is VARIABLE — mixed pricing strategy (consistency ${gasConsistencyScore}/100), average ${avgFmt}, suggesting partial automation or manual overrides.`;
  }

  return { averageGasPrice: mean, gasVariance: variance, optimalGasPercent, gasConsistencyScore, overpayPercent, gasPattern, insight };
}

interface DecisionEntropyResult {
  contractDiversity: number;
  actionRepeatRate: number;
  decisionEntropy: number;
  patternScore: number;
  uniqueContractRatio: number;
  entropyPattern: "ALGORITHMIC" | "ADAPTIVE" | "RANDOM";
  insight: string;
}

function analyzeDecisionEntropy(transfers: { to: string | null; contractAddress: string | null; category: string }[]): DecisionEntropyResult {
  if (transfers.length === 0) {
    return { contractDiversity: 0, actionRepeatRate: 0, decisionEntropy: 0, patternScore: 0, uniqueContractRatio: 0, entropyPattern: "RANDOM", insight: "Insufficient transaction data for entropy analysis." };
  }

  // Build destination frequency map (prefer contractAddress, fallback to to)
  const destMap = new Map<string, number>();
  for (const t of transfers) {
    const dest = (t.contractAddress || t.to || "unknown").toLowerCase();
    destMap.set(dest, (destMap.get(dest) ?? 0) + 1);
  }

  const total = transfers.length;
  const uniqueContracts = destMap.size;
  const uniqueContractRatio = uniqueContracts / total;

  // Shannon entropy over destination distribution
  let entropy = 0;
  for (const count of destMap.values()) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(Math.max(uniqueContracts, 2));
  const normalizedEntropy = maxEntropy > 0 ? Math.min(1, entropy / maxEntropy) : 0;

  // Repeat rate: fraction of txs going to the most-common destination
  const maxCount = Math.max(...destMap.values());
  const actionRepeatRate = Math.round((maxCount / total) * 100);

  // Contract diversity: unique contracts as % of total (capped at 100)
  const contractDiversity = Math.min(100, Math.round(uniqueContractRatio * 100));

  // patternScore: high score = low entropy = ALGORITHMIC (repetitive)
  const patternScore = Math.round((1 - normalizedEntropy) * 70 + (1 - Math.min(1, uniqueContractRatio)) * 30);

  const entropyPattern: DecisionEntropyResult["entropyPattern"] =
    patternScore >= 65 ? "ALGORITHMIC"
    : patternScore <= 30 ? "RANDOM"
    : "ADAPTIVE";

  const decisionEntropy = parseFloat(entropy.toFixed(3));

  let insight: string;
  if (entropyPattern === "ALGORITHMIC") {
    insight = `Decision pattern is ALGORITHMIC — ${actionRepeatRate}% of transactions target the same destination, entropy ${decisionEntropy} bits, consistent with automated scripted behavior.`;
  } else if (entropyPattern === "RANDOM") {
    insight = `Decision pattern is RANDOM — high destination entropy ${decisionEntropy} bits across ${uniqueContracts} unique addresses, suggesting exploration or manual operation.`;
  } else {
    insight = `Decision pattern is ADAPTIVE — moderate entropy ${decisionEntropy} bits with ${contractDiversity}% unique contract diversity, suggesting semi-automated strategy execution.`;
  }

  return { contractDiversity, actionRepeatRate, decisionEntropy, patternScore, uniqueContractRatio: parseFloat(uniqueContractRatio.toFixed(3)), entropyPattern, insight };
}

interface AnomalyDetectionResult {
  anomalyStatus: "STABLE" | "SHIFTING" | "ANOMALOUS";
  anomalyScore: number;
  snapshotCount: number;
  baselineActivityScore: number | null;
  baselineReactionScore: number | null;
  baselineGasScore: number | null;
  baselineDecisionScore: number | null;
  activityAnomaly: { detected: boolean; delta: number };
  reactionAnomaly: { detected: boolean; delta: number };
  gasAnomaly: { detected: boolean; delta: number };
  decisionAnomaly: { detected: boolean; delta: number };
}

function detectAnomalies(
  current: { activity: number | null; reaction: number | null; gas: number | null; decision: number | null },
  history: { botActivityScore: number | null; reactionConsistencyScore: number | null; gasConsistencyScore: number | null; decisionPatternScore: number | null }[],
): AnomalyDetectionResult | null {
  if (history.length < 2) return null;

  const avg = (vals: (number | null)[]): number | null => {
    const nums = vals.filter((v): v is number => v !== null);
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };

  const baselineActivityScore  = avg(history.map(s => s.botActivityScore));
  const baselineReactionScore  = avg(history.map(s => s.reactionConsistencyScore));
  const baselineGasScore       = avg(history.map(s => s.gasConsistencyScore));
  const baselineDecisionScore  = avg(history.map(s => s.decisionPatternScore));

  const THRESHOLD = 20;
  const makeAnomaly = (curr: number | null, baseline: number | null) => {
    if (curr === null || baseline === null) return { detected: false, delta: 0 };
    const delta = Math.round(curr - baseline);
    return { detected: Math.abs(delta) > THRESHOLD, delta };
  };

  const activityAnomaly = makeAnomaly(current.activity,  baselineActivityScore);
  const reactionAnomaly = makeAnomaly(current.reaction,  baselineReactionScore);
  const gasAnomaly      = makeAnomaly(current.gas,       baselineGasScore);
  const decisionAnomaly = makeAnomaly(current.decision,  baselineDecisionScore);

  const anomalyCount = [activityAnomaly, reactionAnomaly, gasAnomaly, decisionAnomaly].filter(a => a.detected).length;

  // anomalyScore: average absolute delta across signals with data, capped at 100
  const deltas: number[] = [];
  for (const [curr, baseline] of [
    [current.activity, baselineActivityScore],
    [current.reaction, baselineReactionScore],
    [current.gas,      baselineGasScore],
    [current.decision, baselineDecisionScore],
  ] as [number | null, number | null][]) {
    if (curr !== null && baseline !== null) deltas.push(Math.min(Math.abs(curr - baseline), 100));
  }
  const anomalyScore = deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;

  const anomalyStatus: AnomalyDetectionResult["anomalyStatus"] =
    anomalyCount === 0 ? "STABLE" : anomalyCount <= 2 ? "SHIFTING" : "ANOMALOUS";

  return {
    anomalyStatus, anomalyScore, snapshotCount: history.length,
    baselineActivityScore: baselineActivityScore !== null ? Math.round(baselineActivityScore) : null,
    baselineReactionScore: baselineReactionScore !== null ? Math.round(baselineReactionScore) : null,
    baselineGasScore:      baselineGasScore      !== null ? Math.round(baselineGasScore)      : null,
    baselineDecisionScore: baselineDecisionScore !== null ? Math.round(baselineDecisionScore) : null,
    activityAnomaly, reactionAnomaly, gasAnomaly, decisionAnomaly,
  };
}

interface CertificationTierResult {
  tier: "UNVERIFIED" | "BRONZE" | "SILVER" | "GOLD";
  rawTier: "UNVERIFIED" | "BRONZE" | "SILVER" | "GOLD";
  anomalyCapped: boolean;
  qualifyingSignals: number;
  availableSignals: number;
  averageForensicScore: number | null;
}

function computeCertificationTier(
  cognitionScore: number | null,
  forensic: { activity: number | null; reaction: number | null; gas: number | null; decision: number | null },
  verdict: string | null,
  anomalyStatus: "STABLE" | "SHIFTING" | "ANOMALOUS" | null,
): CertificationTierResult {
  const all = [forensic.activity, forensic.reaction, forensic.gas, forensic.decision];
  const available = all.filter((s): s is number => s !== null);
  const n = available.length;
  const avg = n > 0 ? available.reduce((a, b) => a + b, 0) / n : null;

  const count = (min: number) => available.filter(s => s >= min).length;

  // Evaluate score-based tier top-down
  let rawTier: CertificationTierResult["tier"] = "UNVERIFIED";

  const notDisqualified =
    cognitionScore !== null &&
    cognitionScore >= 50 &&
    n >= 2 &&
    verdict !== "Confirmed LARP";

  if (notDisqualified) {
    if (
      cognitionScore >= 80 &&
      n === 4 &&
      count(75) === 4 &&
      avg !== null && avg >= 80 &&
      verdict === "Confirmed Autonomous Agent"
    ) {
      rawTier = "GOLD";
    } else if (
      cognitionScore >= 65 &&
      n >= 3 &&
      count(70) >= 3 &&
      (verdict === "Confirmed Autonomous Agent" || verdict === "Likely Autonomous")
    ) {
      rawTier = "SILVER";
    } else if (
      count(60) >= 2 &&
      verdict !== "Insufficient Data"
    ) {
      rawTier = "BRONZE";
    }
  }

  // Apply anomaly cap post-award
  let tier = rawTier;
  let anomalyCapped = false;
  if (anomalyStatus === "ANOMALOUS" && (rawTier === "SILVER" || rawTier === "GOLD")) {
    tier = "BRONZE";
    anomalyCapped = true;
  } else if (anomalyStatus === "SHIFTING" && rawTier === "GOLD") {
    tier = "SILVER";
    anomalyCapped = true;
  }

  const qualifyingThreshold = tier === "GOLD" ? 75 : tier === "SILVER" ? 70 : 60;
  const qualifyingSignals = tier === "UNVERIFIED" ? 0 : count(qualifyingThreshold);

  return {
    tier,
    rawTier,
    anomalyCapped,
    qualifyingSignals,
    availableSignals: n,
    averageForensicScore: avg !== null ? Math.round(avg) : null,
  };
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

async function detectPlatformFromQuoteToken(tokenAddr: string): Promise<string | null> {
  try {
    const data = await dexFetch(`${DEXSCREENER_BASE}/tokens/v1/base/${tokenAddr}`, 5000);
    const pairs = (Array.isArray(data) ? data : []).filter((p: any) => (p?.chainId || "").toLowerCase() === "base");
    if (pairs.length === 0) return null;
    const lq = (p: any) => parseFloat(p?.liquidity?.usd || "0") || 0;
    const tokenLow = tokenAddr.toLowerCase();
    const topPair = pairs.reduce((a: any, b: any) => lq(b) > lq(a) ? b : a, pairs[0]);
    const platformOf = (p: any) => {
      const q = (p?.quoteToken?.address || "").toLowerCase();
      if (q && PLATFORM_MAP[q]) return PLATFORM_MAP[q];
      const b = (p?.baseToken?.address || "").toLowerCase();
      if (b && b !== tokenLow && PLATFORM_MAP[b]) return PLATFORM_MAP[b];
      return null;
    };
    const topPlatform = platformOf(topPair);
    if (!topPlatform) return null;
    if (lq(topPair) < 1000) return null;
    return topPlatform;
  } catch { return null; }
}

async function detectPlatformFromContractName(addr: string): Promise<string | null> {
  try {
    const resp = await fetch(`${BLOCKSCOUT_BASE}/api/v2/addresses/${addr}`, { signal: AbortSignal.timeout(4000) });
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    const name = (data?.name || "").toLowerCase();
    if (name) {
      for (const [platform, kw] of Object.entries(DEPLOYER_CHAIN_KEYWORDS)) {
        if (kw.names.some((n: string) => name.includes(n))) return platform;
      }
    }
    try {
      const srcResp = await fetch(`${BLOCKSCOUT_BASE}/api/v2/smart-contracts/${addr}`, { signal: AbortSignal.timeout(4000) });
      if (srcResp.ok) {
        const srcData = await srcResp.json() as any;
        const contractName = (srcData?.name || "").toLowerCase();
        if (contractName) {
          for (const [platform, kw] of Object.entries(DEPLOYER_CHAIN_KEYWORDS)) {
            if (kw.names.some((n: string) => contractName.includes(n))) return platform;
          }
        }
        const src = (srcData?.source_code || "").slice(0, 5000).toLowerCase();
        if (src) {
          for (const [platform, kw] of Object.entries(DEPLOYER_CHAIN_KEYWORDS)) {
            if (kw.sourcePatterns.some((p: string) => src.includes(p))) return platform;
          }
        }
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
  installX402(app);

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

  const detectiveAnalyzeHandler = async (req: Request, res: Response) => {
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
          getAlchemyPrice(address),
          getGoPlusSecurityData(address),
          getBlockaidTokenScan(address),
          getHoneypotIs(address),
          getDeFiShield(address),
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
      const dexData = results[6].status === "fulfilled" ? results[6].value : { volume24h: 0, pairCreatedAt: null, poolVersion: null, dexId: null };
      const alchemyPrice: number = results[7]?.status === "fulfilled" ? (results[7].value as number) : 0;
      let goplusData = results[8]?.status === "fulfilled" ? results[8].value : null;
      const blockaidData = results[9]?.status === "fulfilled" ? results[9].value : null;
      const honeypotIsData = results[10]?.status === "fulfilled" ? results[10].value : null;
      const defiShieldData = results[11]?.status === "fulfilled" ? results[11].value : null;

      if (!goplusData) {
        goplusData = await getGoPlusSecurityData(address).catch(() => null);
      }

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
        const [proxyP, creationP, chainP, quoteP, nameP] = await Promise.all([
          withTimeout(detectPlatformFromProxyImpl(address), 4000, "proxy-impl-detect").catch(() => null),
          withTimeout(detectPlatformFromCreationTx(address), 5000, "creation-platform-detect").catch(() => null),
          deployer ? withTimeout(detectPlatformFromDeployerChain(deployer), 5000, "deployer-chain-detect").catch(() => null) : null,
          withTimeout(detectPlatformFromQuoteToken(address), 5000, "quote-token-detect").catch(() => null),
          withTimeout(detectPlatformFromContractName(address), 5000, "contract-name-detect").catch(() => null),
        ]);
        platform = proxyP || creationP || chainP || quoteP || nameP;
      }
      const scanCount = await storage.incrementLookup(address, tokenInfo.name, tokenInfo.symbol);
      const lpStatus = detectLpStatus(topHolders, platform);
      const isVirtuals = platform === "Virtuals";
      const isManaged = !!(platform && MANAGED_PROTOCOLS.has(platform));

      let buyTax = isManaged ? 0 : sim.buyTax;
      let sellTax = isManaged ? 0 : sim.sellTax;
      let isHoneypot = isManaged ? false : (
        sim.isHoneypot ||
        honeypotIsData?.isHoneypot === true ||
        goplusData?.goPlusIsHoneypot === true
      );

      if (!isManaged && !sim.simulationSuccess && fallbackData) {
        buyTax = fallbackData.buyTax;
        sellTax = fallbackData.sellTax;
        if (!isHoneypot) isHoneypot = fallbackData.isHoneypot;
      }
      let tokenPriceUsd = alchemyPrice;
      if (tokenPriceUsd === 0 && sim.tokensReceived > BigInt(0) && ethUsd > 0) {
        const tokensWholeUnits = Number(sim.tokensReceived) / (10 ** tokenInfo.decimals);
        tokenPriceUsd = tokensWholeUnits > 0 ? (0.001 / tokensWholeUnits) * ethUsd : 0;
      }
      const mcap = Number(tokenInfo.totalSupply) * tokenPriceUsd;

      const nameUpper = tokenInfo.name.toUpperCase();
      const symbolUpper = tokenInfo.symbol.toUpperCase();
      const isFakeApol = symbolUpper === "APOL" || nameUpper === "APOL" || nameUpper === "APOL AGENT" || nameUpper.includes("APOLAGENT");

      // --- Forensic enrichment ---
      const deployerLower = deployer?.toLowerCase() || null;
      const deployerHolding = deployerLower
        ? (topHolders.find(h => h.address === deployerLower)?.percent ?? 0)
        : null;
      const creatorDumped = deployerHolding !== null && deployerHolding < 0.5;

      const tokenAgeDays = dexData.pairCreatedAt
        ? Math.floor((Date.now() - dexData.pairCreatedAt) / (1000 * 60 * 60 * 24))
        : null;
      const isNewToken = tokenAgeDays !== null && tokenAgeDays < 14;
      const isInDex = tokenPriceUsd > 0;

      // Top 5 non-LP/non-burn holders for display
      const displayHolders = topHolders
        .filter(h => !BURN_ADDRS.has(h.address))
        .slice(0, 5)
        .map(h => ({ address: h.address, percent: h.percent }));

      // GoPlus-derived security flags
      const isMintable = goplusData?.isMintable ?? false;
      const isProxy = goplusData?.isProxy ?? null;
      const isOpenSource = goplusData?.isOpenSource ?? null;
      const hasBlacklist = goplusData?.hasBlacklist ?? false;
      const canPause = goplusData?.canPause ?? false;

      // Blockaid-derived flags
      const blockaidMalicious = blockaidData?.isMalicious ?? false;
      const blockaidSellFail = blockaidData?.sellSimulationSuccess === false;

      // GoPlus sell simulation
      const goPlusSellSimSuccess = goplusData?.goPlusSellSimSuccess ?? null;

      // Red flags
      const redFlags: string[] = [];
      if (isFakeApol) redFlags.push("IMPERSONATING APOL");
      if (isHoneypot) redFlags.push("HONEYPOT DETECTED");
      if (honeypotIsData?.isHoneypot) redFlags.push(`HONEYPOT.IS: SELL BLOCKED${honeypotIsData.honeypotReason ? ` — ${honeypotIsData.honeypotReason}` : ""}`);
      if (blockaidSellFail && !isHoneypot) redFlags.push("SELL SIMULATION FAILED");
      if (blockaidMalicious) redFlags.push("BLOCKAID: MALICIOUS CONTRACT DETECTED");
      if (goPlusSellSimSuccess === false && !isHoneypot) redFlags.push("GOPLUS: SELL SIMULATION FAILED");
      if (defiShieldData?.risks?.length) {
        for (const r of defiShieldData.risks) redFlags.push(`DE.FI SHIELD: ${r}`);
      }
      if (buyTax > 10) redFlags.push(`HIGH BUY TAX (${buyTax.toFixed(1)}%)`);
      if (sellTax > 10) redFlags.push(`HIGH SELL TAX (${sellTax.toFixed(1)}%)`);
      if (creatorDumped) redFlags.push("CREATOR SOLD 100%");
      if (isNewToken && tokenAgeDays === 0) redFlags.push("DEPLOYED TODAY");
      else if (isNewToken && tokenAgeDays! < 3) redFlags.push(`${tokenAgeDays} DAYS OLD`);
      if (holderCount > 0 && holderCount < 50) redFlags.push(`ONLY ${holderCount} HOLDERS`);
      if (isOpenSource === false) redFlags.push("UNVERIFIED CONTRACT");
      if (isMintable) redFlags.push("MINTABLE — OWNER CAN PRINT");
      if (hasBlacklist) redFlags.push("BLACKLIST FUNCTION");
      if (canPause) redFlags.push("OWNER CAN PAUSE TRADING");

      const isHighRisk = isFakeApol || isHoneypot || buyTax > 10 || sellTax > 10 || isMintable || canPause || hasBlacklist || blockaidMalicious || blockaidSellFail || goPlusSellSimSuccess === false;
      const riskLevel = isHighRisk ? "High" : buyTax > 0 || sellTax > 0 ? "Caution" : "Clean";

      // APOL Detective verdict
      const ageLabel = tokenAgeDays === null ? "" : tokenAgeDays === 0 ? "deployed today" : tokenAgeDays === 1 ? "1 day old" : `${tokenAgeDays} days old`;
      let apolVerdict: string;
      if (isHoneypot) {
        const hpReason = honeypotIsData?.honeypotReason ? ` Reason: ${honeypotIsData.honeypotReason}.` : "";
        apolVerdict = `HONEYPOT CONFIRMED on ${tokenInfo.name} (${tokenInfo.symbol}). This contract blocks selling — funds are trapped.${hpReason} Do not interact under any circumstances.`;
      } else if (blockaidSellFail) {
        apolVerdict = `SELL BLOCKED — Blockaid simulation confirms sell transactions fail on ${tokenInfo.name} (${tokenInfo.symbol}). Funds may be trapped. APOL rates this DANGEROUS — do not buy.${blockaidData?.sellRevertReason ? ` Revert reason: ${blockaidData.sellRevertReason}.` : ""}`;
      } else if (blockaidMalicious) {
        apolVerdict = `BLOCKAID ALERT: ${tokenInfo.name} (${tokenInfo.symbol}) is flagged as MALICIOUS. Attack types: ${blockaidData?.attackTypes?.join(", ") || "unknown"}. APOL rates this HIGH RISK — avoid.`;
      } else if (isFakeApol) {
        apolVerdict = `SCAM ALERT: ${tokenInfo.name} is impersonating APOL Agent. APOL does NOT have an official token or CA yet. Any $APOL token is unauthorized — do not buy.`;
      } else if (redFlags.length >= 4) {
        apolVerdict = `${tokenInfo.name} (${tokenInfo.symbol})${ageLabel ? `, ${ageLabel}` : ""}, carries ${redFlags.length} active risk signals: ${redFlags.slice(0, 3).join(", ")}${redFlags.length > 3 ? ", and more" : ""}. APOL rates this HIGH RISK — proceed with extreme caution or avoid.`;
      } else if (redFlags.length >= 2) {
        apolVerdict = `${tokenInfo.name} (${tokenInfo.symbol}) raises ${redFlags.length} concerns: ${redFlags.join(", ")}${ageLabel ? ` (${ageLabel})` : ""}. Speculative play — DYOR before any entry.`;
      } else if (redFlags.length === 1) {
        apolVerdict = `${tokenInfo.name} (${tokenInfo.symbol}) is generally clean but flags one issue: ${redFlags[0]}. Lower risk overall, but stay alert.`;
      } else if (riskLevel === "Clean") {
        apolVerdict = `${tokenInfo.name} (${tokenInfo.symbol}) passes all security checks — no honeypot, no high tax, no admin threats detected${platform ? ` (${platform} managed)` : ""}. Standard market risk still applies.`;
      } else {
        apolVerdict = `${tokenInfo.name} (${tokenInfo.symbol})${ageLabel ? ` — ${ageLabel}` : ""}. Partial data available. Treat as speculative and verify independently before entry.`;
      }

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
        isHighRisk,
        tokenName: tokenInfo.name, tokenSymbol: tokenInfo.symbol,
        isHoneypot, buyTax, sellTax,
        simulationSuccess: sim.simulationSuccess,
        feeTier: sim.feeTier,
        platform: platform || null,
        lpStatus,
        holderCount,
        priceUsd: tokenPriceUsd,
        mcap,
        liquidity: 0,
        volume24h: dexData.volume24h,
        deployer,
        scanCount,
        greenBadge: riskLevel === "Clean" && !isHighRisk && !isFakeApol && redFlags.length === 0,
        isFakeApol,
        fakeApolWarning: isFakeApol ? "APOL Agent does NOT have an official token or CA yet. Any $APOL token is a SCAM." : null,
        // Forensic enrichment
        redFlags,
        apolVerdict,
        isInDex,
        isMintable,
        isProxy,
        isOpenSource,
        hasBlacklist,
        canPause,
        deployerHolding,
        creatorDumped,
        tokenAgeDays,
        topHoldersList: displayHolders,
        poolVersion: dexData.poolVersion,
        dexId: dexData.dexId,
        // Blockaid sell simulation
        sellSimulationSuccess: blockaidData?.sellSimulationSuccess ?? null,
        sellSimRevertReason: blockaidData?.sellRevertReason ?? null,
        blockaidResultType: blockaidData?.resultType ?? null,
        blockaidAttackTypes: blockaidData?.attackTypes ?? [],
        // Honeypot.is
        honeypotIsResult: honeypotIsData ?? null,
        // De.Fi Shield
        defiShieldRisks: defiShieldData?.risks ?? null,
        // GoPlus sell simulation
        goPlusSellSimSuccess,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Scan failed" });
    }
  };
  app.get("/api/detective/analyze", detectiveAnalyzeHandler);
  app.get("/api/x402/detective/analyze", detectiveAnalyzeHandler);

  const agentAnalyzeHandler = async (req: Request, res: Response) => {
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
      let activityPatternResult: ActivityPatternResult | null = null;
      let reactionTimeResult: ReactionTimeResult | null = null;
      let gasPatternResult: GasPatternResult | null = null;
      let decisionEntropyResult: DecisionEntropyResult | null = null;

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
          const [creationP, chainP, quoteP, nameP] = await Promise.all([
            detectPlatformFromCreationTx(wallet).catch(() => null),
            deployerAddr ? detectPlatformFromDeployerChain(deployerAddr).catch(() => null) : null,
            detectPlatformFromQuoteToken(wallet).catch(() => null),
            detectPlatformFromContractName(wallet).catch(() => null),
          ]);
          platform = creationP || chainP || quoteP || nameP;
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
                  params: [{ fromBlock: "0x0", toBlock: "latest", fromAddress: wallet, category: ["external", "erc20"], maxCount: "0x32", withMetadata: true }] }),
                signal: AbortSignal.timeout(6000),
              });
              const walletData = await walletResp.json() as any;
              const walletTransfers = walletData?.result?.transfers || [];
              if (walletTransfers.length > 5) {
                const blockNums = walletTransfers.map((t: any) => parseInt(t.blockNum, 16));
                const uniqueBlocks = new Set(blockNums);
                speedScore = Math.min(30, uniqueBlocks.size * 2);
                speedDetail = uniqueBlocks.size >= 20 ? "High on-chain activity detected — consistent with autonomous agent." : uniqueBlocks.size >= 10 ? "Mixed activity patterns — some autonomous behavior." : "Limited activity — likely manual operator.";
                // extract unix timestamps from Alchemy metadata for pattern analysis
                const txTimestamps: number[] = walletTransfers
                  .map((t: any) => t.metadata?.blockTimestamp ? Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000) : null)
                  .filter((ts: number | null): ts is number => ts !== null);
                activityPatternResult = analyzeActivityPattern(txTimestamps);
                reactionTimeResult = analyzeReactionTime(txTimestamps);
                const txDiversityData = walletTransfers.map((t: any) => ({
                  to: t.to || null,
                  contractAddress: t.rawContract?.address || null,
                  category: t.category || "",
                }));
                console.log(`[entropy] wallet=${wallet} txCount=${txDiversityData.length} sample=${JSON.stringify(txDiversityData.slice(0, 3))}`);
                decisionEntropyResult = analyzeDecisionEntropy(txDiversityData);
                console.log(`[entropy] result: patternScore=${decisionEntropyResult.patternScore} repeatRate=${decisionEntropyResult.actionRepeatRate} entropy=${decisionEntropyResult.decisionEntropy} uniqueContracts=${Math.round(decisionEntropyResult.uniqueContractRatio * txDiversityData.length)}`);
                try {
                  const sampleTransfers = walletTransfers.slice(0, 15);
                  const txHashes: string[] = sampleTransfers.map((t: any) => t.hash).filter(Boolean);
                  const uniqueBlockHexes: string[] = [...new Set<string>(sampleTransfers.map((t: any) => t.blockNum).filter(Boolean))].slice(0, 10);
                  const [txDatas, blockDatas] = await Promise.all([
                    rpcBatch(txHashes.map(h => ({ method: "eth_getTransactionByHash", params: [h] }))),
                    rpcBatch(uniqueBlockHexes.map(n => ({ method: "eth_getBlockByNumber", params: [n, false] }))),
                  ]);
                  const blockBaseFeeMap = new Map<string, number>();
                  for (let i = 0; i < uniqueBlockHexes.length; i++) {
                    const b = blockDatas[i];
                    if (b?.baseFeePerGas) blockBaseFeeMap.set(uniqueBlockHexes[i], Number(BigInt(b.baseFeePerGas)) / 1e9);
                  }
                  const gasSamples: { gasPrice: number; baseFee: number | null }[] = [];
                  for (let i = 0; i < txHashes.length; i++) {
                    const tx = txDatas[i];
                    if (!tx) continue;
                    const rawGas = tx.maxFeePerGas ?? tx.gasPrice;
                    if (!rawGas) continue;
                    const gasPriceGwei = Number(BigInt(rawGas)) / 1e9;
                    const baseFee = blockBaseFeeMap.get(sampleTransfers[i]?.blockNum) ?? null;
                    gasSamples.push({ gasPrice: gasPriceGwei, baseFee });
                  }
                  gasPatternResult = analyzeGasPatterns(gasSamples);
                } catch {}
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
      if (logsUrl && logsUrl.trim() && !isSafeUrl(logsUrl.trim())) {
        logsStatus = "mismatch";
        logsDetail = "Logs URL rejected — only public, non-private addresses are permitted.";
      } else if (logsUrl && logsUrl.trim() && isSafeUrl(logsUrl.trim())) {
        try {
          const logsRes = await fetch(logsUrl.trim(), { signal: AbortSignal.timeout(5000), redirect: "error" });
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
      const reactionScore = Math.round((reactionTimeResult?.consistencyScore ?? 0) / 100 * 10);
      const gasScore = Math.round((gasPatternResult?.gasConsistencyScore ?? 0) / 100 * 10);
      const entropyScore = Math.round((decisionEntropyResult?.patternScore ?? 0) / 100 * 10);
      const rawScore = speedScore + traceScore + contextScore + socialScore + logsScore + activityScore + codeSizeScore + reactionScore + gasScore + entropyScore;

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

      // Sub-section weighted average: prefer this over rawScore when 2+ sections have data
      const subSectionScores: number[] = [];
      if (activityPatternResult) subSectionScores.push(activityPatternResult.botScore);
      if (reactionTimeResult) subSectionScores.push(reactionTimeResult.consistencyScore);
      if (gasPatternResult) subSectionScores.push(gasPatternResult.gasConsistencyScore);
      if (decisionEntropyResult) subSectionScores.push(decisionEntropyResult.patternScore);
      const subSectionAvg = subSectionScores.length >= 2
        ? Math.round(subSectionScores.reduce((a, b) => a + b, 0) / subSectionScores.length)
        : null;
      const cognitionBase = subSectionAvg !== null ? subSectionAvg : Math.min(100, rawScore);

      const cognitionScore = isVerifiedAgent ? 100 : zeroAgentTrace ? 0 : (scoredTests >= 2 ? cognitionBase : null);
      const isPartial = isVerifiedAgent ? false : zeroAgentTrace ? false : scoredTests < 3;

      // Blockaid override: if the agent's contract is flagged malicious, cap cognition at 5
      const agentBlockaidData = (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet))
        ? await getBlockaidTokenScan(wallet).catch(() => null)
        : null;
      const finalCognitionScore = (agentBlockaidData?.isMalicious && cognitionScore !== null && !isVerifiedAgent)
        ? Math.min(cognitionScore, 5)
        : cognitionScore;

      type Verdict = "Confirmed LARP" | "Unverified" | "Semi-Autonomous" | "Fully Autonomous" | "Under Review" | "Insufficient Data" | "Inconclusive";
      let verdict: Verdict;
      if (isVerifiedAgent) verdict = "Fully Autonomous";
      else if (zeroAgentTrace) verdict = "Confirmed LARP";
      else if (scoredTests < 2) verdict = "Insufficient Data";
      else if (finalCognitionScore !== null && finalCognitionScore >= 71) verdict = "Fully Autonomous";
      else if (finalCognitionScore !== null && finalCognitionScore >= 41) verdict = "Semi-Autonomous";
      else if (finalCognitionScore !== null && finalCognitionScore >= 21) verdict = "Under Review";
      else if (finalCognitionScore !== null && finalCognitionScore <= 10 && scoredTests >= 4) verdict = "Confirmed LARP";
      else if (finalCognitionScore !== null) verdict = "Unverified";
      else verdict = "Inconclusive";

      // Sub-section verdict capping: prevent headline from contradicting behavioral sub-sections
      if (!isVerifiedAgent && !zeroAgentTrace && verdict !== "Confirmed LARP" && verdict !== "Insufficient Data" && verdict !== "Inconclusive") {
        const subHumanSignals = (activityPatternResult?.verdict === "HUMAN-LIKE") || (reactionTimeResult?.reactionPattern === "MANUAL");
        const subBotSignals = (activityPatternResult?.verdict === "BOT-LIKE") || (reactionTimeResult?.reactionPattern === "AUTONOMOUS") || (decisionEntropyResult?.entropyPattern === "ALGORITHMIC");
        const subSplit = subHumanSignals && subBotSignals;
        if (subSplit && (verdict === "Fully Autonomous" || verdict === "Semi-Autonomous")) {
          verdict = "Under Review";
        } else if (subHumanSignals && verdict === "Fully Autonomous") {
          verdict = "Semi-Autonomous";
        }
      }

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
      if (agentBlockaidData?.isMalicious) apolVerdict += " 🚨 BLOCKAID: Agent contract flagged MALICIOUS — cognition score capped at 5/100.";

      storage.logAgentActivity({
        action: "agent_verification",
        target: agentName.trim(),
        detail: `Verified agent "${agentName.trim()}". Cognition score: ${finalCognitionScore ?? "N/A"}. Tests scored: ${scoredTests}. ${traceIsContract ? "On-chain contract verified." : "No on-chain contract."} ${autoAbilityAudit?.claimedAbilities?.length ? `Abilities: ${autoAbilityAudit.claimedAbilities.join(", ")}.` : ""} ${autoAbilityAudit?.reasoningStatus === "verified" ? "Reasoning logs verified." : autoAbilityAudit?.reasoningStatus === "mismatch" ? "Reasoning logs mismatch." : "No reasoning logs found."}`.replace(/\s+/g, " ").trim(),
        verdict,
        source: "web",
        metadata: { cognitionScore: finalCognitionScore, scoredTests, wallet, socialLink, abilities: autoAbilityAudit?.claimedAbilities },
      }).catch(() => {});

      let anomalyDetectionResult: AnomalyDetectionResult | null = null;
      if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        try {
          const behavioralHistory = await storage.getAgentBehavioralHistory(wallet.toLowerCase(), 30);
          anomalyDetectionResult = detectAnomalies({
            activity: activityPatternResult?.botScore ?? null,
            reaction: reactionTimeResult?.consistencyScore ?? null,
            gas: gasPatternResult?.gasConsistencyScore ?? null,
            decision: decisionEntropyResult?.patternScore ?? null,
          }, behavioralHistory);
        } catch {}
      }

      const certificationTierResult = computeCertificationTier(
        finalCognitionScore,
        {
          activity: activityPatternResult?.botScore ?? null,
          reaction: reactionTimeResult?.consistencyScore ?? null,
          gas: gasPatternResult?.gasConsistencyScore ?? null,
          decision: decisionEntropyResult?.patternScore ?? null,
        },
        verdict,
        anomalyDetectionResult?.anomalyStatus ?? null,
      );

      const fullResult = {
        agentName: agentName.trim(),
        wallet: wallet || null,
        cognitionScore: finalCognitionScore,
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
        activityPattern: activityPatternResult ?? undefined,
        reactionTime: reactionTimeResult ?? undefined,
        gasPattern: gasPatternResult ?? undefined,
        decisionEntropy: decisionEntropyResult ?? undefined,
        anomalyDetection: anomalyDetectionResult ?? undefined,
        certificationTier: certificationTierResult,
      };

      // Fire-and-forget behavioral snapshot — never blocks the scan response
      if (wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        storage.saveAgentBehavioralSnapshot({
          walletAddress: wallet.toLowerCase(),
          chain: chain || "base",
          botActivityScore: activityPatternResult?.botScore ?? null,
          reactionConsistencyScore: reactionTimeResult?.consistencyScore ?? null,
          gasConsistencyScore: gasPatternResult?.gasConsistencyScore ?? null,
          decisionPatternScore: decisionEntropyResult?.patternScore ?? null,
          overallAuthenticityScore: finalCognitionScore ?? null,
          activityPattern: activityPatternResult?.verdict ?? null,
          reactionPattern: reactionTimeResult?.reactionPattern ?? null,
          gasPattern: gasPatternResult?.gasPattern ?? null,
          decisionPattern: decisionEntropyResult?.entropyPattern ?? null,
          verdict: verdict,
        }).catch(() => {});
      }

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
  };
  app.post("/api/agent/analyze", agentAnalyzeHandler);
  app.post("/api/x402/agent/analyze", agentAnalyzeHandler);

  // Regenerates reactionTime.insight from stored numeric values so slug results
  // aren't stuck with insight text built by older code (e.g. "141.3 min" vs "2.4 hrs").
  function fixStoredReactionInsight(result: any): any {
    const rt = result?.reactionTime;
    if (!rt || typeof rt.averageReactionTime !== "number") return result;
    const mean = rt.averageReactionTime;
    const avgFmt = mean < 1 ? `${Math.round(mean * 1000)}ms`
      : mean < 60 ? `${mean.toFixed(1)}s`
      : mean < 3600 ? `${(mean / 60).toFixed(1)} min`
      : `${(mean / 3600).toFixed(1)} hrs`;
    let insight: string;
    if (rt.reactionPattern === "AUTONOMOUS") {
      const signal = rt.subSecondPercent >= 20
        ? `${rt.subSecondPercent}% of gaps are sub-second`
        : `consistency score of ${rt.consistencyScore}/100`;
      insight = `Reaction pattern is AUTONOMOUS — ${signal}, with an average gap of ${avgFmt} between transactions.`;
    } else if (rt.reactionPattern === "MANUAL") {
      insight = `Reaction pattern is MANUAL — high timing variability (consistency ${rt.consistencyScore}/100) and average gap of ${avgFmt} suggest human operation.`;
    } else {
      insight = `Mixed reaction pattern — average gap of ${avgFmt} with ${rt.subSecondPercent}% sub-second transactions and consistency score ${rt.consistencyScore}/100.`;
    }
    return { ...result, reactionTime: { ...rt, insight } };
  }

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
        result: fixStoredReactionInsight(row.resultJson),
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to load result" });
    }
  });

  app.get("/api/agent/history/:address", async (req, res) => {
    try {
      const address = String(req.params.address || "").trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ error: "Invalid wallet address" });
      }
      const snapshots = await storage.getAgentBehavioralHistory(address, 30);
      const firstSeen = snapshots.length > 0 ? snapshots[0].scanDate : null;
      const lastSeen = snapshots.length > 0 ? snapshots[snapshots.length - 1].scanDate : null;
      res.json({ address, count: snapshots.length, firstSeen, lastSeen, snapshots });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to load behavioral history" });
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

  const scanxHandler = async (req: Request, res: Response) => {
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
        const dexData = await dexFetch(`${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(handle)}`, 5000);
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
  };

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
  app.get("/api/scanx", scanxHandler);
  app.get("/api/x402/scanx", scanxHandler);

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
      console.log(`[payment-lane=manual-eth] HUMAN paid manually (0.02 ETH) — wallet=${wallet} txHash=${txHash}`);
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
