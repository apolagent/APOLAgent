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

## Simulation-First Security Engine (2026 Overhaul)
- **Architecture**: Alchemy RPC simulation (Uniswap V3 QuoterV2) → Blockscout (deployer + holders + verification) → DexScreener (price/liquidity)
- **GoPlus and Honeypot.is have been REMOVED** — zero external oracle dependencies for security data
- **Simulation Engine** (`botAlchemySimulate` in bot.ts, `rpcAlchemySimulate` in routes.ts):
  - Uses Uniswap V3 QuoterV2 at `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`
  - Simulates 0.1 ETH buy (WETH→Token) then sell (Token→WETH) via `eth_call`
  - Tries all fee tiers: [500, 3000, 10000, 100]
  - Honeypot detection: sell revert = honeypot
  - Tax calculation: round-trip loss minus pool fees, split 50/50 buy/sell
  - Selector: `0xc6a5026a` (QuoterV2 `quoteExactInputSingle`)
  - Returns: `{ isHoneypot, buyTax, sellTax, simulationSuccess }`
- **Single Parallel Block** (`Promise.allSettled`):
  - bot.ts `buildSnapshot`: sim, tokenInfo, holderCount, topHolders, dexCheck, dexScreener, deployer — ALL parallel, target < 5s
  - routes.ts `/api/detective/analyze`: sim + Blockscout address + token info + holders — ALL parallel
  - No more sequential waterfall (was 75+ seconds, now < 6s)
- **Virtuals Protocol 2026 Identity**:
  - VIRTUAL token: `0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b`
  - ERC-8183 Vault: `0xdad686299fb562f89e55da05f1d96fabeb2a2e32`
  - If paired with VIRTUAL or matches vault → "Virtuals Protocol 🤖", bypass all risk flags
  - Labels: "Virtuals Managed (ERC-8183) 🤖" or "Virtuals Managed ✅"
- **Platform Detection** (`botResolvePlatformFast` / single-pass):
  - Checks address, deployer, and top holders against PLATFORM_LOCKERS + PLATFORM_DEPLOYERS
  - No multi-hop deployer tracing — single Blockscout call for deployer
  - Supported: ApeStore, Clanker v4, Virtuals, Flaunch
- **Holder Count**: Blockscout `/api/v2/tokens/{addr}/counters` (single call, not multi-hop)
- **Dual-DEX detection** (V3 + V4):
  - V3: Factory `0x3312...FDfD`, fee tiers [500, 3000, 10000, 100]
  - V4: PoolManager `0x4985...2b2b` via `eth_getLogs`
- **Tax override**: Factory tokens with simulated tax > 50% → tax forced to 0%
- **Bot async scanning**: All scan commands use edit-message pattern — "Analyzing..." → edit with results
- **Affected endpoints**: `/api/detective/analyze`, `/api/agent/analyze`, `/api/admin/audit`, `/api/verify/:address`, bot.ts

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
1. **Alchemy RPC Simulation** (`BASE_RPC_URL`) — Uniswap V3 QuoterV2 buy/sell simulation for honeypot/tax detection, `eth_getBalance`, `eth_call` for contract detection, token info, pool detection
2. **Internal Whitelist** — `PLATFORM_LOCKERS` + `PLATFORM_DEPLOYERS` maps (both routes.ts and bot.ts maintain copies)
3. **Blockscout API** — Deployer info, holder counts (PRIMARY via `/counters`), top holders, contract verification status, wallet tx history
4. **DexScreener** — Price, market cap, liquidity data
5. **Internal Reports** — APOL database for flagged wallets (replaces GoPlus address_security)

## Secrets
- `APOL_BOT_TOKEN` - Telegram bot token
- `BASE_RPC_URL` - Alchemy Base RPC endpoint (contract detection + token info fallback)
- `MORALIS_API_KEY` - Moralis Web3 API (wallet forensics)
- `BASESCAN_API_KEY` - Basescan explorer links
- `CHAINABUSE_API_KEY` - ChainAbuse threat reports
- `RAPIDAPI_KEY` - RapidAPI (X/Twitter forensics)
- `SESSION_SECRET` - Express session secret
