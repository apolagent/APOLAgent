import { Telegraf } from "telegraf";

const BASE_RPC = process.env.BASE_RPC_URL || "";
const WETH = "0x4200000000000000000000000000000000000006";
const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const SIM_AMOUNT = BigInt("100000000000000000");
const FEE_TIERS = [500, 3000, 10000, 100] as const;

const VIRTUAL_TOKEN = "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b";
const VIRTUAL_VAULT = "0xdad686299fb562f89e55da05f1d96fabeb2a2e32";
const VIRTUAL_DEPLOYER = "0x97cf38bb06da57b6418083998b09976ec40a90a3";

interface SimulationResult {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  simulationSuccess: boolean;
  feeTier: number | null;
  protocol: string;
}

function pad32(hex: string): string {
  return hex.replace(/^0x/i, "").padStart(64, "0");
}

function uint256Hex(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

function buildQuoteCalldata(tokenIn: string, tokenOut: string, amountIn: bigint, fee: number): string {
  const selector = "0xc6a5026a";
  return selector + pad32(tokenIn) + pad32(tokenOut) + uint256Hex(amountIn) + uint256Hex(BigInt(fee)) + uint256Hex(BigInt(0));
}

async function rpcCall(method: string, params: any[]): Promise<any> {
  const resp = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const json = await resp.json() as any;
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.result;
}

async function getTokenInfo(addr: string): Promise<{ name: string; symbol: string }> {
  const nameSelector = "0x06fdde03";
  const symbolSelector = "0x95d89b41";
  try {
    const [nameRaw, symbolRaw] = await Promise.all([
      rpcCall("eth_call", [{ to: addr, data: nameSelector }, "latest"]),
      rpcCall("eth_call", [{ to: addr, data: symbolSelector }, "latest"]),
    ]);
    const decodeName = (hex: string) => {
      if (!hex || hex === "0x" || hex.length < 130) return "";
      const offset = parseInt(hex.slice(2, 66), 16) * 2;
      const len = parseInt(hex.slice(2 + offset, 2 + offset + 64), 16);
      const raw = hex.slice(2 + offset + 64, 2 + offset + 64 + len * 2);
      return Buffer.from(raw, "hex").toString("utf8");
    };
    return { name: decodeName(nameRaw) || "Unknown", symbol: decodeName(symbolRaw) || "???" };
  } catch {
    return { name: "Unknown", symbol: "???" };
  }
}

async function getDeployer(addr: string): Promise<string | null> {
  try {
    const data = await fetch(
      `https://base.blockscout.com/api/v2/addresses/${addr}`,
      { signal: AbortSignal.timeout(6000) }
    ).then(r => r.ok ? r.json() as any : null);
    return data?.creator_address_hash?.toLowerCase() || null;
  } catch {
    return null;
  }
}

function detectVirtuals(addr: string, deployer: string | null): boolean {
  const a = addr.toLowerCase();
  if (a === VIRTUAL_TOKEN || a === VIRTUAL_VAULT) return true;
  if (deployer === VIRTUAL_DEPLOYER || deployer === VIRTUAL_VAULT) return true;
  return false;
}

export async function botAlchemySimulate(tokenAddress: string): Promise<SimulationResult> {
  const addr = tokenAddress.toLowerCase();

  for (const fee of FEE_TIERS) {
    try {
      const buyData = buildQuoteCalldata(WETH, addr, SIM_AMOUNT, fee);
      const buyResult = await rpcCall("eth_call", [{ to: QUOTER_V2, data: buyData }, "latest"]);
      if (!buyResult || buyResult === "0x") continue;

      const tokensReceived = BigInt("0x" + buyResult.slice(2, 66));
      if (tokensReceived === BigInt(0)) continue;

      const poolFeePercent = fee / 10000;

      let sellResult: string;
      try {
        const sellData = buildQuoteCalldata(addr, WETH, tokensReceived, fee);
        sellResult = await rpcCall("eth_call", [{ to: QUOTER_V2, data: sellData }, "latest"]);
      } catch {
        console.log(`[sim] fee=${fee}: sell REVERTED → honeypot`);
        return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, protocol: "Uniswap V3" };
      }

      if (!sellResult || sellResult === "0x") {
        return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, protocol: "Uniswap V3" };
      }

      const ethBack = BigInt("0x" + sellResult.slice(2, 66));
      if (ethBack === BigInt(0)) {
        return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true, feeTier: fee, protocol: "Uniswap V3" };
      }

      const ethIn = Number(SIM_AMOUNT) / 1e18;
      const ethOut = Number(ethBack) / 1e18;
      const roundTripLoss = ((ethIn - ethOut) / ethIn) * 100;
      const expectedPoolFees = poolFeePercent * 2;
      const netTax = Math.max(0, roundTripLoss - expectedPoolFees);
      const buyTax = parseFloat((netTax / 2).toFixed(2));
      const sellTax = parseFloat((netTax / 2).toFixed(2));

      console.log(`[sim] fee=${fee}: roundTrip=${roundTripLoss.toFixed(2)}%, netTax=${netTax.toFixed(2)}%`);

      return { isHoneypot: false, buyTax, sellTax, simulationSuccess: true, feeTier: fee, protocol: "Uniswap V3" };
    } catch (e: any) {
      console.log(`[sim] fee=${fee}: ${e?.message?.slice(0, 80) || "failed"}`);
      continue;
    }
  }

  return { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false, feeTier: null, protocol: "None" };
}

