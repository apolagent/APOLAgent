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
  constants.ts - SINGLE SOURCE OF TRUTH: all addresses, maps, endpoints, protocol configs (Object.freeze + as const)
  index.ts     - Express server + webhook registration + bot launcher
  routes.ts    - API endpoints + simulation engine (imports from constants.ts)
  bot.ts       - Telegram bot /scan command + simulation engine (imports from constants.ts)
  storage.ts   - Database operations (DatabaseStorage)
  db.ts        - PostgreSQL connection
client/src/    - React frontend
shared/
  schema.ts    - Drizzle ORM schemas (scanLookups table for scan counter)
```

## Simulation-First Engine
- **Two-Pass Simulation**: Micro amount (0.000001 ETH) for accurate tax isolation, then normal amount (0.001 ETH) for liquidity depth. Prevents price impact from being misreported as contract tax.
- **Single-Path Lookup**: `findBestPool` uses V3 Factory `getPool` (batch RPC) across 4 fee tiers → finds pool address
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

## Source Hierarchy (STRICT)
1. **PRIMARY ENGINE (Alchemy RPC)**: ALL simulations (buy/sell/tax), deployer detection, wallet info, balance, contract checks, treasury balance
2. **SPEED RULE**: Alchemy is for the "Report Header." If Alchemy is slow, send the report anyway
3. **SECONDARY DATA (Blockscout ONLY)**: Holder counts, top holders, contract verification status, BaseScan links
4. **SILENT FALLBACK (GoPlus)**: ONLY called when primary sources return empty/zero. Fills: holder count, honeypot, buy/sell tax, creator address. NEVER overrides successful Alchemy/Blockscout data. NO branding — completely invisible in all user-facing output
5. **NO OVERRIDES**: Never switch fallback to primary for any reason. Alchemy simulation always wins when it returns data

### Implementation:
- **Deployer detection**: Alchemy `alchemy_getAssetTransfers` (creation tx receipt) → Blockscout v2 fallback
- **Wallet info**: Alchemy RPC `eth_getBalance` + `eth_getCode` + `alchemy_getAssetTransfers` (both directions) → RPC nonce fallback
- **Contract ownership**: Direct `owner()` call via Alchemy RPC (0x8da5cb5b) — never infer renouncement from missing deployer
- **Serial deployer detection**: Alchemy `alchemy_getAssetTransfers` from deployer → Blockscout counters fallback
- **X verification**: `u.verification?.verified` (nested object in fxtwitter API), NOT `u.verified`
- **Linked CA**: DexScreener search + bio regex `0x[a-fA-F0-9]{40}`

## LP Status Detection
- Checks top 10 holders from Blockscout against LOCKER_MAP and BURN_ADDRS
- Labels: `🔥 BURNED`, `🔒 LOCKED (platform)`, `🔒 Platform Managed ✅`, `⚠️ OPEN`

## Scan Counter
- `scanLookups` table: address (unique), tokenName, tokenSymbol, lookupCount, lastScannedAt
- `storage.incrementLookup()` — upsert with `lookupCount + 1` on conflict
- Displayed as 👁️ count in Telegram output

## Agent Verification (LARP Detector)
- **On-Chain Activity Audit**: Fetches transaction count (Blockscout `/api/v2/addresses/.../counters`) + token_transfers_count. Contract age from creation tx (Blockscout) or first ERC-20 transfer block timestamp (Alchemy fallback). Activity rate = txCount / ageDays.
- **Contract Code Check**: `eth_getCode` via RPC. Bare ERC-20 (<500 bytes) = no agent logic. Complex (>5KB) = agent logic possible.
- **MCap vs Activity Mismatch**: $1M+ MCap with <10 transactions over >7 days = "NARRATIVE BLACK BOX" flag.
- **Verdict thresholds (bot)**: LARP DETECTED (honeypot or 4+ flags), SUSPICIOUS (2+ flags), INCONCLUSIVE (1 flag + 2 passes), LIKELY LEGITIMATE (3+ passes), INSUFFICIENT DATA (default).
- **Web cognition score**: speedScore(30) + traceScore(20) + contextScore(20) + socialScore(20) + logsScore(20) + activityScore(15) + codeSizeScore(10). Verdict: Digital Puppet (<21), Low Autonomy (21-40), Semi-Autonomous (41-70), Fully Autonomous (71+).
- **Caching**: DexScreener data (60s), ETH price (60s), scan results (60s), in-flight deduplication for concurrent requests.

## Bot Commands
- `/scan <CA>` — Full forensic report: protocol, honeypot, tax, LP, holders, price, mcap, risk badge, scan count
- `/scanagent <CA or name>` — Agent LARP Detector: on-chain activity audit, mind-to-wallet trace, treasury health, creator forensic, token health, verdict
- `/scanx <@handle or URL>` — X/Twitter profile forensic analysis
- `/start` — Welcome message

## API Endpoints
- `GET /health` — Health check
- `GET /api/detective/flagged` — Recently flagged addresses
- `GET /api/detective/analyze?address=&chain=` — Full forensic analysis (JSON)
- `POST /api/agent/analyze` — Agent LARP Detector (body: agentName, wallet, socialLink, claimedAbilities, logsUrl)

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
