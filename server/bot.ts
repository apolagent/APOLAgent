import { Telegraf } from "telegraf";

const BASE_RPC = process.env.BASE_RPC_URL || "";
const WETH = "0x4200000000000000000000000000000000000006";
const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const SIM_AMOUNT = BigInt("100000000000000000");
const FEE_TIERS = [500, 3000, 10000, 100] as const;

interface SimulationResult {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  simulationSuccess: boolean;
}

function pad32(hex: string): string {
  return hex.replace(/^0x/i, "").padStart(64, "0");
}

function uint256Hex(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

function buildQuoteCalldata(tokenIn: string, tokenOut: string, amountIn: bigint, fee: number): string {
  const selector = "0xc6a5026a";
  const tokenInPad = pad32(tokenIn);
  const tokenOutPad = pad32(tokenOut);
  const amountPad = uint256Hex(amountIn);
  const feePad = uint256Hex(BigInt(fee));
  const sqrtPricePad = uint256Hex(BigInt(0));
  return selector + tokenInPad + tokenOutPad + amountPad + feePad + sqrtPricePad;
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

export async function botAlchemySimulate(tokenAddress: string): Promise<SimulationResult> {
  const addr = tokenAddress.toLowerCase();

  for (const fee of FEE_TIERS) {
    try {
      const buyData = buildQuoteCalldata(WETH, addr, SIM_AMOUNT, fee);
      const buyResult = await rpcCall("eth_call", [
        { to: QUOTER_V2, data: buyData },
        "latest",
      ]);

      if (!buyResult || buyResult === "0x") continue;

      const tokensReceived = BigInt("0x" + buyResult.slice(2, 66));
      if (tokensReceived === BigInt(0)) continue;

      const poolFeePercent = fee / 10000;

      let sellResult: string;
      try {
        const sellData = buildQuoteCalldata(addr, WETH, tokensReceived, fee);
        sellResult = await rpcCall("eth_call", [
          { to: QUOTER_V2, data: sellData },
          "latest",
        ]);
      } catch {
        console.log(`[sim] fee=${fee}: sell REVERTED → honeypot`);
        return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true };
      }

      if (!sellResult || sellResult === "0x") {
        console.log(`[sim] fee=${fee}: sell returned empty → honeypot`);
        return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true };
      }

      const ethBack = BigInt("0x" + sellResult.slice(2, 66));
      if (ethBack === BigInt(0)) {
        return { isHoneypot: true, buyTax: 0, sellTax: 100, simulationSuccess: true };
      }

      const ethIn = Number(SIM_AMOUNT) / 1e18;
      const ethOut = Number(ethBack) / 1e18;
      const roundTripLoss = ((ethIn - ethOut) / ethIn) * 100;
      const expectedPoolFees = poolFeePercent * 2;
      const netTax = Math.max(0, roundTripLoss - expectedPoolFees);
      const buyTax = parseFloat((netTax / 2).toFixed(2));
      const sellTax = parseFloat((netTax / 2).toFixed(2));

      console.log(`[sim] fee=${fee}: ethIn=${ethIn}, ethOut=${ethOut.toFixed(6)}, roundTrip=${roundTripLoss.toFixed(2)}%, poolFees=${expectedPoolFees.toFixed(2)}%, netTax=${netTax.toFixed(2)}%`);

      return {
        isHoneypot: false,
        buyTax,
        sellTax,
        simulationSuccess: true,
      };

    } catch (e: any) {
      console.log(`[sim] fee=${fee}: ${e?.message?.slice(0, 80) || "failed"}`);
      continue;
    }
  }

  console.log(`[sim] ${addr.slice(0, 10)}: no pool found on any fee tier`);
  return { isHoneypot: false, buyTax: 0, sellTax: 0, simulationSuccess: false };
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
      ctx.reply("🔍 Send a Base contract address after /scan.\nExample: /scan 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
      return;
    }

    const loadingMsg = await ctx.reply("⏳ Running Alchemy simulation...");

    try {
      const sim = await botAlchemySimulate(input);

      let text = "";
      if (!sim.simulationSuccess) {
        text = `🔍 *APOL Simulation Report*\n\n📍 \`${input}\`\n\n⚠️ No Uniswap V3 pool found for this token. Simulation could not run.`;
      } else if (sim.isHoneypot) {
        text = `🔍 *APOL Simulation Report*\n\n📍 \`${input}\`\n\n🚨 *HONEYPOT DETECTED*\nSell transaction reverted. This token cannot be sold.`;
      } else {
        const taxLine = sim.buyTax === 0 && sim.sellTax === 0
          ? "✅ No hidden taxes detected"
          : `⚠️ Buy Tax: ${sim.buyTax}% | Sell Tax: ${sim.sellTax}%`;
        text = `🔍 *APOL Simulation Report*\n\n📍 \`${input}\`\n\n${taxLine}\n✅ Token is tradeable — not a honeypot.`;
      }

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
