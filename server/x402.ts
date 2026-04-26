import type { Express, Request, Response, NextFunction } from "express";
import { paymentMiddleware, type Network, type RoutesConfig } from "x402-express";
import type { FacilitatorConfig } from "x402/types";

const PAY_TO_ADDRESS = "0x857aca6A8A743C9262d64819D239f509a1Cd0A85" as `0x${string}`;
const PRICE_USDC = "$0.50";
const NETWORK: Network = "base";

const DEFAULT_FACILITATOR_URL = "https://payai.to/api/x402";
const FACILITATOR_URL = process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR_URL;

const X402_LANES: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ["GET /api/x402/detective/analyze", "APOL on-chain forensic scan: contract or wallet on Base. Returns the same JSON as the public Terminal scan."],
  ["POST /api/x402/agent/analyze", "APOL AI agent legitimacy report (LARP detector). Returns the same JSON as the public Terminal scan."],
  ["GET /api/x402/scanx", "APOL X (Twitter) handle agent verification scan. Returns the same JSON as the public Terminal scan."],
]);

export function installX402(app: Express): void {
  const facilitator: FacilitatorConfig = { url: FACILITATOR_URL as `${string}` };

  console.log(`[x402] facilitator: ${FACILITATOR_URL}`);
  console.log(`[x402] payTo: ${PAY_TO_ADDRESS} | network: ${NETWORK} | price: ${PRICE_USDC} | settlement: ERC-3009 transferWithAuthorization (gasless for merchant)`);

  const routes: RoutesConfig = {};
  for (const [routeKey, description] of X402_LANES) {
    routes[routeKey] = {
      price: PRICE_USDC,
      network: NETWORK,
      config: {
        description,
        mimeType: "application/json",
      },
    };
  }

  app.use(paymentMiddleware(PAY_TO_ADDRESS, routes, facilitator));

  app.use("/api/x402/", (req: Request, _res: Response, next: NextFunction) => {
    console.log(`[payment-lane=x402] AGENT paid via x402 ($0.50 USDC on Base, settled via ${FACILITATOR_URL}) — ${req.method} ${req.originalUrl}`);
    next();
  });
}
