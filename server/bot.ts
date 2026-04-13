import { Telegraf } from "telegraf";
import { storage } from "./storage";
import {
  WETH, QUOTER_V2, V3_FACTORY, SIM_AMOUNT, MICRO_AMOUNT, FEE_TIERS,
  BURN_ADDRS, PLATFORM_MAP, LOCKER_MAP, CREATION_LOG_SIGNATURES, MANAGED_PROTOCOLS,
  DEPLOYER_CHAIN_KEYWORDS, BLOCKSCOUT_BASE, DEXSCREENER_BASE, GOPLUS_BASE, BASE_CHAIN_ID,
  VERIFIED_AGENTS, CLANKER_API_BASE, SERIAL_DEPLOYER_THRESHOLD, SERIAL_DEPLOYER_WINDOW_DAYS,
  APOL_CA,
} from "./constants";

function log(message: string, source = "bot") {
  const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  console.log(`${t} [${source}] ${message}`);
}

const BASE_RPC = process.env.BASE_RPC_URL || "";

const SCAN_CACHE = new Map<string, { result: string; timestamp: number }>();
const SCAN_CACHE_TTL = 60000;
const SCAN_IN_FLIGHT = new Map<string, Promise<string>>();

const PENDING_COMMAND = new Map<number, { command: string; timestamp: number }>();
const PENDING_TTL = 120000;

const DEX_CACHE = new Map<string, { data: { priceUsd: number; liquidity: number; poolVersion: string | null }; timestamp: number }>();
const DEX_CACHE_TTL = 60000;
let ETH_PRICE_CACHE: { price: number; timestamp: number } | null = null;
const ETH_CACHE_TTL = 60000;

interface SimResult {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  simulationSuccess: boolean;
  feeTier: number | null;
  tokensReceived: bigint;
  failReason: string | null;
}

function pad32(hex: string): string { return hex.replace(/^0x/i, "").padStart(64, "0"); }
function uint256Hex(n: bigint): string { return n.toString(16).padStart(64, "0"); }

async function rpcCall(method: string, params: any[]): Promise<any> {
  const resp = await fetch(BASE_RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
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
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
  });
  const results = (await resp.json()) as any[];
  results.sort((a: any, b: any) => a.id - b.id);
  return results.map((r: any) => (r.error ? null : r.result));
}

function softTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

async function findBestPool(token: string): Promise<{ pool: string; fee: number } | null> {
  const addr = token.toLowerCase();
  const [t0, t1] = addr < WETH.toLowerCase() ? [addr, WETH.toLowerCase()] : [WETH.toLowerCase(), addr];
  const calls = FEE_TIERS.map((fee) => ({
    method: "eth_call" as const,
    params: [{ to: V3_FACTORY, data: "0x1698ee82" + pad32(t0) + pad32(t1) + uint256Hex(BigInt(fee)) }, "latest"],
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

async function simulateRoundTrip(addr: string, amount: bigint, fee: number): Promise<{ tokensReceived: bigint; ethBack: bigint } | "buy_fail" | "sell_fail"> {
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

async function simulateToken(tokenAddress: string): Promise<SimResult> {
  const addr = tokenAddress.toLowerCase();
  const fail = (reason: string): SimResult => ({ isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0), failReason: reason });

  const poolInfo = await findBestPool(addr);
  if (!poolInfo) return fail("No Uniswap liquidity pool found");
  const { fee } = poolInfo;
  const expectedPoolFees = (fee / 10000) * 2;

  let taxFromMicro: number | null = null;

  const microResult = await simulateRoundTrip(addr, MICRO_AMOUNT, fee);
  if (microResult !== "buy_fail" && microResult !== "sell_fail" && microResult.ethBack > BigInt(0)) {
    const microIn = Number(MICRO_AMOUNT) / 1e18;
    const microOut = Number(microResult.ethBack) / 1e18;
    const microLoss = ((microIn - microOut) / microIn) * 100;
    taxFromMicro = Math.max(0, microLoss - expectedPoolFees);
  }

  const mainResult = await simulateRoundTrip(addr, SIM_AMOUNT, fee);
  if (mainResult === "buy_fail") {
    if (microResult === "buy_fail") return fail("Insufficient liquidity");
    if (microResult === "sell_fail") return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived: BigInt(0), failReason: null };
    return { isHoneypot: false, buyTax: parseFloat(((taxFromMicro || 0) / 2).toFixed(1)), sellTax: parseFloat(((taxFromMicro || 0) / 2).toFixed(1)), simulationSuccess: true, feeTier: fee, tokensReceived: microResult.tokensReceived, failReason: null };
  }
  if (mainResult === "sell_fail") return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived: BigInt(0), failReason: null };
  if (mainResult.ethBack === BigInt(0)) return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived: mainResult.tokensReceived, failReason: null };

  let netTax: number;
  if (taxFromMicro !== null) {
    netTax = taxFromMicro;
  } else {
    const ethIn = Number(SIM_AMOUNT) / 1e18;
    const ethOut = Number(mainResult.ethBack) / 1e18;
    const roundTripLoss = ((ethIn - ethOut) / ethIn) * 100;
    netTax = Math.max(0, roundTripLoss - expectedPoolFees);
  }

  const buyTax = parseFloat((netTax / 2).toFixed(1));
  const sellTax = parseFloat((netTax / 2).toFixed(1));

  return { isHoneypot: false, buyTax, sellTax, simulationSuccess: true, feeTier: fee, tokensReceived: mainResult.tokensReceived, failReason: null };
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
      return Buffer.from(hex.slice(2 + offset + 64, 2 + offset + 64 + len * 2), "hex").toString("utf8");
    } catch { return ""; }
  };
  const rawSupply = results[2] ? BigInt(results[2]) : BigInt(0);
  const decimals = results[3] ? Number(BigInt(results[3])) : 18;
  const divisor = BigInt(10) ** BigInt(decimals);
  return { name: decodeName(results[0]) || "Unknown", symbol: decodeName(results[1]) || "???", totalSupply: divisor > 0 ? rawSupply / divisor : BigInt(0), decimals };
}

async function getDeployer(addr: string): Promise<string | null> {
  if (BASE_RPC) {
    try {
      const resp = await fetch(BASE_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    const data = await fetch(`${BLOCKSCOUT_BASE}/api/v2/addresses/${addr}`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok ? r.json() as any : null);
    if (data?.creator_address_hash) return data.creator_address_hash.toLowerCase();
  } catch {}
  return null;
}

async function getHolderCount(addr: string): Promise<number> {
  try {
    const data = await fetch(`${BLOCKSCOUT_BASE}/api/v2/tokens/${addr}/counters`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok ? r.json() as any : null);
    return parseInt(data?.token_holders_count || "0", 10);
  } catch { return 0; }
}

async function getTopHolders(addr: string): Promise<{ address: string; percent: number }[]> {
  try {
    const data = await fetch(`${BLOCKSCOUT_BASE}/api/v2/tokens/${addr}/holders?limit=10`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok ? r.json() as any : null);
    if (!data?.items) return [];
    return data.items.map((h: any) => ({ address: (h.address?.hash || "").toLowerCase(), percent: parseFloat(h.percentage || "0") }));
  } catch { return []; }
}

async function getEthUsdPrice(): Promise<number> {
  if (ETH_PRICE_CACHE && Date.now() - ETH_PRICE_CACHE.timestamp < ETH_CACHE_TTL) {
    return ETH_PRICE_CACHE.price;
  }
  try {
    const data = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${WETH}`, { signal: AbortSignal.timeout(6000) }).then((r) => r.ok ? r.json() as any : null);
    const price = parseFloat(data?.pairs?.[0]?.priceUsd || "0") || 0;
    if (price > 0) ETH_PRICE_CACHE = { price, timestamp: Date.now() };
    return price || ETH_PRICE_CACHE?.price || 0;
  } catch {
    return ETH_PRICE_CACHE?.price || 0;
  }
}

async function getDexScreenerData(addr: string): Promise<{ priceUsd: number; liquidity: number; poolVersion: string | null; dexMcap: number; dexFdv: number }> {
  const key = addr.toLowerCase();
  const cached = DEX_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < DEX_CACHE_TTL) {
    return cached.data;
  }
  try {
    const data = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(6000) }).then((r) => r.ok ? r.json() as any : null);
    const pairs = data?.pairs || [];
    const pair = pairs.length > 1
      ? pairs.reduce((best: any, p: any) => (parseFloat(p?.liquidity?.usd || "0") > parseFloat(best?.liquidity?.usd || "0") ? p : best), pairs[0])
      : pairs[0] || null;
    const labels: string[] = pair?.labels || [];
    let poolVersion: string | null = null;
    if (labels.includes("v4")) poolVersion = "v4";
    else if (labels.includes("v3")) poolVersion = "v3";
    const result = {
      priceUsd: parseFloat(pair?.priceUsd || "0") || 0,
      liquidity: parseFloat(pair?.liquidity?.usd || "0") || 0,
      poolVersion,
      dexMcap: parseFloat(pair?.marketCap || "0") || 0,
      dexFdv: parseFloat(pair?.fdv || "0") || 0,
    };
    if (result.priceUsd > 0) DEX_CACHE.set(key, { data: result, timestamp: Date.now() });
    return result.priceUsd > 0 ? result : cached?.data || result;
  } catch {
    return cached?.data || { priceUsd: 0, liquidity: 0, poolVersion: null, dexMcap: 0, dexFdv: 0 };
  }
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

async function searchDexScreener(query: string): Promise<{ address: string; name: string; symbol: string; chain: string } | null> {
  try {
    const data = await fetch(`${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok ? r.json() as any : null);
    const pair = data?.pairs?.find((p: any) => p.chainId === "base");
    if (!pair) return null;
    return { address: pair.baseToken?.address || "", name: pair.baseToken?.name || "", symbol: pair.baseToken?.symbol || "", chain: "base" };
  } catch { return null; }
}

interface WalletInfo {
  balance: string;
  txCount: number;
  isContract: boolean;
  firstTx: string | null;
  firstTxHash: string | null;
  firstTxFrom: string | null;
  firstTxFromName: string | null;
  inflow: number;
  outflow: number;
}

async function getWalletInfo(addr: string): Promise<WalletInfo> {
  try {
    const lowerAddr = addr.toLowerCase();

    const [balResult, codeResult] = await rpcBatch([
      { method: "eth_getBalance", params: [addr, "latest"] },
      { method: "eth_getCode", params: [addr, "latest"] },
    ]);
    const balWei = balResult ? BigInt(balResult) : BigInt(0);
    const balEth = Number(balWei) / 1e18;
    const isContract = codeResult && codeResult !== "0x" && codeResult.length > 2;

    let txCount = 0;
    let firstTx: string | null = null;
    let firstTxHash: string | null = null;
    let firstTxFrom: string | null = null;
    let firstTxFromName: string | null = null;
    let inflow = 0;
    let outflow = 0;

    if (BASE_RPC) {
      try {
        const [inResp, outResp] = await Promise.all([
          fetch(BASE_RPC, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 10, method: "alchemy_getAssetTransfers",
              params: [{ fromBlock: "0x0", toBlock: "latest", toAddress: addr, category: ["external", "erc20", "erc721", "erc1155"], maxCount: "0x32", order: "asc" }] }),
            signal: AbortSignal.timeout(8000),
          }).then(r => r.json() as any),
          fetch(BASE_RPC, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 11, method: "alchemy_getAssetTransfers",
              params: [{ fromBlock: "0x0", toBlock: "latest", fromAddress: addr, category: ["external", "erc20", "erc721", "erc1155"], maxCount: "0x32", order: "asc" }] }),
            signal: AbortSignal.timeout(8000),
          }).then(r => r.json() as any),
        ]);

        const inTransfers = inResp?.result?.transfers || [];
        const outTransfers = outResp?.result?.transfers || [];

        const allTransfers = [...inTransfers, ...outTransfers].sort((a, b) => {
          const ba = parseInt(a.blockNum, 16);
          const bb = parseInt(b.blockNum, 16);
          return ba - bb;
        });

        const uniqueHashes = new Set<string>();
        for (const t of allTransfers) uniqueHashes.add(t.hash);
        txCount = uniqueHashes.size;

        if (allTransfers.length > 0) {
          const first = allTransfers[0];
          firstTxHash = first.hash;
          const blockHex = first.blockNum;
          try {
            const [blockData] = await rpcBatch([{ method: "eth_getBlockByNumber", params: [blockHex, false] }]);
            if (blockData?.timestamp) {
              firstTx = new Date(parseInt(blockData.timestamp, 16) * 1000).toISOString();
            }
          } catch {}

          if (first.from?.toLowerCase() !== lowerAddr) {
            firstTxFrom = first.from;
          } else if (first.to) {
            firstTxFrom = first.to;
          }
        }

        for (const t of inTransfers) {
          if (t.value && t.asset === "ETH") inflow += t.value;
        }
        for (const t of outTransfers) {
          if (t.value && t.asset === "ETH") outflow += t.value;
        }
      } catch {}
    }

    if (txCount === 0) {
      try {
        const [nonceResult] = await rpcBatch([{ method: "eth_getTransactionCount", params: [addr, "latest"] }]);
        if (nonceResult) {
          const nonce = parseInt(nonceResult, 16);
          if (nonce > txCount) txCount = nonce;
        }
      } catch {}
    }

    return { balance: balEth.toFixed(4), txCount, isContract, firstTx, firstTxHash, firstTxFrom, firstTxFromName, inflow, outflow };
  } catch { return { balance: "0", txCount: 0, isContract: false, firstTx: null, firstTxHash: null, firstTxFrom: null, firstTxFromName: null, inflow: 0, outflow: 0 }; }
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
    }
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

