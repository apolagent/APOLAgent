import { Telegraf } from "telegraf";
import { storage } from "./storage";

function log(message: string, source = "bot") {
  const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
  console.log(`${t} [${source}] ${message}`);
}

const BASE_RPC = process.env.BASE_RPC_URL || "";
const WETH = "0x4200000000000000000000000000000000000006";
const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const SIM_AMOUNT = BigInt("1000000000000000");
const BURN_ADDRS = new Set(["0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"]);

const PLATFORM_MAP: Record<string, string> = {
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
  "0xe85a08cf16f07b0b6e8b1f5e4918f6e9dab3a5c0": "Clanker",
  "0xf3625f0e85afe89228eeab5c8c6e3aff94e77d38": "Clanker",
  "0xd466e09acadc0345b4cf42ea530e242a086f68c7": "Clanker",
  "0x1bc40af29dd8b8e1f685dc2b0e550f3d67842af5": "Clanker",
  "0x0bf85e6f2ff0ed5c4a76b1dbbd3f2f65c05a4f58": "ApeStore",
  "0xade20c0cc8482c404a57da404ed1f3f2a1f6fe6f": "ApeStore",
  "0x070c1626e110c8776cdbeb5439257c69a8d35523": "ApeStore",
  "0x7e89e29f2b3d95e4e8aec0a751427015c8fbe966": "ApeStore",
  "0x6a53961a5bc81e8b1e02aa84445e07a4e8057957": "Flaunch",
  "0xce0e4e4d2dc0033ce2dd0ec79abe6186106f0462": "Flaunch",
};

const LOCKER_MAP: Record<string, string> = {
  "0xe85a08cf16f07b0b6e8b1f5e4918f6e9dab3a5c0": "Clanker",
  "0xf3625f0e85afe89228eeab5c8c6e3aff94e77d38": "Clanker",
  "0x1bc40af29dd8b8e1f685dc2b0e550f3d67842af5": "Clanker",
  "0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214": "Unicrypt",
  "0x71b5759d73262fbb223956913ecf4ecc51057641": "PinkLock",
  "0xe2fe530c047f2d85298b07d9333c05737f1435fb": "Team Finance",
  "0x0bf85e6f2ff0ed5c4a76b1dbbd3f2f65c05a4f58": "ApeStore",
  "0x070c1626e110c8776cdbeb5439257c69a8d35523": "ApeStore",
  "0x7e89e29f2b3d95e4e8aec0a751427015c8fbe966": "ApeStore",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x6a53961a5bc81e8b1e02aa84445e07a4e8057957": "Flaunch",
  "0xce0e4e4d2dc0033ce2dd0ec79abe6186106f0462": "Flaunch",
};

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
  const fees = [500, 3000, 10000, 100];
  const calls = fees.map((fee) => ({
    method: "eth_call" as const,
    params: [{ to: V3_FACTORY, data: "0x1698ee82" + pad32(t0) + pad32(t1) + uint256Hex(BigInt(fee)) }, "latest"],
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

async function simulateToken(tokenAddress: string): Promise<SimResult> {
  const addr = tokenAddress.toLowerCase();
  const fail = (reason: string): SimResult => ({ isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0), failReason: reason });

  const poolInfo = await findBestPool(addr);
  if (!poolInfo) return fail("No Uniswap V3 pool found");

  const { fee } = poolInfo;
  const sel = "0xc6a5026a";
  const buyData = sel + pad32(WETH) + pad32(addr) + uint256Hex(SIM_AMOUNT) + uint256Hex(BigInt(fee)) + uint256Hex(BigInt(0));

  let buyResult: string;
  try { buyResult = await rpcCall("eth_call", [{ to: QUOTER_V2, data: buyData }, "latest"]); }
  catch (e: any) { return fail(e?.message?.includes("revert") ? "Insufficient liquidity" : "Buy simulation failed"); }
  if (!buyResult || buyResult === "0x") return fail("Insufficient liquidity");

  const tokensReceived = BigInt("0x" + buyResult.slice(2, 66));
  if (tokensReceived === BigInt(0)) return fail("Insufficient liquidity");

  let sellResult: string;
  try {
    const sellData = sel + pad32(addr) + pad32(WETH) + uint256Hex(tokensReceived) + uint256Hex(BigInt(fee)) + uint256Hex(BigInt(0));
    sellResult = await rpcCall("eth_call", [{ to: QUOTER_V2, data: sellData }, "latest"]);
  } catch { return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived, failReason: null }; }

  if (!sellResult || sellResult === "0x") return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived, failReason: null };

  const ethBack = BigInt("0x" + sellResult.slice(2, 66));
  if (ethBack === BigInt(0)) return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, tokensReceived, failReason: null };

  const ethIn = Number(SIM_AMOUNT) / 1e18;
  const ethOut = Number(ethBack) / 1e18;
  const roundTripLoss = ((ethIn - ethOut) / ethIn) * 100;
  const expectedPoolFees = (fee / 10000) * 2;
  const netTax = Math.max(0, roundTripLoss - expectedPoolFees);
  const buyTax = parseFloat((netTax / 2).toFixed(1));
  const sellTax = parseFloat((netTax / 2).toFixed(1));

  return { isHoneypot: false, buyTax, sellTax, simulationSuccess: true, feeTier: fee, tokensReceived, failReason: null };
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
  try {
    const data = await fetch(`https://base.blockscout.com/api/v2/addresses/${addr}`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok ? r.json() as any : null);
    if (data?.creator_address_hash) return data.creator_address_hash.toLowerCase();
  } catch {}
  try {
    const data = await fetch(`https://base.blockscout.com/api?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok ? r.json() as any : null);
    const firstFrom = data?.result?.[0]?.from;
    if (firstFrom) return firstFrom.toLowerCase();
  } catch {}
  return null;
}

async function getHolderCount(addr: string): Promise<number> {
  try {
    const data = await fetch(`https://base.blockscout.com/api/v2/tokens/${addr}/counters`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok ? r.json() as any : null);
    return parseInt(data?.token_holders_count || "0", 10);
  } catch { return 0; }
}

