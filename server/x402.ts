import type { Express, Request, Response, NextFunction } from "express";
import { paymentMiddleware, type Network, type RoutesConfig } from "x402-express";
import { facilitator as cdpFacilitator } from "@coinbase/x402";

const PAY_TO_ADDRESS = "0x857aca6A8A743C9262d64819D239f509a1Cd0A85" as `0x${string}`;
const PRICE_USDC = "$0.50";
const NETWORK: Network = "base";

const X402_LANES: ReadonlyArray<readonly [string, string]> = Object.freeze([
  ["GET /api/x402/detective/analyze", "APOL on-chain forensic scan: contract or wallet on Base. Returns the same JSON as the public Terminal scan."],
  ["POST /api/x402/agent/analyze", "APOL AI agent legitimacy report (LARP detector). Returns the same JSON as the public Terminal scan."],
  ["GET /api/x402/scanx", "APOL X (Twitter) handle agent verification scan. Returns the same JSON as the public Terminal scan."],
]);

export function installX402(app: Express): void {
  const hasCdpKeys = !!(process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET);
  if (!hasCdpKeys) {
    console.warn("[x402] CDP_API_KEY_ID / CDP_API_KEY_SECRET not set. x402 mainnet (Base) verification will fail until they are configured. The middleware is still mounted; agents will receive a 402 with payment requirements but settlement will error out.");
  } else {
    console.log("[x402] CDP facilitator credentials detected — x402 lane is live on Base for $0.50 USDC.");
  }

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

  app.use(paymentMiddleware(PAY_TO_ADDRESS, routes, cdpFacilitator));

  app.use("/api/x402/", (req: Request, _res: Response, next: NextFunction) => {
    console.log(`[payment-lane=x402] AGENT paid via x402 ($0.50 USDC on Base) — ${req.method} ${req.originalUrl}`);
    next();
  });
}
