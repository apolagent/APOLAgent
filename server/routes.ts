import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScamReportSchema, insertHeroNominationSchema, insertVoteSchema } from "@shared/schema";

const CHAINABUSE_API_KEY = process.env.CHAINABUSE_API_KEY;
const CHAINABUSE_BASE = "https://api.chainabuse.com/v0";

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

  // ── Detective Service ──────────────────────────────────────────────────────

  function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buildRiskLevel(reportCount: number, internalFlag = false): string {
    if (reportCount === 0 && internalFlag) return "High Risk";
    if (reportCount === 0) return "Clean";
    if (reportCount <= 2) return "Caution";
    return "High Risk";
  }

  function buildOfficerVerdict(address: string, reports: any[], riskLevel: string, internalFlag = false): string {
    const count = reports.length;
    const topCat = (reports[0]?.category || "suspicious activity").replace(/_/g, " ");
    const dateStr = reports[0]?.createdAt
      ? new Date(reports[0].createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    const dateClause = dateStr ? ` on ${dateStr}` : "";

    if (count === 0 && internalFlag) {
      return pickRandom([
        `Fresh off the crime scene, Citizen. No ChainAbuse record yet — but APE POLICE internal intelligence flagged this address in the last 24 hours. Treat as High Risk. 🚨`,
        `New to our system, but already on our radar. Internal reports link this wallet to suspicious activity in the last 24 hours. New Offender designation applied, Citizen. 🚨`,
        `ChainAbuse shows clean, but our own community flagged this address recently. Don't be fooled, Citizen — new criminals don't have records until they do. 🚨`,
        `Brand new threat detected, Citizen. No external history, but APE POLICE internal sources lit up for this wallet in the last 24 hours. Stay far away. 🚨`,
        `First offense detected, Citizen. This wallet may not have a ChainAbuse record yet, but our internal intelligence says otherwise. Consider this address hostile. 🚨`,
      ]);
    }

    if (count === 0) {
      return pickRandom([
        `Citizen, this wallet appears clean in our database. Exercise standard vigilance and stay sharp out there. APE POLICE are always watching. 🦍`,
        `All clear on this one, Citizen. No prior record on file. Don't let your guard down though — new threats emerge daily. Stay sharp. 🦍`,
        `Nothing here, Citizen. Clean as a whistle. Our database shows no criminal activity for this address. Stay vigilant out there. 🦍`,
        `Wallet cleared, Citizen. No reports found. I've checked a thousand scammers — this one doesn't match any known patterns. Proceed with standard caution. 🦍`,
        `No charges, no record, no flags. This wallet is clean for now, Citizen. But don't go getting sloppy — always do your homework before you ape in. 🦍`,
      ]);
    }

    if (riskLevel === "High Risk") {
      return pickRandom([
        `Citizen, my database shows this wallet is a REPEAT OFFENDER — ${count} reports on file, primarily for ${topCat}. High Risk: Suspected Serial Rugger. Do NOT interact under any circumstances. 🚨`,
        `Stop right there, Citizen. This wallet is a known menace. I've seen this pattern a thousand times. ${count} reports don't lie. Walk away. Don't look back. 🚨`,
        `Warrant issued, Citizen. ${count} reports and counting — serial offense: ${topCat}. This address is DANGEROUS. Back away slowly and do not engage. 🚨`,
        `RED ALERT, Citizen. ${count} reports on file for ${topCat}. This wallet operates at the highest threat level. I've arrested scammers like this before. Run. 🚨`,
        `I've been on the force a long time, Citizen. This wallet? Pure criminal. ${count} reports, primary offense: ${topCat}. Suspect goes straight to the hall of shame. 🚨`,
      ]);
    }

    return pickRandom([
      `Citizen, this wallet has ${count} report(s) on file for ${topCat}${dateClause}. Approach with caution — this is an active investigation. 🔍`,
      `Hold it right there, Citizen. We've got ${count} prior complaint(s) against this address for ${topCat}. I'd keep my distance if I were you. 🔍`,
      `Suspicious activity logged, Citizen. ${count} report(s) for ${topCat}${dateClause}. We're watching this one closely. Don't get caught in the crossfire. 🔍`,
      `This address is on our watchlist, Citizen — ${count} report(s) for ${topCat}. Tread carefully. You've been officially warned. 🔍`,
      `Our records don't look great for this wallet, Citizen. ${count} flag(s) for ${topCat}. Don't say I didn't warn you. 🔍`,
    ]);
  }

  app.get("/api/detective/analyze", async (req, res) => {
    const { address, chain = "ethereum" } = req.query as { address: string; chain?: string };
    if (!address) return res.status(400).json({ error: "Address is required" });
    if (!CHAINABUSE_API_KEY) return res.status(500).json({ error: "ChainAbuse API key not configured" });

    try {
      const response = await fetch(
        `${CHAINABUSE_BASE}/reports?address=${encodeURIComponent(address)}&limit=20`,
        {
          headers: {
            "Authorization": `Bearer ${CHAINABUSE_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await response.json() as any;
      if (!response.ok) {
        const isRateLimit = response.status === 429 || (data.message || "").toLowerCase().includes("login attempts");
        return res.status(response.status).json({
          error: isRateLimit
            ? "ChainAbuse is temporarily unavailable due to a rate limit. Please try again in a few hours."
            : data.message || "ChainAbuse API error",
        });
      }

      const reports: any[] = data.reports || [];
      const internalFlag = reports.length === 0
        ? await storage.checkInternalReports(address)
        : false;
      const riskLevel = buildRiskLevel(reports.length, internalFlag);
      const topCategory = reports[0]?.category || null;
      const apolVerdict = buildOfficerVerdict(address, reports, riskLevel, internalFlag);

      if (reports.length > 0 || internalFlag) {
        await storage.upsertFlaggedWallet({
          address,
          chain,
          reportCount: reports.length,
          riskLevel,
          topCategory: internalFlag && !topCategory ? "internal report (24h)" : topCategory,
          apolVerdict,
          reports: reports.slice(0, 5),
        });
      }

      res.json({
        address,
        chain,
        reports,
        total: data.total ?? reports.length,
        riskLevel,
        topCategory,
        apolVerdict,
        isHighRisk: riskLevel === "High Risk",
        isSerial: reports.length > 2,
        isNewOffender: internalFlag && reports.length === 0,
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