async function getTopHolders(addr: string): Promise<{ address: string; percent: number }[]> {
  try {
    const data = await fetch(`https://base.blockscout.com/api/v2/tokens/${addr}/holders?limit=10`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok ? r.json() as any : null);
    if (!data?.items) return [];
    return data.items.map((h: any) => ({ address: (h.address?.hash || "").toLowerCase(), percent: parseFloat(h.percentage || "0") }));
  } catch { return []; }
}

async function getEthUsdPrice(): Promise<number> {
  try {
    const data = await fetch("https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006", { signal: AbortSignal.timeout(3000) }).then((r) => r.ok ? r.json() as any : null);
    return parseFloat(data?.pairs?.[0]?.priceUsd || "0") || 0;
  } catch { return 0; }
}

async function getDexScreenerData(addr: string): Promise<{ priceUsd: number; liquidity: number }> {
  try {
    const data = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok ? r.json() as any : null);
    const pair = data?.pairs?.[0];
    return { priceUsd: parseFloat(pair?.priceUsd || "0") || 0, liquidity: parseFloat(pair?.liquidity?.usd || "0") || 0 };
  } catch { return { priceUsd: 0, liquidity: 0 }; }
}

async function searchDexScreener(query: string): Promise<{ address: string; name: string; symbol: string; chain: string } | null> {
  try {
    const data = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok ? r.json() as any : null);
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
    const [balResult] = await rpcBatch([
      { method: "eth_getBalance", params: [addr, "latest"] },
    ]);
    const balWei = balResult ? BigInt(balResult) : BigInt(0);
    const balEth = Number(balWei) / 1e18;

    const addrData = await fetch(`https://base.blockscout.com/api/v2/addresses/${addr}`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok ? r.json() as any : null);
    const isContract = addrData?.is_contract || false;

    let txCount = 0;
    let firstTx: string | null = null;
    let firstTxHash: string | null = null;
    let firstTxFrom: string | null = null;
    let firstTxFromName: string | null = null;
    let inflow = 0;
    let outflow = 0;

    try {
      const txData = await fetch(`https://base.blockscout.com/api/v2/addresses/${addr}/transactions?limit=50&sort=asc`, { signal: AbortSignal.timeout(6000) }).then((r) => r.ok ? r.json() as any : null);
      const items = txData?.items || [];
      if (items.length > 0) {
        firstTx = items[0]?.timestamp || null;
        firstTxHash = items[0]?.hash || null;
        const fromAddr = items[0]?.from?.hash || null;
        firstTxFrom = fromAddr;
        firstTxFromName = items[0]?.from?.name || items[0]?.from?.ens_domain_name || null;
      }

      const lowerAddr = addr.toLowerCase();
      for (const tx of items) {
        const val = tx.value ? Number(BigInt(tx.value)) / 1e18 : 0;
        if (val > 0) {
          if (tx.to?.hash?.toLowerCase() === lowerAddr) inflow += val;
          if (tx.from?.hash?.toLowerCase() === lowerAddr) outflow += val;
        }
      }
    } catch {}

    try {
      const countData = await fetch(`https://base.blockscout.com/api/v2/addresses/${addr}/counters`, { signal: AbortSignal.timeout(4000) }).then((r) => r.ok ? r.json() as any : null);
      txCount = countData?.transactions_count ? parseInt(countData.transactions_count) : 0;
    } catch {}

    return { balance: balEth.toFixed(4), txCount, isContract, firstTx, firstTxHash, firstTxFrom, firstTxFromName, inflow, outflow };
  } catch { return { balance: "0", txCount: 0, isContract: false, firstTx: null, firstTxHash: null, firstTxFrom: null, firstTxFromName: null, inflow: 0, outflow: 0 }; }
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
    if (BURN_ADDRS.has(h.address)) return `Burned 🔥`;
    if (LOCKER_MAP[h.address]) return `${LOCKER_MAP[h.address]} Locked 🔒`;
  }
  if (platform) return `${platform} Managed ✅`;
  return "Unlocked ⚠️";
}

