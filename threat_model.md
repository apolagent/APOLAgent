# Threat Model

## Project Overview

APOL Agent is a public-facing React + TypeScript single-page app with an Express backend, a PostgreSQL database via Drizzle ORM, and a Telegram bot running in webhook mode. The production system exposes public blockchain-forensics and agent-analysis endpoints, stores scan results and subscription records, and makes many outbound requests to third-party services including Base RPC, Blockscout, DexScreener, FxTwitter, GoPlus, Clanker, and user-supplied URLs.

Production scope for this scan is the deployed Express server, static client bundle, Telegram webhook/bot flow, database-backed storage, and the Python scheduler triggered by the server. Per scan assumptions, the mockup sandbox is not production, NODE_ENV is production when deployed, and TLS is provided by the platform.

## Assets

- **Application secrets** — `APOL_BOT_TOKEN`, `BASE_RPC_URL`, `DATABASE_URL`, `SESSION_SECRET`, and any other environment secrets. Exposure would enable bot takeover, RPC abuse, or database compromise.
- **Subscription and payment records** — transaction hashes, payer wallet addresses, Telegram user bindings, payment amounts, and expiry dates. These gate paid features and could be abused for unauthorized access or user tracking.
- **Stored scan results and activity logs** — agent analysis results, reasoning-log excerpts, wallet metadata, and public activity entries. These can contain user-supplied or third-party content and must not become an exfiltration channel.
- **Service availability and API credits** — the app depends on outbound RPC and third-party APIs. Abuse of public endpoints can consume paid quotas or deny service to legitimate users.
- **Telegram bot control plane** — webhook handling and bot commands affect publicly visible output and paid-feature access.

## Trust Boundaries

- **Browser / Telegram user to Express API** — all request parameters, bodies, URLs, handles, wallet addresses, and tx hashes are attacker-controlled and must be validated server-side.
- **Express server to third-party services** — the backend fetches blockchain explorers, RPC endpoints, social/profile mirrors, and other external URLs. This boundary is high risk for SSRF, data exfiltration, and quota exhaustion.
- **Express server to PostgreSQL** — server code has write access to stored scan results, activity logs, verification state, and subscriptions.
- **Telegram webhook to bot handlers** — webhook requests must be treated as untrusted unless their origin/authenticity is established.
- **Public / paid-feature boundary** — subscription checks must reliably distinguish unpaid users from paid users for deep-dive features.
- **Production / dev-only boundary** — `server/vite.ts`, Vite dev middleware, and mockup-only assets are not production surfaces unless explicitly routed in production. Client-only admin UI code without matching server routes is not an active production auth boundary today.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/bot.ts`, `server/storage.ts`, `shared/schema.ts`, `main.py`
- **Highest-risk code areas:** public API handlers in `server/routes.ts`; Telegram webhook/payment flows in `server/index.ts` and `server/bot.ts`; result persistence and subscription lookups in `server/storage.ts`
- **Public surfaces:** `/api/detective/analyze`, `/api/agent/analyze`, `/api/agent/result/:slug`, `/api/scanx`, `/api/subscription/status`, `/api/subscription/verify`, `/skill/skill.md`, Telegram webhook route
- **Dormant / lower-priority areas:** client-only admin dashboard routes in `client/src/pages/admin-dashboard.tsx`; `users` table and user helpers exist but no production login/register HTTP routes are currently exposed

## Threat Categories

### Spoofing

The system accepts unauthenticated requests for all public analysis endpoints and uses wallet-address-based checks for subscription claiming. The bot also accepts webhook deliveries on a secret path. The application must ensure paid access cannot be claimed by someone who did not originate the payment, and webhook traffic must not be forgeable through guessable or leaked webhook identifiers.

### Tampering

User-controlled inputs such as `logsUrl`, `socialLink`, wallet addresses, Twitter handles, and transaction hashes flow into backend fetch logic, scoring logic, and stored results. The server must treat all of these values as untrusted, validate them strictly, and avoid letting attacker-controlled inputs alter internal state or outbound request targets in unsafe ways.

### Information Disclosure

The backend fetches and stores content from third-party and user-supplied URLs, then returns analysis results publicly. The application must not let public callers use backend fetches to reach internal-only services, metadata endpoints, or secrets-bearing resources, and must not expose sensitive subscription or operational data more broadly than intended.

### Denial of Service

Several public routes trigger multiple outbound RPC and API requests plus database writes. The application must enforce request throttling and bounded work so unauthenticated users cannot exhaust upstream API quotas, saturate the event loop, or degrade service with repeated heavy scans.

### Elevation of Privilege

Any path that turns public input into privileged backend behavior is relevant here: server-side URL fetching, payment verification, and bot webhook handling. The application must ensure public users cannot leverage backend network position, database persistence, or payment state transitions to gain capabilities they should not have.