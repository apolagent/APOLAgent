import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

const BASE_RPC = process.env.BASE_RPC_URL || "";
const WETH = "0x4200000000000000000000000000000000000006";
const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const SIM_AMOUNT = BigInt("1000000000000000");
const BURN_ADDRS = new Set(["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"]);
const HARD_TIMEOUT = 10000;

const PLATFORM_MAP: Record<string, string> = {
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
  "0xe85a59c628f7d27878aceb4bf3b35733630083a9": "Clanker",
  "0x2a787b2362021cc3eea3c24c4748a6cd5b687382": "Clanker",
  "0xe85a08cf16f07b0b6e8b1f5e4918f6e9dab3a5c0": "Clanker",
  "0xf3622742b1e446d92e45e22923ef11c2fcd55d68": "Clanker",
  "0x6a53f8b799be11a2a3264ef0bff183dcb12d9571": "Flaunch",
  "0xce0e4e4d2dc0033ce2dd0ec79abe6186106f0462": "Flaunch",
  "0x0bf8edd756ff6caf3f583d67a9fd8b237e40f58a": "ApeStore",
  "0xade20c0cc8482c404a57da404ed1f3f2a1f6fe6f": "ApeStore",
  "0xade256e1c2763b8766efe1eeb7c578d93f621f6f": "ApeStore",
  "0xb1900f41d78d330a2a35c6771b3a6088a1b51309": "ApeStore",
  "0x39112541720078c70164ea4deb61f0a4811910f9": "Flaunch",
  "0xc785de52b739930ab0864b0ae7896ed6e327628a": "Flaunch",
  "0x45edccb44da8aa1bf4b9e4f2baae61760d1c8fb9": "Flaunch",
};

const LOCKER_MAP: Record<string, string> = {
  "0xe85a59c628f7d27878aceb4bf3b35733630083a9": "Clanker",
  "0x2a787b2362021cc3eea3c24c4748a6cd5b687382": "Clanker",
  "0xe85a08cf16f07b0b6e8b1f5e4918f6e9dab3a5c0": "Clanker",
  "0xf3622742b1e446d92e45e22923ef11c2fcd55d68": "Clanker",
  "0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214": "Unicrypt",
  "0x71b5759d73262fbb223956913ecf4ecc51057641": "PinkLock",
  "0xe2fe530c047f2d85298b07d9333c05737f1435fb": "Team Finance",
  "0x0bf8edd756ff6caf3f583d67a9fd8b237e40f58a": "ApeStore",
  "0xade20c0cc8482c404a57da404ed1f3f2a1f6fe6f": "ApeStore",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
  "0x6a53f8b799be11a2a3264ef0bff183dcb12d9571": "Flaunch",
  "0xce0e4e4d2dc0033ce2dd0ec79abe6186106f0462": "Flaunch",
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

  const MICRO_AMOUNT = BigInt("1000000000000");
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
    const data = await fetch(`https://base.blockscout.com/api/v2/addresses/${addr}`, { signal: AbortSignal.timeout(4000) })
      .then((r) => (r.ok ? (r.json() as any) : null));
    if (data?.creator_address_hash) return data.creator_address_hash.toLowerCase();
  } catch {}
  return null;
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

async function getDexScreenerData(addr: string): Promise<{ priceUsd: number; liquidity: number }> {
  try {
    const data = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok ? r.json() as any : null);
    const pair = data?.pairs?.[0];
    return { priceUsd: parseFloat(pair?.priceUsd || "0") || 0, liquidity: parseFloat(pair?.liquidity?.usd || "0") || 0 };
  } catch { return { priceUsd: 0, liquidity: 0 }; }
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
    const resp = await fetch(`https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${addr}`, { signal: AbortSignal.timeout(5000) });
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

const CREATION_LOG_SIGNATURES: Record<string, string> = {
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
};

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
    }
    return null;
  } catch { return null; }
}

