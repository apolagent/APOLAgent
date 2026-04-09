import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const BASE_RPC = process.env.BASE_RPC_URL || "";
const WETH = "0x4200000000000000000000000000000000000006";
const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const SIM_AMOUNT = BigInt("100000000000000000");
const BURN_ADDRS = new Set(["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"]);
const HARD_TIMEOUT = 10000;

const PLATFORM_MAP: Record<string, string> = {
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
  "0xe85a08cf16f07b0b6e8b1f5e4918f6e9dab3a5c0": "Clanker",
  "0xf3625f0e85afe89228eeab5c8c6e3aff94e77d38": "Clanker",
  "0xd466e09acadc0345b4cf42ea530e242a086f68c7": "Clanker",
  "0x0bf85e6f2ff0ed5c4a76b1dbbd3f2f65c05a4f58": "ApeStore",
  "0xade20c0cc8482c404a57da404ed1f3f2a1f6fe6f": "ApeStore",
  "0x6a53961a5bc81e8b1e02aa84445e07a4e8057957": "Flaunch",
};

const LOCKER_MAP: Record<string, string> = {
  "0xe85a08cf16f07b0b6e8b1f5e4918f6e9dab3a5c0": "Clanker",
  "0xf3625f0e85afe89228eeab5c8c6e3aff94e77d38": "Clanker",
  "0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214": "Unicrypt",
  "0x71b5759d73262fbb223956913ecf4ecc51057641": "PinkLock",
  "0xe2fe530c047f2d85298b07d9333c05737f1435fb": "Team Finance",
  "0x0bf85e6f2ff0ed5c4a76b1dbbd3f2f65c05a4f58": "ApeStore",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
};

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
  const fees = [500, 3000, 10000, 100];
  const calls = fees.map((fee) => ({
    method: "eth_call" as const,
    params: [{ to: V3_FACTORY, data: selector + pad32(t0) + pad32(t1) + uint256Hex(BigInt(fee)) }, "latest"],
  }));
  const results = await rpcBatch(calls);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r || r === "0x" || r === "0x" + "0".repeat(64)) continue;
    const poolAddr = "0x" + r.slice(26, 66);
    if (poolAddr === "0x0000000000000000000000000000000000000000") continue;
    return { pool: poolAddr, fee: fees[i] };
  }
  return null;
}

async function rpcAlchemySimulate(tokenAddress: string): Promise<{ isHoneypot: boolean; buyTax: number; sellTax: number; simulationSuccess: boolean; feeTier: number | null; tokensReceived: bigint }> {
  const addr = tokenAddress.toLowerCase();
  const poolInfo = await findBestPool(addr);
  if (!poolInfo) return { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0) };

  const { fee } = poolInfo;
  const selector = "0xc6a5026a";
  const buyData = selector + pad32(WETH) + pad32(addr) + uint256Hex(SIM_AMOUNT) + uint256Hex(BigInt(fee)) + uint256Hex(BigInt(0));
  const buyResult = await rpcCall("eth_call", [{ to: QUOTER_V2, data: buyData }, "latest"]);
  if (!buyResult || buyResult === "0x") return { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: fee, tokensReceived: BigInt(0) };

  const tokensReceived = BigInt("0x" + buyResult.slice(2, 66));
  if (tokensReceived === BigInt(0)) return { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: fee, tokensReceived: BigInt(0) };

  let sellResult: string;
  try {
    const sellData = selector + pad32(addr) + pad32(WETH) + uint256Hex(tokensReceived) + uint256Hex(BigInt(fee)) + uint256Hex(BigInt(0));
    sellResult = await rpcCall("eth_call", [{ to: QUOTER_V2, data: sellData }, "latest"]);
  } catch {
    return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived };
  }

  if (!sellResult || sellResult === "0x") return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived };

  const ethBack = BigInt("0x" + sellResult.slice(2, 66));
  if (ethBack === BigInt(0)) return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived };

  const ethIn = Number(SIM_AMOUNT) / 1e18;
  const ethOut = Number(ethBack) / 1e18;
  const roundTripLoss = ((ethIn - ethOut) / ethIn) * 100;
  const expectedPoolFees = (fee / 10000) * 2;
  const netTax = Math.max(0, roundTripLoss - expectedPoolFees);
  const buyTax = parseFloat((netTax / 2).toFixed(2));
  const sellTax = parseFloat((netTax / 2).toFixed(2));

  return { isHoneypot: false, buyTax, sellTax, simulationSuccess: true, feeTier: fee, tokensReceived };
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
  try {
    const data = await fetch(`https://base.blockscout.com/api/v2/addresses/${addr}`, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? (r.json() as any) : null));
    return data?.creator_address_hash?.toLowerCase() || null;
  } catch { return null; }
}