function detectLpStatus(holders: { address: string; percent: number }[], platform: string | null, holdersComplete: boolean): string {
  if (platform && MANAGED_PROTOCOLS.has(platform)) return `${platform} Managed ✅`;
  for (const h of holders) {
    if (BURN_ADDRS.has(h.address)) return `Burned 🔥`;
    if (LOCKER_MAP[h.address]) return `${LOCKER_MAP[h.address]} Locked 🔒`;
  }
  if (platform) return `${platform} Managed ✅`;
  if (!holdersComplete) return "Checking...";
  return "Unlocked ⚠️";
}

function formatPrice(usdPrice: number): string {
  if (usdPrice === 0) return "$0";
  if (usdPrice >= 1000) return `$${usdPrice.toFixed(2)}`;
  if (usdPrice >= 1) return `$${usdPrice.toFixed(4)}`;
  if (usdPrice >= 0.01) return `$${usdPrice.toFixed(6)}`;
  const s = usdPrice.toFixed(20);
  const match = s.match(/^0\.(0*[1-9]\d{0,3})/);
  if (match) return `$0.${match[1]}`;
  return `$${usdPrice.toFixed(18).replace(/0+$/, "")}`;
}

function formatUsd(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

function isContractAddress(text: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(text.trim());
}

async function runScan(address: string): Promise<string> {
  const t0 = Date.now();
  log(`runScan START for ${address.slice(0, 10)}...`, "bot");

  let phase1End = 0;
  const [simR, tokenR, deployerR] = await Promise.allSettled([
    softTimeout(simulateToken(address), 12000, { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0), failReason: "Timeout" } as SimResult),
    softTimeout(getTokenInfo(address), 8000, { name: "Unknown", symbol: "???", totalSupply: BigInt(0), decimals: 18 }),
    softTimeout(getDeployer(address), 7000, null),
  ]);
  phase1End = Date.now();
  log(`runScan P1 ${phase1End - t0}ms sim=${simR.status} token=${tokenR.status} deployer=${deployerR.status}`, "bot");

  const sim: SimResult = simR.status === "fulfilled" ? simR.value
    : { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0), failReason: "Simulation error" };
  const tokenInfo = tokenR.status === "fulfilled" ? tokenR.value
    : { name: "Unknown", symbol: "???", totalSupply: BigInt(0), decimals: 18 };
  let deployer = deployerR.status === "fulfilled" ? deployerR.value : null;

  const platformFromDeployer = detectPlatform(address, deployer, []);

  let [holderCount, topHolders, ethUsd, dexData, creationPlatform, deployerChainPlatform] = await Promise.all([
    softTimeout(getHolderCount(address), 7000, 0),
    softTimeout(getTopHolders(address), 7000, []),
    softTimeout(getEthUsdPrice(), 7000, 0),
    softTimeout(getDexScreenerData(address), 7000, { priceUsd: 0, liquidity: 0, poolVersion: null, dexMcap: 0, dexFdv: 0 }),
    !platformFromDeployer ? softTimeout(detectPlatformFromCreationTx(address), 7000, null) : Promise.resolve(null),
    !platformFromDeployer && deployer ? softTimeout(detectPlatformFromDeployerChain(deployer), 7000, null) : Promise.resolve(null),
  ]);

  log(`runScan P2 ${Date.now() - t0}ms holders=${holderCount} dex=$${dexData.priceUsd} ethUsd=${ethUsd}`, "bot");

  let holdersComplete = topHolders.length > 0;

  if (dexData.priceUsd === 0 || holderCount === 0) {
    const retries = await Promise.all([
      dexData.priceUsd === 0 ? softTimeout(getDexScreenerData(address), 5000, { priceUsd: 0, liquidity: 0, poolVersion: null, dexMcap: 0, dexFdv: 0 }) : Promise.resolve(dexData),
      holderCount === 0 ? softTimeout(getHolderCount(address), 5000, 0) : Promise.resolve(holderCount),
      topHolders.length === 0 ? softTimeout(getTopHolders(address), 5000, []) : Promise.resolve(topHolders),
    ]);
    if (dexData.priceUsd === 0) dexData = retries[0] as typeof dexData;
    if (holderCount === 0) holderCount = retries[1] as number;
    if (topHolders.length === 0) {
      topHolders = retries[2] as typeof topHolders;
      holdersComplete = topHolders.length > 0;
    }
    log(`runScan P2-retry ${Date.now() - t0}ms holders=${holderCount} dex=$${dexData.priceUsd}`, "bot");
  }

  let fallbackData: FallbackTokenData | null = null;
  const needsFallback = holderCount === 0 || (!sim.simulationSuccess && !deployer);
  if (needsFallback) {
    fallbackData = await softTimeout(getFallbackTokenData(address), 5000, null);
    if (fallbackData) {
      if (holderCount === 0 && fallbackData.holderCount > 0) holderCount = fallbackData.holderCount;
      if (!deployer && fallbackData.creatorAddress) deployer = fallbackData.creatorAddress.toLowerCase();
    }
  }

  const scanCount = await storage.incrementLookup(address, tokenInfo.name, tokenInfo.symbol);

  const platform = detectPlatform(address, deployer, topHolders) || platformFromDeployer || creationPlatform || deployerChainPlatform;
  const lpStatus = detectLpStatus(topHolders, platform, holdersComplete);
  const isVirtuals = platform === "Virtuals";
  const isManaged = !!(platform && MANAGED_PROTOCOLS.has(platform));
  const isClanker = platform === "Clanker";

  const clankerData = isClanker ? await softTimeout(fetchClankerData(address), 5000, null) : null;

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
  const liquidity = dexData.liquidity;

  const hasPool = sim.simulationSuccess || isManaged || !!platform;
  const poolLabel = "Uniswap";
  const dexStatus = hasPool ? `${poolLabel} ✅` : "No Pool Found ⚠️";

  let contractOwner: string | null = null;
  let isOwnerRenounced = false;
  let ownerCheckDone = false;
  try {
    const ownerSig = "0x8da5cb5b";
    const [ownerResult] = await rpcBatch([
      { method: "eth_call", params: [{ to: address, data: ownerSig }, "latest"] },
    ]);
    if (ownerResult && ownerResult !== "0x" && ownerResult.length >= 66) {
      contractOwner = "0x" + ownerResult.slice(26).toLowerCase();
      const DEAD = ["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead", "0x0000000000000000000000000000000000000001"];
      isOwnerRenounced = DEAD.includes(contractOwner);
      ownerCheckDone = true;
    }
  } catch {}

  const nameUpper = tokenInfo.name.toUpperCase();
  const symbolUpper = tokenInfo.symbol.toUpperCase();
  const isRealApol = address.toLowerCase() === APOL_CA;
  const isFakeApol = !isRealApol && (symbolUpper === "APOL" || nameUpper === "APOL" || nameUpper === "APOL AGENT" || nameUpper.includes("APOLAGENT"));

  const flags: string[] = [];
  if (isFakeApol) flags.push("🚨 FAKE $APOL — The real APOL CA is 0x7d8817AcEa5c58a3675088d779a3b5a0CaA57B07.");
  if (isHoneypot) flags.push("🚨 Honeypot — SELL BLOCKED");
  if (buyTax > 5 || sellTax > 5) flags.push(`💰 High tax: Buy ${buyTax}% / Sell ${sellTax}%`);
  if (!isRealApol && holderCount > 0 && holderCount < 100) flags.push("👥 Low holder count");
  if (!isRealApol && liquidity > 0 && liquidity < 10000) flags.push("💧 Very Low Liquidity");
  if (!isRealApol && !hasPool) flags.push("⚠️ No Uniswap liquidity pool");

  const riskLevel = isRealApol ? "🟢 LOW RISK"
    : isFakeApol || isHoneypot || buyTax > 10 || sellTax > 10
      ? "🔴 HIGH RISK"
      : flags.length > 0
        ? "🟡 CAUTION"
        : "🟢 LOW RISK";

  log(`runScan DONE for ${address.slice(0, 10)}... in ${Date.now() - t0}ms — ${tokenInfo.symbol} risk=${riskLevel.includes("HIGH") ? "HIGH" : riskLevel.includes("CAUTION") ? "MID" : "LOW"} sim=${sim.simulationSuccess}`, "bot");

  const riskShort = riskLevel.includes("HIGH") ? "High" : riskLevel.includes("CAUTION") ? "Caution" : "Clean";
  storage.logAgentActivity({
    action: "contract_scan",
    target: address,
    detail: `Analyzed ${tokenInfo.symbol || "unknown"} via Telegram. Simulation: ${sim.simulationSuccess ? "success" : "failed"}. Risk: ${riskShort}. ${isHoneypot ? "Honeypot detected." : ""} ${buyTax > 0 || sellTax > 0 ? `Tax: ${buyTax}%/${sellTax}%.` : "No tax."} ${platform ? `Platform: ${platform}.` : ""} Holders: ${holderCount}.`.replace(/\s+/g, " ").trim(),
    verdict: riskShort,
    source: "telegram",
    metadata: { tokenSymbol: tokenInfo.symbol, tokenName: tokenInfo.name, isHoneypot, buyTax, sellTax, platform, holderCount, mcap },
  }).catch(() => {});

  const shortAddr = address.slice(0, 8) + "..." + address.slice(-6);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const priceStr = tokenPriceUsd > 0 ? formatPrice(tokenPriceUsd) : "N/A";
  const mcapStr = mcap > 0 ? formatUsd(mcap) : "N/A";
  const liqStr = liquidity > 0 ? formatUsd(liquidity) : "N/A";
  const holderStr = holderCount > 0 ? holderCount.toLocaleString() : "N/A";

  const lines: string[] = [
    `🏛 *APOL AGENT — CONTRACT SNAPSHOT*`,
    ``,
    `📍 *Address:* \`${shortAddr}\``,
    `⛓ *Chain:* Base Mainnet`,
    ``,
    `*${esc(tokenInfo.name)}* ($${esc(tokenInfo.symbol)}) 👁️ ${scanCount}`,
    `💲 *Price:* ${priceStr}`,
    `📊 *Market Cap:* ${mcapStr}`,
    `💧 *Liquidity:* ${liqStr}`,
    `📡 *Status:* ${dexStatus}`,
    `🔒 *LP Status:* ${lpStatus}`,
    `👥 *Holders:* ${holderStr}`,
    `💰 *Buy Tax:* ${buyTax.toFixed(1)}%  |  *Sell Tax:* ${sellTax.toFixed(1)}%`,
  ];

  if (clankerData) {
    if (clankerData.volume24h > 0) lines.push(`📈 *24h Volume:* ${formatUsd(clankerData.volume24h)}`);
    if (clankerData.rewardsAvailable) lines.push(`💎 *Clanker Rewards:* Available`);
    if (clankerData.warnings.length > 0) lines.push(`⚠️ *Clanker Warnings:* ${clankerData.warnings.join(", ")}`);
  }

  lines.push(``);
  lines.push(`*RISK LEVEL:* ${riskLevel}`);
  lines.push(``);

  if (isManaged || platform) {
    lines.push(`📋 *DEPLOYER*`);
    if (deployer) lines.push(`• \`${deployer.slice(0, 10)}...\``);
    lines.push(`• Deployed via ${platform}`);
  } else if (ownerCheckDone) {
    if (isOwnerRenounced) {
      lines.push(`✅ *CONTRACT RENOUNCED*`);
      lines.push(`• Ownership burned. No admin keys.`);
    } else if (contractOwner) {
      lines.push(`⚠️ *CONTRACT NOT RENOUNCED*`);
      lines.push(`• Owner: \`${contractOwner.slice(0, 10)}...\``);
    }
  } else if (deployer) {
    lines.push(`📋 *DEPLOYER*`);
    lines.push(`• \`${deployer.slice(0, 10)}...\``);
    lines.push(`• Ownership status: Unknown`);
  }

  if (flags.length > 0) {
    lines.push(``);
    lines.push(`🚩 *FLAGS DETECTED:*`);
    for (const f of flags) lines.push(`   ${f}`);
  }

  lines.push(``);
  lines.push(`🔍 [Full Scan](https://apolagent.online/agent-scanner)   🏛 [Wall of Shame](https://apolagent.online/report-scam)`);
  lines.push(`🔗 [View on Basescan](https://basescan.org/address/${address})`);
  lines.push(``);
  lines.push(`⚡ ${elapsed}s · APOL Forensic Engine`);

  return lines.join("\n");
}

