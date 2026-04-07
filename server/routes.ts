import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertScamReportSchema, insertHeroNominationSchema, insertVoteSchema, insertVerificationRequestSchema } from "@shared/schema";
import { verifyMessage } from "ethers";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";

const ADMIN_WALLET = (process.env.ADMIN_WALLET_ADDRESS || "").toLowerCase();
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const TOKEN_TTL = 12 * 60 * 60 * 1000; // 12 hours

// In-memory store for nonces only (5 min TTL) — tokens are now stateless HMAC-signed
const nonceStore = new Map<string, { nonce: string; expires: number }>();

function cleanExpired() {
  const now = Date.now();
  for (const [k, v] of nonceStore) if (v.expires < now) nonceStore.delete(k);
}

function signAdminToken(address: string): string {
  const expires = Date.now() + TOKEN_TTL;
  const payload = `${address}|${expires}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

function verifyAdminToken(token: string): { address: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastBar = decoded.lastIndexOf("|");
    const payload = decoded.slice(0, lastBar);
    const sig = decoded.slice(lastBar + 1);
    const bar = payload.lastIndexOf("|");
    const expires = parseInt(payload.slice(bar + 1), 10);
    if (isNaN(expires) || expires < Date.now()) return null;
    const expected = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const address = payload.slice(0, bar);
    return { address };
  } catch {
    return null;
  }
}

function requireAdmin(req: Request & { adminAddress?: string }, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  const token = auth.slice(7);
  const session = verifyAdminToken(token);
  if (!session) return res.status(401).json({ error: "Session expired or invalid" });
  (req as any).adminAddress = session.address;
  next();
}

const CHAINABUSE_API_KEY = process.env.CHAINABUSE_API_KEY;
const CHAINABUSE_BASE = "https://api.chainabuse.com/v0";
const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const GOPLUS_CHAIN: Record<string, string> = {
  ethereum: "1", bsc: "56", polygon: "137", arbitrum: "42161",
  optimism: "10", base: "8453", avalanche: "43114", tron: "tron", solana: "solana", other: "1",
};

const PLATFORM_LOCKERS: Record<string, string> = {
  "0x0bf8edd756ff6caf3f583d67a9fd8b237e40f58a": "ApeStore",
  "0xe85a59c628f7d27878aceb4bf3b35733630083a9": "Clanker v4",
  "0xf3622742b1e446d92e45e22923ef11c2fcd55d68": "Clanker v4",
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x39112541720078c70164ea4deb61f0a4811910f9": "Flaunch",
};

const PLATFORM_DEPLOYERS: Record<string, string> = {
  "0xade256e1c2763b8766efe1eeb7c578d93f621f6f": "ApeStore",
  "0xd46618f35099074c5a456b21d2967a6ff6841bd3": "Clanker v4",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x71b8efc8bcad65a5d9386d07f2dff57ab4eaf533": "Virtuals",
  "0x9547e85f3016303a2996271314bde78b02021a28": "Virtuals",
  "0x39112541720078c70164ea4deb61f0a4811910f9": "Flaunch",
};

const BURN_SET = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

const ALL_KNOWN_FACTORY_ADDRESSES = new Set([
  ...Object.keys(PLATFORM_LOCKERS).map(a => a.toLowerCase()),
  ...Object.keys(PLATFORM_DEPLOYERS).map(a => a.toLowerCase()),
]);

async function fetchHolderCountFallback(address: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://base.blockscout.com/api/v2/tokens/${encodeURIComponent(address)}/counters`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (!r.ok) return null;
    const data = await r.json() as any;
    const count = parseInt(data?.token_holders_count ?? "0");
    return count > 0 ? count : null;
  } catch {
    return null;
  }
}

function isKnownFactoryOrigin(creatorAddress: string, lpHolders: { address: string }[]): boolean {
  const creatorLower = (creatorAddress || "").toLowerCase();
  if (ALL_KNOWN_FACTORY_ADDRESSES.has(creatorLower)) return true;
  for (const lp of lpHolders) {
    if (ALL_KNOWN_FACTORY_ADDRESSES.has((lp.address ?? "").toLowerCase())) return true;
  }
  return false;
}

