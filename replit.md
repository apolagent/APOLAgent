# APOL Agent - Autonomous Onchain Forensics

## Overview
APOL Agent is an autonomous on-chain forensics protocol on Base blockchain. It features contract scanning, wallet forensics, AI agent verification (LARP detection), X/Twitter social forensics, scam reporting, builder verification, and community intelligence. Powered by the $APOL token.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Telegram Bot**: Telegraf in **webhook mode** (not polling) — eliminates 409 conflicts during deployments. Webhook endpoint: `/bot-webhook-{token_suffix}` on `apolagent.online`
- **Routing**: wouter (frontend), Express routes (backend)
- **State Management**: TanStack React Query

## Project Structure
```
client/src/
  pages/
    home.tsx              - Main landing page with all sections
    report-scam.tsx       - Scam reporting + detective service
    agent-scanner.tsx     - AI agent LARP detection scanner
    verified-builders.tsx - Verified project registry
    get-verified.tsx      - Verification application form
    verify-certificate.tsx - On-chain verification certificate
    admin-dashboard.tsx   - Admin panel (wallet-gated)
  components/
    navigation.tsx       - Top nav with logo and menu
    hero-section.tsx     - Hero banner
    mission-section.tsx  - Mission statement cards
    tokenomics-section.tsx - Token details
    channel-section.tsx  - Channel info
    roadmap-section.tsx  - 4-phase roadmap
    join-section.tsx     - Social links (Telegram, X, etc.)
    footer.tsx           - Footer with disclaimer
    apol-agent.tsx       - Chat widget (knowledge base)
    recently-flagged.tsx - Flagged addresses feed
    ui/                  - shadcn/ui components (do not edit)
server/
  index.ts    - Express server setup + bot launcher
  routes.ts   - API endpoints + detective verdicts
  bot.ts      - Telegram bot commands (scan, scanagent, checkwallet, scanx)
  storage.ts  - Database operations (DatabaseStorage)
  db.ts       - PostgreSQL connection
shared/
  schema.ts   - Drizzle ORM schemas, Zod validation, TypeScript types
```

## Key Configuration
- **Colors**: #000000 / #FFFFFF / #00FF00 only — terminal aesthetic
- **Font**: JetBrains Mono everywhere, `font-meme` = JetBrains Mono bold weight 800
- **Admin wallet**: `0x857aca6A8A743C9262d64819D239f509a1Cd0A85`
- **Domain**: apolagent.online
- **Bot**: Only starts in production (`NODE_ENV=production` or `REPL_DEPLOYMENT`)

## API Endpoints
- `GET /health` - Service health check
- `GET/POST /api/scam-reports` - Scam reports CRUD
- `POST /api/detective/analyze` - Detective service (contract + wallet scan)
- `GET /api/detective/flagged` - Recently flagged addresses
- `POST /api/verified-projects` - Submit verification application
- `GET /api/verified-projects` - List verified projects
- `POST /api/agent/analyze` - Agent LARP detection scan

## LP Detection — Protocol Security Override (Blockscout Deployer Tracing)
- **3-layer forensics** (in `resolveProtocolLocker` function, `server/routes.ts`):
  1. **Direct match**: Check GoPlus `creator_address` and `lp_holders` against `PLATFORM_LOCKERS`
  2. **Deployer tracing**: For each LP holder contract, query Blockscout API (`/api/v2/addresses/{addr}`) to get `creator_address_hash`, then check against `PLATFORM_DEPLOYERS`
  3. **Creator tracing**: If no LP match, check the token creator's deployer against `PLATFORM_DEPLOYERS`
- **PLATFORM_LOCKERS** (factory/locker contract addresses):
  - `0x0bf8...f58a` — ApeStore → "ApeStore Managed"
  - `0xe85a...83a9` — Clanker V4 Factory → "Clanker v4"
  - `0xf362...5d68` — Clanker Locker → "Clanker v4"
  - `0x0b3e...7e1b` — Virtuals Protocol → "Virtuals"
  - `0xdad6...2e32` — Virtuals Vault → "Virtuals"
