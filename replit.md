# APOL Agent - Autonomous Onchain Forensics

## Overview
APOL Agent is an autonomous on-chain forensics protocol on Base blockchain. It features contract scanning, wallet forensics, AI agent verification (LARP detection), X/Twitter social forensics, scam reporting, builder verification, and community intelligence. Powered by the $APOL token.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Telegram Bot**: Telegraf — runs only in production to avoid conflicts
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
- **PLATFORM_DEPLOYERS** (EOAs that deploy per-token locker contracts):
  - `0xade2...1f6f` → "ApeStore Managed" (deploys ApeStore factory + per-token lockers)
  - `0xd466...1bd3` → "Clanker v4" (deploys Clanker locker + SingletonLpLocker/MultipleLpLockerUniV3)
  - `0x97cf...0a3` → "Virtuals" (deploys Virtuals Protocol)
- **Why deployer tracing**: GoPlus never exposes factory addresses directly for V3/V4 tokens. LP holders are per-token locker contracts (e.g., SingletonLpLocker) created by platform deployer EOAs.
- **Virtuals early override** (`isVirtualsOrigin` + `isVirtualsContract`):
  - Matches tokens created by Virtuals factory `0x0b3e...7e1b` or deployer `0x97cf...0a3`
  - Runs BEFORE `resolveProtocolLocker` and GoPlus risk assessment
  - For Virtuals-origin tokens: clears LP/holder/hidden-owner flags, forces risk to Clean (or Caution if other real flags remain)
  - For Virtuals contract addresses themselves: also clears GoPlus false-positive honeypot/mint flags
  - Safety gate: honeypot/killer-tax flags still force High Risk for non-Virtuals-contract tokens even if Virtuals-origin
- **Override behavior**: When protocol match found:
  - `isSecure = true`, LP shown as "Protocol Managed"
  - Risk level forced to Clean (unless honeypot or killer tax for non-Virtuals contracts)
- **Holder count fallback**: If GoPlus returns 0 holders, falls back to Blockscout token counters API. Shows "Calculating..." instead of 0 on failure.
- **Response fields**: `protocolSecured: true`, `isKnownFactory: true`, `holderCount`, `lpEscrow: { name, address, percent }`, `contractScan.protocolLocker`
- **Risk hierarchy**: Honeypot or sell_tax > 20% → forced High Risk even if protocol-secured (except for Virtuals contract addresses)
- **Bot async scanning**: All scan commands (`/scan`, `/checkwallet`, `/scanagent`, `/scanx`) use edit-message pattern — send "Analyzing..." immediately, then edit with results. 60s timeout. On edit failure, deletes loading message and sends reply.
- **Used in**: `/api/detective/analyze`, `/api/agent/analyze` (contractScan), `/api/admin/audit`, `/api/verify/:address`, `bot.ts`

## Secrets
- `APOL_BOT_TOKEN` - Telegram bot token
- `MORALIS_API_KEY` - Moralis Web3 API (wallet forensics)
- `BASESCAN_API_KEY` - Basescan explorer links
- `CHAINABUSE_API_KEY` - ChainAbuse threat reports
- `RAPIDAPI_KEY` - RapidAPI (X/Twitter forensics)
- `SESSION_SECRET` - Express session secret