async function getDeployerContracts(deployer: string): Promise<{ count: number; tokens: { address: string; name: string; age: number }[] }> {
  try {
    const data = await fetch(`${BLOCKSCOUT_BASE}/api/v2/addresses/${deployer}/tokens?type=ERC-20&limit=50`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok ? r.json() as any : null);
    const items = data?.items || [];
    const tokens: { address: string; name: string; age: number }[] = [];
    for (const item of items) {
      if (item.token?.address) {
        tokens.push({
          address: item.token.address,
          name: item.token.name || "Unknown",
          age: 0,
        });
      }
    }
    return { count: tokens.length, tokens: tokens.slice(0, 10) };
  } catch { return { count: 0, tokens: [] }; }
}

async function getDeployerCreatedContracts(deployer: string): Promise<number> {
  if (BASE_RPC) {
    try {
      const resp = await fetch(BASE_RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers",
          params: [{ fromBlock: "0x0", toBlock: "latest", fromAddress: deployer, category: ["erc20"], maxCount: "0x32", excludeZeroValue: false }] }),
        signal: AbortSignal.timeout(6000),
      });
      const data = await resp.json() as any;
      const transfers = data?.result?.transfers || [];
      const uniqueContracts = new Set<string>();
      for (const t of transfers) {
        if (t.rawContract?.address) uniqueContracts.add(t.rawContract.address.toLowerCase());
      }
      if (uniqueContracts.size > 0) return uniqueContracts.size;
    } catch {}
  }
  try {
    const data = await fetch(`${BLOCKSCOUT_BASE}/api/v2/addresses/${deployer}/counters`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok ? r.json() as any : null);
    return data?.token_transfers_count ? Math.min(parseInt(data.token_transfers_count), 50) : 0;
  } catch { return 0; }
}

async function getTreasuryBalance(addr: string): Promise<{ eth: number; usd: number }> {
  try {
    const [balResult] = await rpcBatch([{ method: "eth_getBalance", params: [addr, "latest"] }]);
    const eth = balResult ? Number(BigInt(balResult)) / 1e18 : 0;
    const ethUsd = await softTimeout(getEthUsdPrice(), 3000, 0);
    return { eth, usd: eth * ethUsd };
  } catch { return { eth: 0, usd: 0 }; }
}

function getProtocolUrl(platform: string | null, address: string): string | null {
  if (!platform) return null;
  if (platform === "Virtuals") return `https://app.virtuals.io/virtuals?token=${address}`;
  if (platform === "Clanker") return `https://clanker.world/clanker/${address}`;
  if (platform === "ApeStore") return `https://ape.store/base/${address}`;
  if (platform === "Flaunch") return `https://flaunch.gg/base/token/${address}`;
  return null;
}

