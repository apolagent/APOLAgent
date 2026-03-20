import { users, scamReports, heroNominations, votes, flaggedWallets, verificationRequests, type User, type InsertUser, type ScamReport, type InsertScamReport, type HeroNomination, type InsertHeroNomination, type Vote, type InsertVote, type FlaggedWallet, type InsertVerificationRequest, type VerificationRequest } from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, or, and, sql } from "drizzle-orm";

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
  checkInternalReports(address: string): Promise<boolean>;
  createVerificationRequest(data: InsertVerificationRequest): Promise<VerificationRequest>;
  getVerificationRequestByTxHash(txHash: string): Promise<VerificationRequest | null>;
  getVerificationRequestByWallet(walletAddress: string): Promise<VerificationRequest | null>;
  getAllVerificationRequests(): Promise<VerificationRequest[]>;
  approveVerification(id: number, reviewerWallet: string): Promise<VerificationRequest>;
  rejectVerification(id: number, reason: string, reviewerWallet: string): Promise<VerificationRequest>;
  getVerifiedProjectByContract(contractAddress: string): Promise<VerificationRequest | null>;
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

  async createVerificationRequest(data: InsertVerificationRequest): Promise<VerificationRequest> {
    const [request] = await db
      .insert(verificationRequests)
      .values(data)
      .returning();
    return request;
  }

  async getVerificationRequestByTxHash(txHash: string): Promise<VerificationRequest | null> {
    const [row] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.txHash, txHash))
      .limit(1);
    return row ?? null;
  }

  async getVerificationRequestByWallet(walletAddress: string): Promise<VerificationRequest | null> {
    const [row] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.walletAddress, walletAddress.toLowerCase()))
      .orderBy(desc(verificationRequests.submittedAt))
      .limit(1);
    return row ?? null;
  }

  async getVerifiedProjectByContract(contractAddress: string): Promise<VerificationRequest | null> {
    const [row] = await db
      .select()
      .from(verificationRequests)
      .where(
        and(
          eq(verificationRequests.contractAddress, contractAddress),
          eq(verificationRequests.status, "verified")
        )
      )
      .limit(1);
    return row ?? null;
  }

  async getAllVerificationRequests(): Promise<VerificationRequest[]> {
    return await db
      .select()
      .from(verificationRequests)
      .orderBy(desc(verificationRequests.submittedAt));
  }

  async approveVerification(id: number, reviewerWallet: string): Promise<VerificationRequest> {
    const [row] = await db
      .update(verificationRequests)
      .set({ status: "verified", reviewedAt: new Date(), reviewedBy: reviewerWallet.toLowerCase() })
      .where(eq(verificationRequests.id, id))
      .returning();
    return row;
  }

  async rejectVerification(id: number, reason: string, reviewerWallet: string): Promise<VerificationRequest> {
    const [row] = await db
      .update(verificationRequests)
      .set({ status: "rejected", rejectionReason: reason, reviewedAt: new Date(), reviewedBy: reviewerWallet.toLowerCase() })
      .where(eq(verificationRequests.id, id))
      .returning();
    return row;
  }

  async checkInternalReports(address: string): Promise<boolean> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lowerAddr = address.toLowerCase();
    const results = await db
      .select({ id: scamReports.id })
      .from(scamReports)
      .where(
        and(
          gte(scamReports.createdAt, cutoff),
          or(
            sql`lower(${scamReports.description}) like ${"%" + lowerAddr + "%"}`,
            sql`lower(${scamReports.title}) like ${"%" + lowerAddr + "%"}`,
            sql`lower(coalesce(${scamReports.evidenceUrl}, '')) like ${"%" + lowerAddr + "%"}`
          )
        )
      )
      .limit(1);
    return results.length > 0;
  }
}

export const storage = new DatabaseStorage();