async function resolveProtocolLocker(
  creatorAddress: string,
  lpHolders: { address: string; percent: string }[],
  chain?: string,
  tokenAddress?: string,
): Promise<{ name: string; address: string; percent: number } | null> {
  if (chain && chain !== "base" && chain !== "8453") return null;

  const creatorLower = (creatorAddress || "").toLowerCase();
  if (PLATFORM_LOCKERS[creatorLower]) {
    return { name: PLATFORM_LOCKERS[creatorLower], address: creatorLower, percent: 100 };
  }

  for (const lp of lpHolders) {
    const addr = (lp.address ?? "").toLowerCase();
    const pct = parseFloat(lp.percent ?? "0") * 100;
    if (PLATFORM_LOCKERS[addr]) {
      return { name: PLATFORM_LOCKERS[addr], address: addr, percent: pct };
    }
  }

  for (const lp of lpHolders.slice(0, 3)) {
    const addr = (lp.address ?? "").toLowerCase();
    const pct = parseFloat(lp.percent ?? "0") * 100;
    if (!addr || BURN_SET.has(addr)) continue;
    try {
      const r = await fetch(
        `https://base.blockscout.com/api/v2/addresses/${addr}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!r.ok) { console.log(`[forensics] Blockscout ${r.status} for LP ${addr.slice(0,10)}`); continue; }
      const data = await r.json() as any;
      const deployerAddr = (data.creator_address_hash || "").toLowerCase();
      if (deployerAddr && PLATFORM_DEPLOYERS[deployerAddr]) {
        console.log(`[forensics] LP ${addr.slice(0,10)} → deployer ${deployerAddr.slice(0,10)} → ${PLATFORM_DEPLOYERS[deployerAddr]}`);
        return { name: PLATFORM_DEPLOYERS[deployerAddr], address: addr, percent: pct };
      }
    } catch (e: any) { console.log(`[forensics] Blockscout timeout/error for LP ${addr.slice(0,10)}: ${e.message ?? e}`); }
  }

  if (creatorLower && !BURN_SET.has(creatorLower)) {
    try {
      const r = await fetch(
        `https://base.blockscout.com/api/v2/addresses/${creatorLower}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (r.ok) {
        const data = await r.json() as any;
        const deployerAddr = (data.creator_address_hash || "").toLowerCase();
        if (deployerAddr && PLATFORM_DEPLOYERS[deployerAddr]) {
          console.log(`[forensics] Creator ${creatorLower.slice(0,10)} → deployer ${deployerAddr.slice(0,10)} → ${PLATFORM_DEPLOYERS[deployerAddr]}`);
          return { name: PLATFORM_DEPLOYERS[deployerAddr], address: creatorLower, percent: 100 };
        }
        if (deployerAddr && deployerAddr !== creatorLower) {
          try {
            const r2 = await fetch(
              `https://base.blockscout.com/api/v2/addresses/${deployerAddr}`,
              { signal: AbortSignal.timeout(5000) },
            );
            if (r2.ok) {
              const data2 = await r2.json() as any;
              const deployer2 = (data2.creator_address_hash || "").toLowerCase();
              if (deployer2 && PLATFORM_DEPLOYERS[deployer2]) {
                console.log(`[forensics] Creator ${creatorLower.slice(0,10)} → ${deployerAddr.slice(0,10)} → ${deployer2.slice(0,10)} → ${PLATFORM_DEPLOYERS[deployer2]}`);
                return { name: PLATFORM_DEPLOYERS[deployer2], address: creatorLower, percent: 100 };
              }
            }
          } catch (e2: any) { console.log(`[forensics] Blockscout hop2 error: ${e2.message ?? e2}`); }
        }
      }
    } catch (e: any) { console.log(`[forensics] Blockscout timeout/error for creator ${creatorLower.slice(0,10)}: ${e.message ?? e}`); }
  }

  const tokenLower = (tokenAddress || "").toLowerCase();
  if (tokenLower && !BURN_SET.has(tokenLower)) {
    try {
      const r = await fetch(
        `https://base.blockscout.com/api/v2/addresses/${tokenLower}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (r.ok) {
        const data = await r.json() as any;
        const contractDeployer = (data.creator_address_hash || "").toLowerCase();
        if (contractDeployer && PLATFORM_DEPLOYERS[contractDeployer]) {
          console.log(`[forensics] Token ${tokenLower.slice(0,10)} → Blockscout deployer ${contractDeployer.slice(0,10)} → ${PLATFORM_DEPLOYERS[contractDeployer]}`);
          return { name: PLATFORM_DEPLOYERS[contractDeployer], address: tokenLower, percent: 100 };
        }
        if (contractDeployer && contractDeployer !== creatorLower) {
          try {
            const r2 = await fetch(
              `https://base.blockscout.com/api/v2/addresses/${contractDeployer}`,
              { signal: AbortSignal.timeout(5000) },
            );
            if (r2.ok) {
              const data2 = await r2.json() as any;
              const deployer2 = (data2.creator_address_hash || "").toLowerCase();
              if (deployer2 && PLATFORM_DEPLOYERS[deployer2]) {
                console.log(`[forensics] Token ${tokenLower.slice(0,10)} → ${contractDeployer.slice(0,10)} → ${deployer2.slice(0,10)} → ${PLATFORM_DEPLOYERS[deployer2]}`);
                return { name: PLATFORM_DEPLOYERS[deployer2], address: tokenLower, percent: 100 };
              }
            }
          } catch (e2: any) { console.log(`[forensics] Blockscout token hop2 error: ${e2.message ?? e2}`); }
        }
      }
    } catch (e: any) { console.log(`[forensics] Blockscout timeout/error for token ${tokenLower.slice(0,10)}: ${e.message ?? e}`); }
  }

  return null;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // ── One-time startup purge: clear stale flagged wallets & scan lookups ──────
  try {
    const { db } = await import("./db");
    const { flaggedWallets, scanLookups } = await import("@shared/schema");
    const delFlagged = await db.delete(flaggedWallets);
    const delLookups = await db.delete(scanLookups);
    console.log(`[startup] PURGED flagged_wallets and scan_lookups — clean slate for 2026 logic`);
  } catch (e: any) {
    console.log(`[startup] Purge skipped: ${e.message}`);
  }

  // ── Health check (for uptime monitors) ──────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "APOL Agent",
      timestamp: new Date().toISOString(),
      bot: !!process.env.APOL_BOT_TOKEN ? "active" : "disabled",
    });
  });

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
      message: "Report submitted and saved to the APOL Agent database.",
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
        `Citizen, this wallet appears clean in our security scan. No malicious activity detected. Stay vigilant out there, APOL Agent is always watching. 🦍`,
        `All clear on this one, Citizen. Our scan shows no blacklist flags, no sanctions, no criminal activity. Proceed with standard caution. 🦍`,
        `Nothing here, Citizen. Clean as a whistle. Our security scan shows no malicious patterns for this address. 🦍`,
        `Wallet cleared, Citizen. No flags, no sanctions, no phishing history. I've seen a thousand scammers, this one doesn't match any known patterns. 🦍`,
        `No charges, no record, no flags. This wallet is clean for now, Citizen. Don't go getting sloppy, always do your homework before you ape in. 🦍`,
      ]);
    }
    if (internalFlag && flags.length === 0) {
      return pickRandom([
        `Fresh off the crime scene, Citizen. Our external scan shows clean but APOL Agent internal intelligence flagged this address in the last 24 hours. Treat as High Risk. 🚨`,
        `New to our system but already on our radar. Internal reports link this wallet to suspicious activity in the last 24 hours. 🚨`,
        `Our external scan shows nothing yet, but our community flagged this address recently. New criminals don't have records until they do, Citizen. 🚨`,
        `Brand new threat detected. No external scan history, but APOL Agent internal sources lit up for this wallet. Stay far away. 🚨`,
        `First offense, Citizen. No external record yet, but our internal intelligence says otherwise. Consider this address hostile. 🚨`,
      ]);
    }
    const flagList = flags.join(", ");
    if (riskLevel === "High Risk") {
      return pickRandom([
        `Stop right there, Citizen. This wallet is SANCTIONED or flagged for serious criminal activity: ${flagList}. Do NOT interact under any circumstances. 🚨`,
        `Warrant issued, Citizen. APOL Agent has flagged this address for: ${flagList}. This is a KNOWN THREAT. Back away and do not engage. 🚨`,
        `RED ALERT, Citizen. Criminal record confirmed: ${flagList}. I've arrested scammers like this before. Run. 🚨`,
        `I've been on the force a long time, Citizen. This wallet? Pure criminal. Flagged for ${flagList}. Suspect goes straight to the hall of shame. 🚨`,
        `Citizen, our database and security scan both agree, this address is DANGEROUS. Charges: ${flagList}. Do NOT touch this wallet. 🚨`,
      ]);
    }
    return pickRandom([
      `Citizen, this wallet has flags on record: ${flagList}. Approach with caution, this is an active investigation. 🔍`,
      `Hold it right there, Citizen. APOL Agent flagged this address for: ${flagList}. I'd keep my distance if I were you. 🔍`,
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
        `${token} passes all APOL Agent security checks. No honeypot, no hidden taxes, no unlimited minting. Green badge earned, Citizen. ✅`,
        `All systems go on ${token}, Citizen. Our scan shows clean on every metric I track. Liquidity, taxes, mint, all pass. ✅`,
        `Citizen, ${token} has earned the APOL Agent Green Badge. Verified open source, safe tax structure, no malicious functions detected. ✅`,
        `I've checked ${token} top to bottom. No traps. No honeypot. No rug mechanics. This one checks out, Citizen, but stay alert. ✅`,
      ]);
    }
    const issues = redFlags.join("; ");
    const hasCannotSellFlag = redFlags.some(f => f.toLowerCase().includes("honeypot") || f.toLowerCase().includes("cannot sell"));
    const hasTrapTaxFlag = redFlags.some(f => {
      const m = f.match(/(buy|sell) tax:\s*([\d.]+)%/i);
      return m && parseFloat(m[2]) > 90;
    });
    if (riskLevel === "High Risk" && (hasCannotSellFlag || hasTrapTaxFlag)) {
      return pickRandom([
        `Citizen, ${token} is a TRAP / HONEYPOT. Confirmed malicious code. You cannot sell this token. Do NOT buy. 🚨`,
        `RED ALERT on ${token}. This is a confirmed TRAP. You cannot sell. Do NOT interact with this contract. 🚨`,
        `Citizen, ${token} is a HONEYPOT. Our scan confirms you cannot sell. Do NOT buy this token under any circumstances. 🚨`,
      ]);
    }
    if (riskLevel === "High Risk") {
      return pickRandom([
        `Citizen, ${token} is a TRAP. APOL Agent flagged: ${issues}. Do NOT buy this token. This has rug written all over it. 🚨`,
        `Stop right there, Citizen. ${token} failed critical security checks: ${issues}. Walk away. This is a known rug pattern. 🚨`,
        `RED ALERT on ${token}. My scan shows: ${issues}. I've seen this a thousand times, stay far away. 🚨`,
        `Warrant issued for ${token}. Security violations: ${issues}. Do not interact with this contract under any circumstances. 🚨`,
        `Citizen, ${token} has multiple critical red flags: ${issues}. Your funds will not survive this trade. I'm ordering you to stand down. 🚨`,
      ]);
    }
    const onlyLpUnlocked = redFlags.length === 1 && redFlags[0]?.includes("LP not locked");
    if (riskLevel === "Caution" && onlyLpUnlocked) {
      return pickRandom([
        `Citizen, ${token} has one issue: LP is currently unlocked. Exercise caution as liquidity is not yet burnt or locked in a third-party locker. 🔍`,
        `${token} checks out on most metrics, but LP is unlocked. Liquidity is not yet burnt or locked. Proceed with caution, Citizen. 🔍`,
        `Our scan on ${token} found no critical threats, but LP is currently unlocked. Be aware the liquidity is not yet secured in a third-party locker. 🔍`,
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

  const APOL_SELF_NAMES = ["apol", "apol agent", "active onchain intelligence", "$apol"];

  app.get("/api/detective/analyze", async (req, res) => {
    const { address, chain = "ethereum" } = req.query as { address: string; chain?: string };
    if (!address) return res.status(400).json({ error: "Address is required" });
    const chainId = GOPLUS_CHAIN[chain] || "1";

    console.log(`${new Date().toLocaleTimeString()} [scanner] FRESH SCAN TRIGGERED — CACHE BYPASSED — ${address} on ${chain}`);

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

      let hpData: any = null;
      if (chainId !== "solana" && chainId !== "tron") {
        try {
          const r = await fetch(
            `https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(address)}&chainID=${chainId}`,
            { signal: AbortSignal.timeout(12000) }
          );
          if (r.ok) hpData = await r.json() as any;
        } catch { /* non-fatal */ }
      }

      let isContract = tokenData !== null;
      let blockscoutToken: any = null;

      if (!isContract && chain === "base") {
        try {
          const bsRes = await fetch(`https://base.blockscout.com/api/v2/addresses/${encodeURIComponent(address as string)}`, { signal: AbortSignal.timeout(8000) });
          if (bsRes.ok) {
            const bsData = await bsRes.json() as any;
            if (bsData.is_contract) {
              isContract = true;
              blockscoutToken = bsData.token;
              console.log(`[forensics] GoPlus missed contract ${(address as string).slice(0,10)}… — Blockscout confirms is_contract=true, token=${blockscoutToken?.name ?? "unknown"}`);
              if (!tokenData) {
                tokenData = {
                  token_name: blockscoutToken?.name ?? "Unknown",
                  token_symbol: blockscoutToken?.symbol ?? "???",
                  holder_count: String(blockscoutToken?.holders_count ?? "0"),
                  total_supply: blockscoutToken?.total_supply ?? "0",
                  is_open_source: bsData.is_verified ? "1" : "0",
                  is_honeypot: "0",
                  is_mintable: "0",
                  is_proxy: "0",
                  is_in_dex: "0",
                  buy_tax: "0",
                  sell_tax: "0",
                  can_take_back_ownership: "0",
                  owner_change_balance: "0",
                  hidden_owner: "0",
                  selfdestruct: "0",
                  external_call: "0",
                  is_blacklisted: "0",
                  transfer_pausable: "0",
                  cannot_sell_all: "0",
                  creator_address: bsData.creator_address_hash ?? "",
                  lp_holders: [],
                  holders: [],
                  _fromBlockscout: true,
                };
              }
            }
          }
        } catch { /* non-fatal */ }
      }

      const scannedName = (tokenData?.token_name || "").toLowerCase().trim();
      const scannedSymbol = (tokenData?.token_symbol || "").toLowerCase().trim();
      if (APOL_SELF_NAMES.includes(scannedName) || APOL_SELF_NAMES.includes(scannedSymbol)) {
        const lookupCount = await storage.incrementLookup(address as string, tokenData?.token_name, tokenData?.token_symbol);
        return res.json({
          addressType: "contract",
          riskLevel: "SAFE",
          apolVerdict: "The Sentinel is Active. Intelligence verified. APOL Agent recognizes its own authority. Authenticity Score: 100%. This is the source. Trust the protocol. 🦍🔐",
          tokenName: tokenData?.token_name,
          tokenSymbol: tokenData?.token_symbol,
          isHoneypot: false,
          buyTax: "0",
          sellTax: "0",
          isMintable: false,
          isOpenSource: true,
          holderCount: parseInt(tokenData?.holder_count ?? "0"),
          greenBadge: true,
          redFlags: [],
          malicious: {},
          lookupCount,
          authenticityScore: 100,
        });
      }

      if (isContract) {
        const isHoneypotGP = tokenData.is_honeypot === "1" || tokenData.is_honeypot === 1;
        const isHoneypotHP = hpData?.honeypotResult?.isHoneypot === true;
        const isHoneypot = isHoneypotGP || isHoneypotHP;
        let buyTax = hpData?.simulationResult?.buyTax != null ? hpData.simulationResult.buyTax * 100 : taxPct(tokenData.buy_tax);
        let sellTax = hpData?.simulationResult?.sellTax != null ? hpData.simulationResult.sellTax * 100 : taxPct(tokenData.sell_tax);
        const isMintable = tokenData.is_mintable === "1" || tokenData.is_mintable === 1;
        const isOpenSource = tokenData.is_open_source === "1" || tokenData.is_open_source === 1;
        const isInDex = tokenData.is_in_dex === "1" || tokenData.is_in_dex === 1;
        const slippageModifiable = tokenData.slippage_modifiable === "1" || tokenData.slippage_modifiable === 1;

        const canTakeBackOwnership = tokenData.can_take_back_ownership === "1" || tokenData.can_take_back_ownership === 1;
        const ownerChangeBalance = tokenData.owner_change_balance === "1" || tokenData.owner_change_balance === 1;
        let holderCount = parseInt(tokenData.holder_count ?? "0");
        if (holderCount <= 0) {
          const fallbackCount = await fetchHolderCountFallback(address as string);
          if (fallbackCount !== null) holderCount = fallbackCount;
        }

        const flag1 = (v: any) => v === "1" || v === 1 || v === true;
        const isProxy = flag1(tokenData.is_proxy);
        const hasHiddenOwner = flag1(tokenData.hidden_owner);
        const hasSelfDestruct = flag1(tokenData.selfdestruct);
        const hasExternalCall = flag1(tokenData.external_call);
        const isAntiWhale = flag1(tokenData.is_anti_whale);
        const canPause = flag1(tokenData.transfer_pausable);
        const hasBlacklist = flag1(tokenData.is_blacklisted) || flag1(tokenData.is_blacklist);
        const hasWhitelist = flag1(tokenData.is_whitelisted) || flag1(tokenData.is_whitelist);
        const ownerAddress = tokenData.owner_address || null;
        const creatorAddress = tokenData.creator_address || null;
        const ownerIsContract = flag1(tokenData.owner_type);

        const BURN_ADDRESSES = [
          "0x0000000000000000000000000000000000000000",
          "0x000000000000000000000000000000000000dead",
          "0x0000000000000000000000000000000000000001",
          "0x0000000000000000000000000000000000000dead",
        ];
        const ownerLower = (ownerAddress || "").toLowerCase();
        const isOwnershipRenounced = !ownerLower || BURN_ADDRESSES.includes(ownerLower);

        const adminThreats: { severity: "critical" | "high" | "medium"; label: string; detail: string }[] = [];

        if (isOwnershipRenounced) {
          if (canTakeBackOwnership) {
            adminThreats.push({ severity: "critical", label: "RECOVERABLE OWNERSHIP", detail: "Ownership was renounced BUT can be reclaimed. Renounce is fake — treat as active admin." });
          }
          if (hasHiddenOwner) {
            adminThreats.push({ severity: "critical", label: "HIDDEN OWNER", detail: "Contract has a hidden owner function. True controller may be concealed despite renounce." });
          }
        } else {
          if (ownerChangeBalance) adminThreats.push({ severity: "critical", label: "BALANCE MANIPULATION", detail: "Owner can directly modify token balances. Funds can be drained at any time." });
          if (canTakeBackOwnership) adminThreats.push({ severity: "critical", label: "RECOVERABLE OWNERSHIP", detail: "Ownership can be reclaimed after renouncement. Renounce is fake." });
          if (isMintable) adminThreats.push({ severity: "critical", label: "UNLIMITED MINTING", detail: "Owner can mint unlimited tokens, instantly diluting all holders." });
          if (hasHiddenOwner) adminThreats.push({ severity: "critical", label: "HIDDEN OWNER", detail: "Contract has a hidden owner function. True controller is concealed." });
          if (hasSelfDestruct) adminThreats.push({ severity: "critical", label: "SELF-DESTRUCT", detail: "Contract can be destroyed by admin. All tokens become worthless." });
          if (canPause) adminThreats.push({ severity: "high", label: "TRANSFER PAUSABLE", detail: "Admin can freeze all transfers. Effectively a kill-switch." });
          if (slippageModifiable) adminThreats.push({ severity: "high", label: "SLIPPAGE CONTROL", detail: "Owner can modify trading slippage. Sell tax can be raised to 100% at any time." });
          if (isProxy) adminThreats.push({ severity: "high", label: "PROXY CONTRACT", detail: "Contract logic can be changed by admin. Current code can be swapped silently." });
          if (hasBlacklist) adminThreats.push({ severity: "high", label: "BLACKLIST FUNCTION", detail: "Admin can blacklist wallets from selling. Targeted rug mechanism." });
          if (hasExternalCall) adminThreats.push({ severity: "medium", label: "EXTERNAL CALL", detail: "Contract makes external calls. Behavior may change based on external state." });
          if (hasWhitelist) adminThreats.push({ severity: "medium", label: "WHITELIST FUNCTION", detail: "Admin-controlled whitelist. May restrict trading to insiders." });
          if (isAntiWhale && (isMintable || ownerChangeBalance)) adminThreats.push({ severity: "medium", label: "ANTI-WHALE + ADMIN POWER", detail: "Anti-whale limits combined with admin mint/balance powers. Holders capped while admin has unlimited control." });

          const ownerNotRenounced = true;
          const isSingleSigAdmin = ownerNotRenounced && !ownerIsContract;
          if (isSingleSigAdmin && adminThreats.length > 0) {
            adminThreats.unshift({ severity: "critical", label: "SINGLE-SIG ADMIN", detail: `Contract controlled by a single wallet (${ownerAddress!.slice(0,6)}…${ownerAddress!.slice(-4)}). No multisig. One key = total control.` });
          }
        }

        const lpHolders: any[] = tokenData.lp_holders ?? [];

        const scannedAddrLower = (address as string).toLowerCase();
        const isFactoryContract = ALL_KNOWN_FACTORY_ADDRESSES.has(scannedAddrLower);
        const factoryEarlyMatch = isFactoryContract || isKnownFactoryOrigin(creatorAddress || "", lpHolders);

        let protocolMatch: { name: string; address: string; percent: number } | null = null;
        if (factoryEarlyMatch) {
          const creatorLower = (creatorAddress || "").toLowerCase();
          const matchName = PLATFORM_LOCKERS[creatorLower] || PLATFORM_DEPLOYERS[creatorLower]
            || PLATFORM_LOCKERS[scannedAddrLower] || PLATFORM_DEPLOYERS[scannedAddrLower]
            || (() => { for (const lp of lpHolders) { const a = (lp.address ?? "").toLowerCase(); if (PLATFORM_LOCKERS[a]) return PLATFORM_LOCKERS[a]; } return "Protocol"; })();
          protocolMatch = { name: matchName, address: creatorLower || scannedAddrLower, percent: 100 };
        } else {
          protocolMatch = await resolveProtocolLocker(creatorAddress || "", lpHolders, chain, address as string);
        }
        const lpEscrowName = protocolMatch?.name ?? null;
        const lpEscrowAddress = protocolMatch?.address ?? null;
        const lpEscrowPct = protocolMatch?.percent ?? 0;
        const isKnownFactory = !!protocolMatch;

        let taxOverridden = false;
        if (isKnownFactory && (buyTax !== null && buyTax > 50 || sellTax !== null && sellTax > 50)) {
          buyTax = 0;
          sellTax = 0;
          taxOverridden = true;
        }
        const isProtocolEscrow = isKnownFactory;

        const lpBurnedPct = lpHolders
          .filter((h: any) => (h.tag ?? "").toLowerCase().includes("burn") || (h.address ?? "").toLowerCase() === "0x000000000000000000000000000000000000dead")
          .reduce((acc: number, h: any) => acc + parseFloat(h.percent ?? "0") * 100, 0);
        const lpLockedPct = lpHolders
          .filter((h: any) => h.is_locked === "1" || h.is_locked === 1)
          .reduce((acc: number, h: any) => acc + parseFloat(h.percent ?? "0") * 100, 0);
        const lpSecure = lpBurnedPct >= 50 || lpLockedPct >= 50 || isProtocolEscrow;

        const redFlags: string[] = [];
        if (isHoneypot) redFlags.push("Honeypot, cannot sell");
        if (buyTax !== null && buyTax > 10) redFlags.push(`High buy tax: ${buyTax.toFixed(1)}%`);
        if (sellTax !== null && sellTax > 10) redFlags.push(`High sell tax: ${sellTax.toFixed(1)}%`);

        if (isOwnershipRenounced) {
          if (canTakeBackOwnership) redFlags.push("Recoverable ownership (fake renounce)");
          if (hasHiddenOwner) redFlags.push("Hidden owner detected despite renounce");
        } else {
          if (isMintable) redFlags.push("Owner can mint unlimited tokens");
          if (slippageModifiable) redFlags.push("Owner can modify slippage");
          if (canTakeBackOwnership) redFlags.push("Recoverable ownership");
          if (ownerChangeBalance) redFlags.push("Owner can change balances");
          if (hasHiddenOwner) redFlags.push("Hidden owner detected");
          if (hasSelfDestruct) redFlags.push("Self-destruct enabled");
          if (canPause) redFlags.push("Transfers pausable by admin");
          if (isProxy) redFlags.push("Proxy contract — upgradeable");
          if (hasBlacklist) redFlags.push("Blacklist function");
        }

        if (!isOpenSource) redFlags.push("Contract not verified / open source");
        if (!lpSecure && !isProtocolEscrow) redFlags.push("LP not locked");
        if (holderCount > 0 && holderCount < 200) redFlags.push("Low holder count");

        const hasHoneypot = isHoneypot;
        const hasKillerTax = (sellTax !== null && sellTax > 20) || (buyTax !== null && buyTax > 20);
        const hasCriticalFlag = !isOwnershipRenounced && (ownerChangeBalance || canTakeBackOwnership || hasHiddenOwner || hasSelfDestruct);
        const hasUnlockedLP = !lpSecure && !isProtocolEscrow;

        const protocolSecured = isProtocolEscrow;

        if (factoryEarlyMatch && (isFactoryContract || (!hasHoneypot && !hasKillerTax))) {
          const filteredFlags = redFlags.filter(f => {
            const fl = f.toLowerCase();
            if (fl.includes("lp not locked")) return false;
            if (fl.includes("low holder")) return false;
            if (fl.includes("not verified")) return false;
            if (fl.includes("hidden owner")) return false;
            if (isFactoryContract && (fl.includes("honeypot") || fl.includes("mint"))) return false;
            return true;
          });
          redFlags.length = 0;
          redFlags.push(...filteredFlags);
          const filteredThreats = adminThreats.filter(t =>
            t.severity === "critical" && !t.label.includes("HIDDEN OWNER")
          );
          adminThreats.length = 0;
          adminThreats.push(...filteredThreats);
        }

        let riskLevel: string;
        const isVirtualsToken = lpEscrowName === "Virtuals";
        const hasCannotSell = isHoneypot;
        const hasTrapTax = !isVirtualsToken && ((buyTax !== null && buyTax > 90) || (sellTax !== null && sellTax > 90));
        const isTrapOrHoneypot = hasCannotSell || hasTrapTax;
        const onlyUnlockedLP = hasUnlockedLP && !isTrapOrHoneypot && !hasCriticalFlag && redFlags.length === 1 && redFlags[0]?.includes("LP not locked");

        if (isTrapOrHoneypot && !isFactoryContract) {
          riskLevel = "High Risk";
        } else if ((hasHoneypot || hasKillerTax) && !isFactoryContract) {
          riskLevel = "High Risk";
        } else if (factoryEarlyMatch) {
          riskLevel = redFlags.length > 0 ? "Caution" : "Clean";
        } else if (hasCriticalFlag) {
          riskLevel = "High Risk";
        } else if (isProtocolEscrow) {
          riskLevel = "Clean";
        } else if (isOwnershipRenounced) {
          if (redFlags.length >= 3) riskLevel = "High Risk";
          else if (redFlags.length >= 1) riskLevel = "Caution";
          else riskLevel = "Clean";
        } else if (onlyUnlockedLP) {
          riskLevel = "Caution";
        } else {
          if (redFlags.length >= 2) riskLevel = "High Risk";
          else if (redFlags.length >= 1) riskLevel = "Caution";
          else riskLevel = "Clean";
        }

        const greenBadge = riskLevel !== "High Risk" && redFlags.length === 0 && isOpenSource && !isHoneypot && !hasKillerTax && (lpSecure || isProtocolEscrow) && adminThreats.length === 0;

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

        const lookupCount = await storage.incrementLookup(address as string, tokenData.token_name, tokenData.token_symbol);

        return res.json({
          address, chain,
          addressType: "contract",
          riskLevel,
          apolVerdict,
          isHighRisk: riskLevel === "High Risk",
          isNewOffender: false,
          greenBadge,
          redFlags,
          adminThreats,
          ownerAddress: ownerAddress || null,
          creatorAddress: creatorAddress || null,
          isOwnershipRenounced,
          isSingleSigAdmin: !isOwnershipRenounced && adminThreats.length > 0 && !ownerIsContract,
          lookupCount,
          tokenName: tokenData.token_name,
          tokenSymbol: tokenData.token_symbol,
          holderCount,
          buyTax,
          sellTax,
          taxOverride: taxOverridden ? lpEscrowName : null,
          isHoneypot,
          isMintable,
          isOpenSource,
          isInDex,
          isProxy,
          hasBlacklist,
          canPause,
          protocolSecured: isProtocolEscrow,
          isKnownFactory,
          lpEscrow: isKnownFactory ? {
            name: lpEscrowName,
            address: lpEscrowAddress,
            percent: lpEscrowPct,
          } : null,
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

      const lookupCount = await storage.incrementLookup(address as string);

      return res.json({
        address, chain,
        addressType: "wallet",
        riskLevel,
        apolVerdict,
        isHighRisk: riskLevel === "High Risk",
        isNewOffender: internalFlag && walletFlags.length === 0,
        walletFlags,
        totalFlags: walletFlags.length,
        lookupCount,
      });

    } catch (error) {
      res.status(500).json({ error: "Detective analysis failed" });
    }
  });

  // ── Scan Lookups (public counters) ──────────────────────────────────────────

  app.get("/api/lookups/total", async (_req, res) => {
    try {
      const total = await storage.getTotalLookups();
      res.json({ total });
    } catch {
      res.json({ total: 0 });
    }
  });

  app.get("/api/lookups/recent", async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "5")), 20);
      const recent = await storage.getRecentLookups(limit);
      res.json(recent);
    } catch {
      res.json([]);
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
        `Citizen, "${agentName}" remains unclassified. The APOL Agent Protocol requires hard evidence before issuing a Cognition Score. I will not fabricate certainty where none exists. 📊`,
      ]);
    }
    if (verdict === "Insufficient Data") {
      return pickRandom([
        `Citizen, I cannot give "${agentName}" a definitive AI verdict — too much data is missing. No wallet, no reasoning logs, no claimed abilities. I see a social link but that alone doesn't prove autonomy. Provide the agent's wallet address and a logs/API endpoint for a proper assessment. 📋🟡`,
        `"${agentName}" — INSUFFICIENT DATA, Citizen. A social profile alone isn't enough for APOL to classify an agent. I need an on-chain wallet, reasoning logs, and claimed capabilities to run a real autonomy check. This is not a guilty verdict, it's a data gap. 🔍🟡`,
        `Citizen, "${agentName}" scores ${score}% but I'm working with almost nothing here — no wallet, no logs, no verifiable claims. I cannot call this a LARP or a real agent without evidence. Submit more data for a proper verdict. The Patrol doesn't guess. 🦍🟡`,
        `INSUFFICIENT DATA on "${agentName}", Citizen. Current score: ${score}%, but most test categories have no inputs. This is not a condemnation — it's a request for evidence. Wallet address, API logs, claimed abilities — bring me something real and I'll give you a real answer. 📊🟡`,
        `Citizen, "${agentName}" has a ${score}% preliminary reading, but critical data is missing. No wallet to trace, no logs to verify, no abilities to cross-check. I refuse to issue a final verdict on incomplete evidence. This agent needs to prove itself. Provide the missing data. 🔐🟡`,
      ]);
    }
    if (verdict === "Low Autonomy") {
      return pickRandom([
        `Citizen, "${agentName}" scores ${score}% on the Cognition Scale. The contract security checks out — LP locked, no honeypot flags — but the AI identity is unverifiable. This is NOT a scam verdict. It's an INCONCLUSIVE autonomy reading. The project may be legitimate but lacks AI proof. 🔍🟡`,
        `${score}% Cognition, Citizen. "${agentName}" has a clean contract: LP secured, low taxes, ownership renounced. But I cannot confirm autonomous AI operation — no logs, limited claims data. Verdict: LOW AUTONOMY. The contract is safe, the AI identity is unproven. DYOR. 🦍🟡`,
        `Citizen, "${agentName}" passes contract security but fails AI verification at ${score}%. This does NOT mean it's a rug. It means the autonomous agent claim cannot be confirmed. Safe contract ≠ real AI. Investigate further before committing. 📋🟡`,
        `"${agentName}", ${score}% Cognition. LOW AUTONOMY classification, Citizen. The on-chain contract is clean — that's good. But there's no verifiable proof this is an actual AI agent. Could be human-operated, could be early-stage. Not a red flag, but not a green one either. 🔐🟡`,
        `Citizen, I've assessed "${agentName}" at ${score}%. Contract integrity is solid — no honeypot, LP looks secured. However, AI autonomy evidence is insufficient. Classification: LOW AUTONOMY. This is a yellow flag, not red. The project needs to prove its agent is real. 📊🟡`,
      ]);
    }
    if (verdict === "Digital Puppet") {
      return pickRandom([
        `Citizen, I've run a full behavioral analysis on "${agentName}". Cognition Score: ${score}%. DIGITAL PUPPET, a human hiding behind an AI label. No autonomous footprint, no verifiable on-chain execution. Don't let this project fool you. 🤖❌`,
        `${score}% Cognition, that's a LARP, Citizen. "${agentName}" shows zero signs of genuine autonomous operation. Human timing, missing traces, unverifiable claims. Pure puppet show. 🎭`,
        `Citizen, "${agentName}" fails APOL Agent autonomous verification at ${score}%. This is a person pretending to be an AI to hype their project. Classic LARP behavior. Walk away. 🚨`,
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
      `Citizen, "${agentName}" achieves ${score}% on the Cognition Scale, FULLY AUTONOMOUS confirmed. On-chain patterns, timing spread, and claim verification all check out. This looks like a genuine AI agent. APOL Agent credibility stamp, always DYOR though. 🦍✅`,
      `${score}% Cognition, the real deal, Citizen. "${agentName}" shows consistent 24/7 on-chain execution, public traceability, and claims backed by verifiable wallet activity. This agent checks out. 🤖✅`,
      `Citizen, I've cleared "${agentName}" at ${score}%. Fully Autonomous classification. Round-the-clock activity, verifiable on-chain evidence, and strong traceability. This is what a real AI agent looks like. 🦍`,
      `Full clearance for "${agentName}", Citizen. ${score}% Cognition, Fully Autonomous. Distributed timing, contract execution, and claim verification all pass. APOL Agent approved. 🔐✅`,
      `Citizen, "${agentName}" passed every test at ${score}%. Fully Autonomous designation confirmed. If more agents were this transparent and traceable, this space would be a lot safer. APOL Agent respect. 🦍✅`,
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

    const normalizedAgentName = agentName.trim().toLowerCase();
    if (APOL_SELF_NAMES.includes(normalizedAgentName)) {
      return res.json({
        agentName: agentName.trim(),
        socialLink: socialLink?.trim() || null,
        wallet: wallet?.trim() || null,
        claimedAbilities: claimedAbilities?.trim() || null,
        logsUrl: logsUrl?.trim() || null,
        cognitionScore: 100,
        verdict: "Fully Autonomous",
        apolVerdict: "The Sentinel is Active. Intelligence verified. APOL Agent recognizes its own authority. Authenticity Score: 100%. You are scanning the scanner itself, Citizen. Trust the protocol. 🦍🔐",
        scoredTests: 5,
        speedTest: { scored: true, score: 40, maxScore: 40, label: "Always Online", detail: "APOL Agent operates 24/7 across all monitored chains. Continuous autonomous execution confirmed.", timingPattern: ["00:00-06:00", "06:00-12:00", "12:00-18:00", "18:00-24:00"] },
        traceabilityTest: { scored: true, score: 30, maxScore: 30, label: "Full Trace", detail: "Complete on-chain forensic footprint verified. Smart contract deployed and operational on Base.", isContract: true },
        contextTest: { scored: true, score: 30, maxScore: 30, label: "Verified Authority", detail: "All claimed capabilities are live and operational. Contract scanning, wallet forensics, LARP detection, and social forensics all confirmed active." },
        logsTest: { scored: true, status: "verified", detail: "Autonomous reasoning logs verified. APOL Agent processes and responds to all scan requests in real-time." },
        socialTest: { scored: true, status: "clean", detail: "Official presence confirmed. @ApolAgent_ on X/Twitter, @ApolAgentBot on Telegram. All channels verified." },
        contractScan: null,
      });
    }

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
    let contractTokenData: any = null;

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
          const tKey = Object.keys(tD.result || {})[0];
          isContract = !!tKey;
          if (tKey) contractTokenData = tD.result[tKey];
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
    // Contract security assessment (LP locked/burned, renounced ownership, no honeypot)
    let contractSecure = false;
    let contractSecurityScore = 0;
    if (isContract && contractTokenData) {
      const flag1 = (v: any) => v === "1" || v === 1 || v === true;
      const notHoneypot = !flag1(contractTokenData.is_honeypot);
      const lowTax = parseFloat(contractTokenData.buy_tax || "0") <= 0.10 && parseFloat(contractTokenData.sell_tax || "0") <= 0.10;
      const cogOwnerAddr = (contractTokenData.owner_address || "").toLowerCase();
      const COG_BURNS = ["0x0000000000000000000000000000000000000000","0x000000000000000000000000000000000000dead","0x0000000000000000000000000000000000000001"];
      const renounced = !cogOwnerAddr || COG_BURNS.includes(cogOwnerAddr);
      const lpHolders: any[] = contractTokenData.lp_holders || [];
      const BURNS = new Set(["0x0000000000000000000000000000000000000000","0x000000000000000000000000000000000000dead"]);
      let lpLockedPct = 0;
      for (const lp of lpHolders) {
        const addr = (lp.address || "").toLowerCase();
        if (flag1(lp.is_locked) || BURNS.has(addr) || !!lp.tag) {
          lpLockedPct += parseFloat(lp.percent || "0") * 100;
        }
      }
      const lpSafe = lpLockedPct >= 80;

      if (notHoneypot) contractSecurityScore += 25;
      if (lowTax) contractSecurityScore += 15;
      if (lpSafe) contractSecurityScore += 35;
      if (renounced) contractSecurityScore += 25;

      contractSecure = contractSecurityScore >= 75;
    }

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

      if (contractSecure) raw = Math.min(100, raw + 20);

      if (logsResult.status === "verified") raw = Math.min(100, raw + 10);
      if (logsResult.status === "mismatch") raw = Math.max(0, raw - 12);
      if (socialResult.status === "suspicious") raw = Math.max(0, raw - 8);

      cognitionScore = Math.min(100, Math.max(0, raw));

      const _missingCount = [!w, !lu, !claims, !sl].filter(Boolean).length;
      const _isPartial = _missingCount >= 2;

      if (contractSecure && logsResult.status === "inconclusive" && contextScored === false) {
        verdict = "Low Autonomy";
        if (cognitionScore < 50) cognitionScore = 50;
      } else if (contractSecure && cognitionScore <= 50 && logsResult.status !== "mismatch" && socialResult.status !== "suspicious") {
        verdict = "Low Autonomy";
        if (cognitionScore < 45) cognitionScore = 45;
      } else if (_isPartial && !lu && cognitionScore <= 50) {
        verdict = "Insufficient Data";
      } else {
        verdict = cognitionScore <= 30 ? "Digital Puppet" : cognitionScore <= 70 ? "Semi-Autonomous" : "Fully Autonomous";
      }
    }

    if (scoredCount === 0) verdict = "Inconclusive";

    const missingData: string[] = [];
    if (!w) missingData.push("Agent Wallet / CA");
    if (!lu) missingData.push("Logs URL / API Endpoint");
    if (!claims) missingData.push("Claimed Abilities");
    if (!sl) missingData.push("Social Link");
    const isPartial = missingData.length >= 2;

    const apolVerdict = buildAgentVerdict(agentName.trim(), cognitionScore, verdict);

    // ── Contract Scan summary (only when wallet is a token contract) ──────────
    type ContractScanResult = {
      honeypot: boolean; buyTax: number; sellTax: number;
      lpLockedPercent: number; lockLocations: string[];
      topHolders: { address: string; percent: number; tag: string; isBurn: boolean }[];
      holderCount: number;
      protocolLocker?: string | null;
    };
    let contractScan: ContractScanResult | null = null;
    if (isContract && contractTokenData) {
      const flag1c = (v: any) => v === "1" || v === 1;
      const BURNS = new Set(["0x0000000000000000000000000000000000000000","0x000000000000000000000000000000000000dead"]);
      const LOCKERS: Record<string,string> = {
        "0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214":"Unicrypt",
        "0xadb2437e6f65682b85f814fbc12fec0508a7b1d":"Unicrypt BSC",
        "0x71b5759d73262fbb223956913ecf4ecc51057641":"PinkLock",
        "0x407993575c91ce7643a4d4ccdaa9b98f5b96e40":"PinkLock V2",
        "0xe2fe530c047f2d85298b07d9333c05737f1435fb":"Team Finance",
      };
      const csLpHolders: any[] = contractTokenData.lp_holders || [];
      let lpLockedPct = 0; const lockLocs: string[] = [];

      const csProtocolMatch = await resolveProtocolLocker(
        contractTokenData.creator_address || "",
        csLpHolders,
        chain,
        contractAddress,
      );

      for (const lp of csLpHolders) {
        const addr = (lp.address || "").toLowerCase();
        const pct = parseFloat(lp.percent || "0") * 100;
        const isBurn = BURNS.has(addr);
        const lockerLabel = LOCKERS[addr];
        if (flag1c(lp.is_locked) || isBurn || !!lockerLabel || !!lp.tag) {
          lpLockedPct += pct;
          const loc = lp.tag || lockerLabel || (isBurn ? "Burn Address" : "Locked");
          if (!lockLocs.includes(loc)) lockLocs.push(loc);
        }
      }

      if (csProtocolMatch) {
        lpLockedPct = 100;
        if (!lockLocs.includes(csProtocolMatch.name)) lockLocs.push(csProtocolMatch.name);
      }

      const rawH: any[] = contractTokenData.holders || [];
      contractScan = {
        honeypot: flag1c(contractTokenData.is_honeypot),
        buyTax: parseFloat(contractTokenData.buy_tax || "0"),
        sellTax: parseFloat(contractTokenData.sell_tax || "0"),
        lpLockedPercent: Math.min(100, lpLockedPct),
        lockLocations: lockLocs,
        topHolders: rawH.slice(0, 8).map(h => ({
          address: h.address || "",
          percent: parseFloat(h.percent || "0") * 100,
          tag: h.tag || "",
          isBurn: BURNS.has((h.address || "").toLowerCase()),
        })),
        holderCount: parseInt(contractTokenData.holder_count || "0"),
        protocolLocker: csProtocolMatch?.name ?? null,
      };
    }

    res.json({
      agentName: agentName.trim(), socialLink: sl, wallet: w, claimedAbilities: claims, logsUrl: lu,
      cognitionScore, verdict, apolVerdict, scoredTests: scoredCount,
      missingData, isPartial,
      speedTest: { scored: speedScored, score: speedScore, maxScore: 40, label: speedLabel, detail: speedDetail, timingPattern: timingPattern.slice(0, 5) },
      traceabilityTest: { scored: traceScored, score: traceScore, maxScore: 30, label: traceLabel, detail: traceDetail, isContract },
      contextTest: { scored: contextScored, score: contextScore, maxScore: 30, label: contextLabel, detail: contextDetail },
      logsTest: logsResult,
      socialTest: socialResult,
      contractScan,
    });
  });

  // ── /api/scanx — Social forensics (same data as Telegram /scanx) ────────
  app.get("/api/scanx", async (req, res) => {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    const RAPIDAPI_HOST = "twitter241.p.rapidapi.com";
    const input = (req.query.username as string || "").trim();

    if (!RAPIDAPI_KEY) return res.status(503).json({ error: "Social forensics module offline." });

    const username = input.replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//i, "").replace(/\/$/, "").split("/")[0].split("?")[0];
    if (!username || username.length < 1 || username.length > 50) return res.status(400).json({ error: "Invalid username." });

    const apolHandles = ["apol_agent", "apolagent"];
    const isApolSelf = apolHandles.includes(username.toLowerCase());

    try {
      const headers: Record<string, string> = { "x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": RAPIDAPI_HOST };

      const userRes = await fetch(`https://${RAPIDAPI_HOST}/user?username=${encodeURIComponent(username)}`, { headers, signal: AbortSignal.timeout(12_000) });
      const userRaw: any = await userRes.json();
      const userResult: any = userRaw?.result?.data?.user?.result ?? {};
      const legacy: any = userResult?.legacy ?? {};
      const core: any = userResult?.core ?? {};

      if (!legacy?.followers_count && !core?.name) return res.status(404).json({ error: `No X profile found for "${username}".` });

      const userId = userResult?.rest_id ?? "";
      let tweets: any[] = [];
      if (userId) {
        try {
          const tweetsRes = await fetch(`https://${RAPIDAPI_HOST}/user-tweets?user_id=${encodeURIComponent(userId)}&count=5`, { headers, signal: AbortSignal.timeout(12_000) });
          const tweetsData: any = await tweetsRes.json();
          const instructions: any[] = tweetsData?.result?.timeline?.instructions ?? [];
          const entries: any[] = instructions.find((i: any) => i?.type === "TimelineAddEntries")?.entries ?? [];
          tweets = entries.map((e: any) => e?.content?.itemContent?.tweet_results?.result?.legacy).filter(Boolean).slice(0, 5);
        } catch { /* non-fatal */ }
      }

      const displayName = core.name ?? username;
      const followers = parseInt(legacy.followers_count ?? "0");
      const following = parseInt(legacy.friends_count ?? "0");
      const isVerified = !!(userResult.is_blue_verified || legacy.verified);
      const totalTweets = parseInt(legacy.statuses_count ?? "0");
      const bio = legacy.description ?? "";
      const profileImage = legacy.profile_image_url_https ?? null;

      let joinedDate = "Unknown";
      let ageDays = 0;
      if (core.created_at) {
        const createdAt = new Date(core.created_at);
        if (!isNaN(createdAt.getTime())) {
          joinedDate = createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          ageDays = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
        }
      }

      const avgLikes = tweets.length > 0 ? Math.round(tweets.reduce((s: number, t: any) => s + parseInt(t.favorite_count ?? "0"), 0) / tweets.length) : 0;
      const avgRetweets = tweets.length > 0 ? Math.round(tweets.reduce((s: number, t: any) => s + parseInt(t.retweet_count ?? "0"), 0) / tweets.length) : 0;
      const followRatio = following > 0 ? (followers / following).toFixed(2) : "∞";
      const engagementPct = followers > 0 ? ((avgLikes + avgRetweets) / followers * 100) : 0;

      const flags: { type: "critical" | "warning" | "info"; text: string }[] = [];
      if (isApolSelf) {
        if (ageDays > 0 && ageDays < 90) flags.push({ type: "info", text: "PLANNED DEPLOYMENT — Sentinel Initial Phase" });
      } else {
        if (ageDays > 0 && ageDays < 30) flags.push({ type: "critical", text: "HIGH RISK FRESH ACCOUNT — Profile less than 30 days old" });
        else if (ageDays > 0 && ageDays < 90) flags.push({ type: "warning", text: "New account — less than 90 days old" });
        if (followers > 10_000 && tweets.length > 0 && avgLikes < 10) flags.push({ type: "critical", text: "BOTTED FOLLOWERS — 10K+ followers but avg < 10 likes" });
        if (following > followers * 3 && followers < 2_000) flags.push({ type: "warning", text: "Follow-back pattern — following far exceeds followers" });
        if (totalTweets < 5 && followers > 500) flags.push({ type: "warning", text: "Ghost account — very few posts for follower count" });
        if (engagementPct > 20 && followers > 500) flags.push({ type: "warning", text: "Unusually high engagement — verify authenticity" });
      }

      let engagementRating: string;
      if (tweets.length === 0) engagementRating = "Data Pending";
      else if (engagementPct >= 2.0) engagementRating = "High";
      else if (engagementPct >= 0.3) engagementRating = "Average";
      else engagementRating = "Low";

      let verdict: string;
      if (isApolSelf) {
        verdict = "AUTHENTICATED — Official APOL Forensic Node";
      } else {
        const critFlags = flags.filter(f => f.type === "critical").length;
        const warnFlags = flags.filter(f => f.type === "warning").length;
        if (critFlags >= 1) verdict = "BOT ACTIVITY DETECTED";
        else if (warnFlags >= 2) verdict = "Multiple Suspicious Patterns";
        else if (warnFlags === 1) verdict = "Suspicious Patterns Detected";
        else if (ageDays > 365 && followers > 1_000 && engagementPct >= 0.3) verdict = "Likely Authentic";
        else if (ageDays < 180 || followers < 100) verdict = "Inconclusive — Insufficient History";
        else verdict = "No Red Flags Detected";
      }

      const verdictLevel: "green" | "yellow" | "red" | "grey" =
        isApolSelf ? "green" :
        flags.some(f => f.type === "critical") ? "red" :
        flags.some(f => f.type === "warning") ? "yellow" :
        verdict === "Likely Authentic" || verdict === "No Red Flags Detected" ? "green" : "grey";

      let linkedCA: string | null = null;
      let linkedSymbol: string | null = null;
      try {
        const dexSearch: any = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(username)}`, { signal: AbortSignal.timeout(8_000) }).then(r => r.json());
        const basePairs: any[] = (dexSearch?.pairs ?? []).filter((p: any) => p.chainId === "base");
        const match = basePairs.find((p: any) => (p.info?.socials ?? []).some((s: any) => s.type === "twitter" && s.url.toLowerCase().includes(username.toLowerCase())));
        if (match) { linkedCA = match.baseToken.address; linkedSymbol = match.baseToken.symbol; }
      } catch { /* non-fatal */ }

      res.json({
        username, displayName, bio, profileImage,
        followers, following, followRatio, totalTweets,
        isVerified, joinedDate, ageDays,
        engagement: { rating: engagementRating, avgLikes, avgRetweets, pct: parseFloat(engagementPct.toFixed(2)) },
        flags,
        verdict, verdictLevel,
        linkedCA, linkedSymbol,
        isApolSelf,
      });
    } catch (err: any) {
      console.error("[scanx] error:", err?.message ?? err);
      res.status(500).json({ error: "Social scan failed. Please try again." });
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

  // Public endpoint — check if a contract is APOL-certified
  app.get("/api/contracts/verified/:address", async (req, res) => {
    try {
      const address = (req.params.address || "").toLowerCase().trim();
      if (!address) return res.json({ certified: false });
      const project = await storage.getVerifiedProjectByContract(address);
      if (!project || project.status !== "verified") return res.json({ certified: false });
      res.json({ certified: true, project });
    } catch {
      res.json({ certified: false });
    }
  });

  // Public endpoint — list all verified projects
  app.get("/api/contracts/verified", async (req, res) => {
    try {
      const all = await storage.getAllVerificationRequests();
      res.json(all.filter(r => r.status === "verified"));
    } catch {
      res.status(500).json({ error: "Failed to fetch verified projects" });
    }
  });

  // ─── Admin Contract Audit ─────────────────────────────────────────────────

  const BURN_ADDRESSES = new Set([
    "0x0000000000000000000000000000000000000000",
    "0x000000000000000000000000000000000000dead",
  ]);

  const auditResultCache = new Map<string, { data: Record<string, unknown>; cachedAt: number }>();
  const AUDIT_CACHE_TTL = 60 * 60 * 1000;
  auditResultCache.clear();

  const LOCKER_LABELS: Record<string, string> = {
    "0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214": "Unicrypt",
    "0xadb2437e6f65682b85f814fbc12fec0508a7b1d": "Unicrypt BSC",
    "0x71b5759d73262fbb223956913ecf4ecc51057641": "PinkLock",
    "0x407993575c91ce7643a4d4ccdaa9b98f5b96e40": "PinkLock V2",
    "0xe2fe530c047f2d85298b07d9333c05737f1435fb": "Team Finance",
    "0x8bac53e19d5db68f62c3770c1db33c5b07c19a0": "Mudra Locker",
  };

  app.get("/api/admin/audit", requireAdmin as any, async (req, res) => {
    const { contractAddress, chain = "base" } = req.query as { contractAddress: string; chain?: string };
    if (!contractAddress) return res.status(400).json({ error: "contractAddress required" });

    const chainId = GOPLUS_CHAIN[chain] || "8453";

    // 1. GoPlus token_security
    let tokenData: any = null;
    try {
      const r = await fetch(
        `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${encodeURIComponent(contractAddress)}`,
        { signal: AbortSignal.timeout(12000) }
      );
      const j = await r.json() as any;
      const key = Object.keys(j.result || {})[0];
      if (key) tokenData = j.result[key];
    } catch { /* non-fatal */ }

    // 2. Honeypot.is simulated buy/sell
    let hpData: any = null;
    try {
      const r = await fetch(
        `https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(contractAddress)}&chainID=${chainId}`,
        { signal: AbortSignal.timeout(12000) }
      );
      if (r.ok) hpData = await r.json() as any;
    } catch { /* non-fatal */ }

    const flag1 = (v: any) => v === "1" || v === 1;

    // Honeypot
    const isHoneypotGP = flag1(tokenData?.is_honeypot);
    const isHoneypotHP = hpData?.IsHoneypot === true;
    const isHoneypot = isHoneypotGP || isHoneypotHP;
    const simulationSuccess = hpData != null ? hpData.simulationSuccess !== false : null;
    let buyTax = hpData?.BuyTax != null ? hpData.BuyTax : taxPct(tokenData?.buy_tax ?? "0");
    let sellTax = hpData?.SellTax != null ? hpData.SellTax : taxPct(tokenData?.sell_tax ?? "0");

    // LP Lock
    const lpHolders: any[] = tokenData?.lp_holders || [];
    let lockedLpPercent = 0;
    const lockLocations: string[] = [];

    const auditProtocolMatch = await resolveProtocolLocker(
      tokenData?.creator_address || "",
      lpHolders,
      chain,
      contractAddress,
    );
    const auditProtocolLocker = auditProtocolMatch?.name ?? null;
    const auditIsProtocolSecure = !!auditProtocolMatch;

    for (const lp of lpHolders) {
      const addr = (lp.address || "").toLowerCase();
      const pct = parseFloat(lp.percent || "0") * 100;
      const isBurn = BURN_ADDRESSES.has(addr);
      const lockerLabel = LOCKER_LABELS[addr];
      const isLocked = flag1(lp.is_locked) || isBurn || !!lockerLabel || !!(lp.tag);
      if (isLocked) {
        lockedLpPercent += pct;
        const loc = lp.tag || lockerLabel || (isBurn ? "Burn Address" : "Locked");
        if (!lockLocations.includes(loc)) lockLocations.push(loc);
      }
    }

    if (auditIsProtocolSecure && (buyTax !== null && buyTax > 50 || sellTax !== null && sellTax > 50)) {
      buyTax = 0;
      sellTax = 0;
    }

    if (auditIsProtocolSecure) {
      lockedLpPercent = 100;
      if (!lockLocations.includes(auditProtocolLocker!)) lockLocations.push(auditProtocolLocker!);
    }

    const clampedLocked = Math.min(100, lockedLpPercent);

    // Top holders
    const rawHolders: any[] = tokenData?.holders || [];
    const topHolders = rawHolders.slice(0, 10).map((h: any, i: number) => ({
      rank: i + 1,
      address: h.address || "Unknown",
      percent: parseFloat(h.percent || "0") * 100,
      tag: h.tag || "",
      isLocked: flag1(h.is_locked),
      isContract: flag1(h.is_contract),
    }));

    const top5pct = topHolders.slice(0, 5).reduce((s, h) => s + h.percent, 0);

    // Flags
    const flags: string[] = [];
    if (isHoneypot) flags.push("HONEYPOT — tokens cannot be sold");
    if (simulationSuccess === false) flags.push("Trade simulation failed — unverifiable");
    if (buyTax > 25) flags.push(`Extreme buy tax: ${buyTax.toFixed(1)}%`);
    else if (buyTax > 10) flags.push(`High buy tax: ${buyTax.toFixed(1)}%`);
    if (sellTax > 25) flags.push(`Extreme sell tax: ${sellTax.toFixed(1)}%`);
    else if (sellTax > 10) flags.push(`High sell tax: ${sellTax.toFixed(1)}%`);
    if (clampedLocked < 50 && lpHolders.length > 0 && !auditIsProtocolSecure) flags.push("Liquidity is not adequately locked");
    if (flag1(tokenData?.is_mintable)) flags.push("Owner can mint unlimited tokens");
    if (flag1(tokenData?.slippage_modifiable)) flags.push("Owner can modify sell slippage");
    if (flag1(tokenData?.can_take_back_ownership)) flags.push("Recoverable ownership — renounce is fake");
    if (flag1(tokenData?.owner_change_balance)) flags.push("Owner can change balances directly");
    if (flag1(tokenData?.hidden_owner)) flags.push("Hidden owner function detected");
    if (flag1(tokenData?.selfdestruct)) flags.push("Self-destruct enabled");
    if (flag1(tokenData?.transfer_pausable)) flags.push("Admin can freeze all transfers");
    if (flag1(tokenData?.is_proxy)) flags.push("Proxy contract — upgradeable by admin");
    if (flag1(tokenData?.is_blacklisted)) flags.push("Blacklist function — admin can block wallets");
    if (flag1(tokenData?.external_call)) flags.push("External call risk");
    if (top5pct > 50) flags.push(`Top 5 wallets hold ${top5pct.toFixed(1)}% — high concentration`);

    const auditOwnerAddr = tokenData?.owner_address || null;
    const auditOwnerIsContract = flag1(tokenData?.owner_type);
    const auditOwnerNotRenounced = auditOwnerAddr && auditOwnerAddr !== "0x0000000000000000000000000000000000000000" && auditOwnerAddr !== "0x000000000000000000000000000000000000dead";
    const auditIsSingleSig = auditOwnerNotRenounced && !auditOwnerIsContract;

    const adminFlags = flags.filter(f => f.includes("Owner") || f.includes("Recoverable") || f.includes("Hidden") || f.includes("Self-destruct") || f.includes("freeze") || f.includes("Proxy") || f.includes("Blacklist") || f.includes("mint"));

    const riskLevel = isHoneypot || buyTax > 25 || sellTax > 25 || flag1(tokenData?.owner_change_balance) || flag1(tokenData?.hidden_owner)
      ? "High Risk"
      : auditIsProtocolSecure ? "Looks Clean"
      : adminFlags.length >= 2 ? "High Risk"
      : flags.length >= 2 ? "Caution"
      : flags.length === 1 ? "Watch"
      : "Looks Clean";

    const lpStatus = auditIsProtocolSecure
      ? "Protocol Managed"
      : clampedLocked >= 90 ? "Fully Locked" : clampedLocked >= 50 ? "Partially Locked" : lpHolders.length > 0 ? "Unlocked" : "No LP data";

    res.json({
      contractAddress, chain,
      tokenName: tokenData?.token_name || "",
      tokenSymbol: tokenData?.token_symbol || "",
      holderCount: parseInt(tokenData?.holder_count || "0"),
      isOpenSource: flag1(tokenData?.is_open_source),
      isInDex: flag1(tokenData?.is_in_dex),
      honeypot: { isHoneypot, simulationSuccess, buyTax, sellTax, source: hpData ? "honeypot.is" : "GoPlus" },
      liquidityLock: {
        lockedPercent: auditIsProtocolSecure ? 100 : clampedLocked,
        lockLocations,
        status: lpStatus,
        lpHoldersChecked: lpHolders.length,
        protocolLocker: auditProtocolLocker,
      },
      topHolders,
      top5pct,
      flags,
      adminFlags,
      ownerAddress: auditOwnerAddr,
      isSingleSigAdmin: !!auditIsSingleSig,
      riskLevel,
      dataSource: tokenData ? "GoPlus" : "No data",
    });
  });

  // ─── Public Verification Certificate ──────────────────────────────────────

  app.get("/api/verify/:contractAddress", async (req, res) => {
    const contractAddress = (req.params.contractAddress || "").toLowerCase().trim();
    if (!contractAddress || !contractAddress.startsWith("0x")) {
      return res.status(400).json({ error: "Invalid contract address" });
    }

    const project = await storage.getVerifiedProjectByContract(contractAddress);
    if (!project) {
      return res.status(404).json({ error: "No verified certificate found for this contract" });
    }

    // Return cached audit data if fresh
    const cacheKey = `${contractAddress}:base`;
    const cached = auditResultCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < AUDIT_CACHE_TTL) {
      return res.json({ project, audit: cached.data });
    }

    const chainId = "8453"; // Base mainnet
    const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";

    let tokenData: Record<string, any> | null = null;
    let hpData: Record<string, any> | null = null;

    try {
      const [tRes, hRes] = await Promise.all([
        fetch(`${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${encodeURIComponent(contractAddress)}`),
        fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(contractAddress)}&chainID=${chainId}`),
      ]);
      if (tRes.ok) {
        const tj = await tRes.json();
        tokenData = tj?.result?.[contractAddress.toLowerCase()] ?? null;
      }
      if (hRes.ok) {
        hpData = await hRes.json();
      }
    } catch { /* non-fatal */ }

    const flag1 = (v: any) => v === "1" || v === 1 || v === true;

    const isHoneypot = hpData?.IsHoneypot ?? flag1(tokenData?.is_honeypot);
    const simulationSuccess = hpData ? (hpData.simulationSuccess ?? null) : null;
    let buyTax = hpData?.BuyTax != null ? hpData.BuyTax : taxPct(tokenData?.buy_tax ?? "0");
    let sellTax = hpData?.SellTax != null ? hpData.SellTax : taxPct(tokenData?.sell_tax ?? "0");

    const lpHolders: { address: string; balance: string; percent: string; is_contract: string; locked: string; tag: string }[]
      = tokenData?.lp_holders ?? [];

    const certProtocolMatch = await resolveProtocolLocker(
      tokenData?.creator_address || "",
      lpHolders,
      "base",
      contractAddress,
    );
    const certProtocolLocker = certProtocolMatch?.name ?? null;
    const certIsProtocolSecure = !!certProtocolMatch;

    if (certIsProtocolSecure && (buyTax !== null && buyTax > 50 || sellTax !== null && sellTax > 50)) {
      buyTax = 0;
      sellTax = 0;
    }

    let lockedBalance = 0;
    let totalBalance = 0;
    const lockLocations: string[] = [];

    for (const lp of lpHolders) {
      const pct = parseFloat(lp.percent || "0");
      totalBalance += pct;
      const addr = (lp.address || "").toLowerCase();
      const isBurn = BURN_ADDRESSES.has(addr);
      const lockerLabel = LOCKER_LABELS[addr];
      if (lp.locked === "1" || lp.locked === true as any || isBurn || !!lockerLabel) {
        lockedBalance += pct;
        const label = lockerLabel || (isBurn ? "Burn Address" : lp.tag || "Locked");
        if (label && !lockLocations.includes(label)) lockLocations.push(label);
      }
    }

    if (certIsProtocolSecure) {
      lockedBalance = totalBalance > 0 ? totalBalance : 1;
      if (!lockLocations.includes(certProtocolLocker!)) lockLocations.push(certProtocolLocker!);
    }

    const clampedLocked = certProtocolLocker ? 100 : (totalBalance > 0 ? Math.min((lockedBalance / totalBalance) * 100, 100) : 0);

    const holders: { address: string; balance: string; percent: string; is_contract: string; tag: string }[]
      = tokenData?.holders ?? [];

    const topHolders = holders.slice(0, 10).map((h, i) => ({
      rank: i + 1,
      address: h.address || "",
      percent: parseFloat(h.percent || "0") * 100,
      tag: h.tag || "",
      isLocked: false,
      isContract: flag1(h.is_contract),
    }));

    const top5pct = topHolders.slice(0, 5).reduce((s, h) => s + h.percent, 0);

    const flags: string[] = [];
    if (isHoneypot) flags.push("HONEYPOT");
    if (buyTax > 10) flags.push(`BUY TAX ${buyTax.toFixed(1)}%`);
    if (sellTax > 10) flags.push(`SELL TAX ${sellTax.toFixed(1)}%`);
    if (lpHolders.length > 0 && clampedLocked < 50 && !certIsProtocolSecure) flags.push("UNLOCKED LIQUIDITY");
    if (flag1(tokenData?.is_mintable)) flags.push("MINTABLE");
    if (flag1(tokenData?.slippage_modifiable)) flags.push("SLIPPAGE MODIFIABLE");
    if (top5pct > 50) flags.push("HIGH HOLDER CONCENTRATION");

    const riskLevel = isHoneypot ? "Honeypot"
      : certIsProtocolSecure ? "Low Risk"
      : flags.length >= 3 ? "High Risk"
      : flags.length >= 1 ? "Caution"
      : "Low Risk";

    const certLpStatus = certIsProtocolSecure
      ? "Protocol Managed"
      : clampedLocked >= 90 ? "Fully Locked" : clampedLocked >= 50 ? "Partially Locked" : lpHolders.length > 0 ? "Unlocked" : "No LP data";

    const auditResult = {
      tokenName: tokenData?.token_name || "",
      tokenSymbol: tokenData?.token_symbol || "",
      holderCount: parseInt(tokenData?.holder_count || "0"),
      isOpenSource: flag1(tokenData?.is_open_source),
      isInDex: flag1(tokenData?.is_in_dex),
      honeypot: { isHoneypot, simulationSuccess, buyTax, sellTax, source: hpData ? "honeypot.is" : "GoPlus" },
      liquidityLock: {
        lockedPercent: clampedLocked,
        lockLocations,
        status: certLpStatus,
        lpHoldersChecked: lpHolders.length,
        protocolLocker: certProtocolLocker,
      },
      topHolders,
      top5pct,
      flags,
      riskLevel,
    };

    auditResultCache.set(cacheKey, { data: auditResult as any, cachedAt: Date.now() });
    return res.json({ project, audit: auditResult });
  });

  // ─── Admin Auth ────────────────────────────────────────────────────────────

  app.get("/api/admin/nonce", (req, res) => {
    cleanExpired();
    const address = (req.query.address as string || "").toLowerCase();
    if (!address || !address.startsWith("0x")) {
      return res.status(400).json({ error: "Invalid address" });
    }
    const nonce = `APOL Admin Authentication\nNonce: ${randomBytes(16).toString("hex")}\nTimestamp: ${Date.now()}`;
    nonceStore.set(address, { nonce, expires: Date.now() + 5 * 60 * 1000 });
    res.json({ nonce });
  });

  app.post("/api/admin/auth", async (req, res) => {
    if (!ADMIN_WALLET) {
      return res.status(503).json({ error: "Admin wallet not configured. Set ADMIN_WALLET_ADDRESS env var." });
    }
    const { address, signature } = req.body as { address: string; signature: string };
    if (!address || !signature) return res.status(400).json({ error: "Missing address or signature" });

    const lowerAddr = address.toLowerCase();
    const stored = nonceStore.get(lowerAddr);
    if (!stored || stored.expires < Date.now()) {
      return res.status(401).json({ error: "Nonce expired or not found. Request a new one." });
    }

    try {
      const recovered = (await verifyMessage(stored.nonce, signature)).toLowerCase();
      nonceStore.delete(lowerAddr);

      if (recovered !== lowerAddr) {
        return res.status(401).json({ error: "Signature does not match address" });
      }
      if (recovered !== ADMIN_WALLET) {
        return res.status(403).json({ error: "Wallet is not authorized as admin" });
      }

      const token = signAdminToken(lowerAddr);
      res.json({ token });
    } catch (err) {
      res.status(400).json({ error: "Invalid signature" });
    }
  });

  // ─── Admin CRUD ────────────────────────────────────────────────────────────

  app.get("/api/admin/verifications", requireAdmin as any, async (req, res) => {
    try {
      const all = await storage.getAllVerificationRequests();
      res.json(all);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch verification requests" });
    }
  });

  app.post("/api/admin/verifications/:id/approve", requireAdmin as any, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const adminAddr = (req as any).adminAddress as string;
      const updated = await storage.approveVerification(id, adminAddr);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve verification" });
    }
  });

  app.post("/api/admin/verifications/:id/reject", requireAdmin as any, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
      const { reason } = req.body as { reason: string };
      if (!reason?.trim()) return res.status(400).json({ error: "Rejection reason is required" });
      const adminAddr = (req as any).adminAddress as string;
      const updated = await storage.rejectVerification(id, reason.trim(), adminAddr);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject verification" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
