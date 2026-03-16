import { users, scamReports, heroNominations, votes, flaggedWallets, type User, type InsertUser, type ScamReport, type InsertScamReport, type HeroNomination, type InsertHeroNomination, type Vote, type InsertVote, type FlaggedWallet } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createScamReport(report: InsertScamReport): Promise<ScamReport>;
  getScamReports(): Promise<ScamReport[]>;
  createHeroNomination(nomination: InsertHeroNomination): Promise<HeroNomination>;
  getHeroNominations(): Promise<HeroNomination[]>;
  createVote(vote: InsertVote): Promise<Vote>;
  updateScamReportVotes(reportId: number, votes: number): Promise<void>;
  updateHeroNominationVotes(nominationId: number, votes: number): Promise<void>;
  upsertFlaggedWallet(data: {
    address: string;
    chain: string;
    reportCount: number;
    riskLevel: string;
    topCategory: string | null;
    apolVerdict: string;
    reports: any[];
  }): Promise<FlaggedWallet>;
  getFlaggedWallets(limit?: number): Promise<FlaggedWallet[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createScamReport(report: InsertScamReport): Promise<ScamReport> {
    const [scamReport] = await db
      .insert(scamReports)
      .values(report)
      .returning();
    return scamReport;
  }

  async getScamReports(): Promise<ScamReport[]> {
    return await db
      .select()
      .from(scamReports)
      .orderBy(desc(scamReports.createdAt));
  }

  async createHeroNomination(nomination: InsertHeroNomination): Promise<HeroNomination> {
    const [heroNomination] = await db
      .insert(heroNominations)
      .values(nomination)
      .returning();
    return heroNomination;
  }

  async getHeroNominations(): Promise<HeroNomination[]> {
    return await db
      .select()
      .from(heroNominations)
      .orderBy(desc(heroNominations.votes));
  }

  async createVote(vote: InsertVote): Promise<Vote> {
    const [newVote] = await db
      .insert(votes)
      .values(vote)
      .returning();
    return newVote;
  }

  async updateScamReportVotes(reportId: number, newVotes: number): Promise<void> {
    await db
      .update(scamReports)
      .set({ votes: newVotes })
      .where(eq(scamReports.id, reportId));
  }

  async updateHeroNominationVotes(nominationId: number, newVotes: number): Promise<void> {
    await db
      .update(heroNominations)
      .set({ votes: newVotes })
      .where(eq(heroNominations.id, nominationId));
  }

  async upsertFlaggedWallet(data: {
    address: string;
    chain: string;
    reportCount: number;
    riskLevel: string;
    topCategory: string | null;
    apolVerdict: string;
    reports: any[];
  }): Promise<FlaggedWallet> {
    const [result] = await db
      .insert(flaggedWallets)
      .values({
        address: data.address,
        chain: data.chain,
        reportCount: data.reportCount,
        riskLevel: data.riskLevel,
        topCategory: data.topCategory,
        apolVerdict: data.apolVerdict,
        reports: data.reports,
        flaggedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: flaggedWallets.address,
        set: {
          chain: data.chain,
          reportCount: data.reportCount,
          riskLevel: data.riskLevel,
          topCategory: data.topCategory,
          apolVerdict: data.apolVerdict,
          reports: data.reports,
          flaggedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async getFlaggedWallets(limit = 10): Promise<FlaggedWallet[]> {
    return await db
      .select()
      .from(flaggedWallets)
      .orderBy(desc(flaggedWallets.flaggedAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