async function getHolderCount(addr: string): Promise<number> {
  try {
    const data = await fetch(`https://base.blockscout.com/api/v2/tokens/${addr}/counters`, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? (r.json() as any) : null));
    return parseInt(data?.token_holders_count || "0", 10);
  } catch { return 0; }
}

async function getTopHolders(addr: string): Promise<{ address: string; percent: number }[]> {
  try {
    const data = await fetch(`https://base.blockscout.com/api/v2/tokens/${addr}/holders?limit=10`, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? (r.json() as any) : null));
    if (!data?.items) return [];
    return data.items.map((h: any) => ({ address: (h.address?.hash || "").toLowerCase(), percent: parseFloat(h.percentage || "0") }));
  } catch { return []; }
}

async function getEthUsdPrice(): Promise<number> {
  try {
    const data = await fetch("https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006", { signal: AbortSignal.timeout(5000) })
      .then((r) => (r.ok ? (r.json() as any) : null));
    return parseFloat(data?.pairs?.[0]?.priceUsd || "0") || 0;
  } catch { return 0; }
}

function detectPlatform(addr: string, deployer: string | null, holders: { address: string }[]): string | null {
  const a = addr.toLowerCase();
  if (PLATFORM_MAP[a]) return PLATFORM_MAP[a];
  if (deployer && PLATFORM_MAP[deployer]) return PLATFORM_MAP[deployer];
  for (const h of holders) { if (PLATFORM_MAP[h.address]) return PLATFORM_MAP[h.address]; }
  return null;
}

function detectLpStatus(holders: { address: string; percent: number }[], platform: string | null): string {
  for (const h of holders) {
    if (BURN_ADDRS.has(h.address)) return "BURNED";
    if (LOCKER_MAP[h.address]) return `LOCKED (${LOCKER_MAP[h.address]})`;
  }
  if (platform) return `${platform} Managed`;
  return "OPEN";
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", engine: "APOL v2 — Simulation-First", timestamp: Date.now() });
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
          rpcAlchemySimulate(address),
          getTokenInfo(address),
          getDeployer(address),
          getHolderCount(address),
          getTopHolders(address),
          getEthUsdPrice(),
        ]),
        HARD_TIMEOUT,
        "detective-analyze",
      );

      const sim = results[0].status === "fulfilled" ? results[0].value : { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0) };
      const tokenInfo = results[1].status === "fulfilled" ? results[1].value : { name: "Unknown", symbol: "???", totalSupply: BigInt(0), decimals: 18 };
      const deployer = results[2].status === "fulfilled" ? results[2].value : null;
      const holderCount = results[3].status === "fulfilled" ? results[3].value : 0;
      const topHolders = results[4].status === "fulfilled" ? results[4].value : [];
      const ethUsd = results[5].status === "fulfilled" ? results[5].value : 0;

      const scanCount = await storage.incrementLookup(address, tokenInfo.name, tokenInfo.symbol);
      const platform = detectPlatform(address, deployer, topHolders);
      const lpStatus = detectLpStatus(topHolders, platform);
      const isVirtuals = platform === "Virtuals";

      const buyTax = isVirtuals ? 0 : sim.buyTax;
      const sellTax = isVirtuals ? 0 : sim.sellTax;
      const isHoneypot = isVirtuals ? false : sim.isHoneypot;
      const tokensWholeUnits = Number(sim.tokensReceived) / (10 ** tokenInfo.decimals);
      const tokenPriceEth = tokensWholeUnits > 0 ? 0.1 / tokensWholeUnits : 0;
      const tokenPriceUsd = tokenPriceEth * ethUsd;
      const mcap = Number(tokenInfo.totalSupply) * tokenPriceUsd;

      const riskLevel = isHoneypot || buyTax > 10 || sellTax > 10 ? "High" : buyTax > 0 || sellTax > 0 ? "Caution" : "Clean";

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
        deployer,
        scanCount,
        greenBadge: riskLevel === "Clean" && sim.simulationSuccess,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Scan failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
