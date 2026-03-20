import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scamReports = pgTable("scam_reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  reportedBy: integer("reported_by").notNull(),
  scamType: text("scam_type").notNull(),
  evidenceUrl: text("evidence_url"),
  evidenceImage: text("evidence_image"),
  status: text("status").default("pending").notNull(),
  votes: integer("votes").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const heroNominations = pgTable("hero_nominations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  nominatedBy: integer("nominated_by").notNull(),
  evidenceUrl: text("evidence_url"),
  walletAddress: text("wallet_address"),
  votes: integer("votes").default(0).notNull(),
  approved: boolean("approved").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  targetId: integer("target_id").notNull(),
  targetType: text("target_type").notNull(),
  voteType: text("vote_type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  scamReports: many(scamReports),
  heroNominations: many(heroNominations),
  votes: many(votes),
}));

export const scamReportsRelations = relations(scamReports, ({ one, many }) => ({
  reportedByUser: one(users, {
    fields: [scamReports.reportedBy],
    references: [users.id],
  }),
  votes: many(votes),
}));

export const heroNominationsRelations = relations(heroNominations, ({ one, many }) => ({
  nominatedByUser: one(users, {
    fields: [heroNominations.nominatedBy],
    references: [users.id],
  }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
}));

export const flaggedWallets = pgTable("flagged_wallets", {
  id: serial("id").primaryKey(),
  address: text("address").notNull().unique(),
  chain: text("chain").notNull().default("ethereum"),
  reportCount: integer("report_count").notNull().default(0),
  riskLevel: text("risk_level").notNull(),
  topCategory: text("top_category"),
  apolVerdict: text("apol_verdict").notNull(),
  reports: jsonb("reports").default([]),
  flaggedAt: timestamp("flagged_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertScamReportSchema = createInsertSchema(scamReports).pick({
  title: true,
  description: true,
  reportedBy: true,
  scamType: true,
  evidenceUrl: true,
  evidenceImage: true,
});

export const insertHeroNominationSchema = createInsertSchema(heroNominations).pick({
  name: true,
  description: true,
  category: true,
  nominatedBy: true,
  evidenceUrl: true,
  walletAddress: true,
});

export const insertVoteSchema = createInsertSchema(votes).pick({
  userId: true,
  targetId: true,
  targetType: true,
  voteType: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertScamReport = z.infer<typeof insertScamReportSchema>;
export type ScamReport = typeof scamReports.$inferSelect;
export type InsertHeroNomination = z.infer<typeof insertHeroNominationSchema>;
export type HeroNomination = typeof heroNominations.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Vote = typeof votes.$inferSelect;
export type FlaggedWallet = typeof flaggedWallets.$inferSelect;