- **PLATFORM_DEPLOYERS** (EOAs that deploy per-token locker contracts):
  - `0xade2...1f6f` → "ApeStore Managed" (deploys ApeStore factory + per-token lockers)
  - `0xd466...1bd3` → "Clanker v4" (deploys Clanker locker + SingletonLpLocker/MultipleLpLockerUniV3)
  - `0x97cf...0a3` → "Virtuals" (deploys Virtuals Protocol)
  - `0xdad6...2e32` → "Virtuals" (Virtuals Vault — Live on Uniswap V3)
- **Why deployer tracing**: GoPlus never exposes factory addresses directly for V3/V4 tokens. LP holders are per-token locker contracts (e.g., SingletonLpLocker) created by platform deployer EOAs.
- **Virtuals PRE-GoPlus bypass** (fixes false 99% tax/honeypot):
  - In `directGoPlus` (bot.ts) and `/api/detective/analyze` (routes.ts), Virtuals pairing check runs BEFORE GoPlus API call
  - If `isVirtualsPair` or address matches ERC-8183 vault `0xdad6...2e32`, returns immediately: `isHoneypot: false`, `buyTax: 0`, `sellTax: 0`, `riskLevel: "Clean"`
  - GoPlus is NEVER called for Virtuals tokens — eliminates false 99% tax and honeypot flags entirely
  - Also matches tokens created by Virtuals factory `0x0b3e...7e1b` or deployer `0x97cf...0a3`
  - For Virtuals-origin tokens: clears LP/holder/hidden-owner flags, forces risk to Clean
  - For Virtuals contract addresses themselves: also clears GoPlus false-positive honeypot/mint flags
- **Override behavior**: When protocol match found:
  - `isSecure = true`, LP shown as "Protocol Managed"
  - Risk level forced to Clean (unless honeypot or killer tax for non-factory contracts)
- **Tax override**: If a factory-origin token has simulated buy/sell tax > 50% (Direct-to-V3 simulation failure), tax is forced to 0 and `taxOverride` field is set to the platform name. UI/bot shows "Tax: Protocol Managed (Virtuals)" instead of the false 99%.
- **Holder count (Blockscout forced)**: `botFetchHolderCount` and `fetchHolderCountFallback` always return a number (0 on failure), never null. Primary source is Blockscout `/api/v2/tokens/{addr}/counters`.
- **Response fields**: `protocolSecured: true`, `isKnownFactory: true`, `holderCount`, `lpEscrow: { name, address, percent }`, `contractScan.protocolLocker`
- **Risk hierarchy**: Honeypot or sell_tax > 20% → forced High Risk even if protocol-secured (except for Virtuals contract addresses)
- **Bot async scanning**: All scan commands (`/scan`, `/checkwallet`, `/scanagent`, `/scanx`) use edit-message pattern — send "Analyzing..." immediately, then edit with results. 60s timeout. On edit failure, deletes loading message and sends reply.
- **Used in**: `/api/detective/analyze`, `/api/agent/analyze` (contractScan), `/api/admin/audit`, `/api/verify/:address`, `bot.ts`

## Alchemy-First Security Engine (Dual-DEX: V3 + V4)
- **Architecture**: Alchemy RPC (Dual-DEX pool + bytecode + whitelist) → Blockscout (deployer trace + holders) → GoPlus → Honeypot.is
- **Alchemy is the FIRST call**: For ALL Base scans, Alchemy `eth_getCode`, `rpcGetDeployer`, and `rpcCheckDualDex` (V3+V4 parallel) run as the very first step
- **Dual-DEX detection**:
  - V3: Queries Base V3 Factory (`0x3312...FDfD`) for `getPool(tokenA, WETH, fee)` across 4 fee tiers (500, 3000, 10000, 100)
  - V4: Queries V4 PoolManager (`0x4985...2b2b`) via `eth_getLogs` filtering by token address as topic2 or topic3
  - `rpcCheckDualDex` / `botCheckDualDex` run both in parallel, V4 takes priority if both found
