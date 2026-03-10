import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScamReportSchema, insertHeroNominationSchema, insertVoteSchema } from "@shared/schema";

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

  const httpServer = createServer(app);

  return httpServer;
}