function feeLabel(fee: number): string {
  if (fee === 100) return "0.01%";
  if (fee === 500) return "0.05%";
  if (fee === 3000) return "0.3%";
  if (fee === 10000) return "1%";
  return `${fee / 10000}%`;
}

export function createBot(): Telegraf | null {
  const token = process.env.APOL_BOT_TOKEN;
  if (!token) {
    console.log("[bot] No APOL_BOT_TOKEN found — bot disabled");
    return null;
  }

  const bot = new Telegraf(token);

  bot.command("start", (ctx) => {
    ctx.reply("🦍 APOL Agent online. Use /scan <contract address> to begin.");
  });

  bot.command("scan", async (ctx) => {
    const input = ctx.message.text.split(/\s+/)[1] || "";
    if (!input || !input.startsWith("0x") || input.length !== 42) {
      ctx.reply("🔍 Send a Base contract address after /scan\.\nExample: `/scan 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`", { parse_mode: "Markdown" });
      return;
    }

    const t0 = Date.now();
    const loadingMsg = await ctx.reply("⏳ Simulating buy/sell on Alchemy...");

    try {
      const [sim, tokenInfo, deployer] = await Promise.all([
        botAlchemySimulate(input),
        getTokenInfo(input),
        getDeployer(input),
      ]);

      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const isVirtuals = detectVirtuals(input, deployer);
      const protocol = isVirtuals ? "Virtuals Protocol 🤖" : sim.simulationSuccess ? `Uniswap V3 (${feeLabel(sim.feeTier!)})` : "No pool found";

      if (isVirtuals && sim.simulationSuccess) {
        sim.buyTax = 0;
        sim.sellTax = 0;
        sim.isHoneypot = false;
      }

      const shortAddr = input.slice(0, 6) + "..." + input.slice(-4);
      const header = `🔍 *APOL SIMULATION REPORT*\n${"─".repeat(28)}`;
      const nameBlock = `🏷 *${tokenInfo.name}* ($${tokenInfo.symbol})\n📍 \`${shortAddr}\` · Base`;

      let body: string;
      if (!sim.simulationSuccess) {
        body = [
          `💰 *Tax:* N/A — no liquidity pool detected`,
          `🍯 *Honeypot:* ⚠️ UNABLE TO TEST`,
          `🔗 *Protocol:* ${protocol}`,
        ].join("\n");
      } else if (sim.isHoneypot) {
        body = [
          `💰 *Tax:* Buy ${sim.buyTax}% / Sell ${sim.sellTax}%`,
          `🍯 *Honeypot:* 🚨 *YES — SELL BLOCKED*`,
          `🔗 *Protocol:* ${protocol}`,
        ].join("\n");
      } else {
        const taxStr = sim.buyTax === 0 && sim.sellTax === 0
          ? "0% / 0% ✅"
          : `${sim.buyTax}% / ${sim.sellTax}% ⚠️`;
        body = [
          `💰 *Tax:* Buy ${taxStr}`,
          `🍯 *Honeypot:* NO ✅`,
          `🔗 *Protocol:* ${protocol}`,
        ].join("\n");
      }

      const footer = `⚡ ${elapsed}s · Alchemy Simulation Engine`;
      const text = [header, "", nameBlock, "", body, "", footer].join("\n");

      await ctx.telegram.editMessageText(
        ctx.chat.id, loadingMsg.message_id, undefined, text,
        { parse_mode: "Markdown" }
      );
    } catch (e: any) {
      await ctx.telegram.editMessageText(
        ctx.chat.id, loadingMsg.message_id, undefined,
        `❌ Simulation failed: ${e?.message?.slice(0, 100) || "Unknown error"}`
      );
    }
  });

  return bot;
}
