import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScamReportSchema, insertHeroNominationSchema, insertVoteSchema } from "@shared/schema";

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
      return res.status(503).json({ error: "ChainAbuse API not configured" });
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
          ? "ChainAbuse is temporarily unavailable due to a rate limit. Please try again in a few hours."
          : data.message || "ChainAbuse API error";
        return res.status(response.status).json({ error: errorMsg });
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to query ChainAbuse" });
    }
  });

  app.post("/api/chainabuse/report", async (req, res) => {
    const { address, chain, description, category } = req.body;
    if (!address || !chain || !description) {
      return res.status(400).json({ error: "address, chain, and description are required" });
    }
    if (!CHAINABUSE_API_KEY) {
      return res.status(503).json({ error: "ChainAbuse API not configured" });
    }
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
      const data = await response.json() as any;
      if (!response.ok) {
        return res.status(response.status).json({ error: data.message || "ChainAbuse API error" });
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit report to ChainAbuse" });
    }
  });

  // ── Detective Service (GoPlus Security) ───────────────────────────────────

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
        `Citizen, this wallet appears clean in our GoPlus scan. No malicious activity detected. Stay vigilant out there — APE POLICE are always watching. 🦍`,
        `All clear on this one, Citizen. GoPlus shows no blacklist flags, no sanctions, no criminal activity. Proceed with standard caution. 🦍`,
        `Nothing here, Citizen. Clean as a whistle. Our security scan shows no malicious patterns for this address. 🦍`,
        `Wallet cleared, Citizen. No flags, no sanctions, no phishing history. I've seen a thousand scammers — this one doesn't match any known patterns. 🦍`,
        `No charges, no record, no flags. This wallet is clean for now, Citizen. Don't go getting sloppy — always do your homework before you ape in. 🦍`,
      ]);
    }
    if (internalFlag && flags.length === 0) {
      return pickRandom([
        `Fresh off the crime scene, Citizen. GoPlus shows clean but APE POLICE internal intelligence flagged this address in the last 24 hours. Treat as High Risk. 🚨`,
        `New to our system but already on our radar. Internal reports link this wallet to suspicious activity in the last 24 hours. 🚨`,
        `GoPlus shows nothing yet — but our community flagged this address recently. New criminals don't have records until they do, Citizen. 🚨`,
        `Brand new threat detected. No external scan history, but APE POLICE internal sources lit up for this wallet. Stay far away. 🚨`,
        `First offense, Citizen. No external record yet, but our internal intelligence says otherwise. Consider this address hostile. 🚨`,
      ]);
    }
    const flagList = flags.join(", ");
    if (riskLevel === "High Risk") {
      return pickRandom([
        `Stop right there, Citizen. This wallet is SANCTIONED or flagged for serious criminal activity: ${flagList}. Do NOT interact under any circumstances. 🚨`,
        `Warrant issued, Citizen. GoPlus has flagged this address for: ${flagList}. This is a KNOWN THREAT. Back away and do not engage. 🚨`,
        `RED ALERT, Citizen. Criminal record confirmed: ${flagList}. I've arrested scammers like this before. Run. 🚨`,
        `I've been on the force a long time, Citizen. This wallet? Pure criminal. Flagged for ${flagList}. Suspect goes straight to the hall of shame. 🚨`,
        `Citizen, my database and GoPlus both agree — this address is DANGEROUS. Charges: ${flagList}. Do NOT touch this wallet. 🚨`,
      ]);
    }
    return pickRandom([
      `Citizen, this wallet has flags on record: ${flagList}. Approach with caution — this is an active investigation. 🔍`,
      `Hold it right there, Citizen. GoPlus flagged this address for: ${flagList}. I'd keep my distance if I were you. 🔍`,
      `Suspicious activity logged, Citizen. Flags detected: ${flagList}. We're watching this one closely. Don't get caught in the crossfire. 🔍`,
      `This address is on our watchlist, Citizen — flagged for ${flagList}. Tread carefully. You've been officially warned. 🔍`,
      `Our records don't look great for this wallet, Citizen. Flags: ${flagList}. Don't say I didn't warn you. 🔍`,
    ]);
  }

  function buildContractVerdict(name: string | undefined, symbol: string | undefined, riskLevel: string, greenBadge: boolean, redFlags: string[]): string {
    const token = name && symbol ? `${name} (${symbol})` : "this contract";
    if (greenBadge) {
      return pickRandom([
        `Citizen, I ran a full security scan on ${token}. Open source, no honeypot, taxes in check, no mint function. This one looks legit. Always DYOR before aping in. ✅`,
        `${token} passes all APE POLICE security checks. No honeypot, no hidden taxes, no unlimited minting. Green badge earned, Citizen. ✅`,
        `All systems go on ${token}, Citizen. GoPlus shows clean on every metric I track. Liquidity, taxes, mint — all pass. ✅`,
        `Citizen, ${token} has earned the APE POLICE Green Badge. Verified open source, safe tax structure, no malicious functions detected. ✅`,
        `I've checked ${token} top to bottom. No traps. No honeypot. No rug mechanics. This one checks out, Citizen — but stay alert. ✅`,
      ]);
    }
    const issues = redFlags.join("; ");
    if (riskLevel === "High Risk") {
      return pickRandom([
        `Citizen, ${token} is a TRAP. GoPlus flagged: ${issues}. Do NOT buy this token. This has rug written all over it. 🚨`,
        `Stop right there, Citizen. ${token} failed critical security checks: ${issues}. Walk away. This is a known rug pattern. 🚨`,
        `RED ALERT on ${token}. My scan shows: ${issues}. I've seen this a thousand times — stay far away. 🚨`,
        `Warrant issued for ${token}. Security violations: ${issues}. Do not interact with this contract under any circumstances. 🚨`,
        `Citizen, ${token} has multiple critical red flags: ${issues}. Your funds will not survive this trade. I'm ordering you to stand down. 🚨`,
      ]);
    }
    return pickRandom([
      `Citizen, ${token} raised some flags during our scan: ${issues}. Proceed with caution and verify before trading. 🔍`,
      `Hold up, Citizen. ${token} has warnings: ${issues}. Not a confirmed rug — but tread carefully. 🔍`,
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
      // 1. GoPlus Malicious Address check (always run)
      let malicious: any = {};
      try {
        const r = await fetch(`${GOPLUS_BASE}/address_security/${encodeURIComponent(address)}`);
        const j = await r.json() as any;
        malicious = j.result || {};
      } catch { /* non-fatal */ }

      // 2. GoPlus Token Security check (determines if contract)
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
        if (isHoneypot) redFlags.push("Honeypot — cannot sell");
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

  app.get("/api/detective/flagged", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const wallets = await storage.getFlaggedWallets(limit);
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flagged wallets" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
