# APOL Agent - Autonomous Onchain Forensics

## Overview
APOL Agent is an autonomous on-chain forensics protocol on Base blockchain. Telegram bot + Express web service. Currently in CLEAN SLATE rebuild — commands being added one-by-one.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Telegram Bot**: Telegraf in **webhook mode** (not polling). Webhook endpoint: `/bot-webhook-{token}` on `apolagent.online`
- **Routing**: wouter (frontend), Express routes (backend)
- **State Management**: TanStack React Query

## Project Structure
```
server/
  index.ts    - Express server setup + webhook registration + bot launcher
  routes.ts   - API endpoints (minimal — rebuilding)
  bot.ts      - Telegram bot commands (clean slate — /scan only)
  storage.ts  - Database operations (DatabaseStorage)
  db.ts       - PostgreSQL connection
client/src/   - React frontend (unchanged)
shared/
  schema.ts   - Drizzle ORM schemas, Zod validation, TypeScript types
```

## Key Configuration
- **Colors**: #000000 / #FFFFFF / #00FF00 only — terminal aesthetic
- **Font**: JetBrains Mono everywhere
- **Admin wallet**: `0x857aca6A8A743C9262d64819D239f509a1Cd0A85`
- **Domain**: apolagent.online
- **Bot**: Webhook registered in production only (`NODE_ENV=production` or `REPL_DEPLOYMENT`)

## Current Bot Commands
- `/scan` — Connection test reply (forensic engine not yet wired)
- `/start` — Welcome message

## API Endpoints (Active)
- `GET /health` — Service health check
- `GET /api/detective/flagged` — Recently flagged addresses

## Simulation Engine Reference (to be re-added)
- Uniswap V3 QuoterV2 at `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`
- Selector: `0xc6a5026a` (quoteExactInputSingle)
- 0.1 ETH simulation, fee tiers [500, 3000, 10000, 100]
- Sell revert = honeypot; round-trip tax split 50/50
- WETH on Base: `0x4200000000000000000000000000000000000006`

## Platform Whitelist Reference (to be re-added)
- Virtuals: `0x0b3e...7e1b` (token), `0xdad6...2e32` (vault), `0x97cf...0a3` (deployer)
- Clanker v4: `0xe85a...83a9` (factory), `0xf362...5d68` (locker), `0xd466...1bd3` (deployer)
- ApeStore: `0x0bf8...f58a` (factory), `0xade2...1f6f` (deployer)

## Secrets
- `APOL_BOT_TOKEN` - Telegram bot token
- `BASE_RPC_URL` - Alchemy Base RPC endpoint
- `SESSION_SECRET` - Express session secret
