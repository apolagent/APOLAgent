import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", engine: "APOL v2 — Simulation-First", timestamp: Date.now() });
  });

  app.get("/api/detective/flagged", async (_req, res) => {
    try {
      const flagged = await storage.getFlaggedWallets(20);
      res.json(flagged);
    } catch {
      res.json([]);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
