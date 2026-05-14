import { useState, useEffect } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Bot, AlertTriangle, CheckCircle,
  XCircle, Loader2, ChevronRight, Search, Brain, HelpCircle, Info,
  Zap, Lock, ExternalLink, ShieldAlert, Activity, Clock, Shield,
  ShieldCheck, Droplets, Users, TrendingUp, FileBarChart2, Eye,
} from "lucide-react";
import { BrowserProvider, Contract, JsonRpcProvider, parseEther } from "ethers";
import { getSelectedProvider } from "@/hooks/use-wallet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHAIN, PAYMENT, ensureCorrectNetwork, IS_INNER_CIRCLE_TEST_MODE } from "@/lib/chain-config";

async function waitForReceipt(txHash: string, timeoutMs = 90_000): Promise<boolean> {
  const rpc = new JsonRpcProvider(CHAIN.rpcUrl);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await rpc.getTransactionReceipt(txHash);
      if (receipt) return receipt.status === 1;
    } catch {}
    await new Promise(r => setTimeout(r, 2500));
  }
  return false;
}


const G = "#00ff00";

const detectiveChains = [
  { value: "ethereum", label: "Ethereum (ETH)" },
  { value: "bitcoin", label: "Bitcoin (BTC)" },
  { value: "bsc", label: "BNB Smart Chain (BSC)" },
  { value: "polygon", label: "Polygon (MATIC)" },
  { value: "avalanche", label: "Avalanche (AVAX)" },
  { value: "tron", label: "Tron (TRX)" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "optimism", label: "Optimism" },
  { value: "base", label: "Base" },
  { value: "other", label: "Other" },
];

type AdminThreat = { severity: "critical" | "high" | "medium"; label: string; detail: string };

type DetectiveResult = {
  address?: string;
  chain?: string;
  addressType?: "wallet" | "contract";
  riskLevel?: string;
  apolVerdict?: string;
  isHighRisk?: boolean;
  isNewOffender?: boolean;
  walletFlags?: string[];
  totalFlags?: number;
  greenBadge?: boolean;
  redFlags?: string[];
  adminThreats?: AdminThreat[];
  ownerAddress?: string | null;
  creatorAddress?: string | null;
  isOwnershipRenounced?: boolean;
  isSingleSigAdmin?: boolean;
  tokenName?: string;
  tokenSymbol?: string;
  buyTax?: number;
  sellTax?: number;
  taxOverride?: string | null;
  isHoneypot?: boolean;
  isMintable?: boolean;
  isOpenSource?: boolean | null;
  isInDex?: boolean;
  isProxy?: boolean | null;
  hasBlacklist?: boolean;
  canPause?: boolean;
  protocolSecured?: boolean;
  isKnownFactory?: boolean;
  lpEscrow?: { name: string; address: string; percent: number } | null;
  liveStatus?: string | null;
  lpStatus?: string | null;
  holderCountLabel?: string;
  holderCount?: number;
  platformName?: string | null;
  platform?: string | null;
  isClone?: boolean;
  currentBalance?: string;
  activity?: { txCount: number; level: string; inflow: string; outflow: string };
  genesis?: { creationTx: string | null; creator: string | null };
  funding?: { fundingSource: string | null; fundingTxHash: string | null; fundingValue: string };
  // Forensic enrichment
  priceUsd?: number;
  mcap?: number;
  liquidity?: number;
  volume24h?: number;
  tokenAgeDays?: number | null;
  deployerHolding?: number | null;
  creatorDumped?: boolean;
  topHoldersList?: { address: string; percent: number }[];
  poolVersion?: string | null;
  deployer?: string | null;
  scanCount?: number;
  isFakeApol?: boolean;
  fakeApolWarning?: string | null;
  // Blockaid sell simulation
  sellSimulationSuccess?: boolean | null;
  sellSimRevertReason?: string | null;
  blockaidResultType?: string | null;
  // Honeypot.is
  honeypotIsResult?: { isHoneypot: boolean; honeypotReason: string | null; sellTax: number; buyTax: number } | null;
  // De.Fi Shield
  defiShieldRisks?: string[];
  // GoPlus sell simulation
  goPlusSellSimSuccess?: boolean | null;
};

type TestResult = { scored: boolean; score: number; maxScore: number; label: string; detail: string; timingPattern?: string[]; isContract?: boolean };
type LogsTestResult = { status: "verified" | "mismatch" | "inconclusive"; detail: string; logs: string[] };
type SocialTestResult = { status: "clear" | "suspicious" | "inconclusive"; detail: string; followers?: number; accountAgeDays?: number };

type ContractScan = {
  honeypot: boolean;
  buyTax: number;
  sellTax: number;
  lpLockedPercent: number;
  lockLocations: string[];
  topHolders: { address: string; percent: number; tag: string; isBurn: boolean }[];
  holderCount: number;
  protocolLocker?: string | null;
};

type OnChainActivityTest = TestResult & { txCount?: number; contractAgeDays?: number; activityPerDay?: number };
type CodeSizeTest = TestResult & { codeSize?: number; hasCode?: boolean };

type AbilityAuditResult = {
  claimedAbilities: string[];
  reasoningUrl: string | null;
  reasoningStatus: "verified" | "mismatch" | "not_found" | "no_source";
  reasoningDetail: string;
  abilityMismatch: string | null;
};

type AgentResult = {
  agentName: string;
  wallet: string | null;
  cognitionScore: number | null;
  verdict: "Confirmed LARP" | "Unverified" | "Semi-Autonomous" | "Fully Autonomous" | "Under Review" | "Insufficient Data" | "Inconclusive";
  apolVerdict: string;
  scoredTests: number;
  missingData?: string[];
  isPartial?: boolean;
  speedTest: TestResult;
  traceabilityTest: TestResult;
  contextTest: TestResult;
  logsTest: LogsTestResult;
  socialTest: SocialTestResult;
  onChainActivityTest?: OnChainActivityTest;
  codeSizeTest?: CodeSizeTest;
  contractScan: ContractScan | null;
  abilityAudit?: AbilityAuditResult;
  isKnownFactory?: boolean;
  lpEscrow?: { name: string; address: string; percent: number } | null;
  platformName?: string | null;
  clankerData?: {
    volume24h: number;
    marketCap: number;
    rewardsAvailable: boolean;
    warnings: string[];
    tags: { champagne: boolean; verified: boolean; knownInterfaceDeployer: boolean };
  };
  serialDeployer?: {
    recentCount: number;
    windowDays: number;
    recentTokens: { name: string; address: string; ageDays: number }[];
  };
  twitterHandle?: string;
  activityPattern?: {
    offHoursPercent: number;
    botScore: number;
    verdict: "BOT-LIKE" | "HUMAN-LIKE" | "MIXED";
    insight: string;
    hourDistribution?: number[];
  };
  reactionTime?: {
    averageReactionTime: number;
    medianReactionTime: number;
    minReactionTime: number;
    consistencyScore: number;
    subSecondPercent: number;
    reactionPattern: "AUTONOMOUS" | "ASSISTED" | "MANUAL";
    insight: string;
  };
  gasPattern?: {
    averageGasPrice: number;
    gasVariance: number;
    optimalGasPercent: number;
    gasConsistencyScore: number;
    overpayPercent: number;
    gasPattern: "OPTIMIZED" | "VARIABLE" | "INEFFICIENT";
    insight: string;
  };
  decisionEntropy?: {
    contractDiversity: number;
    actionRepeatRate: number;
    decisionEntropy: number;
    patternScore: number;
    uniqueContractRatio: number;
    entropyPattern: "ALGORITHMIC" | "ADAPTIVE" | "RANDOM";
    insight: string;
  };
  anomalyDetection?: {
    anomalyStatus: "STABLE" | "SHIFTING" | "ANOMALOUS";
    anomalyScore: number;
    snapshotCount: number;
    baselineActivityScore: number | null;
    baselineReactionScore: number | null;
    baselineGasScore: number | null;
    baselineDecisionScore: number | null;
    activityAnomaly: { detected: boolean; delta: number };
    reactionAnomaly: { detected: boolean; delta: number };
    gasAnomaly: { detected: boolean; delta: number };
    decisionAnomaly: { detected: boolean; delta: number };
  };
  certificationTier?: {
    tier: "UNVERIFIED" | "BRONZE" | "SILVER" | "GOLD";
    rawTier: "UNVERIFIED" | "BRONZE" | "SILVER" | "GOLD";
    anomalyCapped: boolean;
    qualifyingSignals: number;
    availableSignals: number;
    averageForensicScore: number | null;
  };
};

type StatusColor = "green" | "red" | "yellow" | "grey";

function StatusBadge({ status, label }: { status: StatusColor; label: string }) {
  const cfg: Record<StatusColor, string> = {
    green: "bg-green-900/40 border-green-600/50 text-green-300",
    red: "bg-red-900/40 border-red-600/50 text-red-300",
    yellow: "bg-yellow-900/40 border-yellow-600/50 text-yellow-300",
    grey: "bg-slate-800 border-slate-600 text-slate-400",
  };
  const dot: Record<StatusColor, string> = {
    green: "bg-green-400", red: "bg-red-500", yellow: "bg-yellow-400", grey: "bg-slate-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${cfg[status]}`}>
      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dot[status]}`} />
      {label.toUpperCase()}
    </span>
  );
}

function oneLineSummary(r: AgentResult): string {
  if (r.verdict === "Inconclusive") return "No verifiable evidence submitted.";
  if (r.verdict === "Under Review") return "Some indicators present but APOL reserves judgment until more evidence is available.";
  if (r.verdict === "Unverified") return "APOL could not verify autonomous operation. This does not confirm fraud — the entity has not proven itself.";
  if (r.verdict === "Insufficient Data") return "Not enough data to issue a verdict. Provide wallet address, logs URL, and claimed abilities for a full assessment.";
  if (r.isPartial) return "Verdict based on limited data. Provide wallet and logs for a complete assessment.";
  const parts: string[] = [];
  if (r.speedTest.scored) {
    if (r.speedTest.score >= 25) parts.push("24/7 on-chain activity");
    else if (r.speedTest.score >= 12) parts.push("mixed timing patterns");
    else parts.push("business-hours timing pattern");
  }
  if (r.logsTest.status === "verified") parts.push("verified reasoning logs");
  else if (r.logsTest.status === "mismatch") parts.push("mismatched log timestamps");
  if (r.socialTest.status === "suspicious") parts.push("Sybil/Bot social profile");
  if (r.traceabilityTest.scored && r.traceabilityTest.isContract) parts.push("deployed on-chain contract");
  if (parts.length === 0) return "Verdict based on available on-chain evidence.";
  return `Verdict based on ${parts.slice(0, 2).join(" and ")}.`;
}

function getEvidenceFiling(r: AgentResult | null, formState: { wallet: string; logsUrl: string; socialLink: string }) {
  if (!r) {
    return [
      { emoji: "⛓", label: "On-Chain Activity", status: formState.wallet.trim() ? "green" as StatusColor : "grey" as StatusColor, tag: formState.wallet.trim() ? "Pending" : "No CA" },
      { emoji: "🕒", label: "Liveliness", status: formState.wallet.trim() ? "green" as StatusColor : "grey" as StatusColor, tag: formState.wallet.trim() ? "Active" : "Passive" },
      { emoji: "🧠", label: "Reasoning", status: formState.logsUrl.trim() ? "green" as StatusColor : "yellow" as StatusColor, tag: formState.logsUrl.trim() ? "Verified" : "Unlinked" },
      { emoji: "👥", label: "Sybil Check", status: formState.socialLink.trim() ? "green" as StatusColor : "grey" as StatusColor, tag: formState.socialLink.trim() ? "Clear" : "Pending" },
    ];
  }
  const isWhitelisted = r.cognitionScore === 100 && r.verdict === "Fully Autonomous";
  if (isWhitelisted) {
    return [
      { emoji: "⛓", label: "On-Chain Activity", status: "green" as StatusColor, tag: "Active" },
      { emoji: "🕒", label: "Liveliness", status: "green" as StatusColor, tag: "Active" },
      { emoji: "🧠", label: "Reasoning", status: "green" as StatusColor, tag: "Verified" },
      { emoji: "🔎", label: "Abilities", status: "green" as StatusColor, tag: r.abilityAudit?.claimedAbilities.length ? `${r.abilityAudit.claimedAbilities.length} Found` : "Verified" },
      { emoji: "👥", label: "Sybil Check", status: "green" as StatusColor, tag: "Clear" },
    ];
  }
  const activityStatus: StatusColor = !r.onChainActivityTest?.scored ? "grey" : r.onChainActivityTest.label === "Active" ? "green" : r.onChainActivityTest.label === "Dead" || r.onChainActivityTest.label === "Dormant" ? "red" : "yellow";
  const liveStatus: StatusColor = !r.speedTest.scored ? "grey" : r.speedTest.score >= 12 ? "green" : "red";
  const reasoningStatus: StatusColor = r.logsTest.status === "verified" ? "green" : r.logsTest.status === "mismatch" ? "red" : "yellow";
  const sybilStatus: StatusColor = r.socialTest.status === "clear" ? "green" : r.socialTest.status === "suspicious" ? "red" : "grey";
  const abilityStatus: StatusColor = r.abilityAudit ? (r.abilityAudit.claimedAbilities.length >= 2 && !r.abilityAudit.abilityMismatch ? "green" : r.abilityAudit.abilityMismatch ? "red" : r.abilityAudit.claimedAbilities.length > 0 ? "yellow" : "grey") : "grey";
  return [
    { emoji: "⛓", label: "On-Chain Activity", status: activityStatus, tag: r.onChainActivityTest?.label || "Unknown" },
    { emoji: "🕒", label: "Liveliness", status: liveStatus, tag: liveStatus === "green" ? "Active" : "Passive" },
    { emoji: "🧠", label: "Reasoning", status: reasoningStatus, tag: reasoningStatus === "green" ? "Verified" : "Unlinked" },
    { emoji: "🔎", label: "Abilities", status: abilityStatus, tag: r.abilityAudit?.claimedAbilities.length ? `${r.abilityAudit.claimedAbilities.length} Found` : "None" },
    { emoji: "👥", label: "Sybil Check", status: sybilStatus, tag: sybilStatus === "green" ? "Clear" : sybilStatus === "red" ? "Suspicious" : "Unverified" },
  ];
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ flex: 1, height: "6px", background: "rgba(255,255,255,0.08)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: color, transition: "width 0.5s ease" }} />
      </div>
      <span style={{ fontSize: "10px", color, fontWeight: 700, minWidth: "32px", textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} hrs`;
}

