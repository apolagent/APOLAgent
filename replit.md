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

## LP Detection — Protocol Secured / Direct-to-DEX (3-tier)
1. **LP Holder Match**: Checks GoPlus `lp_holders` against LAUNCHPAD_REGISTRY (Ape.store, Clanker v3/v4, Virtuals, Uniswap routers)
2. **Creator Address Match**: Falls back to checking `creator_address` against LAUNCHPAD_REGISTRY
3. **DexScreener V3/V4 Fallback**: Fetches DexScreener pairs — if highest-liquidity Base pair is V3/V4 with ≥$10K liquidity, marks as "Protocol Secured" Direct-to-DEX
- **Risk weight**: Direct-to-DEX = Zero LP risk (technically superior to manual locks)
- **Response fields**: `protocolSecured: true`, `isDirectToDex: true`, `lpEscrow: { name, address, percent }`
- **Frontend**: Green (#00FF00) "PROTOCOL SECURED — DIRECT-TO-DEX" badge with "ZERO LP RISK" tag
- **Bot**: "Protocol Secured — [name]" LP status, "PROTOCOL SECURED — DIRECT-TO-DEX" section

## Secrets
- `APOL_BOT_TOKEN` - Telegram bot token
- `MORALIS_API_KEY` - Moralis Web3 API (wallet forensics)
- `BASESCAN_API_KEY` - Basescan explorer links
- `CHAINABUSE_API_KEY` - ChainAbuse threat reports
- `RAPIDAPI_KEY` - RapidAPI (X/Twitter forensics)
- `SESSION_SECRET` - Express session secret