function formatPrice(usdPrice: number): string {
  if (usdPrice === 0) return "$0";
  if (usdPrice >= 1) return `$${usdPrice.toFixed(2)}`;
  if (usdPrice >= 0.01) return `$${usdPrice.toFixed(4)}`;
  const str = usdPrice.toFixed(18).replace(/0+$/, "");
  return `$${str}`;
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

  const [simR, tokenR, deployerR] = await Promise.allSettled([
    simulateToken(address),
    getTokenInfo(address),
    getDeployer(address),
  ]);

  const sim: SimResult = simR.status === "fulfilled" ? simR.value
    : { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0), failReason: "Simulation error" };
  const tokenInfo = tokenR.status === "fulfilled" ? tokenR.value
    : { name: "Unknown", symbol: "???", totalSupply: BigInt(0), decimals: 18 };
  const deployer = deployerR.status === "fulfilled" ? deployerR.value : null;

  const [holderCount, topHolders, ethUsd, dexData] = await Promise.all([
    softTimeout(getHolderCount(address), 3000, 0),
    softTimeout(getTopHolders(address), 3000, []),
    softTimeout(getEthUsdPrice(), 3000, 0),
    softTimeout(getDexScreenerData(address), 3000, { priceUsd: 0, liquidity: 0 }),
  ]);

  const scanCount = await storage.incrementLookup(address, tokenInfo.name, tokenInfo.symbol);

  const platform = detectPlatform(address, deployer, topHolders);
  const lpStatus = detectLpStatus(topHolders, platform);
  const isVirtuals = platform === "Virtuals";

  const buyTax = isVirtuals ? 0 : sim.buyTax;
  const sellTax = isVirtuals ? 0 : sim.sellTax;
  const isHoneypot = isVirtuals ? false : sim.isHoneypot;

  let tokenPriceUsd = dexData.priceUsd;
  if (tokenPriceUsd === 0 && sim.tokensReceived > BigInt(0) && ethUsd > 0) {
    const tokensWholeUnits = Number(sim.tokensReceived) / (10 ** tokenInfo.decimals);
    tokenPriceUsd = tokensWholeUnits > 0 ? (0.001 / tokensWholeUnits) * ethUsd : 0;
  }

  const mcap = Number(tokenInfo.totalSupply) * tokenPriceUsd;
  const liquidity = dexData.liquidity;

  const hasPool = sim.simulationSuccess || isVirtuals;
  const dexStatus = hasPool ? "Live (Direct-to-V3) ✅" : "No Pool Found ⚠️";

  const isOwnerRenounced = !deployer || deployer === "0x0000000000000000000000000000000000000000";

  const nameUpper = tokenInfo.name.toUpperCase();
  const symbolUpper = tokenInfo.symbol.toUpperCase();
  const isFakeApol = symbolUpper === "APOL" || nameUpper === "APOL" || nameUpper === "APOL AGENT" || nameUpper.includes("APOLAGENT");

  const flags: string[] = [];
  if (isFakeApol) flags.push("🚨 FAKE $APOL — APOL has NO official token. This is a SCAM.");
  if (isHoneypot) flags.push("🚨 Honeypot — SELL BLOCKED");
  if (buyTax > 5 || sellTax > 5) flags.push(`💰 High tax: Buy ${buyTax}% / Sell ${sellTax}%`);
  if (holderCount > 0 && holderCount < 100) flags.push("👥 Low holder count");
  if (liquidity > 0 && liquidity < 10000) flags.push("💧 Very Low Liquidity");
  if (!hasPool) flags.push("⚠️ No Uniswap V3 liquidity pool");

  const riskLevel = isFakeApol || isHoneypot || buyTax > 10 || sellTax > 10
    ? "🔴 HIGH RISK"
    : flags.length > 0
      ? "🟡 CAUTION"
      : "🟢 LOW RISK";

  const shortAddr = address.slice(0, 8) + "..." + address.slice(-6);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  const lines: string[] = [
    `🏛 *APOL AGENT — CONTRACT SNAPSHOT*`,
    ``,
    `📍 *Address:* \`${shortAddr}\``,
    `⛓ *Chain:* Base Mainnet`,
    ``,
    `*${esc(tokenInfo.name)}* ($${esc(tokenInfo.symbol)}) 👁️ ${scanCount}`,
    `💲 *Price:* ${tokenPriceUsd > 0 ? formatPrice(tokenPriceUsd) : "Scanning..."}`,
    `📊 *Market Cap:* ${mcap > 0 ? formatUsd(mcap) : "N/A"}`,
    `💧 *Liquidity:* ${liquidity > 0 ? formatUsd(liquidity) : "Scanning..."}`,
    `📡 *Status:* ${dexStatus}`,
    `🔒 *LP Status:* ${lpStatus}`,
    `👥 *Holders:* ${holderCount > 0 ? holderCount.toLocaleString() : "Scanning..."}`,
    `💰 *Buy Tax:* ${buyTax.toFixed(1)}%  |  *Sell Tax:* ${sellTax.toFixed(1)}%`,
    ``,
    `*RISK LEVEL:* ${riskLevel}`,
    ``,
  ];

  if (isOwnerRenounced) {
    lines.push(`✅ *CONTRACT RENOUNCED*`);
    lines.push(`• Ownership burned. No admin keys.`);
  } else {
    lines.push(`⚠️ *CONTRACT NOT RENOUNCED*`);
    lines.push(`• Owner: \`${deployer?.slice(0, 10)}...\``);
  }

  if (flags.length > 0) {
    lines.push(``);
    lines.push(`🚩 *FLAGS DETECTED:*`);
    for (const f of flags) lines.push(`   ${f}`);
  }

  lines.push(``);
  lines.push(`🔍 [Full Scan](https://apolagent.online)   🏛 [Wall of Shame](https://apolagent.online)`);
  lines.push(`🔗 [View on Basescan](https://basescan.org/address/${address})`);
  lines.push(``);
  lines.push(`⚡ ${elapsed}s · APOL Forensic Engine`);

  return lines.join("\n");
}

