import { users, scamReports, heroNominations, votes, flaggedWallets, verificationRequests, scanLookups, agentActivityLogs, subscriptions, agentScanResults, usedPaymentTxHashes, type User, type InsertUser, type ScamReport, type InsertScamReport, type HeroNomination, type InsertHeroNomination, type Vote, type InsertVote, type FlaggedWallet, type InsertVerificationRequest, type VerificationRequest, type ScanLookup, type AgentActivityLog, type Subscription, type AgentScanResult } from "@shared/schema";
import { db } from "./db";
import { eq, desc, gte, or, and, sql, sum } from "drizzle-orm";

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
  incrementLookup(address: string, tokenName?: string, tokenSymbol?: string): Promise<number>;
  getLookupCount(address: string): Promise<number>;
  getTotalLookups(): Promise<number>;
  getRecentLookups(limit?: number): Promise<ScanLookup[]>;
  logAgentActivity(data: { action: string; target: string; detail: string; verdict?: string; source: string; metadata?: any }): Promise<AgentActivityLog>;
  getAgentActivityLogs(limit?: number, offset?: number): Promise<AgentActivityLog[]>;
  getAgentActivityLogCount(): Promise<number>;
  getActiveSubscription(telegramUserId: string): Promise<Subscription | null>;
  getActiveSubscriptionByWallet(walletAddress: string): Promise<Subscription | null>;
  getSubscriptionByTxHash(txHash: string): Promise<Subscription | null>;
  upsertSubscription(data: { telegramUserId: string; txHash: string; fromAddress: string | null; amountWei: string; expiresAt: Date }): Promise<Subscription>;
  createWebSubscription(data: { walletAddress: string; txHash: string; fromAddress: string | null; amountWei: string; expiresAt: Date }): Promise<Subscription>;
  isTxHashUsed(txHash: string): Promise<boolean>;
  markTxHashUsed(txHash: string, telegramUserId: string | null, walletAddress: string | null): Promise<void>;
  saveAgentScanResult(data: { slug: string; agentName: string; wallet: string | null; chain: string; twitterHandle: string | null; socialLink: string | null; logsUrl: string | null; claimedAbilities: string | null; resultJson: any; tier: string }): Promise<AgentScanResult>;
  getAgentScanResultBySlug(slug: string): Promise<AgentScanResult | null>;
  upgradeAgentScanResultTier(slug: string, tier: string): Promise<AgentScanResult | null>;
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

  async incrementLookup(address: string, tokenName?: string, tokenSymbol?: string): Promise<number> {
    const [row] = await db
      .insert(scanLookups)
      .values({ address: address.toLowerCase(), tokenName: tokenName || null, tokenSymbol: tokenSymbol || null, lookupCount: 1, lastScannedAt: new Date() })
      .onConflictDoUpdate({
        target: scanLookups.address,
        set: {
          lookupCount: sql`${scanLookups.lookupCount} + 1`,
          lastScannedAt: new Date(),
          ...(tokenName ? { tokenName } : {}),
          ...(tokenSymbol ? { tokenSymbol } : {}),
        },
      })
      .returning();
    return row.lookupCount;
  }

  async getLookupCount(address: string): Promise<number> {
    const [row] = await db.select({ count: scanLookups.lookupCount }).from(scanLookups).where(eq(scanLookups.address, address.toLowerCase())).limit(1);
    return row?.count ?? 0;
  }

  async getTotalLookups(): Promise<number> {
    const [row] = await db.select({ total: sum(scanLookups.lookupCount) }).from(scanLookups);
    return parseInt(String(row?.total ?? "0"), 10);
  }

  async getRecentLookups(limit = 5): Promise<ScanLookup[]> {
    return await db.select().from(scanLookups).orderBy(desc(scanLookups.lastScannedAt)).limit(limit);
  }

  async logAgentActivity(data: { action: string; target: string; detail: string; verdict?: string; source: string; metadata?: any }): Promise<AgentActivityLog> {
    const [row] = await db
      .insert(agentActivityLogs)
      .values({
        action: data.action,
        target: data.target,
        detail: data.detail,
        verdict: data.verdict || null,
        source: data.source,
        metadata: data.metadata || null,
        createdAt: new Date(),
      })
      .returning();
    return row;
  }

  async getAgentActivityLogs(limit = 50, offset = 0): Promise<AgentActivityLog[]> {
    return await db
      .select()
      .from(agentActivityLogs)
      .orderBy(desc(agentActivityLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAgentActivityLogCount(): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(agentActivityLogs);
    return row?.count ?? 0;
  }

  async getActiveSubscription(telegramUserId: string): Promise<Subscription | null> {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.telegramUserId, telegramUserId))
      .limit(1);
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) return null;
    return row;
  }

  async getActiveSubscriptionByWallet(walletAddress: string): Promise<Subscription | null> {
    const lower = walletAddress.toLowerCase();
    const rows = await db
      .select()
      .from(subscriptions)
      .where(or(eq(subscriptions.walletAddress, lower), eq(subscriptions.fromAddress, lower)))
      .orderBy(desc(subscriptions.expiresAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() < Date.now()) return null;
    return row;
  }

  async createWebSubscription(data: { walletAddress: string; txHash: string; fromAddress: string | null; amountWei: string; expiresAt: Date }): Promise<Subscription> {
    const [row] = await db
      .insert(subscriptions)
      .values({
        telegramUserId: null,
        walletAddress: data.walletAddress.toLowerCase(),
        txHash: data.txHash.toLowerCase(),
        fromAddress: data.fromAddress?.toLowerCase() || null,
        amountWei: data.amountWei,
        expiresAt: data.expiresAt,
        paidAt: new Date(),
      })
      .returning();
    return row;
  }

  async getSubscriptionByTxHash(txHash: string): Promise<Subscription | null> {
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.txHash, txHash.toLowerCase()))
      .limit(1);
    return row ?? null;
  }

  async upsertSubscription(data: { telegramUserId: string; txHash: string; fromAddress: string | null; amountWei: string; expiresAt: Date }): Promise<Subscription> {
    const [row] = await db
      .insert(subscriptions)
      .values({
        telegramUserId: data.telegramUserId,
        txHash: data.txHash.toLowerCase(),
        fromAddress: data.fromAddress?.toLowerCase() || null,
        amountWei: data.amountWei,
        expiresAt: data.expiresAt,
        paidAt: new Date(),
      })
      .onConflictDoUpdate({
        target: subscriptions.telegramUserId,
        set: {
          txHash: data.txHash.toLowerCase(),
          fromAddress: data.fromAddress?.toLowerCase() || null,
          amountWei: data.amountWei,
          expiresAt: data.expiresAt,
          paidAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async isTxHashUsed(txHash: string): Promise<boolean> {
    const [row] = await db
      .select({ txHash: usedPaymentTxHashes.txHash })
      .from(usedPaymentTxHashes)
      .where(eq(usedPaymentTxHashes.txHash, txHash.toLowerCase()))
      .limit(1);
    return !!row;
  }

  async markTxHashUsed(txHash: string, telegramUserId: string | null, walletAddress: string | null): Promise<void> {
    await db
      .insert(usedPaymentTxHashes)
      .values({
        txHash: txHash.toLowerCase(),
        telegramUserId,
        walletAddress: walletAddress?.toLowerCase() || null,
      })
      .onConflictDoNothing();
  }

  async saveAgentScanResult(data: { slug: string; agentName: string; wallet: string | null; chain: string; twitterHandle: string | null; socialLink: string | null; logsUrl: string | null; claimedAbilities: string | null; resultJson: any; tier: string }): Promise<AgentScanResult> {
    const [row] = await db
      .insert(agentScanResults)
      .values({
        slug: data.slug,
        agentName: data.agentName,
        wallet: data.wallet,
        chain: data.chain,
        twitterHandle: data.twitterHandle,
        socialLink: data.socialLink,
        logsUrl: data.logsUrl,
        claimedAbilities: data.claimedAbilities,
        resultJson: data.resultJson,
        tier: data.tier,
      })
      .returning();
    return row;
  }

  async upgradeAgentScanResultTier(slug: string, tier: string): Promise<AgentScanResult | null> {
    const [row] = await db
      .update(agentScanResults)
      .set({ tier })
      .where(eq(agentScanResults.slug, slug))
      .returning();
    return row || null;
  }

  async getAgentScanResultBySlug(slug: string): Promise<AgentScanResult | null> {
    const [row] = await db
      .select()
      .from(agentScanResults)
      .where(eq(agentScanResults.slug, slug))
      .limit(1);
    if (!row) return null;
    db.update(agentScanResults)
      .set({ viewCount: sql`${agentScanResults.viewCount} + 1` })
      .where(eq(agentScanResults.slug, slug))
      .execute()
      .catch(() => {});
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
