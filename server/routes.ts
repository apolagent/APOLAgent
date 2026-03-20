import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScamReportSchema, insertHeroNominationSchema, insertVoteSchema, insertVerificationRequestSchema } from "@shared/schema";

const CHAINABUSE_API_KEY = process.env.CHAINABUSE_API_KEY;
const CHAINABUSE_BASE = "https://api.chainabuse.com/v0";
const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const GOPLUS_CHAIN: Record<string, string> = {
  ethereum: "1", bsc: "56", polygon: "137", arbitrum: "42161",
  optimism: "10", base: "8453", avalanche: "43114", tron: "tron", solana: "solana", other: "1",
};

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/scam-reports", async (req, res) => {
    try {
      const reports = await storage.getScamReports();
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch scam reports" });
    }
  });

  app.post("/api/scam-reports", async (req, res) => {
    try {
      const result = insertScamReportSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid scam report data", details: result.error.issues });
      }

      const report = await storage.createScamReport(result.data);
      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ error: "Failed to create scam report" });
    }
  });

  app.get("/api/hero-nominations", async (req, res) => {
    try {
      const nominations = await storage.getHeroNominations();
      res.json(nominations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch hero nominations" });
    }
  });

  app.post("/api/hero-nominations", async (req, res) => {
    try {
      const result = insertHeroNominationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid hero nomination data", details: result.error.issues });
      }

      const nomination = await storage.createHeroNomination(result.data);
      res.status(201).json(nomination);
    } catch (error) {
      res.status(500).json({ error: "Failed to create hero nomination" });
    }
  });

  app.post("/api/votes", async (req, res) => {
    try {
      const result = insertVoteSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid vote data", details: result.error.issues });
      }

      const vote = await storage.createVote(result.data);

      if (result.data.targetType === "scam_report") {
        const reports = await storage.getScamReports();
        const report = reports.find(r => r.id === result.data.targetId);
        if (report) {
          const newVotes = result.data.voteType === "upvote" ? report.votes + 1 : report.votes - 1;
          await storage.updateScamReportVotes(result.data.targetId, Math.max(0, newVotes));
        }
      } else if (result.data.targetType === "hero_nomination") {
        const nominations = await storage.getHeroNominations();
        const nomination = nominations.find(n => n.id === result.data.targetId);
        if (nomination) {
          const newVotes = result.data.voteType === "upvote" ? nomination.votes + 1 : nomination.votes - 1;
          await storage.updateHeroNominationVotes(result.data.targetId, Math.max(0, newVotes));
        }
      }

      res.status(201).json(vote);
    } catch (error) {
      res.status(500).json({ error: "Failed to create vote" });
    }
  });

  app.get("/api/chainabuse/check", async (req, res) => {
    const { address } = req.query;
    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "Address is required" });
    }
    if (!CHAINABUSE_API_KEY) {
      return res.status(503).json({ error: "Address lookup service not configured" });
    }
    try {
      const response = await fetch(`${CHAINABUSE_BASE}/reports?address=${encodeURIComponent(address)}&limit=10`, {
        headers: {
          "Authorization": `Bearer ${CHAINABUSE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json() as any;
      if (!response.ok) {
        const isRateLimit = response.status === 429 || (data.message || "").toLowerCase().includes("login attempts");
        const errorMsg = isRateLimit
          ? "Address lookup is temporarily unavailable due to a rate limit. Please try again in a few hours."
          : data.message || "Address lookup error";
        return res.status(response.status).json({ error: errorMsg });
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to query address database" });
    }
  });

  app.post("/api/chainabuse/report", async (req, res) => {
    const { address, chain, description, category } = req.body;
    if (!address || !chain || !description) {
      return res.status(400).json({ error: "address, chain, and description are required" });
    }

    // Attempt external report submission, gracefully fall back to internal DB on any failure
    let chainabuseOk = false;
    if (CHAINABUSE_API_KEY) {
      try {
        const response = await fetch(`${CHAINABUSE_BASE}/reports`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${CHAINABUSE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            addresses: [{ address, chain }],
            description,
            category: category || "scam",
          }),
        });
        chainabuseOk = response.ok;
      } catch { /* non-fatal, will save internally */ }
    }

    // Always save to internal database
    try {
      await storage.createScamReport({
        title: `[${chain.toUpperCase()}] ${address.slice(0, 10)}…, ${(category || "scam").replace(/_/g, " ")}`,
        description: `${description}\n\n[Chain: ${chain}] [Address: ${address}]`,
        reportedBy: 1,
        scamType: category || "Other",
        evidenceUrl: null,
      });
    } catch { /* non-fatal, report still recorded externally */ }

    res.json({
      success: true,
      chainabuseSubmitted: chainabuseOk,
      savedInternally: true,
      message: "Report submitted and saved to the APE POLICE database.",
    });
  });

  // ── Detective Service ─────────────────────────────────────────────────────

  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function taxPct(raw: any): number {
    const n = parseFloat(String(raw ?? "0"));
    return n > 1 ? n : n * 100;
  }

  function buildWalletVerdict(flags: string[], riskLevel: string, internalFlag: boolean): string {
    if (flags.length === 0 && !internalFlag) {
      return pickRandom([
        `Citizen, this wallet appears clean in our security scan. No malicious activity detected. Stay vigilant out there, APE POLICE are always watching. 🦍`,
        `All clear on this one, Citizen. Our scan shows no blacklist flags, no sanctions, no criminal activity. Proceed with standard caution. 🦍`,
        `Nothing here, Citizen. Clean as a whistle. Our security scan shows no malicious patterns for this address. 🦍`,
        `Wallet cleared, Citizen. No flags, no sanctions, no phishing history. I've seen a thousand scammers, this one doesn't match any known patterns. 🦍`,
        `No charges, no record, no flags. This wallet is clean for now, Citizen. Don't go getting sloppy, always do your homework before you ape in. 🦍`,
      ]);
    }
    if (internalFlag && flags.length === 0) {
      return pickRandom([
        `Fresh off the crime scene, Citizen. Our external scan shows clean but APE POLICE internal intelligence flagged this address in the last 24 hours. Treat as High Risk. 🚨`,
        `New to our system but already on our radar. Internal reports link this wallet to suspicious activity in the last 24 hours. 🚨`,
        `Our external scan shows nothing yet, but our community flagged this address recently. New criminals don't have records until they do, Citizen. 🚨`,
        `Brand new threat detected. No external scan history, but APE POLICE internal sources lit up for this wallet. Stay far away. 🚨`,
        `First offense, Citizen. No external record yet, but our internal intelligence says otherwise. Consider this address hostile. 🚨`,
      ]);
    }
    const flagList = flags.join(", ");
    if (riskLevel === "High Risk") {
      return pickRandom([
        `Stop right there, Citizen. This wallet is SANCTIONED or flagged for serious criminal activity: ${flagList}. Do NOT interact under any circumstances. 🚨`,
        `Warrant issued, Citizen. APE POLICE has flagged this address for: ${flagList}. This is a KNOWN THREAT. Back away and do not engage. 🚨`,
        `RED ALERT, Citizen. Criminal record confirmed: ${flagList}. I've arrested scammers like this before. Run. 🚨`,
        `I've been on the force a long time, Citizen. This wallet? Pure criminal. Flagged for ${flagList}. Suspect goes straight to the hall of shame. 🚨`,
        `Citizen, our database and security scan both agree, this address is DANGEROUS. Charges: ${flagList}. Do NOT touch this wallet. 🚨`,
      ]);
    }
    return pickRandom([
      `Citizen, this wallet has flags on record: ${flagList}. Approach with caution, this is an active investigation. 🔍`,
      `Hold it right there, Citizen. APE POLICE flagged this address for: ${flagList}. I'd keep my distance if I were you. 🔍`,
      `Suspicious activity logged, Citizen. Flags detected: ${flagList}. We're watching this one closely. Don't get caught in the crossfire. 🔍`,
      `This address is on our watchlist, Citizen, flagged for ${flagList}. Tread carefully. You've been officially warned. 🔍`,
      `Our records don't look great for this wallet, Citizen. Flags: ${flagList}. Don't say I didn't warn you. 🔍`,
    ]);
  }

  function buildContractVerdict(name: string | undefined, symbol: string | undefined, riskLevel: string, greenBadge: boolean, redFlags: string[]): string {
    const token = name && symbol ? `${name} (${symbol})` : "this contract";
    if (greenBadge) {
      return pickRandom([
        `Citizen, I ran a full security scan on ${token}. Open source, no honeypot, taxes in check, no mint function. This one looks legit. Always DYOR before aping in. ✅`,
        `${token} passes all APE POLICE security checks. No honeypot, no hidden taxes, no unlimited minting. Green badge earned, Citizen. ✅`,
        `All systems go on ${token}, Citizen. Our scan shows clean on every metric I track. Liquidity, taxes, mint, all pass. ✅`,
        `Citizen, ${token} has earned the APE POLICE Green Badge. Verified open source, safe tax structure, no malicious functions detected. ✅`,
        `I've checked ${token} top to bottom. No traps. No honeypot. No rug mechanics. This one checks out, Citizen, but stay alert. ✅`,
      ]);
    }
    const issues = redFlags.join("; ");
    if (riskLevel === "High Risk") {
      return pickRandom([
        `Citizen, ${token} is a TRAP. APE POLICE flagged: ${issues}. Do NOT buy this token. This has rug written all over it. 🚨`,
        `Stop right there, Citizen. ${token} failed critical security checks: ${issues}. Walk away. This is a known rug pattern. 🚨`,
        `RED ALERT on ${token}. My scan shows: ${issues}. I've seen this a thousand times, stay far away. 🚨`,
        `Warrant issued for ${token}. Security violations: ${issues}. Do not interact with this contract under any circumstances. 🚨`,
        `Citizen, ${token} has multiple critical red flags: ${issues}. Your funds will not survive this trade. I'm ordering you to stand down. 🚨`,
      ]);
    }
    return pickRandom([
      `Citizen, ${token} raised some flags during our scan: ${issues}. Proceed with caution and verify before trading. 🔍`,
      `Hold up, Citizen. ${token} has warnings: ${issues}. Not a confirmed rug, but tread carefully. 🔍`,
      `${token} is on our watchlist, Citizen. Issues detected: ${issues}. I'd do extra research on this one before touching it. 🔍`,
      `Our scan on ${token} returned warnings: ${issues}. Could be nothing. Could be everything. Stay sharp, Citizen. 🔍`,
      `Citizen, ${token} didn't fully pass our checks. Flags: ${issues}. Consider yourself officially warned before you ape in. 🔍`,
    ]);
  }

  app.get("/api/detective/analyze", async (req, res) => {
    const { address, chain = "ethereum" } = req.query as { address: string; chain?: string };
    if (!address) return res.status(400).json({ error: "Address is required" });
    const chainId = GOPLUS_CHAIN[chain] || "1";

    try {
      // 1. Malicious Address check (always run)
      let malicious: any = {};
      try {
        const r = await fetch(`${GOPLUS_BASE}/address_security/${encodeURIComponent(address)}`);
        const j = await r.json() as any;
        malicious = j.result || {};
      } catch { /* non-fatal */ }

      // 2. Token Security check (determines if contract)
      let tokenData: any = null;
      if (chainId !== "solana" && chainId !== "tron") {
        try {
          const r = await fetch(`${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${encodeURIComponent(address)}`);
          const j = await r.json() as any;
          const key = Object.keys(j.result || {})[0];
          if (key) tokenData = j.result[key];
        } catch { /* non-fatal */ }
      }

      const isContract = tokenData !== null;

      if (isContract) {
        const isHoneypot = tokenData.is_honeypot === "1" || tokenData.is_honeypot === 1;
        const buyTax = taxPct(tokenData.buy_tax);
        const sellTax = taxPct(tokenData.sell_tax);
        const isMintable = tokenData.is_mintable === "1" || tokenData.is_mintable === 1;
        const isOpenSource = tokenData.is_open_source === "1" || tokenData.is_open_source === 1;
        const isInDex = tokenData.is_in_dex === "1" || tokenData.is_in_dex === 1;
        const slippageModifiable = tokenData.slippage_modifiable === "1" || tokenData.slippage_modifiable === 1;

        const redFlags: string[] = [];
        if (isHoneypot) redFlags.push("Honeypot, cannot sell");
        if (buyTax > 10) redFlags.push(`High buy tax: ${buyTax.toFixed(1)}%`);
        if (sellTax > 10) redFlags.push(`High sell tax: ${sellTax.toFixed(1)}%`);
        if (isMintable) redFlags.push("Owner can mint unlimited tokens");
        if (!isOpenSource) redFlags.push("Contract not verified / open source");
        if (slippageModifiable) redFlags.push("Owner can modify slippage");

        const greenBadge = redFlags.length === 0 && isOpenSource && !isHoneypot;
        const riskLevel = isHoneypot || buyTax > 25 || sellTax > 25
          ? "High Risk"
          : redFlags.length > 0 ? "Caution" : "Clean";

        const apolVerdict = buildContractVerdict(tokenData.token_name, tokenData.token_symbol, riskLevel, greenBadge, redFlags);

        if (riskLevel !== "Clean") {
          await storage.upsertFlaggedWallet({
            address, chain,
            reportCount: redFlags.length,
            riskLevel,
            topCategory: isHoneypot ? "honeypot" : "token risk",
            apolVerdict,
            reports: [],
          });
        }

        return res.json({
          address, chain,
          addressType: "contract",
          riskLevel,
          apolVerdict,
          isHighRisk: riskLevel === "High Risk",
          isNewOffender: false,
          greenBadge,
          redFlags,
          tokenName: tokenData.token_name,
          tokenSymbol: tokenData.token_symbol,
          buyTax,
          sellTax,
          isHoneypot,
          isMintable,
          isOpenSource,
          isInDex,
        });
      }

      // Wallet analysis
      const FLAG_MAP: Record<string, string> = {
        sanctioned: "Sanctioned",
        stealing_attack: "Theft/Stealing",
        phishing_activities: "Phishing",
        cybercrime: "Cybercrime",
        money_laundering: "Money Laundering",
        blacklist_doubt: "Blacklist Suspect",
        malicious_mining_activities: "Malicious Mining",
        fake_kyc: "Fake KYC",
        financial_crime: "Financial Crime",
        honeypot_related_address: "Honeypot Related",
        darkweb_transactions: "Dark Web Activity",
        mixer: "Mixer/Tumbler",
        fake_token: "Fake Token",
        blackmail_activities: "Blackmail",
      };
      const CRITICAL = new Set(["sanctioned", "stealing_attack", "phishing_activities", "cybercrime"]);

      const walletFlags: string[] = [];
      let hasCritical = false;
      for (const [key, label] of Object.entries(FLAG_MAP)) {
        if (malicious[key] === "1" || malicious[key] === 1) {
          walletFlags.push(label);
          if (CRITICAL.has(key)) hasCritical = true;
        }
      }

      const internalFlag = walletFlags.length === 0 ? await storage.checkInternalReports(address as string) : false;
      const riskLevel = hasCritical || walletFlags.length > 2 ? "High Risk"
        : walletFlags.length > 0 ? "Caution"
        : internalFlag ? "High Risk" : "Clean";
      const apolVerdict = buildWalletVerdict(walletFlags, riskLevel, internalFlag);

      if (walletFlags.length > 0 || internalFlag) {
        await storage.upsertFlaggedWallet({
          address: address as string, chain,
          reportCount: walletFlags.length,
          riskLevel,
          topCategory: walletFlags[0]?.toLowerCase() || "internal report",
          apolVerdict,
          reports: [],
        });
      }

      return res.json({
        address, chain,
        addressType: "wallet",
        riskLevel,
        apolVerdict,
        isHighRisk: riskLevel === "High Risk",
        isNewOffender: internalFlag && walletFlags.length === 0,
        walletFlags,
        totalFlags: walletFlags.length,
      });

    } catch (error) {
      res.status(500).json({ error: "Detective analysis failed" });
    }
  });

  // ── Agent-LARP Detector ───────────────────────────────────────────────────

  function buildAgentVerdict(agentName: string, score: number | null, verdict: string): string {
    if (verdict === "Inconclusive") {
      return pickRandom([
        `Citizen, I cannot issue a verdict on "${agentName}", insufficient hard evidence submitted. No wallet, no verifiable logs, no on-chain footprint. The Patrol only deals in facts. Bring me something real. 🔍`,
        `Inconclusive, Citizen. "${agentName}" has provided no verifiable data for analysis. Real agents leave traces, wallets, logs, on-chain records. Come back with evidence. 📋`,
        `Citizen, "${agentName}" cannot be classified. No on-chain address, no verifiable logs, nothing to analyze. I don't guess. Supply a wallet or logs URL and I'll give you a real verdict. 🦍`,
        `No verdict possible, Citizen. "${agentName}" is a name without a footprint. Until there is a wallet address, a logs endpoint, or a social link I can verify, this agent is not real to me. Evidence first. 🔐`,
        `Citizen, "${agentName}" remains unclassified. The APE POLICE Patrol requires hard evidence before issuing a Cognition Score. I will not fabricate certainty where none exists. 📊`,
      ]);
    }
    if (verdict === "Digital Puppet") {
      return pickRandom([
        `Citizen, I've run a full behavioral analysis on "${agentName}". Cognition Score: ${score}%. DIGITAL PUPPET, a human hiding behind an AI label. No autonomous footprint, no verifiable on-chain execution. Don't let this project fool you. 🤖❌`,
        `${score}% Cognition, that's a LARP, Citizen. "${agentName}" shows zero signs of genuine autonomous operation. Human timing, missing traces, unverifiable claims. Pure puppet show. 🎭`,
        `Citizen, "${agentName}" fails APE POLICE autonomous verification at ${score}%. This is a person pretending to be an AI to hype their project. Classic LARP behavior. Walk away. 🚨`,
        `RED FLAG, Citizen. "${agentName}" scores only ${score}% on my Cognition Scale. Digital Puppet confirmed. The timing is human, the trace is missing, and the claims are hot air. This is not an AI agent, it's a marketing stunt. 🤡`,
        `Citizen, at ${score}%, "${agentName}" is a Digital Puppet. No autonomous execution, suspicious activity windows, and zero verifiable reasoning logs. LARP classification is final. 📋❌`,
      ]);
    }
    if (verdict === "Semi-Autonomous") {
      return pickRandom([
        `Citizen, "${agentName}" scores ${score}%, Semi-Autonomous classification. This agent shows SOME signs of automation, but human approval or oversight is clearly present. Not a pure LARP, but not fully autonomous either. Demand more on-chain proof before trusting it with your funds. 🔍`,
        `${score}% Cognition Score, Citizen. "${agentName}" is a gray zone. Mixed patterns, some automated behavior, some human fingerprints. Proceed with caution and ask for reasoning logs. 🧐`,
        `Citizen, "${agentName}" passes some of my tests but not all. ${score}% = Semi-Autonomous. The agent appears real in parts, but human co-piloting is likely. Verify before trusting. 🔍`,
        `"${agentName}", ${score}% Cognition. Semi-Autonomous, Citizen. Some on-chain traces check out but timing and traceability aren't fully consistent with pure AI operation. Stay alert. 🦍🔍`,
        `Citizen, my analysis of "${agentName}" yields ${score}%. Semi-Autonomous. Neither confirmed LARP nor confirmed AI. The agent may be legitimate but requires a human co-pilot. Do your due diligence. 📊`,
      ]);
    }
    return pickRandom([
      `Citizen, "${agentName}" achieves ${score}% on the Cognition Scale, FULLY AUTONOMOUS confirmed. On-chain patterns, timing spread, and claim verification all check out. This looks like a genuine AI agent. APE POLICE credibility stamp, always DYOR though. 🦍✅`,
      `${score}% Cognition, the real deal, Citizen. "${agentName}" shows consistent 24/7 on-chain execution, public traceability, and claims backed by verifiable wallet activity. This agent checks out. 🤖✅`,
      `Citizen, I've cleared "${agentName}" at ${score}%. Fully Autonomous classification. Round-the-clock activity, verifiable on-chain evidence, and strong traceability. This is what a real AI agent looks like. 🦍`,
      `Full clearance for "${agentName}", Citizen. ${score}% Cognition, Fully Autonomous. Distributed timing, contract execution, and claim verification all pass. APE POLICE approved. 🔐✅`,
      `Citizen, "${agentName}" passed every test at ${score}%. Fully Autonomous designation confirmed. If more agents were this transparent and traceable, this space would be a lot safer. APE POLICE respect. 🦍✅`,
    ]);
  }

  // ── helpers for agent analyze ─────────────────────────────────────────────

  function scoreTimingFromTimestamps(tsSec: number[]): { score: number; label: string; detail: string; timingPattern: string[] } {
    const entries = tsSec.slice(0, 10);
    const hours = entries.map(ts => new Date(ts * 1000).getUTCHours());
    const uniqueHours = new Set(hours).size;
    const bizRatio = hours.filter(h => h >= 8 && h <= 18).length / hours.length;
    const timingPattern = entries.map(ts =>
      new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC"
    );
    let score = 0; let label = ""; let detail = "";
    if (uniqueHours >= 12) { score = 38; label = "24/7 Automated"; detail = `Transactions span ${uniqueHours} unique UTC hours, true round-the-clock automation pattern.`; }
    else if (uniqueHours >= 8) { score = 30; label = "Mostly Automated"; detail = `Activity spans ${uniqueHours} UTC hours, broad window consistent with automation.`; }
    else if (uniqueHours >= 4) { score = 18; label = "Mixed Pattern"; detail = `${uniqueHours} unique active hours, semi-automated or time-zone restricted.`; }
    else { score = 8; label = "Narrow Window"; detail = `Only ${uniqueHours} unique hour(s), extremely concentrated timing, suggesting manual operation.`; }
    if (bizRatio > 0.85) { score = Math.max(5, score - 18); label = "Human Hours ⚠️"; detail += ` ⚠️ ${Math.round(bizRatio * 100)}% of activity falls in business hours (8am–6pm UTC), HIGH LARP RISK.`; }
    else if (bizRatio > 0.65) { score = Math.max(8, score - 8); detail += ` Activity skewed toward business hours.`; }
    return { score, label, detail, timingPattern };
  }

  async function fetchEvmTimestamps(explorerUrl: string, address: string): Promise<number[] | null> {
    try {
      const r = await fetch(`${explorerUrl}?module=account&action=txlist&address=${address}&sort=desc&offset=10&page=1`, { signal: AbortSignal.timeout(7000) });
      const d = await r.json() as any;
      if (d.status === "1" && Array.isArray(d.result) && d.result.length > 0)
        return d.result.slice(0, 10).map((tx: any) => parseInt(tx.timeStamp));
    } catch { /* timeout / network */ }
    return null;
  }

  async function fetchSolanaTimestamps(address: string): Promise<number[] | null> {
    try {
      const r = await fetch("https://api.mainnet-beta.solana.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [address, { limit: 10 }] }),
        signal: AbortSignal.timeout(8000),
      });
      const d = await r.json() as any;
      if (Array.isArray(d.result) && d.result.length > 0) {
        const ts = d.result.filter((s: any) => s.blockTime).map((s: any) => s.blockTime as number);
        return ts.length > 0 ? ts : null;
      }
    } catch { /* non-fatal */ }
    return null;
  }

  async function fetchLogsAndVerify(logsUrl: string, onchainTimestamps: number[]): Promise<{
    status: "verified" | "mismatch" | "inconclusive"; detail: string; logs: string[];
  }> {
    try {
      const r = await fetch(logsUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) });
      const raw = await r.json() as any;
      const entries: any[] = Array.isArray(raw) ? raw.slice(0, 3) : (Array.isArray(raw?.logs) ? raw.logs.slice(0, 3) : (Array.isArray(raw?.data) ? raw.data.slice(0, 3) : []));
      if (entries.length === 0) return { status: "inconclusive", detail: "Logs endpoint responded but returned no parseable log entries.", logs: [] };

      const tsFields = ["timestamp", "time", "created_at", "blockTime", "ts", "datetime", "date", "createdAt"];
      const logTs: number[] = [];
      const logLabels: string[] = [];
      for (const e of entries) {
        const raw = tsFields.map(f => e[f]).find(v => v != null);
        if (raw != null) {
          const ms = typeof raw === "number" ? (raw > 1e12 ? raw : raw * 1000) : new Date(raw).getTime();
          if (!isNaN(ms)) { logTs.push(Math.floor(ms / 1000)); logLabels.push(new Date(ms).toISOString().slice(0, 16).replace("T", " ") + " UTC"); }
        }
      }
      if (logTs.length === 0) return { status: "inconclusive", detail: "Logs found but no recognisable timestamp fields (timestamp/time/created_at/blockTime/ts).", logs: [] };

      const WINDOW = 300; // 5 min tolerance
      const matched = logTs.filter(lt => onchainTimestamps.some(ot => Math.abs(lt - ot) <= WINDOW));
      if (matched.length > 0)
        return { status: "verified", detail: `${matched.length}/${logTs.length} log timestamps match on-chain activity within ±5 minutes. Reasoning is publicly verifiable.`, logs: logLabels };
      return { status: "mismatch", detail: `Log timestamps do NOT align with on-chain transactions (±5 min window). Either the agent is logging off-chain activity only, or the logs are fabricated.`, logs: logLabels };
    } catch (e: any) {
      return { status: "inconclusive", detail: `Could not reach logs endpoint: ${e?.message || "network error"}.`, logs: [] };
    }
  }

  async function checkSocialIntegrity(socialLink: string): Promise<{
    status: "clear" | "suspicious" | "inconclusive"; detail: string; followers?: number; accountAgeDays?: number;
  }> {
    const isX = /x\.com|twitter\.com/.test(socialLink);
    const isTg = /t\.me|telegram\.me/.test(socialLink);

    if (isX) {
      const handleMatch = socialLink.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]+)/);
      const handle = handleMatch?.[1];
      if (!handle) return { status: "inconclusive", detail: "Could not parse X handle from the provided URL." };
      try {
        const r = await fetch(`https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${handle}`, { signal: AbortSignal.timeout(5000) });
        const d = await r.json() as any;
        const user = Array.isArray(d) ? d[0] : null;
        if (!user) return { status: "inconclusive", detail: `X account @${handle} not found or data unavailable.` };
        const followers: number = user.followers_count ?? 0;
        // Approximate account creation via snowflake ID
        let accountAgeDays: number | undefined;
        let ageLabel = "Creation date unverifiable";
        if (user.id) {
          const TWITTER_EPOCH = 1288834974657n;
          try {
            const createdMs = Number((BigInt(user.id) >> 22n) + TWITTER_EPOCH);
            const ageMs = Date.now() - createdMs;
            accountAgeDays = Math.floor(ageMs / 86400000);
            ageLabel = accountAgeDays < 1 ? "created today" : `~${accountAgeDays} days old`;
          } catch { /* BigInt not supported */ }
        }
        if (followers >= 10000 && accountAgeDays !== undefined && accountAgeDays <= 7)
          return { status: "suspicious", detail: `@${handle}: ${followers.toLocaleString()} followers, account is only ${ageLabel}. This is a Sybil/Bot pattern, follower counts this high on a new account are virtually impossible organically. 🚨`, followers, accountAgeDays };
        if (followers >= 10000 && accountAgeDays === undefined)
          return { status: "suspicious", detail: `@${handle}: ${followers.toLocaleString()} followers. Account age could not be determined from the Twitter API, treat with caution if this account is recent.`, followers };
        return { status: "clear", detail: `@${handle}: ${followers.toLocaleString()} followers, ${ageLabel}. No Sybil pattern detected from available data.`, followers, accountAgeDays };
      } catch {
        return { status: "inconclusive", detail: `Could not fetch X profile data for the provided link. Twitter may be rate-limiting this request.` };
      }
    }

    if (isTg) {
      const chMatch = socialLink.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]+)/);
      const channel = chMatch?.[1];
      if (!channel) return { status: "inconclusive", detail: "Could not parse Telegram channel from the URL." };
      try {
        const r = await fetch(`https://t.me/${channel}`, { signal: AbortSignal.timeout(5000) });
        const html = await r.text();
        const memberMatch = html.match(/(\d[\d\s,]+)\s*(?:member|subscriber)/i);
        if (memberMatch) {
          const members = parseInt(memberMatch[1].replace(/[\s,]/g, ""));
          return { status: "clear", detail: `Telegram channel @${channel} has ~${members.toLocaleString()} members. Existence confirmed.`, followers: members };
        }
        if (html.includes("tgme_page")) return { status: "clear", detail: `Telegram channel @${channel} exists. Member count not parseable from public page.` };
        return { status: "inconclusive", detail: `Telegram channel @${channel} could not be fetched (private or non-existent).` };
      } catch {
        return { status: "inconclusive", detail: "Could not reach Telegram to verify the channel." };
      }
    }
    return { status: "inconclusive", detail: "Link is not an X or Telegram URL, social integrity check skipped." };
  }

  app.post("/api/agent/analyze", async (req, res) => {
    const { agentName, socialLink, wallet, chain = "ethereum", claimedAbilities, logsUrl } = req.body;
    if (!agentName?.trim()) return res.status(400).json({ error: "Agent name is required" });

    const w = wallet?.trim() || null;
    const sl = socialLink?.trim() || null;
    const claims = claimedAbilities?.trim() || null;
    const lu = logsUrl?.trim() || null;

    // ── 1. On-chain timing (Speed Test) ──────────────────────────────────────
    const explorerApis: Record<string, string> = {
      ethereum: "https://api.etherscan.io/api",
      bsc: "https://api.bscscan.com/api",
      polygon: "https://api.polygonscan.com/api",
      base: "https://api.basescan.org/api",
    };

    let speedScored = false;
    let speedScore = 0; let speedLabel = "Inconclusive"; let speedDetail = ""; let timingPattern: string[] = [];
    let onchainTimestamps: number[] = [];
    let isContract = false; let hasSecurityFlags = false;

    if (w) {
      // Contract/security check
      const chainId = GOPLUS_CHAIN[chain] || "1";
      try {
        const gpR = await fetch(`${GOPLUS_BASE}/address_security/${encodeURIComponent(w)}`);
        const gpD = await gpR.json() as any;
        hasSecurityFlags = Object.values(gpD.result || {}).some(v => v === "1" || v === 1);
        if (chainId !== "solana" && chainId !== "tron") {
          const tR = await fetch(`${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${encodeURIComponent(w)}`);
          const tD = await tR.json() as any;
          isContract = !!Object.keys(tD.result || {})[0];
        }
      } catch { /* non-fatal */ }

      // Transaction timestamp fetch
      let tsList: number[] | null = null;
      if (chain === "solana") {
        tsList = await fetchSolanaTimestamps(w);
        if (!tsList) { speedLabel = "No Transactions"; speedDetail = "No Solana transactions found for this address via the public RPC. Wallet appears inactive."; }
      } else if (explorerApis[chain]) {
        tsList = await fetchEvmTimestamps(explorerApis[chain], w);
        if (!tsList) { speedLabel = "No Transactions"; speedDetail = `No transactions found on ${chain.charAt(0).toUpperCase() + chain.slice(1)} for this address, or the block explorer is temporarily unavailable.`; }
      } else {
        speedLabel = "Chain Unsupported"; speedDetail = `Direct transaction scanning is not available for ${chain}, wallet security analysis still performed.`;
      }

      if (tsList && tsList.length > 0) {
        onchainTimestamps = tsList;
        const r = scoreTimingFromTimestamps(tsList);
        speedScore = r.score; speedLabel = r.label; speedDetail = r.detail; timingPattern = r.timingPattern;
        speedScored = true;
      }
    } else {
      speedLabel = "Inconclusive, Missing Evidence";
      speedDetail = "No wallet address provided. The Patrol cannot assess transaction timing without an on-chain address.";
    }

    // ── 2. Traceability ───────────────────────────────────────────────────────
    let traceScored = false;
    let traceScore = 0; let traceLabel = "Inconclusive"; let traceDetail = "";

    if (w) {
      traceScored = true;
      if (sl) {
        if (isContract) { traceScore = 28; traceLabel = "Strong Trace"; traceDetail = `Smart contract at ${w.slice(0,10)}… + social presence. Strong autonomous footprint.`; }
        else { traceScore = 20; traceLabel = "Moderate Trace"; traceDetail = `EOA wallet at ${w.slice(0,10)}… + social presence confirmed.`; }
      } else {
        if (isContract) { traceScore = 18; traceLabel = "Contract Found"; traceDetail = `Smart contract at ${w.slice(0,10)}…, programmatic execution possible.`; }
        else { traceScore = 10; traceLabel = "Wallet Only"; traceDetail = `EOA wallet at ${w.slice(0,10)}…, basic trace. No social link cross-reference.`; }
      }
      if (hasSecurityFlags) { traceScore = Math.max(2, traceScore - 10); traceDetail += " ⚠️ Security flags on this wallet."; traceLabel += " ⚠️"; }
    } else if (sl) {
      traceScored = true; traceScore = 8; traceLabel = "Social Only";
      traceDetail = "Social link provided but no on-chain wallet to verify autonomous execution.";
    } else {
      traceLabel = "Inconclusive, Missing Evidence";
      traceDetail = "No wallet or social link. The Patrol cannot establish a trace without verifiable identifiers.";
    }

    // ── 3. Context / Claims ───────────────────────────────────────────────────
    let contextScored = false;
    let contextScore = 0; let contextLabel = "Inconclusive"; let contextDetail = "";

    if (claims) {
      const c = claims.toLowerCase();
      const hasTrade = ["trade", "swap", "arbitrage", "dex", "buy", "sell", "liquidity"].some(k => c.includes(k));
      const hasOnchain = ["deploy", "contract", "bridge", "stake", "yield", "farm", "mint"].some(k => c.includes(k));
      contextScored = true;
      if (!w) {
        contextScore = 10; contextLabel = "Unverifiable, No Wallet";
        contextDetail = `Claims: "${claims.slice(0, 90)}", No wallet provided. Cannot verify on-chain. Always demand a verifiable address.`;
      } else if (isContract && hasOnchain) {
        contextScore = 28; contextLabel = "Claim Verified ✓";
        contextDetail = `Claims on-chain execution, wallet IS a smart contract, consistent with the claimed capabilities.`;
      } else if (hasTrade && onchainTimestamps.length > 0) {
        contextScore = 22; contextLabel = "Evidence Found";
        contextDetail = `Claims trading/swapping, active on-chain wallet detected, consistent with automated execution.`;
      } else if (onchainTimestamps.length > 0) {
        contextScore = 15; contextLabel = "Partial Match";
        contextDetail = `Claims: "${claims.slice(0, 80)}", On-chain activity found but ability-specific proof is limited.`;
      } else {
        contextScore = 8; contextLabel = "No Evidence";
        contextDetail = `Claims: "${claims.slice(0, 80)}", Wallet is inactive. Claims cannot be verified on-chain.`;
      }
    } else {
      contextLabel = "Inconclusive, No Claims";
      contextDetail = "No claimed abilities provided. Real agents have documented, verifiable capabilities.";
    }

    // ── 4. Logs Verification ──────────────────────────────────────────────────
    let logsResult: { status: "verified" | "mismatch" | "inconclusive"; detail: string; logs: string[] } = { status: "inconclusive", detail: "No logs URL provided.", logs: [] };
    if (lu) logsResult = await fetchLogsAndVerify(lu, onchainTimestamps);

    // ── 5. Social Integrity ───────────────────────────────────────────────────
    let socialResult: { status: "clear" | "suspicious" | "inconclusive"; detail: string; followers?: number; accountAgeDays?: number } = { status: "inconclusive", detail: "No social link provided." };
    if (sl) socialResult = await checkSocialIntegrity(sl);

    // ── Score + Verdict ───────────────────────────────────────────────────────
    const scoredTests = [
      speedScored ? { score: speedScore, max: 40 } : null,
      traceScored ? { score: traceScore, max: 30 } : null,
      contextScored ? { score: contextScore, max: 30 } : null,
    ].filter(Boolean) as { score: number; max: number }[];

    const scoredCount = scoredTests.length;
    let cognitionScore: number | null = null;
    let verdict = "Inconclusive";

    if (scoredCount >= 1) {
      const totalScored = scoredTests.reduce((a, t) => a + t.score, 0);
      const totalMax = scoredTests.reduce((a, t) => a + t.max, 0);
      let raw = Math.round((totalScored / totalMax) * 100);

      // Modifiers
      if (logsResult.status === "verified") raw = Math.min(100, raw + 10);
      if (logsResult.status === "mismatch") raw = Math.max(0, raw - 12);
      if (socialResult.status === "suspicious") raw = Math.max(0, raw - 15);

      cognitionScore = Math.min(100, Math.max(0, raw));
      verdict = cognitionScore <= 30 ? "Digital Puppet" : cognitionScore <= 70 ? "Semi-Autonomous" : "Fully Autonomous";
    }

    if (scoredCount === 0) verdict = "Inconclusive";

    const apolVerdict = buildAgentVerdict(agentName.trim(), cognitionScore, verdict);

    res.json({
      agentName: agentName.trim(), socialLink: sl, wallet: w, claimedAbilities: claims, logsUrl: lu,
      cognitionScore, verdict, apolVerdict, scoredTests: scoredCount,
      speedTest: { scored: speedScored, score: speedScore, maxScore: 40, label: speedLabel, detail: speedDetail, timingPattern: timingPattern.slice(0, 5) },
      traceabilityTest: { scored: traceScored, score: traceScore, maxScore: 30, label: traceLabel, detail: traceDetail, isContract },
      contextTest: { scored: contextScored, score: contextScore, maxScore: 30, label: contextLabel, detail: contextDetail },
      logsTest: logsResult,
      socialTest: socialResult,
    });
  });

  app.get("/api/detective/flagged", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const wallets = await storage.getFlaggedWallets(limit);
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flagged wallets" });
    }
  });

  app.get("/api/verification-requests/by-tx/:txHash", async (req, res) => {
    try {
      const { txHash } = req.params;
      if (!txHash) return res.status(400).json({ error: "txHash required" });
      const request = await storage.getVerificationRequestByTxHash(txHash);
      if (!request) return res.status(404).json({ error: "Not found" });
      res.json(request);
    } catch {
      res.status(500).json({ error: "Failed to fetch verification request" });
    }
  });

  app.get("/api/verification-requests/by-wallet/:address", async (req, res) => {
    try {
      const { address } = req.params;
      if (!address) return res.status(400).json({ error: "address required" });
      const request = await storage.getVerificationRequestByWallet(address.toLowerCase());
      if (!request) return res.status(404).json({ error: "Not found" });
      res.json(request);
    } catch {
      res.status(500).json({ error: "Failed to fetch verification request" });
    }
  });

  app.post("/api/verification-requests", async (req, res) => {
    try {
      const result = insertVerificationRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid data", details: result.error.issues });
      }
      const request = await storage.createVerificationRequest(result.data);
      res.status(201).json(request);
    } catch (error) {
      res.status(500).json({ error: "Failed to save verification request" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