function esc(s: string): string {
  return s.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

async function handleScan(ctx: any, address: string): Promise<void> {
  const loadingMsg = await ctx.reply("⏳ Running APOL forensic simulation...");
  try {
    const report = await runScan(address);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, report, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
  } catch (e: any) {
    log(`Scan error for ${address}: ${e?.message}`, "bot");
    const scanCount = await storage.incrementLookup(address).catch(() => 0);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
      `🏛 *APOL AGENT — CONTRACT SNAPSHOT*\n\n📍 \`${address.slice(0, 8)}...${address.slice(-6)}\`\n\n⚠️ Scan error: ${e?.message?.slice(0, 80) || "Unknown"}\n👁 Scan count: ${scanCount}`,
      { parse_mode: "Markdown" },
    ).catch(() => {});
  }
}

async function handleScanX(ctx: any, input: string): Promise<void> {
  const loadingMsg = await ctx.reply("🔍 Running X/Twitter social forensics...");
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
        `🔍 *APOL AGENT — SCANX RESULTS*\n\n🐦 *X Handle:* @${esc(handle)}\n\n✅ *VERIFIED — This is APOL Agent*\n\n🏛 Official security protocol on Base chain\n🔗 Website: apolagent.online\n🐦 Twitter: @ApolAgent\\_\n\n⚠️ *APOL has NO official token or CA.*\nAny token using $APOL ticker is a SCAM.`,
        { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
      return;
    }

    const tokenResult = await softTimeout(searchDexScreener(handle), 5000, null);

    if (tokenResult && tokenResult.address) {
      const report = await runScan(tokenResult.address);
      const header = `🔍 *APOL AGENT — SCANX RESULTS*\n🐦 *X Handle:* @${esc(handle)}\n📌 *Token Found:* ${esc(tokenResult.name)} ($${esc(tokenResult.symbol)})\n\n`;
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, header + report, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } else {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
        `🔍 *APOL AGENT — SCANX RESULTS*\n\n🐦 *X Handle:* @${esc(handle)}\n\n⚠️ No Base chain token found matching "${esc(handle)}"\n\n💡 Try scanning the contract address directly with /scan`,
        { parse_mode: "Markdown" });
    }
  } catch (e: any) {
    log(`ScanX error: ${e?.message}`, "bot");
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
      `🔍 *APOL AGENT — SCANX*\n\n⚠️ Error: ${e?.message?.slice(0, 80) || "Unknown"}`,
      { parse_mode: "Markdown" }).catch(() => {});
  }
}

