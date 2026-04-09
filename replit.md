# APOL Agent - Autonomous Onchain Forensics

## Overview
APOL Agent is an autonomous on-chain forensics protocol on Base blockchain. Telegram bot + Express web service. Simulation-First engine — zero GoPlus, zero Honeypot.is.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Telegram Bot**: Telegraf in **webhook mode**. Webhook endpoint: `/bot-webhook-{token}` on `apolagent.online`
- **State Management**: TanStack React Query

## Project Structure
```
server/
  index.ts    - Express server + webhook registration + bot launcher
  routes.ts   - API endpoints + simulation engine (rpcAlchemySimulate)
  bot.ts      - Telegram bot /scan command + simulation engine (botAlchemySimulate)
  storage.ts  - Database operations (DatabaseStorage)
  db.ts       - PostgreSQL connection
client/src/   - React frontend
shared/
  schema.ts   - Drizzle ORM schemas (scanLookups table for scan counter)
```

## Simulation-First Engine
- **Single-Path Lookup**: `findBestPool` uses V3 Factory `getPool` (batch RPC) across 4 fee tiers → finds pool address → runs ONE buy + ONE sell simulation
- **QuoterV2**: `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a`, selector `0xc6a5026a`
- **V3 Factory**: `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` (Base)
- **WETH**: `0x4200000000000000000000000000000000000006`
- **Simulation**: 0.1 ETH buy → sell. Sell revert = honeypot. Round-trip loss minus pool fees = net tax (split 50/50)
- **Price**: Derived from simulation — `0.1 ETH / (tokensReceived / 10^decimals)` × ETH/USD (DexScreener)
- **MCap**: `price × totalSupply`
- **Timeout**: 10s hard timeout via `Promise.race` wrapping `Promise.allSettled`
- **Batch RPC**: `rpcBatch` sends multiple `eth_call` in a single HTTP request

## Platform Detection
- **Virtuals**: token `0x0b3e...7e1b`, vault `0xdad6...2e32`, deployer `0x97cf...0a3` → taxes forced to 0
- **Clanker**: factory `0xe85a...83a9`, locker `0xf362...5d68`, deployer `0xd466...1bd3`
- **ApeStore**: factory `0x0bf8...f58a`, deployer `0xade2...1f6f`, factory `0xb3be...dabf`, router `0x5c93...6cf7`
- **Flaunch**: deployer `0x6a53...9571`
- Checks: address → deployer → top holders (single-pass)

## Data Source Priority
- **Deployer detection**: Blockscout v2 → Alchemy `alchemy_getAssetTransfers` (creation tx receipt) → Blockscout v1
- **Wallet info**: RPC `eth_getBalance` + Blockscout v2 → Alchemy `alchemy_getAssetTransfers` (both directions) → Blockscout counters → RPC nonce
- **Contract ownership**: Direct `owner()` call (0x8da5cb5b) — never infer renouncement from missing deployer
- **X verification**: `u.verification?.verified` (nested object in fxtwitter API), NOT `u.verified`
- **Linked CA**: DexScreener search + bio regex `0x[a-fA-F0-9]{40}`

## LP Status Detection
- Checks top 10 holders from Blockscout against LOCKER_MAP and BURN_ADDRS
- Labels: `🔥 BURNED`, `🔒 LOCKED (platform)`, `🔒 Platform Managed ✅`, `⚠️ OPEN`

## Scan Counter
- `scanLookups` table: address (unique), tokenName, tokenSymbol, lookupCount, lastScannedAt
- `storage.incrementLookup()` — upsert with `lookupCount + 1` on conflict
- Displayed as 👁️ count in Telegram output

## Bot Commands
- `/scan <CA>` — Full forensic report: protocol, honeypot, tax, LP, holders, price, mcap, risk badge, scan count
- `/start` — Welcome message

## API Endpoints
- `GET /health` — Health check
- `GET /api/detective/flagged` — Recently flagged addresses
- `GET /api/detective/analyze?address=&chain=` — Full forensic analysis (JSON)

## Telegram Output Format
```
🛡️ APOL FORENSIC REPORT
────────────────────────────
🏷 TokenName ($TICKER) 👁️ 5
📍 0xaddr...1234 · Base
🔗 Protocol: Uniswap V3 (0.05%)
🍯 Honeypot: NO ✅
💰 Tax: Buy 0% / 0% ✅
💧 Liquidity: 🔒 LOCKED (Clanker)
👥 Holders: 12,345
💵 Price: $0.000451
📊 MCap: $1.23M
🟢 LOW RISK
⚡ 2.1s · Alchemy Simulation Engine
```

## Key Configuration
- **Colors**: #000000 / #FFFFFF / #00FF00 — terminal aesthetic
- **Domain**: apolagent.online
- **Bot**: Webhook registered in production only

## Secrets
- `APOL_BOT_TOKEN` - Telegram bot token
- `BASE_RPC_URL` - Alchemy Base RPC endpoint
- `SESSION_SECRET` - Express session secret