function HolderBar({ holder, maxPct }: { holder: ContractScan["topHolders"][0]; maxPct: number }) {
  const barW = maxPct > 0 ? (holder.percent / maxPct) * 100 : 0;
  const label = holder.isBurn ? "Burn Address" : holder.tag || `${holder.address.slice(0, 6)}…${holder.address.slice(-4)}`;
  const barColor = holder.isBurn ? "#22c55e" : holder.percent > 10 ? "#facc15" : G;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}>
      <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", width: "100px", flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: "10px", background: "rgba(255,255,255,0.06)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${barW}%`, background: barColor }} />
      </div>
      <span style={{ fontSize: "10px", color: barColor, fontWeight: 700, minWidth: "38px", textAlign: "right" }}>
        {holder.percent.toFixed(1)}%
      </span>
    </div>
  );
}

interface BehavioralSnapshot {
  scanDate: string;
  overallAuthenticityScore: number | null;
  botActivityScore: number | null;
  reactionConsistencyScore: number | null;
  gasConsistencyScore: number | null;
  decisionPatternScore: number | null;
  activityPattern: string | null;
  reactionPattern: string | null;
  gasPattern: string | null;
  decisionPattern: string | null;
  verdict: string | null;
}

interface BehavioralHistoryData {
  address: string;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
  snapshots: BehavioralSnapshot[];
}

function BehavioralHistory({ wallet }: { wallet: string }) {
  const [data, setData] = useState<BehavioralHistoryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/agent/history/${wallet}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [wallet]);

  const G = "#00ff00";

  if (loading) {
    return (
      <div style={{ border: "1px solid rgba(0,255,0,0.2)", background: "#000", padding: "16px 20px", display: "flex", alignItems: "center", gap: "8px", fontFamily: "'JetBrains Mono', monospace" }}>
        <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Loading behavioral history…</span>
      </div>
    );
  }

  if (!data || data.count === 0) {
    return (
      <div style={{ border: "1px solid rgba(0,255,0,0.15)", background: "#000", padding: "14px 20px", fontFamily: "'JetBrains Mono', monospace" }}>
        <div style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px" }}>30-Day Behavioral History</div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>First scan recorded. Scan again to begin tracking behavioral trends.</div>
      </div>
    );
  }

  const snapshots = data.snapshots;
  const scores = snapshots.map(s => s.overallAuthenticityScore).filter((s): s is number => s !== null);

  // Trend: compare mean of first third vs last third
  let trendLabel = "STABLE";
  let trendColor = "#facc15";
  if (scores.length >= 3) {
    const third = Math.max(1, Math.floor(scores.length / 3));
    const firstMean = scores.slice(0, third).reduce((a, b) => a + b, 0) / third;
    const lastMean = scores.slice(-third).reduce((a, b) => a + b, 0) / third;
    const delta = lastMean - firstMean;
    if (delta > 5) { trendLabel = "TRENDING UP ↑"; trendColor = G; }
    else if (delta < -5) { trendLabel = "DECLINING ↓"; trendColor = "#f87171"; }
  }

  // SVG sparkline
  const chartW = 220;
  const chartH = 44;
  const pad = 4;
  const innerW = chartW - pad * 2;
  const innerH = chartH - pad * 2;
  const sparkPoints = scores.length >= 2
    ? scores.map((s, i) => {
        const x = pad + (i / (scores.length - 1)) * innerW;
        const y = pad + innerH - (s / 100) * innerH;
        return `${x},${y}`;
      }).join(" ")
    : null;

  // Verdict timeline — collapse consecutive identical verdicts
  const verdictChanges: { date: string; verdict: string }[] = [];
  for (const snap of snapshots) {
    if (!snap.verdict) continue;
    if (verdictChanges.length === 0 || verdictChanges[verdictChanges.length - 1].verdict !== snap.verdict) {
      verdictChanges.push({ date: snap.scanDate, verdict: snap.verdict });
    }
  }
  const verdictColor = (v: string) =>
    v === "Fully Autonomous" ? G
    : v === "Semi-Autonomous" ? "#86efac"
    : v === "Under Review" ? "#facc15"
    : v === "Unverified" ? "#facc15"
    : v === "Confirmed LARP" ? "#f87171"
    : "rgba(255,255,255,0.4)";

  return (
    <div style={{ border: "1px solid rgba(0,255,0,0.25)", background: "#000", marginBottom: "1px" }}>
      {/* Header */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
        <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
          30-Day Behavioral History
        </span>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
          {data.count} scan{data.count !== 1 ? "s" : ""}{data.firstSeen ? ` · since ${new Date(data.firstSeen).toLocaleDateString()}` : ""}
        </span>
      </div>

      <div style={{ padding: "14px 20px", display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>
        {/* Sparkline */}
        {sparkPoints && scores.length >= 2 && (
          <div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px", fontFamily: "'JetBrains Mono', monospace" }}>Authenticity Score</div>
            <svg width={chartW} height={chartH} style={{ display: "block", overflow: "visible" }}>
              <polyline points={sparkPoints} fill="none" stroke={G} strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" />
              {scores.map((s, i) => {
                const x = pad + (i / (scores.length - 1)) * innerW;
                const y = pad + innerH - (s / 100) * innerH;
                return <circle key={i} cx={x} cy={y} r={2.5} fill={G} opacity="0.9" />;
              })}
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", color: "rgba(255,255,255,0.25)", fontFamily: "'JetBrains Mono', monospace", marginTop: "2px", width: chartW }}>
              <span>0</span><span>100</span>
            </div>
          </div>
        )}

        {/* Trend + scan stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "120px" }}>
          <div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px", fontFamily: "'JetBrains Mono', monospace" }}>Trend</div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: trendColor, fontFamily: "'JetBrains Mono', monospace" }}>{trendLabel}</div>
          </div>
          {scores.length > 0 && (
            <div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px", fontFamily: "'JetBrains Mono', monospace" }}>Latest Score</div>
              <div style={{ fontSize: "18px", fontWeight: 900, color: G, fontFamily: "'JetBrains Mono', monospace" }}>{scores[scores.length - 1]}</div>
            </div>
          )}
        </div>

        {/* Verdict timeline */}
        {verdictChanges.length > 0 && (
          <div style={{ flex: 1, minWidth: "140px" }}>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px", fontFamily: "'JetBrains Mono', monospace" }}>Verdict Timeline</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {verdictChanges.map((vc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>
                    {new Date(vc.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: verdictColor(vc.verdict), fontFamily: "'JetBrains Mono', monospace" }}>
                    {vc.verdict}
                  </span>
                  {i < verdictChanges.length - 1 && (
                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginLeft: "2px" }}>↓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AdvancedResults({ result, shareSlug }: { result: AgentResult; shareSlug?: string | null }) {
  const [briefingOpen, setBriefingOpen] = useState(false);

  // ── SBT ──────────────────────────────────────────────────────────────────
  const SBT_OWNER = "0x857aca6A8A743C9262d64819D239f509a1Cd0A85";
  const SBT_CHAIN_HEX = "0x14A34";
  const SBT_RPC = "https://sepolia.base.org";
  const SBT_EXPLORER = "https://sepolia.basescan.org";

  const { data: sbtDeployed } = useQuery<{ address: string; network: string; chainId: number }>({
    queryKey: ["/api/sbt/contract-address"],
    staleTime: Infinity,
  });

  const [sbtTokenId, setSbtTokenId] = useState<bigint | null>(null);
  const [sbtChecking, setSbtChecking] = useState(false);
  const [sbtMinting, setSbtMinting] = useState(false);
  const [sbtMintError, setSbtMintError] = useState<string | null>(null);
  const [sbtMintSuccess, setSbtMintSuccess] = useState<{ tokenId: bigint; txHash: string } | null>(null);

  const isSbtEligible =
    (result.certificationTier?.tier === "SILVER" || result.certificationTier?.tier === "GOLD") &&
    !!result.wallet && /^0x[a-fA-F0-9]{40}$/.test(result.wallet);

  useEffect(() => {
    if (!isSbtEligible || !sbtDeployed?.address || !result.wallet) return;
    let cancelled = false;
    setSbtChecking(true);
    setSbtTokenId(null);
    const provider = new JsonRpcProvider(SBT_RPC);
    const contract = new Contract(
      sbtDeployed.address,
      ["function walletToTokenId(address) view returns (uint256)"],
      provider,
    );
    contract.walletToTokenId(result.wallet)
      .then((id: bigint) => { if (!cancelled) setSbtTokenId(id); })
      .catch(() => { if (!cancelled) setSbtTokenId(BigInt(0)); })
      .finally(() => { if (!cancelled) setSbtChecking(false); });
    return () => { cancelled = true; };
  }, [isSbtEligible, sbtDeployed?.address, result.wallet]);

  const handleMintSbt = async () => {
    if (!sbtDeployed?.address || !result.wallet || !result.certificationTier) return;
    const eth = getSelectedProvider();
    if (!eth) { setSbtMintError("Please connect your wallet first"); return; }
    const existingAccounts: string[] = await eth.request({ method: "eth_accounts" });
    if (!existingAccounts?.[0]) { setSbtMintError("Please connect your wallet first"); return; }
    setSbtMintError(null);
    setSbtMinting(true);
    try {
      const account = existingAccounts[0];
      if (account.toLowerCase() !== SBT_OWNER.toLowerCase()) {
        throw new Error("Only the APOL owner wallet can mint certification SBTs");
      }
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SBT_CHAIN_HEX }] });
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: SBT_CHAIN_HEX,
              chainName: "Base Sepolia",
              rpcUrls: [SBT_RPC],
              nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
              blockExplorerUrls: [SBT_EXPLORER],
            }],
          });
        } else throw switchErr;
      }
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const contract = new Contract(
        sbtDeployed.address,
        ["function mint(address agentWallet, string agentName, string certificationTier, uint256 cognitionScore, string scanUrl) external"],
        signer,
      );
      const scanUrl = shareSlug ? `https://apolagent.online/agent/${shareSlug}` : "";
      const tx = await contract.mint(
        result.wallet,
        result.agentName,
        result.certificationTier.tier,
        result.cognitionScore ?? 0,
        scanUrl,
      );
      await tx.wait();
      const readProvider = new JsonRpcProvider(SBT_RPC);
      const readContract = new Contract(
        sbtDeployed.address,
        ["function walletToTokenId(address) view returns (uint256)"],
        readProvider,
      );
      const tokenId: bigint = await readContract.walletToTokenId(result.wallet);
      setSbtTokenId(tokenId);
      setSbtMintSuccess({ tokenId, txHash: tx.hash });
    } catch (e: any) {
      if (e?.code === 4001) {
        setSbtMintError("Transaction rejected");
      } else {
        setSbtMintError(e?.reason ?? e?.shortMessage ?? e?.message ?? "Mint failed");
      }
    } finally {
      setSbtMinting(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────
  const cs = result.contractScan;

  const riskLevel = result.cognitionScore === null ? "UNKNOWN"
    : result.verdict === "Insufficient Data" ? "INSUFFICIENT DATA"
    : result.verdict === "Under Review" ? "UNDER REVIEW"
    : result.verdict === "Unverified" ? "UNVERIFIED"
    : result.verdict === "Confirmed LARP" ? "LARP CONFIRMED"
    : result.cognitionScore >= 71 ? "LOW RISK"
    : result.cognitionScore >= 31 ? "MEDIUM RISK"
    : "HIGH RISK";
  const riskColor = result.cognitionScore === null ? "#6b7280"
    : result.verdict === "Insufficient Data" ? "#facc15"
    : result.verdict === "Under Review" ? "#facc15"
    : result.verdict === "Unverified" ? "#facc15"
    : result.verdict === "Confirmed LARP" ? "#f87171"
    : result.cognitionScore >= 71 ? G
    : result.cognitionScore >= 31 ? "#facc15"
    : "#f87171";

  const caseNum = `APOL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }).toUpperCase();

  const isProtocolManaged = (result.isKnownFactory && result.lpEscrow) || cs?.protocolLocker;
  const protocolLabel = result.lpEscrow?.name ?? cs?.protocolLocker ?? "";
  const lpStatus = !cs ? "N/A"
    : isProtocolManaged ? `PROTOCOL MANAGED — ${protocolLabel.toUpperCase()}`
    : cs.lpLockedPercent >= 90 ? `LOCKED (${cs.lpLockedPercent.toFixed(0)}%${cs.lockLocations[0] ? ` · ${cs.lockLocations[0]}` : ""})`
    : cs.lockLocations.some(l => l.toLowerCase().includes("burn")) ? `BURNED (${cs.lpLockedPercent.toFixed(0)}%)`
    : cs.lpLockedPercent > 0 ? `PARTIALLY LOCKED (${cs.lpLockedPercent.toFixed(0)}%)`
    : "MANUAL / UNLOCKED";
  const lpColor = !cs ? "#6b7280"
    : isProtocolManaged ? G
    : cs.lpLockedPercent >= 90 ? G
    : cs.lpLockedPercent >= 50 ? "#facc15"
    : "#f87171";

  const maxHolderPct = cs ? Math.max(...cs.topHolders.map(h => h.percent), 1) : 1;

  const abilityDetail = result.abilityAudit
    ? [
        result.abilityAudit.claimedAbilities.length > 0 ? `Detected abilities: ${result.abilityAudit.claimedAbilities.join(", ")}.` : "No specific abilities detected.",
        result.abilityAudit.reasoningDetail,
        result.abilityAudit.abilityMismatch || "",
      ].filter(Boolean).join(" ")
    : "";

  const narratives = [
    { label: "On-Chain Activity", detail: result.onChainActivityTest?.detail || "" },
    { label: "Contract Code", detail: result.codeSizeTest?.detail || "" },
    { label: "Reasoning & Abilities", detail: abilityDetail },
    { label: "Speed Analysis", detail: result.speedTest.detail },
    { label: "Traceability", detail: result.traceabilityTest.detail },
    { label: "Context Coherence", detail: result.contextTest.detail },
    { label: "Log Integrity", detail: result.logsTest.detail },
    { label: "Social Forensics", detail: result.socialTest.detail },
  ].filter(r => r.detail);

  return (
    <div data-testid="div-advanced-results" style={{ border: `1px solid ${G}`, background: "#000" }}>

      {/* ── Report Header ── */}
      <div style={{ background: "rgba(0,255,0,0.07)", borderBottom: `1px solid rgba(0,255,0,0.25)`, padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/apol-agent-logo.png" alt="APOL" style={{ width: 28, height: 28 }} />
            <div>
              <div style={{ color: G, fontSize: "11px", fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                APOL Agent // Investigation Report
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Full Forensic Analysis
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "rgba(0,255,0,0.6)", fontSize: "9px", letterSpacing: "0.1em" }}>CASE {caseNum}</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>{reportDate}</div>
          </div>
        </div>
      </div>

      {/* ── Subject Info ── */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "2px" }}>Subject</div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{result.agentName}</div>
        </div>
        {result.wallet && (
          <div>
            <div style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "2px" }}>Wallet</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontFamily: "'JetBrains Mono', monospace" }}>
                {result.wallet.slice(0, 8)}…{result.wallet.slice(-6)}
              </span>
              <a href={`${CHAIN.explorerUrl}/address/${result.wallet}`} target="_blank" rel="noopener noreferrer" style={{ color: G }}>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>
        )}
        <div style={{ marginLeft: "auto" }}>
          <div style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "2px" }}>Scored Tests</div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: result.scoredTests >= 3 ? G : "#facc15" }}>{result.scoredTests} / 5</div>
        </div>
      </div>

      {/* ── Two-column: Risk + Authenticity ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Risk Assessment */}
        <div style={{ padding: "16px 20px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <ShieldAlert size={12} color={riskColor} />
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Risk Assessment</span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 900, color: riskColor, letterSpacing: "0.04em", marginBottom: "8px" }}>{riskLevel}</div>
          <ScoreBar value={result.cognitionScore ?? 0} max={100} color={riskColor} />
        </div>
        {/* Authenticity Score */}
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <TrendingUp size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Authenticity Score</span>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 900, color: riskColor, letterSpacing: "0.04em", marginBottom: "8px" }}>
            {result.cognitionScore !== null ? `${result.cognitionScore}%` : "N/A"}
          </div>
          <ScoreBar value={result.cognitionScore ?? 0} max={100} color={riskColor} />
        </div>
      </div>

      {/* ── Certification Tier Badge ── */}
      {result.certificationTier && result.certificationTier.tier !== "UNVERIFIED" && (() => {
        const ct = result.certificationTier!;
        const palette = ct.tier === "GOLD"
          ? { border: "#fbbf24", bg: "rgba(251,191,36,0.07)", text: "#fbbf24" }
          : ct.tier === "SILVER"
          ? { border: "#94a3b8", bg: "rgba(148,163,184,0.07)", text: "#b0bec5" }
          : { border: "#b87333", bg: "rgba(184,115,51,0.07)", text: "#cd8f4a" };
        const subtitle = ct.tier === "GOLD" ? "Elite Autonomous Operation"
          : ct.tier === "SILVER" ? "Autonomous Behavior Confirmed"
          : "Autonomous Indicators Present";
        return (
          <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: palette.bg }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ padding: "3px 10px", border: `1px solid ${palette.border}`, fontSize: "10px", fontWeight: 900, color: palette.text, letterSpacing: "0.12em" }}>
                  {ct.tier} CERTIFIED
                </div>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)" }}>{subtitle}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                {ct.tier === "GOLD" ? (
                  <>
                    {[
                      { label: "Activity",  val: result.activityPattern?.botScore           ?? null },
                      { label: "Reaction",  val: result.reactionTime?.consistencyScore       ?? null },
                      { label: "Gas",       val: result.gasPattern?.gasConsistencyScore      ?? null },
                      { label: "Decision",  val: result.decisionEntropy?.patternScore        ?? null },
                    ].map(s => s.val !== null && (
                      <div key={s.label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: palette.text }}>{s.val}</div>
                        <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
                      </div>
                    ))}
                    {ct.averageForensicScore !== null && (
                      <div style={{ textAlign: "center", borderLeft: `1px solid ${palette.border}55`, paddingLeft: "14px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: palette.text }}>{ct.averageForensicScore}</div>
                        <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Avg</div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: palette.text }}>{ct.qualifyingSignals}/{ct.availableSignals}</div>
                      <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Signals</div>
                    </div>
                    {result.cognitionScore !== null && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: palette.text }}>{result.cognitionScore}%</div>
                        <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Cognition</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {ct.anomalyCapped && (
              <div style={{ marginTop: "6px", fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>
                Raw score qualifies for {ct.rawTier} — capped at {ct.tier} pending behavioral stability
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Certification SBT ── */}
      {isSbtEligible && (() => {
        const ct = result.certificationTier!;
        const palette = ct.tier === "GOLD"
          ? { border: "#fbbf24", bg: "rgba(251,191,36,0.04)", text: "#fbbf24" }
          : { border: "#94a3b8", bg: "rgba(148,163,184,0.04)", text: "#b0bec5" };
        if (!sbtDeployed?.address) {
          return (
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: palette.bg, fontFamily: "'JetBrains Mono', monospace" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontSize: "9px", fontWeight: 900, color: "#00ff00", letterSpacing: "0.14em", textTransform: "uppercase" }}>Certification SBT</span>
                <div style={{ padding: "2px 8px", border: `1px solid ${palette.border}`, fontSize: "9px", fontWeight: 700, color: palette.text, letterSpacing: "0.1em" }}>
                  {ct.tier}
                </div>
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.03em" }}>
                SBT minting coming soon
              </div>
            </div>
          );
        }
        const activeTokenId = sbtMintSuccess?.tokenId ?? sbtTokenId;
        const alreadyMinted = activeTokenId !== null && activeTokenId > BigInt(0);
        return (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: palette.bg, fontFamily: "'JetBrains Mono', monospace" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "9px", fontWeight: 900, color: "#00ff00", letterSpacing: "0.14em", textTransform: "uppercase" }}>Certification SBT</span>
                <div style={{ padding: "2px 8px", border: `1px solid ${palette.border}`, fontSize: "9px", fontWeight: 700, color: palette.text, letterSpacing: "0.1em" }}>
                  {ct.tier}
                </div>
              </div>
              {sbtChecking && (
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.03em" }}>Checking token status…</span>
              )}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "12px", letterSpacing: "0.03em" }}>
              Mint your APOL certification as a non-transferable soulbound token on Base
            </div>
            {!sbtChecking && sbtTokenId !== null && (
              alreadyMinted ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "11px", color: "#00ff00", letterSpacing: "0.04em" }}>✓ Token #{String(activeTokenId)}</span>
                  <a
                    href={`${SBT_EXPLORER}/token/${sbtDeployed.address}?a=${String(activeTokenId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: "10px", color: palette.text, textDecoration: "underline", letterSpacing: "0.04em" }}
                  >
                    View on Basescan ↗
                  </a>
                  {sbtMintSuccess?.txHash && (
                    <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>
                      tx: {sbtMintSuccess.txHash.slice(0, 10)}…
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" }}>
                  <button
                    onClick={handleMintSbt}
                    disabled={sbtMinting}
                    style={{
                      background: sbtMinting ? "rgba(0,255,0,0.15)" : "#00ff00",
                      color: "#000",
                      border: "none",
                      padding: "8px 20px",
                      fontSize: "11px",
                      fontWeight: 900,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      cursor: sbtMinting ? "not-allowed" : "pointer",
                    }}
                  >
                    {sbtMinting ? "Minting…" : "Mint SBT →"}
                  </button>
                  {sbtMintError && (
                    <span style={{ fontSize: "10px", color: "#f87171", letterSpacing: "0.03em" }}>{sbtMintError}</span>
                  )}
                </div>
              )
            )}
          </div>
        );
      })()}

      {/* ── Missing Data Notice ── */}
      {result.missingData && result.missingData.length > 0 && (
        <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(250,204,21,0.04)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <AlertTriangle size={12} color="#facc15" />
            <span style={{ fontSize: "9px", color: "#facc15", letterSpacing: "0.12em", textTransform: "uppercase" }}>Incomplete Data</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
            {result.missingData.map((item, i) => (
              <span key={i} style={{ fontSize: "10px", padding: "2px 8px", border: "1px solid rgba(250,204,21,0.3)", color: "#facc15", letterSpacing: "0.04em" }} data-testid={`missing-data-${i}`}>
                {item}
              </span>
            ))}
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
            {result.isPartial
              ? "Verdict is based on limited data. Provide wallet address and logs URL for a complete AI autonomy assessment."
              : "Some optional data is missing. Results may be more accurate with additional inputs."}
          </div>
        </div>
      )}

      {/* ── Contract Security (only if contract data exists) ── */}
      {cs && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <ShieldCheck size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Contract Security Analysis</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
            {[
              { label: "Honeypot", value: cs.honeypot ? "DETECTED" : "CLEAR", color: cs.honeypot ? "#f87171" : G },
              { label: "Buy Tax", value: isProtocolManaged ? `Protocol Managed` : `${cs.buyTax.toFixed(1)}%`, color: isProtocolManaged ? G : (cs.buyTax > 5 ? "#f87171" : cs.buyTax > 0 ? "#facc15" : G) },
              { label: "Sell Tax", value: isProtocolManaged ? `Protocol Managed` : `${cs.sellTax.toFixed(1)}%`, color: isProtocolManaged ? G : (cs.sellTax > 5 ? "#f87171" : cs.sellTax > 0 ? "#facc15" : G) },
              { label: "Liquidity", value: lpStatus, color: lpColor },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>{item.label}</div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Serial Deployer Alert ── */}
      {result.serialDeployer && (
        <div data-testid="div-serial-deployer-alert" style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(248,113,113,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <AlertTriangle size={14} color="#f87171" />
            <span style={{ fontSize: "10px", color: "#f87171", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Potential Serial Deployer
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)", lineHeight: 1.6, marginBottom: "8px" }}>
            Creator has launched <span style={{ color: "#f87171", fontWeight: 700 }}>{result.serialDeployer.recentCount} tokens</span> in the last {result.serialDeployer.windowDays} days. This is a common pattern for rug-pull operations.
          </div>
          {result.serialDeployer.recentTokens.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {result.serialDeployer.recentTokens.slice(0, 5).map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px" }}>
                  <span style={{ color: "#f87171", fontFamily: "'JetBrains Mono', monospace" }}>{t.address.slice(0, 8)}…{t.address.slice(-4)}</span>
                  <span style={{ color: "rgba(255,255,255,0.5)" }}>{t.name || "Unknown"}</span>
                  <span style={{ color: "rgba(255,255,255,0.3)" }}>({t.ageDays < 1 ? "<1d" : `${t.ageDays}d`} ago)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Clanker Data ── */}
      {result.clankerData && (
        <div data-testid="div-clanker-data" style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <Zap size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Clanker Protocol Data</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
            <div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>24h Volume</div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: result.clankerData.volume24h > 0 ? G : "rgba(255,255,255,0.5)" }}>
                {result.clankerData.volume24h > 0 ? `$${result.clankerData.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "N/A"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Rewards</div>
              <div style={{ fontSize: "11px", fontWeight: 700, color: result.clankerData.rewardsAvailable ? G : "rgba(255,255,255,0.5)" }}>
                {result.clankerData.rewardsAvailable ? "Available" : "None"}
              </div>
            </div>
            {result.clankerData.tags.verified && (
              <div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Status</div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: G }}>Verified</div>
              </div>
            )}
          </div>
          {result.clankerData.warnings.length > 0 && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "3px" }}>
              {result.clankerData.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: "10px", color: "#facc15", display: "flex", alignItems: "center", gap: "4px" }}>
                  <AlertTriangle size={10} /> {w}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── X/Twitter Deep Scan Link ── */}
      {result.twitterHandle && (
        <div data-testid="div-twitter-link" style={{ padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <a
            href={`/agent-scanner?scanx=${encodeURIComponent(result.twitterHandle)}`}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: G, textDecoration: "none", fontWeight: 600 }}
            data-testid="link-deep-scan-twitter"
          >
            <Search size={12} /> Deep Scan X Profile: @{result.twitterHandle}
          </a>
        </div>
      )}

      {/* ── Top Holders ── */}
      {cs && cs.topHolders.length > 0 && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Users size={12} color={G} />
              <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Top Holders</span>
            </div>
            {cs.holderCount > 0 && (
              <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>{cs.holderCount.toLocaleString()} total holders</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {cs.topHolders.map((h, i) => (
              <HolderBar key={i} holder={h} maxPct={maxHolderPct} />
            ))}
          </div>
        </div>
      )}

      {/* ── Transaction Timing Pattern ── */}
      {result.speedTest.timingPattern && result.speedTest.timingPattern.length > 0 && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <Clock size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Transaction Timing Pattern</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {result.speedTest.timingPattern.map((t, i) => (
              <span key={i} style={{ fontSize: "10px", padding: "3px 7px", border: "1px solid rgba(0,255,0,0.2)", color: "rgba(0,255,0,0.7)" }}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {/* ── Anomaly Detection Banner ── */}
      {result.anomalyDetection && result.anomalyDetection.anomalyStatus !== "STABLE" && (() => {
        const ad = result.anomalyDetection!;
        const isAnomalous = ad.anomalyStatus === "ANOMALOUS";
        const color = isAnomalous ? "#f87171" : "#facc15";
        const bg = isAnomalous ? "rgba(248,113,113,0.07)" : "rgba(250,204,21,0.07)";
        const flagged: { label: string; delta: number }[] = [
          ad.activityAnomaly.detected  && { label: "Bot Activity",          delta: ad.activityAnomaly.delta  },
          ad.reactionAnomaly.detected  && { label: "Reaction Consistency",  delta: ad.reactionAnomaly.delta  },
          ad.gasAnomaly.detected       && { label: "Gas Consistency",       delta: ad.gasAnomaly.delta       },
          ad.decisionAnomaly.detected  && { label: "Decision Pattern",      delta: ad.decisionAnomaly.delta  },
        ].filter(Boolean) as { label: string; delta: number }[];
        return (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ border: `1px solid ${color}`, background: bg, padding: "12px 14px" }}>
              <div style={{ fontSize: "11px", fontWeight: 900, color, letterSpacing: "0.1em", marginBottom: "4px" }}>
                {isAnomalous ? "🚨 ANOMALY DETECTED" : "⚠️ BEHAVIORAL SHIFT DETECTED"}
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", marginBottom: "10px" }}>
                {isAnomalous
                  ? "Significant behavioral change from established pattern"
                  : "Scores changing from 30-day baseline"} — based on {ad.snapshotCount} prior scan{ad.snapshotCount !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {flagged.map(sig => (
                  <div key={sig.label} style={{ fontSize: "10px", color, padding: "2px 8px", border: `1px solid ${color}44`, background: `${color}11`, letterSpacing: "0.04em" }}>
                    {sig.label}: {sig.delta > 0 ? "+" : ""}{sig.delta} pts
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Activity Pattern ── */}
      {(result.activityPattern || (result.onChainActivityTest && result.onChainActivityTest.scored)) && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <Activity size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Activity Pattern</span>
          </div>

          {result.activityPattern ? (() => {
            const ap = result.activityPattern;
            const verdictColor = ap.verdict === "BOT-LIKE" ? G : ap.verdict === "HUMAN-LIKE" ? "#facc15" : "#a78bfa";
            const verdictBg = ap.verdict === "BOT-LIKE" ? "rgba(0,255,0,0.08)" : ap.verdict === "HUMAN-LIKE" ? "rgba(250,204,21,0.08)" : "rgba(167,139,250,0.08)";
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <div style={{ padding: "4px 12px", border: `1px solid ${verdictColor}`, background: verdictBg, fontSize: "11px", fontWeight: 900, color: verdictColor, letterSpacing: "0.1em" }}>
                    {ap.verdict}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>Bot Score</span>
                    <div style={{ width: "60px", height: "5px", background: "rgba(255,255,255,0.08)", position: "relative", flexShrink: 0 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${ap.botScore}%`, background: ap.botScore > 65 ? "#f87171" : ap.botScore > 35 ? "#facc15" : G, transition: "width 0.4s ease" }} />
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: verdictColor, minWidth: "36px" }}>{ap.botScore}/100</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Off-Hours Txs</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: ap.offHoursPercent >= 40 ? G : "rgba(255,255,255,0.7)" }}>{ap.offHoursPercent}%</div>
                  </div>
                  {result.onChainActivityTest?.txCount != null && (
                    <div>
                      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Tx Count</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{result.onChainActivityTest.txCount}</div>
                    </div>
                  )}
                  {result.onChainActivityTest?.activityPerDay != null && (
                    <div>
                      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Txs / Day</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{result.onChainActivityTest.activityPerDay.toFixed(1)}</div>
                    </div>
                  )}
                  {result.onChainActivityTest?.contractAgeDays != null && (
                    <div>
                      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Age</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{result.onChainActivityTest.contractAgeDays}d</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{ap.insight}</div>
              </>
            );
          })() : (
            // fallback: basic stats when activityPattern isn't present (old scans)
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px" }}>
                {result.onChainActivityTest?.txCount != null && (
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Tx Count</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{result.onChainActivityTest!.txCount}</div>
                  </div>
                )}
                {result.onChainActivityTest?.activityPerDay != null && (
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Txs / Day</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{result.onChainActivityTest!.activityPerDay.toFixed(1)}</div>
                  </div>
                )}
                {result.onChainActivityTest?.contractAgeDays != null && (
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Age</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{result.onChainActivityTest!.contractAgeDays}d</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Level</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: result.onChainActivityTest?.label === "Active" ? G : (result.onChainActivityTest?.label === "Dead" || result.onChainActivityTest?.label === "Dormant") ? "#f87171" : "#facc15" }}>
                    {result.onChainActivityTest?.label?.toUpperCase()}
                  </div>
                </div>
              </div>
              {result.onChainActivityTest?.detail && (
                <div style={{ marginTop: "8px", fontSize: "10px", color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>{result.onChainActivityTest!.detail}</div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Reaction Time Analysis ── */}
      {result.reactionTime && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <Clock size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Reaction Time Analysis</span>
          </div>
          {(() => {
            const rt = result.reactionTime!;
            const patternColor = rt.reactionPattern === "AUTONOMOUS" ? G : rt.reactionPattern === "MANUAL" ? "#f87171" : "#facc15";
            const patternBg = rt.reactionPattern === "AUTONOMOUS" ? "rgba(0,255,0,0.08)" : rt.reactionPattern === "MANUAL" ? "rgba(248,113,113,0.08)" : "rgba(250,204,21,0.08)";
            const barColor = rt.consistencyScore > 65 ? G : rt.consistencyScore > 35 ? "#facc15" : "#f87171";
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <div style={{ padding: "4px 12px", border: `1px solid ${patternColor}`, background: patternBg, fontSize: "11px", fontWeight: 900, color: patternColor, letterSpacing: "0.1em" }}>
                    {rt.reactionPattern}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>Consistency</span>
                    <div style={{ width: "60px", height: "5px", background: "rgba(255,255,255,0.08)", position: "relative", flexShrink: 0 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${rt.consistencyScore}%`, background: barColor, transition: "width 0.4s ease" }} />
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: barColor, minWidth: "36px" }}>{rt.consistencyScore}/100</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Avg Gap</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{formatDuration(rt.averageReactionTime)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Median Gap</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{formatDuration(rt.medianReactionTime)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Min Gap</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{formatDuration(rt.minReactionTime)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Sub-second</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: rt.subSecondPercent >= 20 ? G : "rgba(255,255,255,0.7)" }}>{rt.subSecondPercent}%</div>
                  </div>
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{rt.insight}</div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Gas Pattern Analysis ── */}
      {result.gasPattern && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <Zap size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Gas Pattern Analysis</span>
          </div>
          {(() => {
            const gp = result.gasPattern!;
            const patternColor = gp.gasPattern === "OPTIMIZED" ? G : gp.gasPattern === "INEFFICIENT" ? "#f87171" : "#facc15";
            const patternBg = gp.gasPattern === "OPTIMIZED" ? "rgba(0,255,0,0.08)" : gp.gasPattern === "INEFFICIENT" ? "rgba(248,113,113,0.08)" : "rgba(250,204,21,0.08)";
            const barColor = gp.gasConsistencyScore > 65 ? G : gp.gasConsistencyScore > 35 ? "#facc15" : "#f87171";
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <div style={{ padding: "4px 12px", border: `1px solid ${patternColor}`, background: patternBg, fontSize: "11px", fontWeight: 900, color: patternColor, letterSpacing: "0.1em" }}>
                    {gp.gasPattern}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>Consistency</span>
                    <div style={{ width: "60px", height: "5px", background: "rgba(255,255,255,0.08)", position: "relative", flexShrink: 0 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${gp.gasConsistencyScore}%`, background: barColor, transition: "width 0.4s ease" }} />
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: barColor, minWidth: "36px" }}>{gp.gasConsistencyScore}/100</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Avg Gas</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{gp.averageGasPrice.toFixed(2)} gwei</div>
                  </div>
                  {gp.optimalGasPercent > 0 && (
                    <div>
                      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Optimal</div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: gp.optimalGasPercent >= 60 ? G : "rgba(255,255,255,0.7)" }}>{gp.optimalGasPercent}%</div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Overpay</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: gp.overpayPercent >= 40 ? "#f87171" : "rgba(255,255,255,0.7)" }}>{gp.overpayPercent}%</div>
                  </div>
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{gp.insight}</div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Decision Pattern Entropy ── */}
      {result.decisionEntropy && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
            <Activity size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Decision Pattern Entropy</span>
          </div>
          {(() => {
            const de = result.decisionEntropy!;
            const patternColor = de.entropyPattern === "ALGORITHMIC" ? G : de.entropyPattern === "ADAPTIVE" ? "#facc15" : "#f87171";
            const patternBg = de.entropyPattern === "ALGORITHMIC" ? "rgba(0,255,0,0.08)" : de.entropyPattern === "ADAPTIVE" ? "rgba(250,204,21,0.08)" : "rgba(248,113,113,0.08)";
            const barColor = de.patternScore > 65 ? G : de.patternScore > 35 ? "#facc15" : "#f87171";
            return (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <div style={{ padding: "4px 12px", border: `1px solid ${patternColor}`, background: patternBg, fontSize: "11px", fontWeight: 900, color: patternColor, letterSpacing: "0.1em" }}>
                    {de.entropyPattern}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>Pattern Score</span>
                    <div style={{ width: "60px", height: "5px", background: "rgba(255,255,255,0.08)", position: "relative", flexShrink: 0 }}>
                      <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${de.patternScore}%`, background: barColor, transition: "width 0.4s ease" }} />
                    </div>
                    <span style={{ fontSize: "10px", fontWeight: 700, color: barColor, minWidth: "36px" }}>{de.patternScore}/100</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Contract Diversity</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: de.contractDiversity <= 20 ? G : "rgba(255,255,255,0.7)" }}>{de.contractDiversity}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Repeat Rate</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: de.actionRepeatRate >= 60 ? G : "rgba(255,255,255,0.7)" }}>{de.actionRepeatRate}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>Entropy</div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{de.decisionEntropy} bits</div>
                  </div>
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>{de.insight}</div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Raw Logs ── */}
      {result.logsTest.logs && result.logsTest.logs.length > 0 && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <Activity size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Raw Reasoning Log Entries</span>
          </div>
          <div style={{ background: "rgba(0,255,0,0.03)", border: "1px solid rgba(0,255,0,0.1)", padding: "10px 12px" }}>
            {result.logsTest.logs.map((log, i) => (
              <div key={i} style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", lineHeight: "1.7", fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: "rgba(0,255,0,0.8)", marginRight: "8px" }}>[{String(i).padStart(2, "0")}]</span>{log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Intelligence Briefing (collapsible) ── */}
      {narratives.length > 0 && (
        <div style={{ padding: "14px 20px" }}>
          <button
            onClick={() => setBriefingOpen(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}
          >
            <FileBarChart2 size={12} color={G} />
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.12em", textTransform: "uppercase", flex: 1, textAlign: "left" }}>
              Intelligence Briefing
            </span>
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)" }}>{briefingOpen ? "▲ COLLAPSE" : "▼ EXPAND"}</span>
          </button>
          {briefingOpen && (
            <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {narratives.map((row, i) => (
                <div key={i}>
                  <div style={{ fontSize: "9px", color: G, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "3px" }}>{row.label}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.72)", lineHeight: "1.65" }}>{row.detail}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ForensicLookups() {
  const { data } = useQuery<{ total: number }>({ queryKey: ["/api/lookups/total"], refetchInterval: 30000 });
  const total = data?.total ?? 0;
  if (!total) return null;
  return (
    <div data-testid="text-total-lookups" style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
      color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em",
    }}>
      <Eye size={12} style={{ color: "#00FF00" }} />
      <span style={{ color: "#00FF00", fontWeight: 700 }}>{total.toLocaleString()}</span>
      <span>lookups</span>
    </div>
  );
}

export default function AgentScanner() {
  const [, slugMatch] = useRoute<{ slug: string }>("/agent-scanner/:slug");
  const slugParam = slugMatch?.slug || null;
  const [location, setLocation] = useLocation();
  const queryString = typeof window !== "undefined" ? window.location.search : "";
  const urlParams = new URLSearchParams(queryString);
  const checkParam = urlParams.get("check");
  const checkChainParam = urlParams.get("chain");
  const scanxParam = urlParams.get("scanx");
  const isLarpMode = !!slugParam;
  const isCheckMode = !!checkParam;
  const isScanxMode = !!scanxParam;
  const isResultMode = isLarpMode || isCheckMode || isScanxMode;

  const [agentName, setAgentName] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [wallet, setWallet] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [claimedAbilities, setClaimedAbilities] = useState("");
  const [logsUrl, setLogsUrl] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [showSysInfo, setShowSysInfo] = useState(false);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [isLoadingSavedScan, setIsLoadingSavedScan] = useState(false);

  useEffect(() => {
    if (!slugParam) return;
    setIsLoadingSavedScan(true);
    setScanError(null);
    fetch(`/api/agent/result/${encodeURIComponent(slugParam)}`)
      .then(async r => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.error || "Scan result not found");
        }
        return r.json();
      })
      .then(data => {
        setResult(data.result);
        setShareSlug(data.slug);
        if (data.tier === "paid") setDeepDiveUnlocked(true);
        else setDeepDiveUnlocked(false);
        setAgentName(data.agentName ?? "");
        setWallet(data.wallet ?? "");
        setChain(data.chain ?? "base");
        setSocialLink(data.socialLink ?? "");
        setLogsUrl(data.logsUrl ?? "");
        setClaimedAbilities(data.claimedAbilities ?? "");
        setTimeout(() => document.getElementById("larp-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      })
      .catch(e => setScanError(e?.message || "Could not load this scan."))
      .finally(() => setIsLoadingSavedScan(false));
  }, [slugParam]);

  const [deepDivePending, setDeepDivePending] = useState(false);
  const [deepDiveUnlocked, setDeepDiveUnlocked] = useState(IS_INNER_CIRCLE_TEST_MODE);
  const [deepDiveTxHash, setDeepDiveTxHash] = useState<string | null>(null);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [deepDiveHover, setDeepDiveHover] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);

  const [alertInput, setAlertInput] = useState("");
  const [alertSubmitting, setAlertSubmitting] = useState(false);
  const [alertSubscribed, setAlertSubscribed] = useState(false);
  const [alertExisting, setAlertExisting] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertUnsubscribing, setAlertUnsubscribing] = useState(false);

  useEffect(() => {
    if (IS_INNER_CIRCLE_TEST_MODE) return;
    const eth = getSelectedProvider();
    if (!eth) return;
    let cancelled = false;
    const checkWallet = async (addr: string) => {
      setConnectedWallet(addr);
      try {
        const res = await fetch(`/api/subscription/status?wallet=${addr}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.paid) { setDeepDiveUnlocked(true); setSubscriptionExpiresAt(data.expiresAt || null); }
      } catch {}
    };
    const check = async () => {
      try {
        const accounts: string[] = await eth.request({ method: "eth_accounts" });
        const addr = accounts?.[0];
        if (!addr || cancelled) return;
        await checkWallet(addr);
      } catch {}
    };
    check();
    const handler = (accounts: string[]) => {
      const addr = accounts?.[0] || null;
      if (!addr) {
        setConnectedWallet(null);
        setDeepDiveUnlocked(false);
        setSubscriptionExpiresAt(null);
        return;
      }
      fetch(`/api/subscription/status?wallet=${addr}`)
        .then(r => r.json())
        .then(d => {
          if (d?.paid) { setDeepDiveUnlocked(true); setSubscriptionExpiresAt(d.expiresAt || null); }
          else { setDeepDiveUnlocked(false); setSubscriptionExpiresAt(null); }
        })
        .catch(() => {});
      setConnectedWallet(addr);
    };
    eth.on?.("accountsChanged", handler);
    return () => { cancelled = true; eth.removeListener?.("accountsChanged", handler); };
  }, []);

  const [apolCertified, setApolCertified] = useState<{ certified: boolean; project?: any } | null>(null);

  const [checkAddress, setCheckAddress] = useState("");
  const [checkChain, setCheckChain] = useState("ethereum");
  const [checkResult, setCheckResult] = useState<DetectiveResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const [scanXHandle, setScanXHandle] = useState("");
  const [scanXResult, setScanXResult] = useState<any | null>(null);
  const [scanXError, setScanXError] = useState<string | null>(null);
  const [isScanningX, setIsScanningX] = useState(false);

  useEffect(() => {
    if (!result?.wallet || !result.traceabilityTest.isContract) { setApolCertified(null); return; }
    fetch(`/api/contracts/verified/${result.wallet.toLowerCase()}`)
      .then(r => r.json()).then(setApolCertified).catch(() => setApolCertified(null));
  }, [result?.wallet, result?.traceabilityTest.isContract]);

  useEffect(() => {
    if (!result?.wallet) { setAlertSubscribed(false); setAlertExisting(null); return; }
    fetch(`/api/webhook/status?agentWallet=${result.wallet.toLowerCase()}`)
      .then(r => r.json())
      .then(d => {
        if (d?.subscribed) { setAlertSubscribed(true); setAlertExisting(d.email ?? d.webhookUrl ?? null); }
        else { setAlertSubscribed(false); setAlertExisting(null); }
      })
      .catch(() => {});
  }, [result?.wallet]);

  const [lastScanxRun, setLastScanxRun] = useState<string | null>(null);
  const [lastCheckRun, setLastCheckRun] = useState<string | null>(null);

  useEffect(() => {
    if (scanxParam && lastScanxRun !== scanxParam) {
      setLastScanxRun(scanxParam);
      setScanXHandle(scanxParam);
      setScanXResult(null);
      setIsScanningX(true);
      setScanXError(null);
      fetch(`/api/scanx?username=${encodeURIComponent(scanxParam)}`)
        .then(r => r.json())
        .then(data => { setScanXResult(data); })
        .catch(() => { setScanXError("Network error."); })
        .finally(() => { setIsScanningX(false); });
    }
  }, [scanxParam, lastScanxRun]);

  useEffect(() => {
    const key = checkParam ? `${checkParam}|${checkChainParam || ""}` : null;
    if (key && lastCheckRun !== key) {
      setLastCheckRun(key);
      setCheckAddress(checkParam!);
      if (checkChainParam) setCheckChain(checkChainParam);
      setCheckResult(null);
      handleCheckAddress(checkParam!, checkChainParam || undefined, true);
    }
  }, [checkParam, checkChainParam, lastCheckRun]);

  const handleCheckAddress = async (overrideAddress?: string, overrideChain?: string, skipNav?: boolean) => {
    const addr = (overrideAddress ?? checkAddress).trim();
    const chainSel = (overrideChain ?? checkChain).trim() || "ethereum";
    if (!addr) return;
    setIsChecking(true);
    setCheckResult(null);
    setCheckError(null);
    try {
      const res = await fetch(
        `/api/detective/analyze?address=${encodeURIComponent(addr)}&chain=${encodeURIComponent(chainSel)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || "Failed to check address");
      } else {
        setCheckResult(data);
        if (!skipNav) {
          setLocation(`/agent-scanner?check=${encodeURIComponent(addr)}&chain=${encodeURIComponent(chainSel)}`);
        }
      }
    } catch {
      setCheckError("Network error. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleScanX = async (overrideHandle?: string, skipNav?: boolean) => {
    const raw = (overrideHandle ?? scanXHandle).trim();
    if (!raw) return;
    setIsScanningX(true);
    setScanXResult(null);
    setScanXError(null);
    try {
      const res = await fetch(`/api/scanx?username=${encodeURIComponent(raw)}`);
      const data = await res.json();
      if (!res.ok) {
        setScanXError(data.error || "Scan failed");
      } else {
        setScanXResult(data);
        if (!skipNav) {
          setLocation(`/agent-scanner?scanx=${encodeURIComponent(raw)}`);
        }
      }
    } catch {
      setScanXError("Network error. Please try again.");
    } finally {
      setIsScanningX(false);
    }
  };

  const buildTweetText = (r: DetectiveResult) => {
    const addr = r.address || checkAddress;
    const short = addr.slice(0, 8) + "…" + addr.slice(-4);
    const type = r.addressType === "contract" ? `Token ${r.tokenSymbol || ""}` : "Wallet";
    const risk = r.riskLevel || "Unknown Risk";
    const issues = r.addressType === "contract"
      ? (r.greenBadge ? "passed all security checks" : `red flags: ${r.redFlags?.join(", ")}`)
      : (r.walletFlags?.length ? `flagged for: ${r.walletFlags.join(", ")}` : "no external flags");
    return encodeURIComponent(
      `APOL SECURITY ALERT\n\n${type} ${short}, ${risk}\nAPOL scan: ${issues}\n\nScanned by @ApolAgent_, #APOL #CryptoSafety #DYOR`
    );
  };

  const handleScan = async () => {
    if (!agentName.trim()) { setScanError("Agent name is required."); return; }
    setIsScanning(true); setScanError(null); setResult(null);
    setDeepDiveTxHash(null); setDeepDiveError(null);
    try {
      const res = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: agentName.trim(),
          socialLink: socialLink.trim() || undefined,
          wallet: wallet.trim() || undefined,
          chain,
          claimedAbilities: claimedAbilities.trim() || undefined,
          logsUrl: logsUrl.trim() || undefined,
          viewerWallet: connectedWallet || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      setShareSlug(data?.slug || null);
      setShareCopied(false);
      if (data?.tier === "paid") setDeepDiveUnlocked(true);
      if (data?.slug) {
        setLocation(`/agent-scanner/${data.slug}`);
      } else {
        setTimeout(() => document.getElementById("larp-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch (e: any) {
      setScanError(e.message || "Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleAlertSubscribe = async () => {
    if (!result?.wallet) return;
    const val = alertInput.trim();
    if (!val) { setAlertError("Enter an email address."); return; }
    if (!val.includes("@")) { setAlertError("Enter a valid email address."); return; }
    setAlertSubmitting(true);
    setAlertError(null);
    try {
      const res = await fetch("/api/webhook/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentWallet: result.wallet,
          email: val,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAlertError(data.error || "Subscription failed."); return; }
      setAlertSubscribed(true);
      setAlertExisting(val);
      setAlertInput("");
    } catch {
      setAlertError("Network error. Please try again.");
    } finally {
      setAlertSubmitting(false);
    }
  };

  const handleAlertUnsubscribe = async () => {
    if (!result?.wallet) return;
    setAlertUnsubscribing(true);
    try {
      await fetch("/api/webhook/unsubscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentWallet: result.wallet }),
      });
      setAlertSubscribed(false);
      setAlertExisting(null);
    } catch {}
    finally { setAlertUnsubscribing(false); }
  };

  const handleDeepDive = async () => {
    if (IS_INNER_CIRCLE_TEST_MODE) { setDeepDiveUnlocked(true); return; }
    const eth = getSelectedProvider();
    if (!eth) {
      setDeepDiveError("MetaMask not detected. Install MetaMask to use Deep Dive Scan.");
      return;
    }
    setDeepDivePending(true);
    setDeepDiveError(null);
    setDeepDiveTxHash(null);
    try {
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      await ensureCorrectNetwork(eth);
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: PAYMENT.platformWallet,
        value: parseEther(PAYMENT.deepDiveFee),
      });
      setDeepDiveTxHash(tx.hash);
      const success = await waitForReceipt(tx.hash);
      if (!success) {
        setDeepDiveError("Transaction reverted on-chain. Deep Dive not unlocked.");
        return;
      }
      const userWallet = accounts[0];
      setConnectedWallet(userWallet);
      let verifiedOk = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const verifyRes = await fetch("/api/subscription/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txHash: tx.hash, wallet: userWallet }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.ok) {
            setDeepDiveUnlocked(true);
            setSubscriptionExpiresAt(verifyData.expiresAt || null);
            verifiedOk = true;
            if (shareSlug) {
              fetch(`/api/agent/result/${encodeURIComponent(shareSlug)}/upgrade`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ wallet: userWallet }),
              }).catch(() => {});
            }
            setTimeout(() => document.getElementById("advanced-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
            break;
          }
          if (attempt === 3) {
            setDeepDiveError(verifyData.reason || "Could not register subscription. Save your tx hash and contact support.");
          }
        } catch {}
        await new Promise(r => setTimeout(r, 3000));
      }
      if (!verifiedOk && !deepDiveError) {
        setDeepDiveError("Payment confirmed but registration failed. Save your tx hash and refresh in a minute.");
      }
    } catch (e: any) {
      if (e.code === 4001 || e.code === "ACTION_REJECTED" || e.message?.includes("rejected")) {
        setDeepDiveError("Transaction rejected.");
      } else {
        setDeepDiveError(e.message || "Transaction failed. Please try again.");
      }
    } finally {
      setDeepDivePending(false);
    }
  };

  const scoreColor = (s: number | null) =>
    s === null ? "text-slate-400" : s >= 71 ? "text-green-400" : s >= 21 ? "text-yellow-400" : "text-red-400";

  const verdictMeta = (v: string) => ({
    "Fully Autonomous": { color: "text-green-400", border: "border-green-700/50", icon: <CheckCircle className="w-5 h-5 text-green-400" /> },
    "Semi-Autonomous": { color: "text-yellow-400", border: "border-yellow-700/50", icon: <AlertTriangle className="w-5 h-5 text-yellow-400" /> },
    "Under Review": { color: "text-yellow-400", border: "border-yellow-700/50", icon: <AlertTriangle className="w-5 h-5 text-yellow-400" /> },
    "Unverified": { color: "text-yellow-400", border: "border-yellow-700/50", icon: <AlertTriangle className="w-5 h-5 text-yellow-400" /> },
    "Insufficient Data": { color: "text-yellow-400", border: "border-yellow-700/50", icon: <AlertTriangle className="w-5 h-5 text-yellow-400" /> },
    "Confirmed LARP": { color: "text-red-400", border: "border-red-700/50", icon: <XCircle className="w-5 h-5 text-red-400" /> },
    "Inconclusive": { color: "text-slate-400", border: "border-slate-700", icon: <HelpCircle className="w-5 h-5 text-slate-400" /> },
  }[v] ?? { color: "text-slate-400", border: "border-slate-700", icon: null });

  const evidence = getEvidenceFiling(result, { wallet, logsUrl, socialLink });
  const vm = result ? verdictMeta(result.verdict) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="bg-slate-900 border-b border-blue-500/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors" data-testid="link-back-home">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 overflow-hidden">
              <img src="/apol-agent-logo.png" alt="APOL Agent" className="w-full h-full object-cover" />
            </div>
            <span className="font-meme text-xl gradient-text">APOL AGENT</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-600/40 rounded-full px-4 py-1.5 text-blue-300 text-sm font-semibold">
            <Bot className="w-4 h-4" /> Scan Agent Utility
          </div>
          <h1 className="font-meme text-4xl md:text-5xl gradient-text">Agent-LARP Detector</h1>
          <ForensicLookups />
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            The Patrol only deals in hard evidence. No data = no verdict.
          </p>
        </div>

        {/* Form */}
        {!isResultMode && (
        <Card className="bg-slate-900/80 border-slate-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <Search className="w-5 h-5 text-blue-400" /> Run LARP Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block font-medium">Agent Name <span className="text-red-400">*</span></label>
              <Input placeholder="e.g. TruthAgent, AutoTrader99…" value={agentName} onChange={e => setAgentName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-500" data-testid="input-agent-name" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">X or Telegram Link <span className="text-slate-500 text-xs font-normal">· Social check</span></label>
                <Input placeholder="https://x.com/AgentHandle" value={socialLink} onChange={e => setSocialLink(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-500" data-testid="input-social-link" />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">Logs URL / API Endpoint <span className="text-slate-500 text-xs font-normal">· (Optional) · Reasoning check</span></label>
                <Input placeholder="https://agent-logs.example.com/api/last" value={logsUrl} onChange={e => setLogsUrl(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-500" data-testid="input-logs-url" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">Wallet Address <span className="text-slate-500 text-xs font-normal">· Liveliness check</span></label>
                <Input placeholder="0x… or Solana address" value={wallet} onChange={e => setWallet(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-500 text-sm" data-testid="input-agent-wallet" />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">Chain</label>
                <Select value={chain} onValueChange={setChain}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white" data-testid="select-agent-chain">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 text-white">
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="bsc">BNB Chain</SelectItem>
                    <SelectItem value="polygon">Polygon</SelectItem>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm text-slate-300 mb-1.5 block font-medium">
                <span className="flex items-center gap-1.5"><Brain className="w-4 h-4 text-purple-400" />Agent Claims</span>
              </label>
              <Textarea placeholder="e.g. 'Trades memecoins 24/7, monitors wallets for rug pulls, posts on-chain reports every hour…'"
                value={claimedAbilities} onChange={e => setClaimedAbilities(e.target.value)} rows={2}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-500 resize-none" data-testid="textarea-claimed-abilities" />
            </div>

            {scanError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2" data-testid="text-scan-error">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {scanError}
              </div>
            )}

            {/* Action buttons row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleScan} disabled={isScanning} style={{
                flex: 1,
                background: isScanning ? "#1e3a5f" : "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                color: "white", fontWeight: "bold", padding: "12px 20px", borderRadius: "10px",
                border: "none", cursor: isScanning ? "not-allowed" : "pointer", fontSize: "14px",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "8px", opacity: isScanning ? 0.7 : 1,
              }} data-testid="button-run-scan">
                {isScanning
                  ? <><Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />Analyzing Agent…</>
                  : <><Bot style={{ width: 18, height: 18 }} />Run LARP Detection</>}
              </button>

            </div>

          </CardContent>
        </Card>
        )}

        {/* Scan CA / Wallet */}
        {(!isResultMode || isCheckMode) && (
        <Card style={{ background: "rgba(0,0,0,0.6)", border: `1px solid rgba(0,255,0,0.25)` }}>
          <CardHeader style={{ paddingBottom: "8px" }}>
            <CardTitle style={{ fontSize: "14px", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fff", fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: "8px" }}>
              <Search size={16} color={G} />
              Scan CA or Wallet
            </CardTitle>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace", marginTop: "4px" }}>
              Full security scan. Flags honeypots, blacklisted addresses, tax traps, and mint abuse.
            </p>
          </CardHeader>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "wrap" }}>
              <Select value={checkChain} onValueChange={setCheckChain}>
                <SelectTrigger style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", width: "180px" }} data-testid="select-check-chain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "#111", border: "1px solid rgba(255,255,255,0.15)" }}>
                  {detectiveChains.map((c) => (
                    <SelectItem key={c.value} value={c.value} style={{ color: "#fff", fontSize: "11px" }}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={checkAddress}
                onChange={(e) => setCheckAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckAddress()}
                placeholder="Enter wallet / contract address..."
                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", flex: 1, minWidth: "200px" }}
                data-testid="input-check-address"
              />
              <button
                onClick={() => handleCheckAddress()}
                disabled={isChecking}
                style={{
                  background: G, color: "#000", border: "none", padding: "8px 20px",
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: "11px",
                  letterSpacing: "0.1em", textTransform: "uppercase", cursor: isChecking ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: "6px", opacity: isChecking ? 0.6 : 1,
                }}
                data-testid="button-check-address"
              >
                {isChecking ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
                {isChecking ? "SCANNING..." : "SCAN"}
              </button>
            </div>

            {checkError && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", border: "1px solid rgba(255,68,68,0.4)", background: "rgba(255,68,68,0.06)", fontSize: "11px", color: "#f87171", fontFamily: "'JetBrains Mono', monospace" }} data-testid="text-check-error">
                <XCircle size={14} style={{ flexShrink: 0 }} />
                {checkError}
              </div>
            )}

            {checkResult && (
              <div data-testid="div-check-result" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {checkResult.addressType === "contract" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {(checkResult.tokenName || checkResult.tokenSymbol) && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace" }}>
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Token</span>
                        <span style={{ color: "#fff", fontWeight: 700 }}>
                          {checkResult.tokenName}
                          {checkResult.tokenSymbol && <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400, marginLeft: "4px" }}>({checkResult.tokenSymbol})</span>}
                        </span>
                        {checkResult.isInDex && (
                          <span style={{ fontSize: "10px", padding: "2px 8px", border: `1px solid rgba(0,255,0,0.3)`, color: G, fontWeight: 700, letterSpacing: "0.05em" }}>DEX LISTED</span>
                        )}
                      </div>
                    )}

                    {(checkResult.liveStatus || checkResult.lpStatus) && (
                      <div data-testid="div-status-panel" style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "12px 16px", border: `1px solid rgba(0,255,0,0.2)`, background: "rgba(0,255,0,0.03)" }}>
                        {checkResult.liveStatus && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>Status</span>
                            <span data-testid="text-live-status" style={{ color: G, fontWeight: 700 }}>{checkResult.liveStatus}</span>
                          </div>
                        )}
                        {checkResult.lpStatus && (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>LP Status</span>
                            <span data-testid="text-lp-status" style={{ color: G, fontWeight: 700 }}>{checkResult.lpStatus}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Token Intelligence Panel */}
                    {(checkResult.priceUsd != null || checkResult.mcap != null || checkResult.liquidity != null || checkResult.volume24h != null || checkResult.tokenAgeDays != null || checkResult.deployerHolding != null || (checkResult.topHoldersList && checkResult.topHoldersList.length > 0)) && (() => {
                      const fmtUsd = (v: number) => v >= 1e9 ? `$${(v/1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(1)}K` : `$${v.toFixed(0)}`;
                      const fmtPrice = (v: number) => {
                        if (v === 0) return "$0";
                        if (v >= 1) return `$${v.toFixed(4)}`;
                        if (v >= 0.01) return `$${v.toFixed(6)}`;
                        const s = v.toFixed(20);
                        const m = s.match(/^0\.(0*[1-9]\d{0,3})/);
                        return m ? `$0.${m[1]}` : `$${v.toExponential(3)}`;
                      };
                      const stats = [
                        checkResult.priceUsd != null && checkResult.priceUsd > 0 ? { label: "Price", value: fmtPrice(checkResult.priceUsd) } : null,
                        checkResult.mcap != null && checkResult.mcap > 0 ? { label: "Market Cap", value: fmtUsd(checkResult.mcap) } : null,
                        checkResult.liquidity != null && checkResult.liquidity > 0 ? { label: "Liquidity", value: fmtUsd(checkResult.liquidity) } : null,
                        checkResult.volume24h != null && checkResult.volume24h > 0 ? { label: "24h Volume", value: fmtUsd(checkResult.volume24h) } : null,
                        checkResult.holderCount != null && checkResult.holderCount > 0 ? { label: "Holders", value: checkResult.holderCount.toLocaleString() } : null,
                        checkResult.tokenAgeDays != null ? { label: "Age", value: checkResult.tokenAgeDays === 0 ? "TODAY" : checkResult.tokenAgeDays === 1 ? "1 day" : `${checkResult.tokenAgeDays} days` } : null,
                      ].filter(Boolean) as { label: string; value: string }[];
                      return (
                        <div data-testid="div-token-intelligence" style={{ border: "1px solid rgba(0,255,0,0.2)", background: "rgba(0,0,0,0.3)", padding: "0" }}>
                          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,255,0,0.12)", display: "flex", alignItems: "center", gap: "8px" }}>
                            <TrendingUp size={13} color={G} />
                            <span style={{ fontSize: "10px", fontWeight: 900, color: G, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>TOKEN INTELLIGENCE</span>
                            {(checkResult.poolVersion || checkResult.platform) && (
                              <span style={{ marginLeft: "auto", fontSize: "9px", fontWeight: 700, padding: "2px 8px", border: `1px solid rgba(0,255,0,0.3)`, color: G, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>
                                {checkResult.poolVersion ? `Uniswap ${checkResult.poolVersion}` : checkResult.platform}
                              </span>
                            )}
                          </div>
                          {stats.length > 0 && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "1px", background: "rgba(0,255,0,0.08)" }}>
                              {stats.map((s, i) => (
                                <div key={i} data-testid={`div-token-stat-${s.label.replace(/\s/g,'-').toLowerCase()}`} style={{ padding: "10px 14px", background: "rgba(0,0,0,0.6)" }}>
                                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: "3px" }}>{s.label}</div>
                                  <div style={{ fontSize: "13px", fontWeight: 900, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {(checkResult.deployerHolding != null || checkResult.creatorDumped != null) && (
                            <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(0,255,0,0.08)", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>Creator Position</span>
                              {checkResult.creatorDumped ? (
                                <span data-testid="badge-creator-dumped" style={{ fontSize: "10px", fontWeight: 900, padding: "2px 10px", background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.4)", color: "#f87171", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>SOLD — 0% HELD ⚠</span>
                              ) : (
                                <span data-testid="badge-creator-holding" style={{ fontSize: "10px", fontWeight: 900, padding: "2px 10px", background: "rgba(0,255,0,0.06)", border: `1px solid rgba(0,255,0,0.3)`, color: G, fontFamily: "'JetBrains Mono', monospace" }}>{(checkResult.deployerHolding ?? 0).toFixed(2)}% HELD</span>
                              )}
                              {checkResult.deployer && (
                                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace", marginLeft: "auto" }}>
                                  {checkResult.deployer.slice(0, 8)}…{checkResult.deployer.slice(-4)}
                                </span>
                              )}
                            </div>
                          )}
                          {checkResult.topHoldersList && checkResult.topHoldersList.length > 0 && (
                            <div style={{ borderTop: "1px solid rgba(0,255,0,0.08)" }}>
                              <div style={{ padding: "8px 14px 4px", fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>Top Holders</div>
                              {checkResult.topHoldersList.map((h, i) => (
                                <div key={i} data-testid={`div-top-holder-${i}`} style={{ padding: "5px 14px", display: "flex", alignItems: "center", gap: "10px", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                                  <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace", width: "14px" }}>#{i + 1}</span>
                                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono', monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {h.address.slice(0, 10)}…{h.address.slice(-4)}
                                  </span>
                                  <span style={{ fontSize: "11px", fontWeight: 900, color: h.percent > 20 ? "#f87171" : h.percent > 10 ? "#facc15" : G, fontFamily: "'JetBrains Mono', monospace" }}>
                                    {h.percent.toFixed(2)}%
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {checkResult.greenBadge && !checkResult.isHighRisk && (!checkResult.redFlags || checkResult.redFlags.length === 0) ? (
                      <div data-testid="div-green-badge" style={{ border: `2px solid ${G}`, background: "rgba(0,255,0,0.06)", padding: "20px", textAlign: "center" }}>
                        <div style={{ fontSize: "14px", fontWeight: 900, color: G, letterSpacing: "0.16em", textTransform: "uppercase" }}>APOL AGENT GREEN BADGE</div>
                        <div style={{ fontSize: "11px", color: "rgba(0,255,0,0.7)", marginTop: "4px" }}>Status: Cleared. All checks passed.</div>
                      </div>
                    ) : (
                      <div data-testid="div-police-record-alert" style={{
                        border: `2px solid ${checkResult.isHighRisk ? "#f87171" : "#facc15"}`,
                        background: checkResult.isHighRisk ? "rgba(255,68,68,0.06)" : "rgba(250,204,21,0.04)",
                        padding: "20px", textAlign: "center",
                      }}>
                        <div style={{ fontSize: "14px", fontWeight: 900, color: checkResult.isHighRisk ? "#f87171" : "#facc15", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                          {checkResult.isHighRisk ? "CONTRACT DANGER DETECTED" : "SECURITY WARNINGS FOUND"}
                        </div>
                        <div style={{ marginTop: "8px" }}>
                          <span style={{
                            fontSize: "10px", fontWeight: 900, padding: "4px 12px", letterSpacing: "0.12em", textTransform: "uppercase",
                            border: `1px solid ${checkResult.isHighRisk ? "rgba(255,68,68,0.4)" : "rgba(250,204,21,0.4)"}`,
                            color: checkResult.isHighRisk ? "#f87171" : "#facc15",
                          }}>
                            {checkResult.riskLevel}
                          </span>
                        </div>
                      </div>
                    )}

                    {checkResult.isOwnershipRenounced && (!checkResult.adminThreats || checkResult.adminThreats.length === 0) && !checkResult.isHighRisk && !checkResult.redFlags?.some(f => f.toLowerCase().includes("honeypot")) && (
                      <div data-testid="div-contract-renounced" style={{ border: `2px solid ${G}`, background: "rgba(0,255,0,0.06)", padding: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
                        <ShieldCheck size={22} color={G} style={{ flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 900, color: G, letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                            CONTRACT RENOUNCED
                          </div>
                          <div style={{ fontSize: "10px", color: "rgba(0,255,0,0.6)", marginTop: "4px", fontFamily: "'JetBrains Mono', monospace" }}>
                            Ownership sent to burn address. No admin can execute privileged functions. Gold standard security.
                          </div>
                        </div>
                      </div>
                    )}

                    {checkResult.isKnownFactory && checkResult.lpEscrow && (
                      <div data-testid="div-lp-escrow" style={{ border: "2px solid #00FF00", background: "rgba(0,255,0,0.04)", padding: "0" }}>
                        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                          <Lock size={18} color="#00FF00" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 900, color: "#00FF00", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                              LP — {checkResult.lpEscrow.name.toUpperCase()}
                            </div>
                          </div>
                          <div style={{ marginLeft: "auto", background: "#00FF00", color: "#000", fontSize: "9px", fontWeight: 900, padding: "3px 8px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
                            PROTOCOL MANAGED
                          </div>
                        </div>
                        <div style={{ padding: "6px 16px 10px", fontSize: "9px", color: "rgba(0,255,0,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>
                          Locker: {checkResult.lpEscrow.address}
                        </div>
                      </div>
                    )}

                    {checkResult.adminThreats && checkResult.adminThreats.length > 0 && (
                      <div data-testid="div-admin-threats" style={{ border: "2px solid #f87171", background: "rgba(255,68,68,0.04)", padding: "0" }}>
                        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,68,68,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
                          <ShieldAlert size={18} color="#f87171" />
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 900, color: "#f87171", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                              ADMIN PERMISSIONS — LIVE THREAT
                            </div>
                            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "2px", fontFamily: "'JetBrains Mono', monospace" }}>
                              {checkResult.isSingleSigAdmin ? "Single-sig owner detected. No multisig protection." : "Active admin controls on this contract."}
                              {" "}Past audits do not clear current permissions.
                            </div>
                          </div>
                        </div>
                        {checkResult.adminThreats.map((threat, i) => {
                          const sevColor = threat.severity === "critical" ? "#f87171" : threat.severity === "high" ? "#fb923c" : "#facc15";
                          const sevBg = threat.severity === "critical" ? "rgba(255,68,68,0.08)" : threat.severity === "high" ? "rgba(251,146,60,0.06)" : "rgba(250,204,21,0.04)";
                          return (
                            <div key={i} data-testid={`div-admin-threat-${i}`} style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,68,68,0.1)", background: sevBg, display: "flex", alignItems: "flex-start", gap: "10px" }}>
                              <span style={{ fontSize: "9px", fontWeight: 900, padding: "2px 6px", border: `1px solid ${sevColor}`, color: sevColor, letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, marginTop: "2px" }}>
                                {threat.severity.toUpperCase()}
                              </span>
                              <div>
                                <div style={{ fontSize: "11px", fontWeight: 900, color: sevColor, letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>
                                  {threat.label}
                                </div>
                                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", marginTop: "2px", lineHeight: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>
                                  {threat.detail}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {checkResult.ownerAddress && (
                          <div style={{ padding: "8px 16px", background: "rgba(255,68,68,0.03)", fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>
                            Owner: <span style={{ color: "rgba(255,255,255,0.6)" }}>{checkResult.ownerAddress}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "6px" }}>
                      {[
                        { label: "Honeypot", value: checkResult.isHoneypot ?? false, skip: false, bad: true },
                        checkResult.isMintable != null ? { label: "Mintable", value: checkResult.isMintable, skip: false, bad: true } : null,
                        checkResult.isOpenSource != null ? { label: "Open Source", value: checkResult.isOpenSource, skip: false, bad: false } : null,
                        checkResult.isProxy != null ? { label: "Proxy Contract", value: checkResult.isProxy, skip: false, bad: true } : null,
                        checkResult.hasBlacklist != null ? { label: "Blacklist", value: checkResult.hasBlacklist, skip: false, bad: true } : null,
                        checkResult.canPause != null ? { label: "Pausable", value: checkResult.canPause, skip: false, bad: true } : null,
                        { label: checkResult.taxOverride ? `Buy Tax: Protocol Managed (${checkResult.taxOverride})` : `Buy Tax ${checkResult.buyTax != null ? Number(checkResult.buyTax).toFixed(1) + "%" : "0%"}`, value: checkResult.taxOverride ? false : (Number(checkResult.buyTax) || 0) > 10, skip: false, bad: true },
                        { label: checkResult.taxOverride ? `Sell Tax: Protocol Managed (${checkResult.taxOverride})` : `Sell Tax ${checkResult.sellTax != null ? Number(checkResult.sellTax).toFixed(1) + "%" : "0%"}`, value: checkResult.taxOverride ? false : (Number(checkResult.sellTax) || 0) > 10, skip: false, bad: true },
                        { label: "On DEX", value: checkResult.isInDex ?? false, skip: false, bad: false },
                        checkResult.sellSimulationSuccess != null
                          ? {
                              label: checkResult.sellSimulationSuccess
                                ? "Sell Sim (Blockaid): PASS"
                                : `Sell Sim (Blockaid): BLOCKED${checkResult.sellSimRevertReason ? ` (${checkResult.sellSimRevertReason})` : ""}`,
                              value: checkResult.sellSimulationSuccess,
                              skip: false,
                              bad: false,
                            }
                          : null,
                        checkResult.goPlusSellSimSuccess != null
                          ? {
                              label: checkResult.goPlusSellSimSuccess
                                ? "Sell Sim (GoPlus): PASS"
                                : "Sell Sim (GoPlus): FAIL",
                              value: checkResult.goPlusSellSimSuccess,
                              skip: false,
                              bad: false,
                            }
                          : null,
                        checkResult.honeypotIsResult != null
                          ? {
                              label: checkResult.honeypotIsResult.isHoneypot
                                ? `Honeypot.is: SELL BLOCKED${checkResult.honeypotIsResult.honeypotReason ? ` — ${checkResult.honeypotIsResult.honeypotReason}` : ""}`
                                : "Honeypot.is: CLEAN",
                              value: checkResult.honeypotIsResult.isHoneypot,
                              skip: false,
                              bad: true,
                            }
                          : null,
                        checkResult.defiShieldRisks != null
                          ? {
                              label: checkResult.defiShieldRisks.length === 0
                                ? "De.Fi Shield: CLEAN"
                                : `De.Fi Shield: ${checkResult.defiShieldRisks.length} risk${checkResult.defiShieldRisks.length > 1 ? "s" : ""}`,
                              value: checkResult.defiShieldRisks.length > 0,
                              skip: false,
                              bad: true,
                            }
                          : null,
                      ].filter(Boolean).map((item, i) => {
                        const itm = item as { label: string; value: boolean; bad: boolean };
                        const isWarning = itm.bad ? itm.value : !itm.value;
                        return (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px",
                            border: `1px solid ${isWarning ? "rgba(255,68,68,0.3)" : "rgba(0,255,0,0.3)"}`,
                            background: isWarning ? "rgba(255,68,68,0.04)" : "rgba(0,255,0,0.04)",
                            fontSize: "11px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                            color: isWarning ? "#f87171" : G,
                          }} data-testid={`div-contract-flag-${i}`}>
                            <span>{isWarning ? "⚠" : "✓"}</span>
                            <span>{itm.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {checkResult.redFlags && checkResult.redFlags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {checkResult.redFlags.map((flag, i) => (
                          <span key={i} style={{ fontSize: "10px", padding: "4px 10px", border: "1px solid rgba(255,68,68,0.4)", background: "rgba(255,68,68,0.06)", color: "#f87171", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }} data-testid={`div-red-flag-${i}`}>
                            🚩 {flag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div data-testid="div-apol-summary" style={{ display: "flex", gap: "12px", padding: "14px 16px", border: `1px solid rgba(0,255,0,0.2)`, background: "rgba(0,255,0,0.03)" }}>
                      <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>🦍</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "10px", fontWeight: 900, color: G, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px", fontFamily: "'JetBrains Mono', monospace" }}>APOL DETECTIVE</div>
                        {checkResult.apolVerdict ? (
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)", lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace" }}>{checkResult.apolVerdict}</div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", lineHeight: 1.6, fontStyle: "italic", fontFamily: "'JetBrains Mono', monospace" }}>Insufficient data for verdict.</div>
                        )}
                        {checkResult.scanCount != null && (
                          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginTop: "6px", fontFamily: "'JetBrains Mono', monospace" }}>Scan #{checkResult.scanCount} on this address</div>
                        )}
                      </div>
                    </div>

                    <a
                      data-testid="button-share-x"
                      href={`https://twitter.com/intent/tweet?text=${buildTweetText(checkResult)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "10px", background: "#000", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", fill: "#fff" }} xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.744l7.736-8.848L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      SHARE APOL ALERT TO X
                    </a>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {checkResult.riskLevel === "Clean" && !checkResult.isNewOffender ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", border: `2px solid ${G}`, background: "rgba(0,255,0,0.06)" }}>
                        <CheckCircle size={20} color={G} style={{ flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 900, color: G, letterSpacing: "0.14em", textTransform: "uppercase" }}>STATUS: CLEAR</div>
                          <div style={{ fontSize: "11px", color: "rgba(0,255,0,0.6)", marginTop: "2px" }}>No flags on record.</div>
                        </div>
                      </div>
                    ) : (
                      <div data-testid="div-police-record-alert" style={{
                        border: `2px solid ${checkResult.isNewOffender ? "#f97316" : checkResult.isHighRisk ? "#f87171" : "#facc15"}`,
                        background: checkResult.isNewOffender ? "rgba(249,115,22,0.06)" : checkResult.isHighRisk ? "rgba(255,68,68,0.06)" : "rgba(250,204,21,0.04)",
                        padding: "20px", textAlign: "center",
                      }}>
                        {checkResult.isNewOffender ? (
                          <>
                            <div style={{ fontSize: "14px", fontWeight: 900, color: "#f97316", letterSpacing: "0.16em", textTransform: "uppercase" }}>NEW OFFENDER DETECTED</div>
                            <div style={{ fontSize: "11px", color: "rgba(249,115,22,0.7)", marginTop: "4px" }}>Flagged: last 24 hours.</div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: "14px", fontWeight: 900, color: checkResult.isHighRisk ? "#f87171" : "#facc15", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                              {checkResult.isHighRisk ? "HIGH RISK WALLET" : "SUSPICIOUS WALLET"}
                            </div>
                            <div style={{ marginTop: "8px" }}>
                              <span style={{
                                fontSize: "10px", fontWeight: 900, padding: "4px 12px", letterSpacing: "0.12em", textTransform: "uppercase",
                                border: `1px solid ${checkResult.isHighRisk ? "rgba(255,68,68,0.4)" : "rgba(250,204,21,0.4)"}`,
                                color: checkResult.isHighRisk ? "#f87171" : "#facc15",
                              }}>
                                {checkResult.riskLevel}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {checkResult.walletFlags && checkResult.walletFlags.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 900, color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>SECURITY FLAGS</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {checkResult.walletFlags.map((flag, i) => (
                            <span key={i} style={{ fontSize: "10px", padding: "4px 10px", border: "1px solid rgba(255,68,68,0.4)", background: "rgba(255,68,68,0.06)", color: "#f87171", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }} data-testid={`badge-wallet-flag-${i}`}>
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {checkResult.currentBalance && (
                      <div data-testid="div-wallet-balance" style={{ padding: "14px", border: "1px solid rgba(0,255,0,0.2)", background: "rgba(0,255,0,0.03)" }}>
                        <div style={{ fontSize: "10px", fontWeight: 900, color: G, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px", fontFamily: "'JetBrains Mono', monospace" }}>CURRENT BALANCE</div>
                        <div style={{ fontSize: "16px", fontWeight: 900, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{checkResult.currentBalance} ETH</div>
                      </div>
                    )}

                    {checkResult.activity && (
                      <div data-testid="div-wallet-activity" style={{ padding: "14px", border: "1px solid rgba(0,255,0,0.2)", background: "rgba(0,255,0,0.03)" }}>
                        <div style={{ fontSize: "10px", fontWeight: 900, color: G, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px", fontFamily: "'JetBrains Mono', monospace" }}>📊 ACTIVITY (Base Mainnet)</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
                          <div data-testid="text-tx-count">Transactions: {checkResult.activity.txCount} txs</div>
                          <div data-testid="text-tx-level">Level: <span style={{ color: checkResult.activity.level === "High" ? "#f87171" : checkResult.activity.level === "Moderate" ? "#facc15" : G, fontWeight: 700 }}>{checkResult.activity.level}</span></div>
                          <div style={{ display: "flex", gap: "24px", marginTop: "4px" }}>
                            <div data-testid="text-inflow">Inflow: <span style={{ color: G, fontWeight: 700 }}>{checkResult.activity.inflow} ETH</span></div>
                            <div data-testid="text-outflow">Outflow: <span style={{ color: "#f87171", fontWeight: 700 }}>{checkResult.activity.outflow} ETH</span></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {checkResult.genesis && (checkResult.genesis.creator || checkResult.genesis.creationTx) && (
                      <div data-testid="div-wallet-genesis" style={{ padding: "14px", border: "1px solid rgba(0,255,0,0.2)", background: "rgba(0,255,0,0.03)" }}>
                        <div style={{ fontSize: "10px", fontWeight: 900, color: G, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px", fontFamily: "'JetBrains Mono', monospace" }}>GENESIS</div>
                        {checkResult.genesis.creator && (
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>
                            Creator: {checkResult.genesis.creator}
                          </div>
                        )}
                        {checkResult.genesis.creationTx && (
                          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace", marginTop: "4px", wordBreak: "break-all" }}>
                            Tx: {checkResult.genesis.creationTx}
                          </div>
                        )}
                      </div>
                    )}

                    {checkResult.funding && checkResult.funding.fundingSource && (
                      <div data-testid="div-wallet-funding" style={{ padding: "14px", border: "1px solid rgba(0,255,0,0.2)", background: "rgba(0,255,0,0.03)" }}>
                        <div style={{ fontSize: "10px", fontWeight: 900, color: G, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px", fontFamily: "'JetBrains Mono', monospace" }}>FUNDING SOURCE</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>
                          From: {checkResult.funding.fundingSource}
                        </div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace", marginTop: "4px" }}>
                          Value: {checkResult.funding.fundingValue} ETH
                        </div>
                      </div>
                    )}

                    <div data-testid="div-apol-summary" style={{ display: "flex", gap: "12px", padding: "14px", border: `1px solid rgba(0,255,0,0.2)`, background: "rgba(0,255,0,0.03)" }}>
                      <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>🦍</div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 900, color: G, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px", fontFamily: "'JetBrains Mono', monospace" }}>APOL DETECTIVE</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, fontStyle: "italic", fontFamily: "'JetBrains Mono', monospace" }}>"{checkResult.apolVerdict}"</div>
                      </div>
                    </div>

                    {(checkResult.riskLevel !== "Clean" || checkResult.isNewOffender) && (
                      <a
                        data-testid="button-share-x"
                        href={`https://twitter.com/intent/tweet?text=${buildTweetText(checkResult)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "10px", background: "#000", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none" }}
                      >
                        <svg viewBox="0 0 24 24" style={{ width: "14px", height: "14px", fill: "#fff" }} xmlns="http://www.w3.org/2000/svg">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.744l7.736-8.848L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        SHARE APOL WARNING TO X
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Scan X Profile */}
        {(!isResultMode || isScanxMode) && (
        <Card style={{ background: "rgba(0,0,0,0.6)", border: `1px solid rgba(0,255,0,0.25)` }}>
          <CardHeader style={{ paddingBottom: "8px" }}>
            <CardTitle style={{ fontSize: "14px", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fff", fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: G }} xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.744l7.736-8.848L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Scan X Agent
            </CardTitle>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace", marginTop: "4px" }}>
              Full agent verification from X profile. Checks social authenticity, extracts claimed abilities, discovers reasoning logs, and detects linked tokens.
            </p>
          </CardHeader>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "wrap" }}>
              <Input
                value={scanXHandle}
                onChange={(e) => setScanXHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScanX()}
                placeholder="@username or https://x.com/username"
                style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", flex: 1, minWidth: "200px" }}
                data-testid="input-scan-x-handle"
              />
              <button
                onClick={() => handleScanX()}
                disabled={isScanningX}
                style={{
                  background: G, color: "#000", border: "none", padding: "8px 20px",
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 900, fontSize: "11px",
                  letterSpacing: "0.1em", textTransform: "uppercase", cursor: isScanningX ? "wait" : "pointer",
                  display: "flex", alignItems: "center", gap: "6px", opacity: isScanningX ? 0.6 : 1,
                }}
                data-testid="button-scan-x"
              >
                {isScanningX ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
                {isScanningX ? "SCANNING..." : "SCAN"}
              </button>
            </div>

            {scanXError && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", border: "1px solid rgba(255,68,68,0.4)", background: "rgba(255,68,68,0.06)", fontSize: "11px", color: "#f87171", fontFamily: "'JetBrains Mono', monospace" }} data-testid="text-scan-x-error">
                <XCircle size={14} style={{ flexShrink: 0 }} />
                {scanXError}
              </div>
            )}

            {scanXResult && (() => {
              const r = scanXResult;
              const vc = r.verdictLevel === "green" ? G : r.verdictLevel === "red" ? "#f87171" : r.verdictLevel === "yellow" ? "#facc15" : "#6b7280";
              return (
              <div data-testid="div-scan-x-result" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Profile header */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)" }}>
                  {r.profileImage && <img src={r.profileImage.replace("_normal", "_200x200")} alt="" style={{ width: "48px", height: "48px", borderRadius: "0" }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 900, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{r.displayName}</span>
                      {r.isVerified && <span style={{ fontSize: "10px", padding: "1px 6px", background: "rgba(29,155,240,0.2)", color: "#1d9bf0", fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>@{r.username}</div>
                  </div>
                </div>

                {/* Bio */}
                {r.bio && (
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono', monospace", padding: "0 4px", lineHeight: 1.5, fontStyle: "italic" }}>
                    "{r.bio.slice(0, 200)}"
                  </div>
                )}

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                  {[
                    { label: "Followers", value: r.followers.toLocaleString() },
                    { label: "Following", value: r.following.toLocaleString() },
                    { label: "Ratio", value: r.followRatio },
                    { label: "Joined", value: r.joinedDate },
                    { label: "Age", value: `${r.ageDays} days` },
                    { label: "Tweets", value: r.totalTweets.toLocaleString() },
                  ].map((s, i) => (
                    <div key={i} style={{ padding: "8px 10px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)", textAlign: "center" }}>
                      <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>{s.label}</div>
                      <div style={{ fontSize: "12px", fontWeight: 900, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Engagement */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <div style={{ flex: 1, padding: "8px 12px", border: `1px solid rgba(255,255,255,0.08)`, background: "rgba(0,0,0,0.3)" }}>
                    <div style={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>Engagement</div>
                    <div style={{ fontSize: "11px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: r.engagement.rating === "High" ? G : r.engagement.rating === "Low" ? "#f87171" : "#facc15" }}>
                      {r.engagement.rating} {r.engagement.rating !== "Data Pending" && `(${r.engagement.avgLikes}❤ / ${r.engagement.avgRetweets}🔁 avg)`}
                    </div>
                  </div>
                </div>

                {/* Risk Flags */}
                {r.flags.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "9px", color: "#f87171", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 900, fontFamily: "'JetBrains Mono', monospace" }}>Risk Flags</div>
                    {r.flags.map((f: any, i: number) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                        border: `1px solid ${f.type === "critical" ? "rgba(255,68,68,0.4)" : f.type === "info" ? "rgba(0,255,0,0.3)" : "rgba(250,204,21,0.4)"}`,
                        color: f.type === "critical" ? "#f87171" : f.type === "info" ? G : "#facc15",
                        background: f.type === "critical" ? "rgba(255,68,68,0.04)" : f.type === "info" ? "rgba(0,255,0,0.04)" : "rgba(250,204,21,0.04)",
                      }}>
                        <span>{f.type === "critical" ? "⛔" : f.type === "info" ? "🟢" : "⚠️"}</span>
                        <span>{f.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "8px 12px", border: `1px solid rgba(0,255,0,0.3)`, background: "rgba(0,255,0,0.04)", fontSize: "11px", fontWeight: 700, color: G, fontFamily: "'JetBrains Mono', monospace" }}>
                    ✅ No social risk flags detected.
                  </div>
                )}

                {/* Agent Abilities */}
                {r.agentAbilities && r.agentAbilities.length > 0 && (
                  <div style={{ padding: "8px 12px", border: "1px solid rgba(0,255,0,0.15)", background: "rgba(0,255,0,0.03)" }}>
                    <div style={{ fontSize: "9px", color: G, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", marginBottom: "6px" }}>Detected Abilities</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {r.agentAbilities.map((a: string, i: number) => (
                        <span key={i} style={{ fontSize: "10px", padding: "2px 8px", background: "rgba(0,255,0,0.1)", border: "1px solid rgba(0,255,0,0.3)", color: G, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reasoning Status */}
                {r.reasoningStatus && r.reasoningStatus !== "no_source" && (
                  <div style={{ padding: "8px 12px", border: `1px solid ${r.reasoningStatus === "verified" ? "rgba(0,255,0,0.3)" : "rgba(255,255,255,0.08)"}`, background: r.reasoningStatus === "verified" ? "rgba(0,255,0,0.03)" : "rgba(0,0,0,0.3)", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Reasoning: </span>
                    <span style={{ color: r.reasoningStatus === "verified" ? G : r.reasoningStatus === "mismatch" ? "#facc15" : "rgba(255,255,255,0.6)", fontWeight: 700 }}>{r.reasoningDetail}</span>
                    {r.reasoningUrl && <div style={{ fontSize: "10px", color: G, marginTop: "4px" }}>Source: {r.reasoningUrl}</div>}
                  </div>
                )}

                {/* Ability Mismatch */}
                {r.abilityMismatch && (
                  <div style={{ padding: "8px 12px", border: "1px solid rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.04)", fontSize: "11px", color: "#f87171", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    ⚠️ {r.abilityMismatch}
                  </div>
                )}

                {/* Linked CA */}
                {r.linkedCA && (
                  <div style={{ padding: "8px 12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Linked CA: </span>
                    <span style={{ color: G, fontWeight: 700 }}>{r.linkedSymbol} — {r.linkedCA}</span>
                  </div>
                )}

                {/* Verdict */}
                <div style={{ border: `2px solid ${vc}`, background: vc === G ? "rgba(0,255,0,0.06)" : vc === "#f87171" ? "rgba(255,68,68,0.06)" : "rgba(250,204,21,0.04)", padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: "6px" }}>Agent Verification</div>
                  <div data-testid="text-scanx-verdict" style={{ fontSize: "12px", fontWeight: 900, color: vc, letterSpacing: "0.05em", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>
                    {r.verdict}
                  </div>
                </div>
              </div>
              );
            })()}
          </CardContent>
        </Card>
        )}

        {/* Evidence Filing — pre-scan (only show for LARP scanner, not CA/wallet) */}
        {!isResultMode && !result && !checkResult && (
          <div>
            <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-3 px-1">Evidence Filing</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {evidence.map((item, i) => (
                <div key={i} className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 flex flex-col items-center gap-2 text-center">
                  <span className="text-3xl">{item.emoji}</span>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                  <StatusBadge status={item.status} label={item.tag} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && !isCheckMode && !isScanxMode && (
          <div id="larp-result" className="space-y-4">

            {/* Share URL */}
            {shareSlug && (
              <div
                data-testid="div-share-url"
                style={{
                  border: `1px solid ${G}`,
                  background: "rgba(0,255,0,0.04)",
                  padding: "12px 16px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: G, fontWeight: 700, letterSpacing: 1 }}>SHARE</span>
                <code
                  data-testid="text-share-url"
                  style={{
                    flex: 1,
                    minWidth: 220,
                    color: "#fff",
                    background: "rgba(0,0,0,0.4)",
                    padding: "6px 10px",
                    border: "1px solid rgba(0,255,0,0.25)",
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {`${typeof window !== "undefined" ? window.location.origin : ""}/agent-scanner/${shareSlug}`}
                </code>
                <button
                  data-testid="button-copy-share-url"
                  onClick={() => {
                    const url = `${window.location.origin}/agent-scanner/${shareSlug}`;
                    navigator.clipboard.writeText(url).then(() => {
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    }).catch(() => {});
                  }}
                  style={{
                    background: shareCopied ? G : "transparent",
                    color: shareCopied ? "#000" : G,
                    border: `1px solid ${G}`,
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                >
                  {shareCopied ? "COPIED" : "COPY LINK"}
                </button>
              </div>
            )}

            {/* Project Info — submitted inputs */}
            {(agentName || wallet || socialLink || logsUrl || claimedAbilities) && (
              <div
                data-testid="div-project-info"
                style={{
                  border: `1px solid rgba(0,255,0,0.3)`,
                  background: "rgba(0,255,0,0.03)",
                  padding: "16px 20px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                <div style={{ color: G, fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
                  PROJECT INFO
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                  {agentName && (
                    <div data-testid="info-agent-name">
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 3 }}>AGENT NAME</div>
                      <div style={{ color: "#fff", fontSize: 13, wordBreak: "break-word" }}>{agentName}</div>
                    </div>
                  )}
                  {wallet && (
                    <div data-testid="info-wallet">
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 3 }}>WALLET / CONTRACT</div>
                      <div style={{ color: "#fff", fontSize: 12, wordBreak: "break-all" }}>
                        <a
                          href={`${CHAIN.explorerUrl}/address/${wallet}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: G, textDecoration: "none" }}
                        >
                          {wallet}
                        </a>
                        <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 6, fontSize: 10 }}>
                          ({chain})
                        </span>
                      </div>
                    </div>
                  )}
                  {socialLink && (
                    <div data-testid="info-social">
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 3 }}>X / TELEGRAM</div>
                      <div style={{ fontSize: 12, wordBreak: "break-all" }}>
                        <a
                          href={socialLink.startsWith("http") ? socialLink : `https://${socialLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: G, textDecoration: "none" }}
                        >
                          {socialLink} <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle" }} />
                        </a>
                      </div>
                    </div>
                  )}
                  {logsUrl && (
                    <div data-testid="info-logs">
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 3 }}>LOGS / API ENDPOINT</div>
                      <div style={{ fontSize: 12, wordBreak: "break-all" }}>
                        <a
                          href={logsUrl.startsWith("http") ? logsUrl : `https://${logsUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: G, textDecoration: "none" }}
                        >
                          {logsUrl} <ExternalLink size={10} style={{ display: "inline", verticalAlign: "middle" }} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                {claimedAbilities && (
                  <div data-testid="info-abilities" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,255,0,0.15)" }}>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 4 }}>CLAIMED ABILITIES</div>
                    <div style={{ color: "#fff", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{claimedAbilities}</div>
                  </div>
                )}
              </div>
            )}

            {/* APOL Certified Banner */}
            {apolCertified?.certified && (
              <div
                data-testid="div-apol-certified-banner"
                style={{
                  border: `2px solid ${G}`,
                  background: "rgba(0,255,0,0.06)",
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                }}
              >
                <Shield size={40} color={G} strokeWidth={2.5} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: G, fontSize: "14px", fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase" }}>
                    APOL AGENT CERTIFIED
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", marginTop: "3px", letterSpacing: "0.06em" }}>
                    This contract has passed a full APOL Agent audit and is verified on-chain.
                    {apolCertified.project?.projectName && (
                      <span style={{ color: G, marginLeft: "6px" }}>[ {apolCertified.project.projectName} ]</span>
                    )}
                  </div>
                </div>
                <a
                  href={`/verify/${result.wallet?.toLowerCase()}`}
                  style={{ color: G, fontSize: "10px", letterSpacing: "0.1em", textDecoration: "underline", whiteSpace: "nowrap" }}
                  data-testid="link-view-certificate"
                >
                  VIEW CERTIFICATE ↗
                </a>
              </div>
            )}

            {/* Verdict card */}
            <div className={`bg-slate-900 border-2 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 ${vm?.border}`}>
              <div className="flex flex-col items-center gap-2 min-w-[110px]">
                {result.cognitionScore !== null ? (
                  <>
                    <span className={`font-orbitron text-6xl font-black ${scoreColor(result.cognitionScore)}`} data-testid="text-cognition-score">
                      {result.cognitionScore}%
                    </span>
                    <div className="w-24 bg-slate-800 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${scoreColor(result.cognitionScore).replace("text-", "bg-")}`}
                        style={{ width: `${result.cognitionScore}%` }} />
                    </div>
                  </>
                ) : (
                  <span className="font-orbitron text-5xl font-black text-slate-600" data-testid="text-cognition-score">N/A</span>
                )}
              </div>
              <div className="flex-1 text-center md:text-left space-y-2">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  {vm?.icon}
                  <span className={`font-orbitron text-2xl font-black ${vm?.color}`} data-testid="text-verdict">
                    {result.verdict}
                  </span>
                </div>
                <p className="text-slate-400 text-sm italic">{oneLineSummary(result)}</p>
              </div>
            </div>

            {/* Evidence Filing — post-scan */}
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-3 px-1">Evidence Filing</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {evidence.map((item, i) => (
                  <div key={i} className="bg-slate-900 border border-slate-700/60 rounded-xl p-5 flex flex-col items-center gap-2 text-center">
                    <span className="text-3xl">{item.emoji}</span>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
                    <StatusBadge status={item.status} label={item.tag} />
                  </div>
                ))}
              </div>
            </div>

            {/* Officer verdict */}
            <div className="bg-slate-900 border border-blue-600/30 rounded-xl p-5 flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-11 h-11 overflow-hidden">
                  <img src="/apol-agent-logo.png" alt="Officer" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-yellow-400 text-xs font-bold mb-1 tracking-wider">APOL OFFICER VERDICT</p>
                <p className="text-slate-200 text-sm leading-relaxed" data-testid="text-apol-verdict">{result.apolVerdict}</p>
                <button onClick={() => {
                  const scoreText = result.cognitionScore !== null ? `Cognition Score: ${result.cognitionScore}%` : "No verifiable data";
                  const text = `🦍 APOL Agent // LARP Detection\n\nAgent: ${result.agentName}\n${scoreText}\nVerdict: ${result.verdict}\n\n${result.apolVerdict}\n\nScan at apolagent.online #APOL #LARPDetector`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
                }} className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors" data-testid="button-tweet-verdict">
                  Tweet this verdict <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {result.wallet && /^0x[a-fA-F0-9]{40}$/.test(result.wallet) && (
              <BehavioralHistory wallet={result.wallet} />
            )}

            <div id="advanced-results">
              <AdvancedResults result={result} shareSlug={shareSlug} />
            </div>

            {/* ── Get Alerts ── */}
            <div
              style={{
                border: "1px solid rgba(0,255,0,0.15)",
                background: "#000",
                padding: "16px 20px",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span style={{ fontSize: "10px", fontWeight: 900, color: G, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  GET ALERTS
                </span>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
                  — notify me when this agent is scanned again
                </span>
              </div>

              {alertSubscribed ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: G, fontWeight: 700 }}>
                    <span style={{ display: "inline-block", width: "7px", height: "7px", background: G, borderRadius: "50%" }} />
                    SUBSCRIBED
                  </span>
                  {alertExisting && (
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
                      → {alertExisting}
                    </span>
                  )}
                  <button
                    onClick={handleAlertUnsubscribe}
                    disabled={alertUnsubscribing}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "10px", color: "rgba(255,255,255,0.3)", textDecoration: "underline", fontFamily: "'JetBrains Mono', monospace", padding: 0 }}
                  >
                    {alertUnsubscribing ? "removing…" : "Unsubscribe"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      value={alertInput}
                      onChange={e => { setAlertInput(e.target.value); setAlertError(null); }}
                      onKeyDown={e => e.key === "Enter" && handleAlertSubscribe()}
                      placeholder="email@example.com"
                      style={{
                        flex: 1,
                        minWidth: "220px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "11px",
                        padding: "7px 10px",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={handleAlertSubscribe}
                      disabled={alertSubmitting}
                      style={{
                        padding: "7px 18px",
                        fontSize: "10px",
                        fontWeight: 900,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        fontFamily: "'JetBrains Mono', monospace",
                        cursor: alertSubmitting ? "not-allowed" : "pointer",
                        background: "transparent",
                        border: `1px solid ${G}`,
                        color: G,
                        opacity: alertSubmitting ? 0.5 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {alertSubmitting ? "…" : "SUBSCRIBE"}
                    </button>
                  </div>
                  {alertError && (
                    <div style={{ fontSize: "10px", color: "#f87171" }}>{alertError}</div>
                  )}
                </div>
              )}
            </div>

            <div className="text-center pt-1">
              <button onClick={() => {
                setResult(null); setAgentName(""); setSocialLink(""); setWallet("");
                setClaimedAbilities(""); setLogsUrl(""); setScanError(null);
                setDeepDiveUnlocked(IS_INNER_CIRCLE_TEST_MODE); setDeepDiveTxHash(null); setDeepDiveError(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
                className="text-slate-500 hover:text-white text-sm underline underline-offset-2 transition-colors" data-testid="button-scan-another">
                Scan another agent
              </button>
            </div>
          </div>
        )}

        {/* System Info */}
        <div className="pt-4 border-t border-slate-800/60 text-center">
          <button
            onClick={() => setShowSysInfo(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-400 transition-colors"
            data-testid="button-system-info"
          >
            <Info className="w-3.5 h-3.5" />
            System Info
          </button>
          {showSysInfo && (
            <div className="mt-3 text-left bg-slate-900/60 border border-slate-800 rounded-xl px-5 py-4 max-w-lg mx-auto">
              <div className="text-xs">
                {[
                  { label: "LATENCY", value: "On-chain tx timing vs. human business hours" },
                  { label: "REASONING", value: "Log endpoint vs. on-chain execution timestamps" },
                  { label: "SOCIAL INTEGRITY", value: "Follower age + engagement ratio" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap w-36 flex-shrink-0">{row.label}</span>
                    <span className="text-slate-400 text-right ml-auto">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-4 py-2.5">
                  <span className="text-slate-500 font-semibold uppercase tracking-wider whitespace-nowrap w-36 flex-shrink-0">SCORE</span>
                  <span className="text-right ml-auto">
                    <span className="text-red-400">0–20%</span><span className="text-slate-600"> LARP &nbsp;</span>
                    <span className="text-yellow-400">21–70%</span><span className="text-slate-600"> REVIEW &nbsp;</span>
                    <span className="text-green-400">71–100%</span><span className="text-slate-600"> VERIFIED</span>
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-800">
                Public data only. Results are community intelligence, not a legal determination.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