async function getDexScreenerSocials(addr: string): Promise<{ twitter: string | null; website: string | null; telegram: string | null; description: string | null }> {
  try {
    const data = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok ? r.json() as any : null);
    const pair = data?.pairs?.[0];
    const info = pair?.info || {};
    const socials = info.socials || [];
    let twitter: string | null = null;
    let website: string | null = null;
    let telegram: string | null = null;
    const description: string | null = info.description || null;
    for (const s of socials) {
      if (s.type === "twitter" && s.url) twitter = s.url.replace(/https?:\/\/(x\.com|twitter\.com)\//i, "").replace(/\/$/, "");
      if (s.type === "telegram" && s.url) telegram = s.url;
    }
    const websites = info.websites || [];
    if (websites.length > 0) website = websites[0].url || null;
    return { twitter, website, telegram, description };
  } catch { return { twitter: null, website: null, telegram: null, description: null }; }
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
      const tAddr = t.rawContract?.address?.toLowerCase();
      if (tAddr && !tokenMap.has(tAddr)) {
        tokenMap.set(tAddr, { name: t.asset || "Unknown", blockNum: t.blockNum });
      }
    }
    const entries = [...tokenMap.entries()].slice(0, 15);
    const blockChecks = entries.map(async ([tokenAddr, info]) => {
      try {
        const blockData = await rpcCall("eth_getBlockByNumber", [info.blockNum, false]);
        if (blockData?.timestamp) {
          const created = parseInt(blockData.timestamp, 16) * 1000;
          const ageDays = Math.max(0, Math.floor((now - created) / (1000 * 60 * 60 * 24)));
          if (now - created <= windowMs) {
            return { name: info.name, address: tokenAddr, ageDays };
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
  sourceTexts: string[];
  reasoningUrl: string | null;
  reasoningStatus: "verified" | "mismatch" | "not_found" | "no_source";
  reasoningDetail: string;
  abilityMismatch: string | null;
}

function extractAbilities(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const [category, keywords] of Object.entries(AGENT_ABILITY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) found.push(category);
  }
  return found;
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>)\]]+/gi;
  return (text.match(urlRegex) || []).filter(u => !u.includes("x.com") && !u.includes("twitter.com") && !u.includes("t.me") && !u.includes("discord")).filter(isSafeUrl);
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

async function auditAgentAbilities(
  xProfile: { bio: string; tweets: number } | null,
  dexDescription: string | null,
  websiteUrl: string | null,
  contractActivity: ContractActivity,
): Promise<AbilityAudit> {
  const sourceTexts: string[] = [];
  const allAbilities: string[] = [];

  if (xProfile?.bio) {
    sourceTexts.push(xProfile.bio);
    allAbilities.push(...extractAbilities(xProfile.bio));
  }
  if (dexDescription) {
    sourceTexts.push(dexDescription);
    allAbilities.push(...extractAbilities(dexDescription));
  }

  const claimedAbilities = [...new Set(allAbilities)];

  let reasoningUrl: string | null = null;
  let reasoningStatus: AbilityAudit["reasoningStatus"] = "no_source";
  let reasoningDetail = "No reasoning logs or dashboard URL found.";

  const allText = sourceTexts.join(" ");
  const candidateUrls = extractUrls(allText);
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

  if (!reasoningUrl && sourceTexts.length > 0) {
    reasoningStatus = "not_found";
    reasoningDetail = "Scanned linked website and social bios — no reasoning logs or agent dashboard found.";
  }

  let abilityMismatch: string | null = null;
  if (claimedAbilities.includes("Trading") && contractActivity.txCount < 50 && contractActivity.contractAgeDays > 7) {
    abilityMismatch = "Claims trading abilities but contract shows minimal swap/transfer activity.";
  } else if (claimedAbilities.includes("DeFi") && contractActivity.txCount < 20 && contractActivity.contractAgeDays > 7) {
    abilityMismatch = "Claims DeFi capabilities but near-zero protocol interactions detected.";
  } else if (claimedAbilities.length === 0 && sourceTexts.length > 0) {
    abilityMismatch = "No specific agent abilities claimed in bio or description — vague identity.";
  }

  return { claimedAbilities, sourceTexts, reasoningUrl, reasoningStatus, reasoningDetail, abilityMismatch };
}

async function runAgentScan(address: string, searchedName: string | null): Promise<{ text: string; twitterHandle: string | null }> {
  const t0 = Date.now();
  log(`runAgentScan START for ${address.slice(0, 10)}... name=${searchedName || "none"}`, "bot");

  const [simR, tokenR, deployerR] = await Promise.allSettled([
    softTimeout(simulateToken(address), 12000, { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0), failReason: "Timeout" } as SimResult),
    softTimeout(getTokenInfo(address), 8000, { name: "Unknown", symbol: "???", totalSupply: BigInt(0), decimals: 18 }),
    softTimeout(getDeployer(address), 7000, null),
  ]);

  const sim: SimResult = simR.status === "fulfilled" ? simR.value
    : { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0), failReason: "Simulation error" };
  const tokenInfo = tokenR.status === "fulfilled" ? tokenR.value
    : { name: "Unknown", symbol: "???", totalSupply: BigInt(0), decimals: 18 };
  let deployer = deployerR.status === "fulfilled" ? deployerR.value : null;

  const platformFromDeployer = detectPlatform(address, deployer, []);

  let [holderCount, topHolders, ethUsd, dexData, dexSocials, creationPlatform, deployerChainPlatform] = await Promise.all([
    softTimeout(getHolderCount(address), 7000, 0),
    softTimeout(getTopHolders(address), 7000, []),
    softTimeout(getEthUsdPrice(), 7000, 0),
    softTimeout(getDexScreenerData(address), 7000, { priceUsd: 0, liquidity: 0, poolVersion: null, dexMcap: 0, dexFdv: 0 }),
    softTimeout(getDexScreenerSocials(address), 7000, { twitter: null, website: null, telegram: null, description: null }),
    !platformFromDeployer ? softTimeout(detectPlatformFromCreationTx(address), 7000, null) : Promise.resolve(null),
    !platformFromDeployer && deployer ? softTimeout(detectPlatformFromDeployerChain(deployer), 7000, null) : Promise.resolve(null),
  ]);

  let fallbackData: FallbackTokenData | null = null;
  if (holderCount === 0 || (!sim.simulationSuccess && !deployer)) {
    fallbackData = await softTimeout(getFallbackTokenData(address), 5000, null);
    if (fallbackData) {
      if (holderCount === 0 && fallbackData.holderCount > 0) holderCount = fallbackData.holderCount;
      if (!deployer && fallbackData.creatorAddress) deployer = fallbackData.creatorAddress.toLowerCase();
    }
  }

  const platform = detectPlatform(address, deployer, topHolders) || platformFromDeployer || creationPlatform || deployerChainPlatform;
  const isVirtuals = platform === "Virtuals";
  const isManaged = !!(platform && MANAGED_PROTOCOLS.has(platform));
  const isClanker = platform === "Clanker";
  let buyTax = isManaged ? 0 : sim.buyTax;
  let sellTax = isManaged ? 0 : sim.sellTax;
  let isHoneypot = isManaged ? false : sim.isHoneypot;

  if (!isManaged && !sim.simulationSuccess && fallbackData) {
    buyTax = fallbackData.buyTax;
    sellTax = fallbackData.sellTax;
    isHoneypot = fallbackData.isHoneypot;
  }

  const [treasuryBal, deployerContracts, xProfile, contractActivity, clankerData, recentDeployer] = await Promise.all([
    deployer ? softTimeout(getTreasuryBalance(deployer), 4000, { eth: 0, usd: 0 }) : Promise.resolve({ eth: 0, usd: 0 }),
    deployer ? softTimeout(getDeployerCreatedContracts(deployer), 5000, 0) : Promise.resolve(0),
    dexSocials.twitter ? softTimeout(fetchXProfile(dexSocials.twitter), 5000, null) : Promise.resolve(null),
    softTimeout(getContractActivity(address), 6000, { txCount: 0, contractAgeDays: 0, hasContractCode: false, codeSize: 0, activityPerDay: 0 } as ContractActivity),
    isClanker ? softTimeout(fetchClankerData(address), 5000, null) : Promise.resolve(null),
    deployer ? softTimeout(checkRecentDeployerTokens(deployer), 6000, { recentCount: 0, recentTokens: [] }) : Promise.resolve({ recentCount: 0, recentTokens: [] }),
  ]);

  const abilityAudit = await softTimeout(
    auditAgentAbilities(xProfile, dexSocials.description, dexSocials.website, contractActivity),
    8000,
    { claimedAbilities: [], sourceTexts: [], reasoningUrl: null, reasoningStatus: "no_source" as const, reasoningDetail: "Timeout", abilityMismatch: null },
  );

  let tokenPriceUsd = dexData.priceUsd;
  if (tokenPriceUsd === 0 && sim.tokensReceived > BigInt(0) && ethUsd > 0) {
    const tokensWholeUnits = Number(sim.tokensReceived) / (10 ** tokenInfo.decimals);
    tokenPriceUsd = tokensWholeUnits > 0 ? (0.001 / tokensWholeUnits) * ethUsd : 0;
  }
  const calculatedMcap = Number(tokenInfo.totalSupply) * tokenPriceUsd;
  const mcap = dexData.dexMcap > 0 ? dexData.dexMcap : (dexData.dexFdv > 0 ? dexData.dexFdv : calculatedMcap);

  const agentFlags: string[] = [];
  const agentPasses: string[] = [];

  if (isHoneypot) agentFlags.push("🚨 Honeypot — SELL BLOCKED");
  if (buyTax > 5 || sellTax > 5) agentFlags.push(`💰 High tax: Buy ${buyTax.toFixed(1)}% / Sell ${sellTax.toFixed(1)}%`);

  if (dexSocials.twitter && xProfile) {
    if (xProfile.tweets < 3) agentFlags.push("🤖 Mind silent — Twitter linked but barely active");
    else if (xProfile.tweets >= 10) agentPasses.push("✅ Mind active — Twitter posting regularly");
    else agentPasses.push("🟡 Mind semi-active — Some Twitter activity");

    if (xProfile.followers < 10) agentFlags.push("👤 Negligible social following");
    const joinDays = xProfile.joined ? Math.floor((Date.now() - new Date(xProfile.joined).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    if (joinDays > 0 && joinDays < 14) agentFlags.push("🆕 Twitter account < 14 days old");
  } else if (!dexSocials.twitter) {
    agentFlags.push("🔇 No linked Twitter/X — Mind unverifiable");
  }

  if (treasuryBal.eth < 0.005) agentFlags.push("💸 Treasury near-empty — Creator may have exited");
  else if (treasuryBal.eth >= 0.1) agentPasses.push("✅ Treasury funded — Active maintenance");
  else agentPasses.push("🟡 Treasury has some funds");

  if (recentDeployer.recentCount >= SERIAL_DEPLOYER_THRESHOLD) {
    agentFlags.push(`🚨 POTENTIAL SERIAL DEPLOYER — ${recentDeployer.recentCount} tokens launched in the last ${SERIAL_DEPLOYER_WINDOW_DAYS} days`);
  }
  if (deployerContracts >= 5) agentFlags.push(`⚠️ Serial deployer — ${deployerContracts} contracts created`);
  else if (deployerContracts >= 3) agentFlags.push(`🟡 Multiple deployments — ${deployerContracts} contracts from this creator`);
  else if (deployerContracts <= 1) agentPasses.push("✅ Focused creator — Single deployment");

  if (holderCount > 0 && holderCount < 50) agentFlags.push("👥 Very few holders");
  if (dexData.liquidity > 0 && dexData.liquidity < 5000) agentFlags.push("💧 Critically low liquidity");

  if (platform) agentPasses.push(`✅ Deployed via ${platform} protocol`);
  if (sim.simulationSuccess) agentPasses.push("✅ Buy/Sell simulation passed");

  let onChainLabel = "";
  let onChainEmoji = "";
  if (contractActivity.txCount === 0 && contractActivity.contractAgeDays > 3) {
    agentFlags.push("🚨 DEAD CONTRACT — Zero on-chain activity detected");
    onChainLabel = "Dead";
    onChainEmoji = "🔴";
  } else if (contractActivity.txCount > 0 && contractActivity.txCount < 10 && contractActivity.contractAgeDays > 7) {
    agentFlags.push("⚠️ Near-dormant — Minimal contract interactions");
    onChainLabel = "Dormant";
    onChainEmoji = "🟡";
  } else if (contractActivity.activityPerDay >= 1) {
    agentPasses.push("✅ Active contract — Regular on-chain interactions");
    onChainLabel = "Active";
    onChainEmoji = "🟢";
  } else if (contractActivity.txCount >= 10) {
    agentPasses.push("🟡 Some contract activity detected");
    onChainLabel = "Moderate";
    onChainEmoji = "🟡";
  }

  if (mcap > 1_000_000 && contractActivity.txCount < 10 && contractActivity.contractAgeDays > 7) {
    agentFlags.push(`🚨 NARRATIVE BLACK BOX — ${formatUsd(mcap)} MCap but near-zero autonomous activity`);
  }

  if (!contractActivity.hasContractCode || contractActivity.codeSize < 500) {
    agentFlags.push("⚠️ Bare token contract — No agent logic in bytecode");
  } else if (contractActivity.codeSize >= 5000) {
    agentPasses.push("✅ Complex contract code — Agent logic possible");
  }

  if (abilityAudit.abilityMismatch) {
    agentFlags.push(`⚠️ Ability mismatch — ${abilityAudit.abilityMismatch}`);
  }
  if (abilityAudit.reasoningStatus === "verified") {
    agentPasses.push("✅ Reasoning logs found — Autonomous operation traces detected");
  } else if (abilityAudit.reasoningStatus === "not_found" && abilityAudit.claimedAbilities.length > 0) {
    agentFlags.push("⚠️ No reasoning logs — Claims abilities but no public proof of autonomous decisions");
  }
  if (abilityAudit.claimedAbilities.length >= 3) {
    agentPasses.push("✅ Multiple abilities claimed — Rich agent identity");
  } else if (abilityAudit.claimedAbilities.length === 0 && dexSocials.description) {
    agentFlags.push("🔇 No agent abilities detectable from description");
  }

  const isVerifiedAgent = !!VERIFIED_AGENTS[address.toLowerCase()];
  if (isVerifiedAgent) {
    agentFlags.length = 0;
    if (!agentPasses.some(p => p.includes("Simulation"))) agentPasses.push("✅ Simulation passed — Token is tradeable");
    if (!agentPasses.some(p => p.includes("On-chain"))) agentPasses.push("✅ On-chain activity verified — Active agent");
    if (!agentPasses.some(p => p.includes("Treasury"))) agentPasses.push("✅ Treasury funded — Operational wallet");
    if (!agentPasses.some(p => p.includes("Focused"))) agentPasses.push("✅ Focused creator — Legitimate deployer");
    if (!agentPasses.some(p => p.includes("abilities"))) agentPasses.push("✅ Multiple abilities claimed — Rich agent identity");
    isHoneypot = false;
  }

  let verdict = "";
  let verdictEmoji = "";
  if (isVerifiedAgent) { verdict = "LIKELY LEGITIMATE"; verdictEmoji = "🟢"; }
  else if (isHoneypot || agentFlags.length >= 4) { verdict = "LARP DETECTED"; verdictEmoji = "🔴"; }
  else if (agentFlags.length >= 2) { verdict = "SUSPICIOUS — Possible Larp"; verdictEmoji = "🟡"; }
  else if (agentFlags.length === 1 && agentPasses.length >= 2) { verdict = "INCONCLUSIVE — Minor concerns"; verdictEmoji = "🟡"; }
  else if (agentPasses.length >= 3) { verdict = "LIKELY LEGITIMATE"; verdictEmoji = "🟢"; }
  else { verdict = "INSUFFICIENT DATA"; verdictEmoji = "⚪"; }

  const shortAddr = address.slice(0, 8) + "..." + address.slice(-6);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const protocolUrl = getProtocolUrl(platform, address);

  const lines: string[] = [
    `🤖 *APOL AGENT — LARP DETECTOR*`,
    ``,
    `📍 *Agent:* ${esc(tokenInfo.name)} ($${esc(tokenInfo.symbol)})`,
    `📌 *CA:* \`${shortAddr}\``,
    `⛓ *Chain:* Base Mainnet`,
    `${platform ? `🏗 *Protocol:* ${platform}` : `🏗 *Protocol:* Unknown`}`,
    ``,
  ];

  lines.push(`⛓ *ON-CHAIN ACTIVITY AUDIT*`);
  lines.push(`   📊 Transactions: ${contractActivity.txCount > 0 ? contractActivity.txCount.toLocaleString() : "None"}`);
  lines.push(`   📅 Contract Age: ${contractActivity.contractAgeDays > 0 ? `${contractActivity.contractAgeDays} days` : "Unknown"}`);
  lines.push(`   ⚡ Activity Rate: ${contractActivity.activityPerDay > 0 ? `${contractActivity.activityPerDay}/day` : "Inactive"}`);
  lines.push(`   📦 Code Size: ${contractActivity.hasContractCode ? `${(contractActivity.codeSize / 1024).toFixed(1)}KB` : "None"}`);
  lines.push(`   ${onChainEmoji || "⚪"} *Status: ${onChainLabel || "Unknown"}*`);
  lines.push(``);

  lines.push(`🔎 *REASONING & ABILITIES*`);
  if (abilityAudit.claimedAbilities.length > 0) {
    lines.push(`   🏷 Claimed: ${abilityAudit.claimedAbilities.join(", ")}`);
  } else {
    lines.push(`   🏷 Claimed: No specific abilities detected`);
  }
  const reasoningIcons: Record<string, string> = { verified: "✅", mismatch: "🟡", not_found: "🔴", no_source: "⚪" };
  lines.push(`   ${reasoningIcons[abilityAudit.reasoningStatus] || "⚪"} Reasoning: ${abilityAudit.reasoningDetail}`);
  if (abilityAudit.reasoningUrl) {
    lines.push(`   📄 Logs: ${abilityAudit.reasoningUrl}`);
  }
  if (abilityAudit.abilityMismatch) {
    lines.push(`   ⚠️ ${abilityAudit.abilityMismatch}`);
  }
  lines.push(``);

  lines.push(`🧠 *MIND-TO-WALLET TRACE*`);
  if (dexSocials.twitter && xProfile) {
    lines.push(`   🐦 Twitter: @${esc(xProfile.screen_name)}`);
    lines.push(`   👥 Followers: ${xProfile.followers.toLocaleString()} | Tweets: ${xProfile.tweets.toLocaleString()}`);
    const twitterActive = xProfile.tweets >= 10;
    lines.push(`   ${twitterActive ? "✅ Mind is active" : "⚠️ Mind is quiet"}`);
  } else {
    lines.push(`   ⚠️ No linked social — Cannot trace mind`);
  }

  lines.push(``);
  lines.push(`💰 *TREASURY HEALTH*`);
  if (deployer) {
    lines.push(`   Creator: \`${deployer.slice(0, 8)}...${deployer.slice(-6)}\``);
    lines.push(`   Balance: ${treasuryBal.eth.toFixed(4)} ETH (~${formatUsd(treasuryBal.usd)})`);
    lines.push(`   ${treasuryBal.eth >= 0.1 ? "✅ Treasury funded" : treasuryBal.eth >= 0.01 ? "🟡 Low treasury" : "🔴 Treasury empty"}`);
  } else {
    lines.push(`   ⚠️ Deployer unknown`);
  }

  lines.push(``);
  lines.push(`🔬 *CREATOR FORENSIC*`);
  if (deployer) {
    lines.push(`   Contracts deployed: ${deployerContracts}`);
    if (recentDeployer.recentCount >= SERIAL_DEPLOYER_THRESHOLD) {
      lines.push(`   🚨 *POTENTIAL SERIAL DEPLOYER*`);
      lines.push(`   ${recentDeployer.recentCount} tokens in last ${SERIAL_DEPLOYER_WINDOW_DAYS} days`);
    }
    if (deployerContracts >= 5) lines.push(`   🔴 Serial deployer — High rug risk`);
    else if (deployerContracts >= 3) lines.push(`   🟡 Multiple projects — Monitor closely`);
    else if (recentDeployer.recentCount < SERIAL_DEPLOYER_THRESHOLD) lines.push(`   ✅ Focused creator`);
  } else {
    lines.push(`   ⚠️ Cannot analyze — Deployer unknown`);
  }

  lines.push(``);
  lines.push(`📊 *TOKEN HEALTH*`);
  lines.push(`   💲 Price: ${tokenPriceUsd > 0 ? formatPrice(tokenPriceUsd) : "N/A"}`);
  lines.push(`   📈 MCap: ${mcap > 0 ? formatUsd(mcap) : "N/A"}`);
  lines.push(`   💧 Liquidity: ${dexData.liquidity > 0 ? formatUsd(dexData.liquidity) : "N/A"}`);
  lines.push(`   👥 Holders: ${holderCount > 0 ? holderCount.toLocaleString() : "N/A"}`);
  lines.push(`   💰 Tax: Buy ${buyTax.toFixed(1)}% / Sell ${sellTax.toFixed(1)}%`);
  if (clankerData) {
    if (clankerData.volume24h > 0) lines.push(`   📈 24h Vol: ${formatUsd(clankerData.volume24h)}`);
    if (clankerData.rewardsAvailable) lines.push(`   💎 Clanker Rewards: Available`);
    if (clankerData.warnings.length > 0) lines.push(`   ⚠️ Clanker: ${clankerData.warnings.join(", ")}`);
  }
  if (isHoneypot) lines.push(`   🚨 HONEYPOT DETECTED`);

  storage.logAgentActivity({
    action: "agent_verification",
    target: address,
    detail: `Verified agent ${tokenInfo.name} ($${tokenInfo.symbol}) via Telegram. Verdict: ${verdict}. Flags: ${agentFlags.length}. Passes: ${agentPasses.length}. Tx count: ${contractActivity.txCount}. Code: ${contractActivity.hasContractCode ? `${(contractActivity.codeSize / 1024).toFixed(1)}KB` : "none"}.`.replace(/\s+/g, " ").trim(),
    verdict,
    source: "telegram",
    metadata: { tokenSymbol: tokenInfo.symbol, tokenName: tokenInfo.name, flags: agentFlags.length, passes: agentPasses.length, txCount: contractActivity.txCount },
  }).catch(() => {});

  lines.push(``);
  lines.push(`${verdictEmoji} *VERDICT: ${verdict}*`);
  lines.push(``);

  if (agentFlags.length > 0) {
    lines.push(`🚩 *RED FLAGS:*`);
    for (const f of agentFlags) lines.push(`   ${f}`);
    lines.push(``);
  }
  if (agentPasses.length > 0) {
    lines.push(`✅ *PASSED:*`);
    for (const p of agentPasses) lines.push(`   ${p}`);
    lines.push(``);
  }

  const linkParts: string[] = [];
  if (protocolUrl) linkParts.push(`🏗 [${platform} Profile](${protocolUrl})`);
  linkParts.push(`🔗 [Basescan](https://basescan.org/address/${address})`);
  if (dexSocials.twitter) linkParts.push(`🐦 [Twitter](https://x.com/${dexSocials.twitter})`);
  if (dexSocials.website) linkParts.push(`🌐 [Website](${dexSocials.website})`);
  lines.push(linkParts.join("   "));

  lines.push(``);
  lines.push(`⚡ ${elapsed}s · APOL Larp Detector`);

  return { text: lines.join("\n"), twitterHandle: dexSocials.twitter || null };
}

function esc(s: string): string {
  return s.replace(/[_*`\[\]]/g, "");
}

async function cachedRunScan(address: string): Promise<string | null> {
  const key = address.toLowerCase();
  const cached = SCAN_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < SCAN_CACHE_TTL) {
    log(`Cache HIT for ${address.slice(0, 10)}... (age ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`, "bot");
    return cached.result;
  }
  const inflight = SCAN_IN_FLIGHT.get(key);
  if (inflight) {
    log(`Waiting on in-flight scan for ${address.slice(0, 10)}...`, "bot");
    return inflight;
  }
  const promise = softTimeout(runScan(address), 25000, null).then((result) => {
    if (result) SCAN_CACHE.set(key, { result, timestamp: Date.now() });
    SCAN_IN_FLIGHT.delete(key);
    return result;
  }).catch((e) => {
    SCAN_IN_FLIGHT.delete(key);
    throw e;
  });
  SCAN_IN_FLIGHT.set(key, promise);
  return promise;
}

async function handleScan(ctx: any, address: string): Promise<void> {
  log(`handleScan called for ${address.slice(0, 10)}...`, "bot");
  const shortAddr = `${address.slice(0, 8)}. . .${address.slice(-6)}`;
  const loadingMsg = await ctx.reply(`🔍 *Analyzing Forensic Data...*\n\n📍 ${shortAddr}\n_Consulting APOL intelligence database. This may take a moment._`, { parse_mode: "Markdown" });
  try {
    const report = await cachedRunScan(address);
    log(`handleScan result for ${address.slice(0, 10)}...: ${report ? `${report.length} chars` : "NULL"}`, "bot");
    if (report) {
      try {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, report, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
      } catch (mdErr: any) {
        log(`handleScan Markdown edit failed: ${mdErr?.message?.slice(0, 120)}`, "bot");
        const plain = report.replace(/[*_`\[\]]/g, "");
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, plain.slice(0, 4000), { link_preview_options: { is_disabled: true } }).catch(() => {});
      }
    } else {
      const scanCount = await storage.incrementLookup(address).catch(() => 0);
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
        `🏛 *APOL AGENT — CONTRACT SNAPSHOT*\n\n📍 \`${address.slice(0, 8)}...${address.slice(-6)}\`\n\n⚠️ Scan timed out. Network may be congested. Try again.\n👁 Scan count: ${scanCount}`,
        { parse_mode: "Markdown" },
      ).catch(() => {});
    }
  } catch (e: any) {
    log(`Scan error for ${address}: ${e?.message}`, "bot");
    const scanCount = await storage.incrementLookup(address).catch(() => 0);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
      `🏛 *APOL AGENT — CONTRACT SNAPSHOT*\n\n📍 \`${address.slice(0, 8)}...${address.slice(-6)}\`\n\n⚠️ Scan error: ${e?.message?.slice(0, 80) || "Unknown"}\n👁 Scan count: ${scanCount}`,
      { parse_mode: "Markdown" },
    ).catch(() => {});
  }
}