async function handleCheckWallet(ctx: any, address: string): Promise<void> {
  const loadingMsg = await ctx.reply("🔍 Running forensic wallet audit...");
  try {
    const walletInfo = await getWalletInfo(address);
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

    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, lines.join("\n"), { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
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

  bot.command("start", (ctx) => {
    const lines = [
      `🦍 *APOL Agent — On-Chain Security*`,
      ``,
      `Forensic analysis on Base chain.`,
      ``,
      `*Commands:*`,
      `/scan - Contract investigation`,
      `/scanx - X/Twitter social forensics`,
      `/scanagent - AI Agent verification`,
      `/checkwallet - Wallet forensic audit`,
      `/map - APOL Wall of Shame`,
      `/verified - Certified Hero Projects`,
      ``,
      `Or just paste a contract address to scan.`,
    ];
    ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  });

  bot.command("scan", async (ctx) => {
    const input = ctx.message.text.replace(/^\/scan(@\w+)?\s*/i, "").trim();
    if (!isContractAddress(input)) {
      ctx.reply("🔍 Send a Base contract address after /scan\nExample: `/scan 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`", { parse_mode: "Markdown" });
      return;
    }
    await handleScan(ctx, input);
  });

  bot.command("scanx", async (ctx) => {
    const input = ctx.message.text.replace(/^\/scanx(@\w+)?\s*/i, "").trim();
    if (!input) {
      ctx.reply("🔍 Send an X/Twitter handle or URL after /scanx\nExample: `/scanx @ShieldCoinBase`", { parse_mode: "Markdown" });
      return;
    }
    await handleScanX(ctx, input);
  });

  bot.command("scanagent", async (ctx) => {
    const input = ctx.message.text.replace(/^\/scanagent(@\w+)?\s*/i, "").trim();
    if (!isContractAddress(input)) {
      ctx.reply("🤖 Send an AI agent contract address after /scanagent\nExample: `/scanagent 0x...`", { parse_mode: "Markdown" });
      return;
    }
    const loadingMsg = await ctx.reply("🤖 Running AI Agent authenticity scan...");
    try {
      const report = await runScan(input);
      const header = `🤖 *APOL AGENT — AI AGENT SCAN*\n\n`;
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, header + report, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch (e: any) {
      log(`ScanAgent error: ${e?.message}`, "bot");
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
        `🤖 *APOL AGENT — AI AGENT SCAN*\n\n⚠️ Error: ${e?.message?.slice(0, 80) || "Unknown"}`,
        { parse_mode: "Markdown" }).catch(() => {});
    }
  });

  bot.command("checkwallet", async (ctx) => {
    const input = ctx.message.text.replace(/^\/checkwallet(@\w+)?\s*/i, "").trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(input)) {
      ctx.reply("💼 Send a wallet address after /checkwallet\nExample: `/checkwallet 0x...`", { parse_mode: "Markdown" });
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
      lines.push(`\n🔗 [View Full Map](https://apolagent.online)`);
      ctx.reply(lines.join("\n"), { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch {
      ctx.reply("🏛 *APOL Wall of Shame*\n\n🔗 [View on Web](https://apolagent.online)", { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    }
  });

  bot.command("verified", (ctx) => {
    ctx.reply(
      `✅ *APOL Certified Hero Projects*\n\nVerified projects that passed APOL's security audit.\n\n🔗 [View Verified List](https://apolagent.online)\n\n💡 Want your project verified? Contact @ApolAgentBot`,
      { parse_mode: "Markdown", link_preview_options: { is_disabled: true } },
    );
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;
    if (isContractAddress(text)) {
      await handleScan(ctx, text);
    }
  });

  return bot;
}