- **Live Reporting labels**:
  - `liveStatus`: "Live (Direct-to-V3) ✅" or "Live (Direct-to-V4) ✅" — set IMMEDIATELY before Blockscout/GoPlus
  - `lpStatus`: "[Platform Name] Managed ✅" or ERC-8183 label — or "Secured ✅"/"Unlocked ⚠️"
  - `dexVersion`: "v3" | "v4" | null — new field in all responses
- **ERC-8183 Vault detection** (`resolveVirtualsLabel` / `botResolveVirtualsLabel`):
  - Vault address: `0xdad686299fb562f89e55da05f1d96fabeb2a2e32`
  - If Virtuals platform + vault is creator or LP holder → `lpStatus: "Virtuals Managed (ERC-8183) 🤖"`
  - Otherwise Virtuals tokens → `lpStatus: "Virtuals Managed ✅"`
- **Whitelist Supremacy**: If Alchemy `getCode` + deployer match whitelist → INSTANTLY return Clean + Protocol Managed. GoPlus/Honeypot.is NEVER called
- **Holder count fallback with Alchemy balanceOf**: If Blockscout returns 0 holders, Alchemy `balanceOf` probes top 5 addresses → "Scanning (High Activity)" or "Awaiting Indexer"
- **2-hop deployer tracing**: Blockscout traces token → deployer → deployer's deployer to match factory origins
- **Non-whitelisted tokens**: GoPlus + Honeypot.is used, but dual-DEX check still runs via Alchemy; holder count is Blockscout-first
- **Bot async pre-check**: `/scan` fires dual-DEX + tokenInfo as IIFE. If completes in <4s, updates loading message with quick V3/V4 status
- **Tax override**: Factory tokens with simulated tax > 50% → tax forced to 0%

## Brand Protection (Strict Identity)
- Official APOL CA: TBA (no contract address exists yet)
- Official Twitter: `@ApolAgent_`
- ANY token using the APOL name is flagged as SCAM — APOL does not have a contract address
- Both web API and Telegram bot enforce this check

## Wallet Forensics (Enhanced)
- **Current Balance**: Direct `eth_getBalance` via Alchemy RPC (real-time, not indexed)
- **Activity Math**: Fetches txlist from Blockscout, loops to calculate:
  - Inflow: Sum of tx `value` where `to` = scanned wallet
  - Outflow: Sum of tx `value` where `from` = scanned wallet
  - Level: >50 txs = High, 10-50 = Moderate, <10 = Low
- **Funding Source**: First transaction trace (who funded the wallet)
- **Genesis Data**: Creation tx hash and creator address from Blockscout
- All 4 forensic calls (Balance, Genesis, Funding, Activity) run in parallel via `Promise.all`
- Activity fetch has strict 15-second timeout; falls back to "Scanning (High Activity)" on timeout
- UI displays: Balance, Activity (txs/level/inflow/outflow), Funding Source, then APOL Verdict

## Data Sources (Priority Order)
1. **Alchemy RPC** (`BASE_RPC_URL`) — `eth_getBalance` for wallet balance, `eth_call` for contract detection, token info, balanceOf, totalSupply, pool detection, bytecode verification
2. **Internal Whitelist** — `PLATFORM_LOCKERS` + `PLATFORM_DEPLOYERS` maps (both routes.ts and bot.ts maintain copies)
3. **Blockscout API** — Deployer tracing (2-hop), holder counts (PRIMARY), top holder addresses, wallet tx history (inflow/outflow)
4. **GoPlus API** — Token security data (non-whitelisted tokens only); wallet `address_security` checks (always)
5. **Honeypot.is** — Secondary honeypot simulation (non-whitelisted tokens only)
6. **DexScreener** — Price, market cap, liquidity data

## Secrets
- `APOL_BOT_TOKEN` - Telegram bot token
- `BASE_RPC_URL` - Alchemy Base RPC endpoint (contract detection + token info fallback)
- `MORALIS_API_KEY` - Moralis Web3 API (wallet forensics)
- `BASESCAN_API_KEY` - Basescan explorer links
- `CHAINABUSE_API_KEY` - ChainAbuse threat reports
- `RAPIDAPI_KEY` - RapidAPI (X/Twitter forensics)
- `SESSION_SECRET` - Express session secret