async function fetchXProfile(handle: string): Promise<{
  name: string; screen_name: string; bio: string; joined: string;
  followers: number; following: number; verified: boolean;
  tweets: number; avatar: string;
} | null> {
  try {
    const res = await fetch(`https://api.fxtwitter.com/${handle}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const u = data?.user;
    if (!u) return null;
    const isVerified = u.verified === true || u.verification?.verified === true || false;
    return {
      name: u.name || handle,
      screen_name: u.screen_name || handle,
      bio: u.description || "",
      joined: u.joined || "",
      followers: u.followers || 0,
      following: u.following || 0,
      verified: isVerified,
      tweets: u.tweets || 0,
      avatar: u.avatar_url || "",
    };
  } catch { return null; }
}

async function handleScanX(ctx: any, input: string): Promise<void> {
  const displayHandle = input.replace(/https?:\/\/(x\.com|twitter\.com)\//i, "").replace(/^@/, "").split("/")[0];
  const loadingMsg = await ctx.reply(`🔍 *Analyzing Forensic Data...*\n\n📍 @${displayHandle}\n_Checking APOL intelligence records..._`, { parse_mode: "Markdown" });
  try {
    let handle = input.replace(/https?:\/\/(x\.com|twitter\.com)\//i, "").replace(/^@/, "").trim();
    if (!handle) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
        `🔍 *APOL AGENT — SCANX*\n\nUsage: \`/scanx @handle\` or \`/scanx https://x.com/handle\``,
        { parse_mode: "Markdown" });
      return;
    }

    handle = handle.split("/")[0].split("?")[0];

    const SELF_HANDLES = ["apolagent_", "apolagent", "apol_agent", "apolagentbot"];
    if (SELF_HANDLES.includes(handle.toLowerCase())) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
        `🔍 *APOL AGENT — SCANX RESULTS*\n\n🐦 *X Handle:* @${esc(handle)}\n\n✅ *VERIFIED — This is APOL Agent*\n\n🏛 Official security protocol on Base chain\n🔗 Website: apolagent.online\n🐦 Twitter: @ApolAgent_\n\n✅ *Official CA:* \`0x7d8817AcEa5c58a3675088d779a3b5a0CaA57B07\`\nAny other token using $APOL ticker is a SCAM.`,
        { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
      return;
    }

    const [profile, tokenResult] = await Promise.all([
      softTimeout(fetchXProfile(handle), 7000, null),
      softTimeout(searchDexScreener(handle), 5000, null),
    ]);

    if (!profile) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
        `🔍 *X INVESTIGATION:*\n@${esc(handle)}\n\n⚠️ Could not retrieve profile data for this handle.\n\n💡 The account may not exist or may be suspended.`,
        { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
      return;
    }

    let joinedStr = "Unknown";
    let joinedDays = 0;
    if (profile.joined) {
      const joinDate = new Date(profile.joined);
      if (!isNaN(joinDate.getTime())) {
        joinedStr = joinDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        joinedDays = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
        joinedStr += ` (${joinedDays} days ago)`;
      }
    }

    const followRatio = profile.following > 0
      ? `${(profile.followers / profile.following).toFixed(1)}:1`
      : profile.followers > 0 ? "∞:1" : "0:0";

    const flags: string[] = [];
    if (joinedDays > 0 && joinedDays < 30) flags.push("🆕 Account less than 30 days old");
    if (profile.followers < 10) flags.push("👤 Very few followers");
    if (profile.following > 0 && profile.followers / profile.following < 0.1) flags.push("📉 Suspicious follow ratio");
    if (profile.tweets < 5) flags.push("📝 Very few tweets");
    if (profile.bio && /t\.co|http|\.com|\.xyz|\.io/i.test(profile.bio) && profile.followers < 50) flags.push("🔗 Link-heavy bio with low following");

    let socialVerdict = "";
    if (flags.length >= 3) socialVerdict = "🔴 _High Risk — Multiple red flags detected_";
    else if (flags.length >= 1) socialVerdict = "⚠️ _Inconclusive — Insufficient History_";
    else if (joinedDays > 180 && profile.followers >= 50) socialVerdict = "✅ _Clean — Established Account_";
    else socialVerdict = "⚠️ _Inconclusive — Insufficient History_";

    const bioDisplay = profile.bio ? profile.bio.slice(0, 120) : "None";

    const bioCAMatch = profile.bio.match(/0x[a-fA-F0-9]{40}/);
    const bioCA = bioCAMatch ? bioCAMatch[0] : null;

    let linkedCA = "Not Found";
    if (tokenResult && tokenResult.address) {
      linkedCA = `${esc(tokenResult.name)} ($${esc(tokenResult.symbol)})\n   \`${tokenResult.address}\``;
    } else if (bioCA) {
      linkedCA = `\`${bioCA}\` _(from bio)_`;
    }

    const lines = [
      `🔍 *X INVESTIGATION:*`,
      `@${esc(profile.screen_name)}`,
      ``,
      `👤 *Name:* ${esc(profile.name)}`,
      `📝 *Bio:* ${esc(bioDisplay)}`,
      `📅 *Joined:* ${joinedStr}`,
      `☑️ *Blue Check:* ${profile.verified ? "Verified ✅" : "Not Verified"}`,
      ``,
      `👥 *Followers:* ${profile.followers.toLocaleString()}`,
      `➡️ *Following:* ${profile.following.toLocaleString()}`,
      `📊 *Follow Ratio:* ${followRatio}`,
      `📈 *Engagement:* ${profile.tweets > 0 ? `${profile.tweets.toLocaleString()} tweets` : "Data Pending"}`,
      ``,
    ];

    if (flags.length > 0) {
      lines.push(`🚩 *FLAGS DETECTED:*`);
      for (const f of flags) lines.push(`   ${f}`);
    } else {
      lines.push(`✅ *No risk flags detected.*`);
    }

    lines.push(``);
    lines.push(`⛓ *Linked CA:* ${linkedCA}`);
    lines.push(``);
    lines.push(`🚨 *Social Verdict:* ${socialVerdict}`);
    lines.push(``);
    lines.push(`🔍 [Full Report](https://x.com/${encodeURIComponent(profile.screen_name)})`);

    const verdictShort = flags.length >= 3 ? "High Risk" : flags.length >= 1 ? "Inconclusive" : "Clean";
    storage.logAgentActivity({
      action: "x_agent_scan",
      target: `@${profile.screen_name}`,
      detail: `Scanned X profile @${profile.screen_name} via Telegram. ${flags.length} flags. Followers: ${profile.followers}. Age: ${joinedDays}d. Verdict: ${verdictShort}. ${tokenResult?.address ? `Linked token: ${tokenResult.name} (${tokenResult.address}).` : bioCA ? `Bio CA: ${bioCA}.` : "No linked token."}`.replace(/\s+/g, " ").trim(),
      verdict: verdictShort,
      source: "telegram",
      metadata: { handle: profile.screen_name, flags: flags.length, followers: profile.followers, ageDays: joinedDays, linkedCA: tokenResult?.address || bioCA },
    }).catch(() => {});

    const msg = lines.join("\n");
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, msg, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch (mdErr: any) {
      log(`handleScanX Markdown edit failed: ${mdErr?.message?.slice(0, 120)}`, "bot");
      const plain = msg.replace(/[*_`\[\]]/g, "");
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, plain.slice(0, 4000), { link_preview_options: { is_disabled: true } }).catch(() => {});
    }
  } catch (e: any) {
    log(`ScanX error: ${e?.message}`, "bot");
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
      `🔍 *APOL AGENT — SCANX*\n\n⚠️ Error: ${e?.message?.slice(0, 80) || "Unknown"}`,
      { parse_mode: "Markdown" }).catch(() => {});
  }
}

async function handleCheckWallet(ctx: any, address: string): Promise<void> {
  const shortAddr = `${address.slice(0, 8)}. . .${address.slice(-6)}`;
  const loadingMsg = await ctx.reply(`🔍 *Analyzing Forensic Data...*\n\n📍 ${shortAddr}\n_Checking APOL intelligence records..._`, { parse_mode: "Markdown" });
  try {
    const walletInfo = await softTimeout(getWalletInfo(address), 15000, { balance: "0", txCount: 0, isContract: false, firstTx: null, firstTxHash: null, firstTxFrom: null, firstTxFromName: null, inflow: 0, outflow: 0 } as WalletInfo);
    const ethUsd = await softTimeout(getEthUsdPrice(), 3000, 0);
    const balUsd = parseFloat(walletInfo.balance) * ethUsd;

    let walletAge = "Unknown";
    let ageDays = 0;
    let ageLabel = "";
    if (walletInfo.firstTx) {
      const firstDate = new Date(walletInfo.firstTx);
      ageDays = Math.floor((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays < 1) { walletAge = "< 1 day"; ageLabel = "⚠️"; }
      else if (ageDays < 30) { walletAge = `${ageDays} days`; ageLabel = ageDays < 7 ? "⚠️" : ""; }
      else if (ageDays < 365) { walletAge = `${ageDays} days (~${Math.floor(ageDays / 30)}mo)`; }
      else { const yrs = Math.floor(ageDays / 365); const mo = Math.floor((ageDays % 365) / 30); walletAge = `${ageDays} days (~${yrs}y ${mo}m)`; }
    }

    const flags: string[] = [];
    if (parseFloat(walletInfo.balance) < 0.001) flags.push("💸 Very low ETH balance");
    if (walletInfo.txCount < 5) flags.push("📉 Very few transactions");
    if (walletInfo.firstTx) {
      if (ageDays < 7) flags.push("🆕 New wallet (< 7 days)");
    }

    const statusIcon = flags.length >= 2 ? "🔴" : flags.length === 1 ? "🟡" : "✅";
    const statusLabel = flags.length >= 2 ? "HIGH RISK" : flags.length === 1 ? "CAUTION" : "CLEAN";
    const shortAddr = address.slice(0, 8) + "..." + address.slice(-6);

    let activityLevel = "Unknown";
    if (walletInfo.txCount >= 100) activityLevel = "High (Established Wallet)";
    else if (walletInfo.txCount >= 20) activityLevel = "Medium";
    else if (walletInfo.txCount >= 5) activityLevel = "Low";
    else activityLevel = "Very Low ⚠️";

    const firstDate = walletInfo.firstTx ? new Date(walletInfo.firstTx) : null;
    const firstDateStr = firstDate ? firstDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown";
    const shortHash = walletInfo.firstTxHash ? walletInfo.firstTxHash.slice(0, 12) + "..." + walletInfo.firstTxHash.slice(-6) : "Unknown";
    const fundingFrom = walletInfo.firstTxFrom ? walletInfo.firstTxFrom.slice(0, 8) + "..." + walletInfo.firstTxFrom.slice(-6) : null;
    const fundingLabel = walletInfo.firstTxFromName || "Unknown";

    const lines = [
      `🏛 *APOL AGENT — WALLET FORENSICS*`,
      ``,
      `📌 *Address:* \`${shortAddr}\``,
      `📦 *Type:* ${walletInfo.isContract ? "Contract" : "EOA (Wallet)"}`,
      `📊 *Status:* ${statusIcon} ${statusLabel}`,
      ``,
      `⛓ *GENESIS (First Base Transaction)*`,
      `   Date: ${firstDateStr}`,
      `   Age: ${walletAge} ${ageLabel}`.trimEnd(),
      `   Chain: BASE`,
      `   Hash: \`${shortHash}\``,
    ];

    if (walletInfo.firstTxFrom) {
      lines.push(``);
      lines.push(`💰 *FUNDING SOURCE (Base)*`);
      if (walletInfo.firstTxFromName) {
        lines.push(`   FUNDED BY: ${fundingLabel}`);
      }
      lines.push(`   From: \`${fundingFrom}\``);
    }

    lines.push(``);
    lines.push(`📊 *ACTIVITY (Base Mainnet)*`);
    lines.push(`   Transactions: ${walletInfo.txCount.toLocaleString()} txs`);
    lines.push(`   Level: ${activityLevel}`);
    if (walletInfo.inflow > 0 || walletInfo.outflow > 0) {
      lines.push(`   Inflow: ${walletInfo.inflow.toFixed(4)} ETH   Outflow: ${walletInfo.outflow.toFixed(4)} ETH`);
    }

    lines.push(``);
    lines.push(`💰 *CURRENT BALANCE*`);
    lines.push(`   ${walletInfo.balance} ETH (~${formatUsd(balUsd)})`);

    lines.push(``);
    if (flags.length > 0) {
      lines.push(`🚩 *FLAGS DETECTED:*`);
      for (const f of flags) lines.push(`   ${f}`);
    } else {
      lines.push(`✅ No threat flags on record.`);
    }

    lines.push(``);
    if (flags.length === 0) {
      lines.push(`🏛 *VERDICT:* _No malicious activity detected. Wallet appears clean._`);
    } else if (flags.length === 1) {
      lines.push(`🏛 *VERDICT:* _Minor concerns detected. Exercise caution._`);
    } else {
      lines.push(`🏛 *VERDICT:* _Multiple risk indicators found. Proceed with extreme caution._`);
    }

    lines.push(``);
    lines.push(`🔗 [View on Basescan](https://basescan.org/address/${address})`);

    const msg = lines.join("\n");
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, msg, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch (mdErr: any) {
      log(`checkwallet Markdown edit failed: ${mdErr?.message?.slice(0, 120)}`, "bot");
      const plain = msg.replace(/[*_`\[\]]/g, "");
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, plain.slice(0, 4000), { link_preview_options: { is_disabled: true } }).catch(() => {});
    }
  } catch (e: any) {
    log(`CheckWallet error: ${e?.message}`, "bot");
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
      `🏛 *APOL AGENT — WALLET FORENSICS*\n\n⚠️ Error: ${e?.message?.slice(0, 80) || "Unknown"}`,
      { parse_mode: "Markdown" }).catch(() => {});
  }
}

export function createBot(): Telegraf | null {
  const token = process.env.APOL_BOT_TOKEN;
  if (!token) {
    console.log("[bot] No APOL_BOT_TOKEN found — bot disabled");
    return null;
  }

  const bot = new Telegraf(token);

  bot.catch((err: any, ctx: any) => {
    log(`Bot error in chat ${ctx?.chat?.id ?? "?"}: ${err?.message || err}`, "bot");
  });

  bot.command("start", (ctx) => {
    const lines = [
      `🚨 *APOL AGENT ONLINE*`,
      `Protecting the Base trenches.`,
      ``,
      `Use /scan address to check a contract or /report to flag a larp.`,
      ``,
      `*AVAILABLE COMMANDS*`,
      `🔍 /scan contract — Token security check`,
      `🔍 /scanx username — X/Twitter social forensics`,
      `🤖 /scanagent name or CA — AI agent audit`,
      `🕵️ /checkwallet address — Wallet investigation`,
      `🚩 /report — Submit scam evidence`,
      `👮 /map — Wall of Shame`,
      `🛡 /verified — Certified projects`,
      `❓ /help — Help`,
    ];
    ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  });

  bot.command("scan", async (ctx) => {
    const input = ctx.message.text.replace(/^\/scan(@\w+)?\s*/i, "").trim();
    if (!isContractAddress(input)) {
      PENDING_COMMAND.set(ctx.chat.id, { command: "scan", timestamp: Date.now() });
      ctx.reply("🔍 Send Base contract address.", { parse_mode: "Markdown" });
      return;
    }
    await handleScan(ctx, input);
  });

  bot.command("scanx", async (ctx) => {
    const input = ctx.message.text.replace(/^\/scanx(@\w+)?\s*/i, "").trim();
    if (!input) {
      PENDING_COMMAND.set(ctx.chat.id, { command: "scanx", timestamp: Date.now() });
      ctx.reply("🔍 Send X/Twitter handle or URL.", { parse_mode: "Markdown" });
      return;
    }
    await handleScanX(ctx, input);
  });

  bot.command("scanagent", async (ctx) => {
    const input = ctx.message.text.replace(/^\/scanagent(@\w+)?\s*/i, "").trim();
    log(`/scanagent command: input="${input.slice(0, 30)}"`, "bot");
    if (!input) {
      PENDING_COMMAND.set(ctx.chat.id, { command: "scanagent", timestamp: Date.now() });
      ctx.reply("🤖 Send AI agent contract address or name.", { parse_mode: "Markdown" });
      return;
    }

    const displayId = isContractAddress(input) ? `${input.slice(0, 8)}. . .${input.slice(-6)}` : input;
    const loadingMsg = await ctx.reply(`🔍 *Analyzing Forensic Data...*\n\n📍 ${displayId}\n_Consulting APOL intelligence database. This may take a moment._`, { parse_mode: "Markdown" });
    try {
      let address = input;
      let searchedName: string | null = null;

      if (!isContractAddress(input)) {
        const found = await softTimeout(searchDexScreener(input), 5000, null);
        if (!found || !found.address) {
          await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
            `🤖 *APOL AGENT — LARP DETECTOR*\n\n⚠️ No Base chain agent found matching "${esc(input)}"\n\n💡 Try with a contract address: \`/scanagent 0x...\``,
            { parse_mode: "Markdown" });
          return;
        }
        address = found.address;
        searchedName = found.name;
      }

      const result = await softTimeout(runAgentScan(address, searchedName), 30000, null);
      log(`scanagent result: ${result ? `${result.text.length} chars` : "NULL"}`, "bot");
      if (result) {
        const opts: any = { parse_mode: "Markdown", link_preview_options: { is_disabled: true } };
        if (result.twitterHandle) {
          opts.reply_markup = { inline_keyboard: [[{ text: "🔍 Deep Scan X Profile", url: `https://apolagent.online/agent-scanner?scanx=${encodeURIComponent(result.twitterHandle)}` }]] };
        }
        try {
          await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, result.text, opts);
        } catch (mdErr: any) {
          log(`scanagent Markdown edit failed: ${mdErr?.message?.slice(0, 120)}`, "bot");
          const plain = result.text.replace(/[*_`\[\]]/g, "");
          await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, plain.slice(0, 4000), { link_preview_options: { is_disabled: true } }).catch(() => {});
        }
      } else {
        await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
          `🤖 *APOL AGENT — LARP DETECTOR*\n\n⚠️ Scan timed out. Network may be congested. Try again.`,
          { parse_mode: "Markdown" }).catch(() => {});
      }
    } catch (e: any) {
      log(`ScanAgent error: ${e?.message}`, "bot");
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
        `🤖 *APOL AGENT — LARP DETECTOR*\n\n⚠️ Error: ${e?.message?.slice(0, 80) || "Unknown"}`,
        { parse_mode: "Markdown" }).catch(() => {});
    }
  });

  bot.command("checkwallet", async (ctx) => {
    const input = ctx.message.text.replace(/^\/checkwallet(@\w+)?\s*/i, "").trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(input)) {
      PENDING_COMMAND.set(ctx.chat.id, { command: "checkwallet", timestamp: Date.now() });
      ctx.reply("💼 Send wallet address.", { parse_mode: "Markdown" });
      return;
    }
    await handleCheckWallet(ctx, input);
  });

  bot.command("map", async (ctx) => {
    try {
      const flagged = await storage.getFlaggedWallets(10);
      if (flagged.length === 0) {
        ctx.reply("🏛 *APOL Wall of Shame*\n\nNo flagged addresses yet. Use /scan to investigate contracts.", { parse_mode: "Markdown" });
        return;
      }
      const lines = [`🏛 *APOL Wall of Shame*\n`];
      for (const f of flagged) {
        lines.push(`🚩 \`${f.address.slice(0, 8)}...${f.address.slice(-6)}\` — ${f.reason || "Flagged"}`);
      }
      lines.push(`\n🔗 [View Full Map](https://apolagent.online/report-scam)`);
      ctx.reply(lines.join("\n"), { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch {
      ctx.reply("🏛 *APOL Wall of Shame*\n\n🔗 [View on Web](https://apolagent.online/report-scam)", { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    }
  });

  bot.command("verified", (ctx) => {
    ctx.reply(
      `✅ *APOL Certified Hero Projects*\n\nVerified projects that passed APOL's security audit.\n\n🔗 [View Verified List](https://apolagent.online)\n\n💡 Want your project verified? Contact @ApolAgentBot`,
      { parse_mode: "Markdown", link_preview_options: { is_disabled: true } },
    );
  });

  bot.command("report", (ctx) => {
    const input = ctx.message.text.replace(/^\/report(@\w+)?\s*/i, "").trim();
    if (!input) {
      ctx.reply(
        `🚩 *APOL AGENT — REPORT*\n\nSend contract address and reason.\n\n📋 Or use the full form:\n🔗 [Submit Report on Web](https://apolagent.online/report-scam)`,
        { parse_mode: "Markdown", link_preview_options: { is_disabled: true } },
      );
      return;
    }
    const parts = input.split(/\s+/);
    const addr = parts[0];
    const reason = parts.slice(1).join(" ") || "Reported by community";
    if (isContractAddress(addr)) {
      storage.upsertFlaggedWallet({
        address: addr.toLowerCase(),
        chain: "base",
        reportCount: 1,
        riskLevel: "Reported",
        topCategory: "Community Report",
        apolVerdict: reason,
        reports: [{ source: "telegram", reason, timestamp: new Date().toISOString() }],
      }).catch(() => {});
      ctx.reply(
        `🚩 *Report Submitted*\n\n📌 Address: \`${addr.slice(0, 8)}...${addr.slice(-6)}\`\n📝 Reason: ${esc(reason)}\n\n✅ This address has been flagged for investigation. Thank you for protecting the trenches.\n\n📋 Want to add more evidence? Use the full form:\n🔗 [Submit on Web](https://apolagent.online/report-scam)`,
        { parse_mode: "Markdown", link_preview_options: { is_disabled: true } },
      );
    } else {
      ctx.reply("🚩 Send a valid contract address and reason.", { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    }
  });

  bot.command("help", (ctx) => {
    const lines = [
      `❓ *APOL AGENT — HELP*`,
      ``,
      `🔍 /scan contract — Token security check`,
      `🔍 /scanx username — X/Twitter social forensics`,
      `🤖 /scanagent name or CA — AI agent audit`,
      `🕵️ /checkwallet address — Wallet investigation`,
      `🚩 /report — Submit scam evidence`,
      `👮 /map — Wall of Shame`,
      `🛡 /verified — Certified projects`,
      ``,
      `💡 You can also paste a contract address directly to scan it.`,
      ``,
      `🔗 [Website](https://apolagent.online) | 🐦 [Twitter](https://x.com/ApolAgent_)`,
    ];
    ctx.reply(lines.join("\n"), { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    const chatId = ctx.chat.id;
    const pending = PENDING_COMMAND.get(chatId);
    if (pending && Date.now() - pending.timestamp < PENDING_TTL) {
      PENDING_COMMAND.delete(chatId);
      const cmd = pending.command;
      log(`bot.on(text) pending=${cmd} input="${text.slice(0, 30)}"`, "bot");
      try {
        if (cmd === "checkwallet") {
          if (isContractAddress(text)) {
            await handleCheckWallet(ctx, text);
          } else {
            ctx.reply("⚠️ That doesn't look like a valid address. Send a 0x... wallet address.", { parse_mode: "Markdown" });
          }
        } else if (cmd === "scanx") {
          await handleScanX(ctx, text);
        } else if (cmd === "scanagent") {
          if (isContractAddress(text)) {
            const displayId = `${text.slice(0, 8)}. . .${text.slice(-6)}`;
            const loadingMsg = await ctx.reply(`🔍 *Analyzing Forensic Data...*\n\n📍 ${displayId}\n_Consulting APOL intelligence database. This may take a moment._`, { parse_mode: "Markdown" });
            try {
              const result = await softTimeout(runAgentScan(text, null), 30000, null);
              log(`scanagent result: ${result ? `${result.text.length} chars` : "NULL"}`, "bot");
              if (result) {
                const opts: any = { parse_mode: "Markdown", link_preview_options: { is_disabled: true } };
                if (result.twitterHandle) {
                  opts.reply_markup = { inline_keyboard: [[{ text: "🔍 Deep Scan X Profile", url: `https://apolagent.online/agent-scanner?scanx=${encodeURIComponent(result.twitterHandle)}` }]] };
                }
                try {
                  await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined, result.text, opts);
                } catch (mdErr: any) {
                  log(`scanagent Markdown edit failed: ${mdErr?.message?.slice(0, 120)}`, "bot");
                  const plain = result.text.replace(/[*_`\[\]]/g, "");
                  await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined, plain.slice(0, 4000), { link_preview_options: { is_disabled: true } }).catch(() => {});
                }
              } else {
                await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined,
                  `🤖 *APOL AGENT — LARP DETECTOR*\n\n⚠️ Scan timed out. Try again.`, { parse_mode: "Markdown" }).catch(() => {});
              }
            } catch (e: any) {
              log(`ScanAgent error: ${e?.message}`, "bot");
              await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined,
                `🤖 *APOL AGENT — LARP DETECTOR*\n\n⚠️ Error: ${e?.message?.slice(0, 80) || "Unknown"}`, { parse_mode: "Markdown" }).catch(() => {});
            }
          } else {
            const found = await softTimeout(searchDexScreener(text), 5000, null);
            if (!found || !found.address) {
              ctx.reply(`🤖 No Base chain agent found matching "${esc(text)}"\n\n💡 Try with a contract address: \`/scanagent 0x...\``, { parse_mode: "Markdown" });
              return;
            }
            const displayId = `${found.address.slice(0, 8)}. . .${found.address.slice(-6)}`;
            const loadingMsg = await ctx.reply(`🔍 *Analyzing Forensic Data...*\n\n📍 ${displayId}\n_Consulting APOL intelligence database..._`, { parse_mode: "Markdown" });
            try {
              const result = await softTimeout(runAgentScan(found.address, found.name), 30000, null);
              if (result) {
                const opts: any = { parse_mode: "Markdown", link_preview_options: { is_disabled: true } };
                if (result.twitterHandle) {
                  opts.reply_markup = { inline_keyboard: [[{ text: "🔍 Deep Scan X Profile", url: `https://apolagent.online/agent-scanner?scanx=${encodeURIComponent(result.twitterHandle)}` }]] };
                }
                try {
                  await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined, result.text, opts);
                } catch (mdErr: any) {
                  const plain = result.text.replace(/[*_`\[\]]/g, "");
                  await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined, plain.slice(0, 4000), { link_preview_options: { is_disabled: true } }).catch(() => {});
                }
              } else {
                await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined,
                  `🤖 *APOL AGENT — LARP DETECTOR*\n\n⚠️ Scan timed out. Try again.`, { parse_mode: "Markdown" }).catch(() => {});
              }
            } catch (e: any) {
              await ctx.telegram.editMessageText(chatId, loadingMsg.message_id, undefined,
                `🤖 *APOL AGENT — LARP DETECTOR*\n\n⚠️ Error: ${e?.message?.slice(0, 80) || "Unknown"}`, { parse_mode: "Markdown" }).catch(() => {});
            }
          }
        } else {
          if (isContractAddress(text)) await handleScan(ctx, text);
        }
      } catch (e: any) {
        log(`bot.on(text) pending handler THREW: ${e?.message}`, "bot");
      }
      return;
    }

    PENDING_COMMAND.delete(chatId);
    if (isContractAddress(text)) {
      log(`bot.on(text) dispatching handleScan for ${text.slice(0, 10)}...`, "bot");
      try {
        await handleScan(ctx, text);
      } catch (e: any) {
        log(`bot.on(text) handleScan THREW: ${e?.message}`, "bot");
      }
    }
  });

  return bot;
}
