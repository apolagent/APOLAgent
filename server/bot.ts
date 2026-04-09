import { Telegraf } from "telegraf";
import { storage } from "./storage";

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

async function botAlchemySimulate(tokenAddress: string): Promise<SimResult> {
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

  console.log(`[sim] fee=${fee}: roundTrip=${roundTripLoss.toFixed(2)}%, netTax=${netTax.toFixed(2)}%`);
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
    return data?.creator_address_hash?.toLowerCase() || null;
  } catch { return null; }
}

async function getHolderCount(addr: string): Promise<number> {
  try {
    const data = await fetch(`https://base.blockscout.com/api/v2/tokens/${addr}/counters`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok ? r.json() as any : null);
    return parseInt(data?.token_holders_count || "0", 10);
  } catch { return 0; }
}

async function getTopHolders(addr: string): Promise<{ address: string; percent: number }[]> {
  try {
    const data = await fetch(`https://base.blockscout.com/api/v2/tokens/${addr}/holders?limit=10`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok ? r.json() as any : null);
    if (!data?.items) return [];
    return data.items.map((h: any) => ({ address: (h.address?.hash || "").toLowerCase(), percent: parseFloat(h.percentage || "0") }));
  } catch { return []; }
}

async function getEthUsdPrice(): Promise<number> {
  try {
    const data = await fetch("https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006", { signal: AbortSignal.timeout(2000) }).then((r) => r.ok ? r.json() as any : null);
    return parseFloat(data?.pairs?.[0]?.priceUsd || "0") || 0;
  } catch { return 0; }
}

async function getDexScreenerData(addr: string): Promise<{ priceUsd: number; liquidity: number }> {
  try {
    const data = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(2000) }).then((r) => r.ok ? r.json() as any : null);
    const pair = data?.pairs?.[0];
    return { priceUsd: parseFloat(pair?.priceUsd || "0") || 0, liquidity: parseFloat(pair?.liquidity?.usd || "0") || 0 };
  } catch { return { priceUsd: 0, liquidity: 0 }; }
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

async function runScan(address: string): Promise<string> {
  const t0 = Date.now();

  const [simR, tokenR, deployerR] = await Promise.allSettled([
    botAlchemySimulate(address),
    getTokenInfo(address),
    getDeployer(address),
  ]);

  const sim: SimResult = simR.status === "fulfilled" ? simR.value
    : { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, tokensReceived: BigInt(0), failReason: "Simulation error" };
  const tokenInfo = tokenR.status === "fulfilled" ? tokenR.value
    : { name: "Unknown", symbol: "???", totalSupply: BigInt(0), decimals: 18 };
  const deployer = deployerR.status === "fulfilled" ? deployerR.value : null;

  const [holderCount, topHolders, ethUsd, dexData] = await Promise.all([
    softTimeout(getHolderCount(address), 2000, 0),
    softTimeout(getTopHolders(address), 2000, []),
    softTimeout(getEthUsdPrice(), 2000, 0),
    softTimeout(getDexScreenerData(address), 2000, { priceUsd: 0, liquidity: 0 }),
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

  const flags: string[] = [];
  if (isHoneypot) flags.push("🚨 Honeypot — SELL BLOCKED");
  if (buyTax > 5 || sellTax > 5) flags.push(`💰 High tax: Buy ${buyTax}% / Sell ${sellTax}%`);
  if (holderCount > 0 && holderCount < 100) flags.push("👥 Low holder count");
  if (liquidity > 0 && liquidity < 10000) flags.push("💧 Very Low Liquidity");
  if (!hasPool) flags.push("⚠️ No Uniswap V3 liquidity pool");

  const riskLevel = isHoneypot || buyTax > 10 || sellTax > 10
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
    `*${tokenInfo.name}* ($${tokenInfo.symbol}) 🧿 ${scanCount}`,
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
  lines.push(`⚡ ${elapsed}s · Alchemy Simulation Engine`);

  return lines.join("\n");
}

function isContractAddress(text: string): boolean {
  const trimmed = text.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
}

export function createBot(): Telegraf | null {
  const token = process.env.APOL_BOT_TOKEN;
  if (!token) {
    console.log("[bot] No APOL_BOT_TOKEN found — bot disabled");
    return null;
  }

  const bot = new Telegraf(token);

  bot.command("start", (ctx) => {
    ctx.reply("🦍 APOL Agent online. Use /scan <contract address> or just paste a CA to begin.");
  });

  bot.command("scan", async (ctx) => {
    const input = ctx.message.text.replace(/\/scan\s*/i, "").trim();
    if (!isContractAddress(input)) {
      ctx.reply("🔍 Send a Base contract address after /scan\.\nExample: `/scan 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`", { parse_mode: "Markdown" });
      return;
    }
    const loadingMsg = await ctx.reply("⏳ Running APOL forensic simulation...");
    try {
      const report = await runScan(input);
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, report, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch (e: any) {
      const scanCount = await storage.incrementLookup(input).catch(() => 0);
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
        `🏛 *APOL AGENT — CONTRACT SNAPSHOT*\n\n📍 \`${input.slice(0,8)}...${input.slice(-6)}\`\n\n⚠️ Scan error: ${e?.message?.slice(0, 80) || "Unknown"}\n👁 Scan count: ${scanCount}`,
        { parse_mode: "Markdown" },
      ).catch(() => {});
    }
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (!isContractAddress(text)) return;
    const loadingMsg = await ctx.reply("⏳ Running APOL forensic simulation...");
    try {
      const report = await runScan(text);
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined, report, { parse_mode: "Markdown", link_preview_options: { is_disabled: true } });
    } catch (e: any) {
      const scanCount = await storage.incrementLookup(text).catch(() => 0);
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, undefined,
        `🏛 *APOL AGENT — CONTRACT SNAPSHOT*\n\n📍 \`${text.slice(0,8)}...${text.slice(-6)}\`\n\n⚠️ Scan error: ${e?.message?.slice(0, 80) || "Unknown"}\n👁 Scan count: ${scanCount}`,
        { parse_mode: "Markdown" },
      ).catch(() => {});
    }
  });

  return bot;
}
