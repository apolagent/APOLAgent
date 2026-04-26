import type { Express, Request, Response, NextFunction } from "express";

const PAY_TO_ADDRESS = "0x857aca6A8A743C9262d64819D239f509a1Cd0A85" as const;
const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const PRICE_USDC_MICROS = "500000" as const;

const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || "https://payai.to/api/x402";
const FACILITATOR_VERSION: 1 | 2 = process.env.X402_FACILITATOR_VERSION === "1" ? 1 : 2;

const NETWORK = FACILITATOR_VERSION === 2 ? "eip155:8453" : "base";
const SCHEME = FACILITATOR_VERSION === 2 ? "erc-3009" : "exact";
const SIGNATURE_HEADER = FACILITATOR_VERSION === 2 ? "payment-signature" : "x-payment";
const REQUIREMENTS_HEADER = "PAYMENT-REQUIRED";

interface Lane {
  method: "GET" | "POST";
  path: string;
  description: string;
}

const X402_LANES: ReadonlyArray<Lane> = Object.freeze([
  { method: "GET",  path: "/api/x402/detective/analyze", description: "APOL on-chain forensic scan: contract or wallet on Base. Returns the same JSON as the public Terminal scan." },
  { method: "POST", path: "/api/x402/agent/analyze",     description: "APOL AI agent legitimacy report (LARP detector). Returns the same JSON as the public Terminal scan." },
  { method: "GET",  path: "/api/x402/scanx",              description: "APOL X (Twitter) handle agent verification scan. Returns the same JSON as the public Terminal scan." },
]);

function buildRequirements(req: Request, description: string) {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.get("host") || "apolagent.online";
  const resource = `${proto}://${host}${req.originalUrl.split("?")[0]}`;
  return {
    scheme: SCHEME,
    network: NETWORK,
    maxAmountRequired: PRICE_USDC_MICROS,
    resource,
    description,
    mimeType: "application/json",
    payTo: PAY_TO_ADDRESS,
    maxTimeoutSeconds: 60,
    asset: USDC_BASE_MAINNET,
    extra: { name: "USD Coin", version: "2" },
  };
}

function send402(res: Response, requirements: ReturnType<typeof buildRequirements>): void {
  const payload = {
    x402Version: FACILITATOR_VERSION,
    error: "Payment Required",
    accepts: [requirements],
  };
  if (FACILITATOR_VERSION === 2) {
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
    res.setHeader(REQUIREMENTS_HEADER, encoded);
    res.status(402).json({
      x402Version: 2,
      error: "Payment Required",
      message: `Payment requirements provided in the ${REQUIREMENTS_HEADER} response header (base64-encoded JSON). Retry with payment proof in the PAYMENT-SIGNATURE request header.`,
    });
  } else {
    res.status(402).json(payload);
  }
}

type FacilitatorOk = { ok: true; settle: { success: boolean; transaction?: string; network?: string; payer?: string } };
type FacilitatorErr = { ok: false; reason: string };

async function verifyAndSettle(paymentHeader: string, requirements: ReturnType<typeof buildRequirements>): Promise<FacilitatorOk | FacilitatorErr> {
  let paymentPayload: unknown;
  try {
    const decoded = Buffer.from(paymentHeader, "base64").toString("utf8");
    paymentPayload = JSON.parse(decoded);
  } catch {
    return { ok: false, reason: `${SIGNATURE_HEADER.toUpperCase()} header is not valid base64-encoded JSON` };
  }

  const facilitatorBody = JSON.stringify({
    paymentPayload,
    paymentRequirements: requirements,
    x402Version: FACILITATOR_VERSION,
  });

  let verifyJson: any;
  try {
    const verifyResp = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: facilitatorBody,
      signal: AbortSignal.timeout(15000),
    });
    if (!verifyResp.ok) {
      const txt = await verifyResp.text().catch(() => "");
      return { ok: false, reason: `Facilitator /verify returned HTTP ${verifyResp.status}${txt ? `: ${txt.slice(0, 200)}` : ""}` };
    }
    verifyJson = await verifyResp.json();
  } catch (e: any) {
    return { ok: false, reason: `Facilitator /verify unreachable: ${e?.message || "network error"}` };
  }
  if (!verifyJson?.isValid) {
    return { ok: false, reason: `Payment verification failed: ${verifyJson?.invalidReason || "unknown reason"}` };
  }

  let settleJson: any;
  try {
    const settleResp = await fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: facilitatorBody,
      signal: AbortSignal.timeout(30000),
    });
    if (!settleResp.ok) {
      const txt = await settleResp.text().catch(() => "");
      return { ok: false, reason: `Facilitator /settle returned HTTP ${settleResp.status}${txt ? `: ${txt.slice(0, 200)}` : ""}` };
    }
    settleJson = await settleResp.json();
  } catch (e: any) {
    return { ok: false, reason: `Facilitator /settle unreachable: ${e?.message || "network error"}` };
  }
  if (!settleJson?.success) {
    return { ok: false, reason: `On-chain settlement failed: ${settleJson?.errorReason || "unknown reason"}` };
  }
  return { ok: true, settle: settleJson };
}

export function installX402(app: Express): void {
  console.log(`[x402] facilitator: ${FACILITATOR_URL}`);
  console.log(`[x402] wire-version: x402Version=${FACILITATOR_VERSION} | scheme="${SCHEME}" | network="${NETWORK}"`);
  console.log(`[x402] headers: request="${SIGNATURE_HEADER.toUpperCase()}"${FACILITATOR_VERSION === 2 ? ` | response="${REQUIREMENTS_HEADER}" (base64-encoded JSON)` : " | response: JSON body (v1)"}`);
  console.log(`[x402] payTo: ${PAY_TO_ADDRESS} | price: $0.50 USDC (${PRICE_USDC_MICROS} micros) | asset: ${USDC_BASE_MAINNET} (USDC on Base)`);
  console.log(`[x402] settlement: ERC-3009 transferWithAuthorization — gasless for the merchant; the facilitator pays gas to push the on-chain transfer.`);

  for (const lane of X402_LANES) {
    const handler = async (req: Request, res: Response, next: NextFunction) => {
      const requirements = buildRequirements(req, lane.description);
      const paymentHeader = req.headers[SIGNATURE_HEADER] as string | undefined;
      if (!paymentHeader) {
        return send402(res, requirements);
      }
      const result = await verifyAndSettle(paymentHeader, requirements);
      if (!result.ok) {
        console.log(`[x402] payment rejected on ${req.method} ${req.originalUrl} — ${result.reason}`);
        return res.status(402).json({ x402Version: FACILITATOR_VERSION, error: result.reason });
      }
      const txHint = result.settle.transaction ? ` tx=${result.settle.transaction}` : "";
      const payerHint = result.settle.payer ? ` payer=${result.settle.payer}` : "";
      console.log(`[payment-lane=x402] AGENT paid via x402 v${FACILITATOR_VERSION} ($0.50 USDC on Base, facilitator=${FACILITATOR_URL}${txHint}${payerHint}) — ${req.method} ${req.originalUrl}`);
      next();
    };
    if (lane.method === "GET") app.get(lane.path, handler);
    else app.post(lane.path, handler);
  }
}
