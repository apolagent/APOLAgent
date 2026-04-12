# APOL Agent — On-Chain Security Forensics Skill

## Overview

APOL Agent is an autonomous on-chain security forensics protocol on Base chain. It detects rugs, honeypots, serial deployers, and fake AI agents using simulation-first analysis (Alchemy RPC + Uniswap V3 QuoterV2).

Use this skill to scan any Base chain contract address for security risks, verify AI agent authenticity, or deep-scan X/Twitter profiles linked to crypto projects.

## Base URL

```
https://apolagent.online
```

## Capabilities

1. **Contract Security Scan** — Detect honeypots, hidden taxes, LP lock status, top holders, ownership risks, and admin threats for any Base chain token.
2. **AI Agent Verification (LARP Detector)** — Determine if a token's claimed AI agent is real or fake by analyzing on-chain activity, contract code, social presence, and reasoning logs.
3. **X/Twitter Profile Forensics** — Deep scan any X/Twitter profile for bot indicators, engagement manipulation, and linked contract addresses.
4. **Serial Deployer Detection** — Flag creators who have launched 3+ tokens within 2 days.
5. **Clanker Token Analysis** — Enhanced data for Clanker-deployed tokens including volume, rewards, and protocol verification.

## API Endpoints

### 1. Contract Security Scan

Scan a Base chain contract address for security risks.

```
GET /api/detective/analyze?address={contractAddress}&chain=base
```

**Parameters:**
- `address` (required): Base chain contract address (0x...)
- `chain` (optional): Chain name, defaults to "base"

**Response fields:**
- `tokenName`, `tokenSymbol` — Token identity
- `buyTax`, `sellTax` — Tax percentages (0 = clean)
- `isHoneypot` — true if sell is blocked
- `riskLevel` — "LOW RISK", "MEDIUM RISK", "HIGH RISK", "CRITICAL"
- `apolVerdict` — Human-readable security assessment
- `redFlags` — Array of detected risk indicators
- `adminThreats` — Array of admin-level security threats with severity
- `isKnownFactory` — true if deployed by known protocol (Clanker, Virtuals, etc.)
- `creatorAddress` — Deployer wallet address
- `topHolders` — Top holder distribution with tags
- `lpLockedPercent` — Liquidity lock percentage

**Example:**
```
GET /api/detective/analyze?address=0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed&chain=base
```

### 2. AI Agent Verification (LARP Detector)

Verify if a claimed AI agent is legitimate or a LARP (fake).

```
POST /api/agent/analyze
Content-Type: application/json
```

**Body:**
- `agentName` (required): Name of the agent to verify
- `wallet` (optional): Base chain contract address (0x...)
- `socialLink` (optional): X/Twitter profile URL
- `claimedAbilities` (optional): Comma-separated abilities the agent claims
- `logsUrl` (optional): URL to public reasoning logs

**Response fields:**
- `verdict` — "Fully Autonomous", "Semi-Autonomous", "Unverified", "Confirmed LARP", "Under Review", "Insufficient Data"
- `cognitionScore` — 0-100 authenticity score
- `apolVerdict` — Detailed human-readable assessment
- `contractScan` — Embedded contract security data (honeypot, tax, holders, LP)
- `platformName` — Detected launch platform (Clanker, Virtuals, Flaunch, etc.)
- `clankerData` — Clanker-specific data (volume24h, rewardsAvailable, warnings) if applicable
- `serialDeployer` — Serial deployer warning (recentCount, windowDays, recentTokens) if detected
- `twitterHandle` — Linked X/Twitter handle if found
- `abilityAudit` — Analysis of claimed vs verified abilities

**Example:**
```json
{
  "agentName": "MyAgent",
  "wallet": "0x1234567890abcdef1234567890abcdef12345678"
}
```

### 3. X/Twitter Profile Scan

Deep forensic scan of an X/Twitter profile.

```
GET /api/scanx?username={handle}
```

**Parameters:**
- `username` (required): X/Twitter handle (with or without @) or full URL

**Response fields:**
- `username`, `displayName`, `bio` — Profile identity
- `followers`, `following`, `followRatio` — Social metrics
- `ageDays` — Account age in days
- `engagement` — Engagement analysis (rating, avgLikes, avgRetweets)
- `flags` — Array of suspicious indicators
- `verdict` — Security verdict with color level
- `verdictLevel` — "green", "yellow", "red"
- `linkedCA` — Linked contract address if found in bio/pinned
- `linkedSymbol` — Linked token symbol if found
- `agentAbilities` — Detected AI agent ability claims
- `reasoningStatus` — "verified", "not_found", "mismatch", "no_source"

**Example:**
```
GET /api/scanx?username=elikitatoken
```

## Usage Instructions for AI Agents

When a user asks you to check if a token is safe, scan a contract, or verify an AI agent:

1. **For contract addresses** (starts with 0x, 42 chars): Use endpoint #1 (Contract Security Scan)
2. **For AI agent verification**: Use endpoint #2 (Agent Verification) with the wallet address
3. **For X/Twitter profile checks**: Use endpoint #3 (X/Twitter Scan)

### Interpreting Results

**Contract Scan Risk Levels:**
- `LOW RISK` — No major issues detected
- `MEDIUM RISK` — Some concerns, proceed with caution
- `HIGH RISK` — Multiple red flags detected
- `CRITICAL` — Honeypot or severe security threat

**Agent Verdicts:**
- `Fully Autonomous` — Strong evidence of real AI operation
- `Semi-Autonomous` — Mixed signals, some automation detected
- `Unverified` — Cannot confirm autonomous operation
- `Confirmed LARP` — Evidence of fake/manual operation

**Key red flags to highlight:**
- `isHoneypot: true` — Token cannot be sold
- `buyTax > 5%` or `sellTax > 5%` — Excessive taxes
- `serialDeployer` present — Creator launching tokens rapidly (rug pattern)
- `lpLockedPercent < 50` — Liquidity not secured
- `verdict: "Confirmed LARP"` — Agent is fake

### Response Format

When reporting results to users, include:
1. Token name and symbol (if contract scan)
2. Risk level or verdict
3. Key findings (taxes, honeypot status, LP lock)
4. Any red flags or warnings
5. Link to full report: `https://apolagent.online/agent-scanner`

## Rate Limits

- No API key required
- Please limit requests to reasonable usage (< 60 per minute)
- On-chain analysis may take 5-15 seconds per scan

## Links

- Website: https://apolagent.online
- Telegram Bot: https://t.me/ApolAgentBot
- Twitter: https://x.com/ApolAgent_