async function detectPlatformFromDeployerChain(deployer: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://base.blockscout.com/api/v2/addresses/${deployer}`);
    if (!resp.ok) return null;
    const data = await resp.json() as any;
    if (data.is_contract) {
      if (data.creator_address_hash) {
        const creator = data.creator_address_hash.toLowerCase();
        if (PLATFORM_MAP[creator]) return PLATFORM_MAP[creator];
      }
      const name = (data.name || "").toLowerCase();
      if (name.includes("flaunch") || name.includes("flayer")) return "Flaunch";
      if (name.includes("clanker")) return "Clanker";
      if (name.includes("apestore") || name.includes("ape.store")) return "ApeStore";
      if (name.includes("virtuals")) return "Virtuals";

      try {
        const srcResp = await fetch(`https://base.blockscout.com/api/v2/smart-contracts/${deployer}`);
        if (srcResp.ok) {
          const srcData = await srcResp.json() as any;
          const contractName = (srcData.name || "").toLowerCase();
          if (contractName.includes("flaunch") || contractName.includes("flayer")) return "Flaunch";
          if (contractName.includes("clanker")) return "Clanker";
          if (contractName.includes("apestore") || contractName.includes("ape.store")) return "ApeStore";
          if (contractName.includes("virtuals")) return "Virtuals";
          const src = (srcData.source_code || "").slice(0, 5000).toLowerCase();
          if (src.includes("@flaunch/") || src.includes("flaunchzap")) return "Flaunch";
          if (src.includes("clanker")) return "Clanker";
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

const MANAGED_PROTOCOLS = new Set(["Virtuals", "Clanker", "Flaunch"]);

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
        const [creationP, chainP] = await Promise.all([
          withTimeout(detectPlatformFromCreationTx(address), 5000, "creation-platform-detect").catch(() => null),
          deployer ? withTimeout(detectPlatformFromDeployerChain(deployer), 5000, "deployer-chain-detect").catch(() => null) : null,
        ]);
        platform = creationP || chainP;
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
      const mcap = Number(tokenInfo.totalSupply) * tokenPriceUsd;

      const nameUpper = tokenInfo.name.toUpperCase();
      const symbolUpper = tokenInfo.symbol.toUpperCase();
      const isFakeApol = symbolUpper === "APOL" || nameUpper === "APOL" || nameUpper === "APOL AGENT" || nameUpper.includes("APOLAGENT");

      const riskLevel = isFakeApol || isHoneypot || buyTax > 10 || sellTax > 10 ? "High" : buyTax > 0 || sellTax > 0 ? "Caution" : "Clean";

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
        fakeApolWarning: isFakeApol ? "APOL has NO official token. Any $APOL token is a SCAM." : null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Scan failed" });
    }
  });

  app.post("/api/agent/analyze", async (req, res) => {
    try {
      const { agentName, socialLink, wallet, chain = "base", claimedAbilities, logsUrl } = req.body;
      if (!agentName) return res.status(400).json({ error: "Agent name is required" });

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
      }

      let logsStatus: "verified" | "mismatch" | "inconclusive" = "inconclusive";
      let logsDetail = "No logs URL provided.";
      const logsArr: string[] = [];
      if (logsUrl && logsUrl.trim()) {
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
      }

      const traceScore = traceIsContract ? 20 : wallet ? 5 : 0;
      const socialScore = socialStatus === "clear" ? 20 : socialStatus === "suspicious" ? 5 : 10;
      const logsScore = logsStatus === "verified" ? 20 : logsStatus === "mismatch" ? 0 : 5;
      const totalPossible = 100;
      const rawScore = speedScore + traceScore + contextScore + socialScore + logsScore;

      const scoredTests = [
        wallet ? 1 : 0,
        socialLink ? 1 : 0,
        logsUrl ? 1 : 0,
        claimedAbilities ? 1 : 0,
        wallet ? 1 : 0,
      ].reduce((a, b) => a + b, 0);

      const cognitionScore = scoredTests >= 2 ? Math.min(100, rawScore) : null;
      const isPartial = scoredTests < 3;

      type Verdict = "Digital Puppet" | "Semi-Autonomous" | "Fully Autonomous" | "Low Autonomy" | "Insufficient Data" | "Inconclusive";
      let verdict: Verdict;
      if (scoredTests < 2) verdict = "Insufficient Data";
      else if (cognitionScore !== null && cognitionScore >= 71) verdict = "Fully Autonomous";
      else if (cognitionScore !== null && cognitionScore >= 41) verdict = "Semi-Autonomous";
      else if (cognitionScore !== null && cognitionScore >= 21) verdict = "Low Autonomy";
      else if (cognitionScore !== null) verdict = "Digital Puppet";
      else verdict = "Inconclusive";

      let apolVerdict = "";
      if (verdict === "Digital Puppet") apolVerdict = "This entity shows minimal signs of autonomous operation. High probability of being a manually operated LARP.";
      else if (verdict === "Low Autonomy") apolVerdict = "Contract security verified but AI identity could not be confirmed. Not necessarily a risk, but exercise caution.";
      else if (verdict === "Semi-Autonomous") apolVerdict = "Mixed signals detected. Some autonomous patterns present but not fully conclusive. Monitor for continued activity.";
      else if (verdict === "Fully Autonomous") apolVerdict = "Strong evidence of autonomous operation. On-chain activity, social presence, and reasoning logs are consistent with a real AI agent.";
      else if (verdict === "Insufficient Data") apolVerdict = "Not enough data to issue a verdict. Provide wallet address, logs URL, and claimed abilities for a full assessment.";
      else apolVerdict = "No verifiable evidence submitted.";

      if (deployerContractCount >= 5) apolVerdict += ` ⚠️ Serial deployer detected: ${deployerContractCount} contracts from the same creator.`;
      if (treasuryEth < 0.005 && wallet) apolVerdict += " ⚠️ Creator treasury is near-empty.";

      res.json({
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
        contractScan,
        creatorAddress: deployerAddr,
        platformName: contractScan?.protocolLocker || null,
        isKnownFactory: !!contractScan?.protocolLocker,
      });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Agent analysis failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
