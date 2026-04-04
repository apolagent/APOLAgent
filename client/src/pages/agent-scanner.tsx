import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Bot, AlertTriangle, CheckCircle,
  XCircle, Loader2, ChevronRight, Search, Brain, HelpCircle, Info,
  Zap, Lock, ExternalLink, ShieldAlert, Activity, Clock, Shield,
  ShieldCheck, Droplets, Users, TrendingUp, FileBarChart2, Eye,
} from "lucide-react";
import { BrowserProvider, JsonRpcProvider, parseEther } from "ethers";
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
  return true;
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
  isHoneypot?: boolean;
  isMintable?: boolean;
  isOpenSource?: boolean;
  isInDex?: boolean;
  isProxy?: boolean;
  hasBlacklist?: boolean;
  canPause?: boolean;
  protocolSecured?: boolean;
  isDirectToDex?: boolean;
  lpEscrow?: { name: string; address: string; percent: number } | null;
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
};

type AgentResult = {
  agentName: string;
  wallet: string | null;
  cognitionScore: number | null;
  verdict: "Digital Puppet" | "Semi-Autonomous" | "Fully Autonomous" | "Low Autonomy" | "Insufficient Data" | "Inconclusive";
  apolVerdict: string;
  scoredTests: number;
  missingData?: string[];
  isPartial?: boolean;
  speedTest: TestResult;
  traceabilityTest: TestResult;
  contextTest: TestResult;
  logsTest: LogsTestResult;
  socialTest: SocialTestResult;
  contractScan: ContractScan | null;
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
  if (r.verdict === "Low Autonomy") return "Contract security verified but AI identity could not be confirmed. Not necessarily a risk.";
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
      { emoji: "🕒", label: "Liveliness", status: formState.wallet.trim() ? "green" as StatusColor : "grey" as StatusColor, tag: formState.wallet.trim() ? "Active" : "Passive" },
      { emoji: "🧠", label: "Reasoning", status: formState.logsUrl.trim() ? "green" as StatusColor : "yellow" as StatusColor, tag: formState.logsUrl.trim() ? "Verified" : "Unlinked" },
      { emoji: "👥", label: "Sybil Check", status: formState.socialLink.trim() ? "green" as StatusColor : "grey" as StatusColor, tag: formState.socialLink.trim() ? "Clear" : "Pending" },
    ];
  }
  const liveStatus: StatusColor = !r.speedTest.scored ? "grey" : r.speedTest.score >= 12 ? "green" : "red";
  const reasoningStatus: StatusColor = r.logsTest.status === "verified" ? "green" : r.logsTest.status === "mismatch" ? "red" : "yellow";
  const sybilStatus: StatusColor = r.socialTest.status === "clear" ? "green" : r.socialTest.status === "suspicious" ? "red" : "grey";
  return [
    { emoji: "🕒", label: "Liveliness", status: liveStatus, tag: liveStatus === "green" ? "Active" : "Passive" },
    { emoji: "🧠", label: "Reasoning", status: reasoningStatus, tag: reasoningStatus === "green" ? "Verified" : "Unlinked" },
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

function AdvancedResults({ result }: { result: AgentResult }) {
  const [briefingOpen, setBriefingOpen] = useState(false);
  const cs = result.contractScan;

  const riskLevel = result.cognitionScore === null ? "UNKNOWN"
    : result.verdict === "Insufficient Data" ? "INSUFFICIENT DATA"
    : result.verdict === "Low Autonomy" ? "INCONCLUSIVE"
    : result.cognitionScore >= 71 ? "LOW RISK"
    : result.cognitionScore >= 31 ? "MEDIUM RISK"
    : "HIGH RISK";
  const riskColor = result.cognitionScore === null ? "#6b7280"
    : result.verdict === "Insufficient Data" ? "#facc15"
    : result.verdict === "Low Autonomy" ? "#facc15"
    : result.cognitionScore >= 71 ? G
    : result.cognitionScore >= 31 ? "#facc15"
    : "#f87171";

  const caseNum = `APOL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }).toUpperCase();

  const lpStatus = !cs ? "N/A"
    : cs.lpLockedPercent >= 90 ? `LOCKED (${cs.lpLockedPercent.toFixed(0)}%${cs.lockLocations[0] ? ` · ${cs.lockLocations[0]}` : ""})`
    : cs.lockLocations.some(l => l.toLowerCase().includes("burn")) ? `BURNED (${cs.lpLockedPercent.toFixed(0)}%)`
    : cs.lpLockedPercent > 0 ? `PARTIALLY LOCKED (${cs.lpLockedPercent.toFixed(0)}%)`
    : "MANUAL / UNLOCKED";
  const lpColor = !cs ? "#6b7280"
    : cs.lpLockedPercent >= 90 ? G
    : cs.lpLockedPercent >= 50 ? "#facc15"
    : "#f87171";

  const maxHolderPct = cs ? Math.max(...cs.topHolders.map(h => h.percent), 1) : 1;

  const narratives = [
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
          <div style={{ fontSize: "10px", color: riskColor, fontWeight: 700, letterSpacing: "0.06em" }}>{result.verdict.toUpperCase()}</div>
        </div>
      </div>

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
              { label: "Buy Tax", value: `${cs.buyTax.toFixed(1)}%`, color: cs.buyTax > 5 ? "#f87171" : cs.buyTax > 0 ? "#facc15" : G },
              { label: "Sell Tax", value: `${cs.sellTax.toFixed(1)}%`, color: cs.sellTax > 5 ? "#f87171" : cs.sellTax > 0 ? "#facc15" : G },
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

  const [deepDivePending, setDeepDivePending] = useState(false);
  const [deepDiveUnlocked, setDeepDiveUnlocked] = useState(IS_INNER_CIRCLE_TEST_MODE);
  const [deepDiveTxHash, setDeepDiveTxHash] = useState<string | null>(null);
  const [deepDiveError, setDeepDiveError] = useState<string | null>(null);
  const [deepDiveHover, setDeepDiveHover] = useState(false);

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

  const handleCheckAddress = async () => {
    if (!checkAddress.trim()) return;
    setIsChecking(true);
    setCheckResult(null);
    setCheckError(null);
    try {
      const res = await fetch(
        `/api/detective/analyze?address=${encodeURIComponent(checkAddress.trim())}&chain=${encodeURIComponent(checkChain)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || "Failed to check address");
      } else {
        setCheckResult(data);
      }
    } catch {
      setCheckError("Network error. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleScanX = async () => {
    const raw = scanXHandle.trim();
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
    setDeepDiveUnlocked(IS_INNER_CIRCLE_TEST_MODE); setDeepDiveTxHash(null); setDeepDiveError(null);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      setTimeout(() => document.getElementById("larp-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: any) {
      setScanError(e.message || "Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
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
      if (success) {
        setDeepDiveUnlocked(true);
        setTimeout(() => document.getElementById("advanced-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
      } else {
        setDeepDiveError("Transaction reverted on-chain. Deep Dive not unlocked.");
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
    s === null ? "text-slate-400" : s >= 71 ? "text-green-400" : s >= 31 ? "text-yellow-400" : "text-red-400";

  const verdictMeta = (v: string) => ({
    "Fully Autonomous": { color: "text-green-400", border: "border-green-700/50", icon: <CheckCircle className="w-5 h-5 text-green-400" /> },
    "Semi-Autonomous": { color: "text-yellow-400", border: "border-yellow-700/50", icon: <AlertTriangle className="w-5 h-5 text-yellow-400" /> },
    "Low Autonomy": { color: "text-yellow-400", border: "border-yellow-700/50", icon: <AlertTriangle className="w-5 h-5 text-yellow-400" /> },
    "Insufficient Data": { color: "text-yellow-400", border: "border-yellow-700/50", icon: <AlertTriangle className="w-5 h-5 text-yellow-400" /> },
    "Digital Puppet": { color: "text-red-400", border: "border-red-700/50", icon: <XCircle className="w-5 h-5 text-red-400" /> },
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
        <Card className="bg-slate-900/80 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
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
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">Logs URL / API Endpoint <span className="text-slate-500 text-xs font-normal">· Reasoning check</span></label>
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

              {!IS_INNER_CIRCLE_TEST_MODE && (
                <button
                  onClick={handleDeepDive}
                  disabled={deepDivePending || deepDiveUnlocked}
                  onMouseEnter={() => setDeepDiveHover(true)}
                  onMouseLeave={() => setDeepDiveHover(false)}
                  data-testid="button-deep-dive-scan"
                  style={{
                    flex: "0 0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "7px",
                    padding: "12px 18px",
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    fontFamily: "'JetBrains Mono', monospace",
                    background: deepDiveUnlocked ? "rgba(0,255,0,0.1)" : deepDiveHover && !deepDivePending ? G : "#000",
                    color: deepDiveUnlocked ? G : deepDiveHover && !deepDivePending ? "#000" : G,
                    border: deepDiveUnlocked ? `1px solid rgba(0,255,0,0.4)` : `1px solid ${G}`,
                    borderRadius: "0",
                    cursor: deepDiveUnlocked || deepDivePending ? "default" : "pointer",
                    transition: "background 0.15s ease, color 0.15s ease",
                    whiteSpace: "nowrap",
                    opacity: deepDivePending ? 0.75 : 1,
                  }}
                >
                  {deepDiveUnlocked ? (
                    <><CheckCircle size={15} />Unlocked</>
                  ) : deepDivePending ? (
                    <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />Confirming…</>
                  ) : (
                    <><Zap size={15} />Deep Dive Scan ({PAYMENT.deepDiveFee} ETH)</>
                  )}
                </button>
              )}
            </div>

            {!IS_INNER_CIRCLE_TEST_MODE && deepDiveTxHash && !deepDiveUnlocked && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 12px", border: "1px solid rgba(0,255,0,0.2)",
                background: "rgba(0,255,0,0.04)", fontSize: "11px", color: "rgba(0,255,0,0.7)",
                fontFamily: "'JetBrains Mono', monospace",
              }} data-testid="div-tx-pending">
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                <span>TX SUBMITTED: Awaiting on-chain confirmation...</span>
                <a href={`${CHAIN.explorerUrl}/tx/${deepDiveTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: G, marginLeft: "auto", flexShrink: 0 }}>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            {!IS_INNER_CIRCLE_TEST_MODE && deepDiveUnlocked && deepDiveTxHash && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 12px", border: `1px solid rgba(0,255,0,0.4)`,
                background: "rgba(0,255,0,0.06)", fontSize: "11px", color: G,
                fontFamily: "'JetBrains Mono', monospace",
              }} data-testid="div-tx-confirmed">
                <CheckCircle size={12} style={{ flexShrink: 0 }} />
                <span>TX CONFIRMED: Advanced Results unlocked below.</span>
                <a href={`${CHAIN.explorerUrl}/tx/${deepDiveTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: G, marginLeft: "auto", flexShrink: 0 }}>
                  <ExternalLink size={12} />
                </a>
              </div>
            )}

            {!IS_INNER_CIRCLE_TEST_MODE && deepDiveError && (
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "8px 12px", border: "1px solid rgba(255,68,68,0.4)",
                background: "rgba(255,68,68,0.04)", fontSize: "11px", color: "#f87171",
                fontFamily: "'JetBrains Mono', monospace",
              }} data-testid="text-deep-dive-error">
                <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                {deepDiveError}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scan CA / Wallet */}
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
                onClick={handleCheckAddress}
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
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontFamily: "'JetBrains Mono', monospace" }}>
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

                    {checkResult.greenBadge ? (
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

                    {checkResult.isOwnershipRenounced && (!checkResult.adminThreats || checkResult.adminThreats.length === 0) && (
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

                    {checkResult.lpEscrow && (
                      <div data-testid="div-lp-escrow" style={{ border: "2px solid #00FF00", background: "rgba(0,255,0,0.04)", padding: "0" }}>
                        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                          <Lock size={18} color="#00FF00" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: 900, color: "#00FF00", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                              {checkResult.isDirectToDex ? "PROTOCOL SECURED — DIRECT-TO-DEX" : `PROTOCOL SECURED — ${checkResult.lpEscrow.name.toUpperCase()}`}
                            </div>
                            {checkResult.isDirectToDex && (
                              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "4px", fontFamily: "'JetBrains Mono', monospace" }}>
                                {checkResult.lpEscrow.name}
                              </div>
                            )}
                          </div>
                          <div style={{ marginLeft: "auto", background: "#00FF00", color: "#000", fontSize: "9px", fontWeight: 900, padding: "3px 8px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
                            ZERO LP RISK
                          </div>
                        </div>
                        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(0,255,0,0.15)", fontSize: "10px", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, fontFamily: "'JetBrains Mono', monospace" }}>
                          {checkResult.isDirectToDex
                            ? `Liquidity is already live and protocol-managed via ${checkResult.lpEscrow.name}. This is a Direct-to-DEX concentrated liquidity deployment — technically superior to a manual lock. The DEX protocol itself manages the LP position.`
                            : `Liquidity is already live and protocol-managed via ${checkResult.lpEscrow.name}. LP is held by the launchpad's immutable vault — a Direct-to-DEX deployment with protocol-level security, technically superior to manual locks.`}
                        </div>
                        <div style={{ padding: "6px 16px 10px", fontSize: "9px", color: "rgba(0,255,0,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {checkResult.isDirectToDex ? "Pool" : "Escrow"}: {checkResult.lpEscrow.address}
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
                        { label: "Honeypot", value: checkResult.isHoneypot, bad: true },
                        { label: "Mintable", value: checkResult.isMintable, bad: true },
                        { label: "Open Source", value: checkResult.isOpenSource, bad: false },
                        { label: "Proxy", value: checkResult.isProxy, bad: true },
                        { label: "Blacklist", value: checkResult.hasBlacklist, bad: true },
                        { label: "Pausable", value: checkResult.canPause, bad: true },
                        { label: `Buy Tax ${checkResult.buyTax != null ? checkResult.buyTax.toFixed(1) + "%" : ""}`, value: (checkResult.buyTax ?? 0) > 10, bad: true },
                        { label: `Sell Tax ${checkResult.sellTax != null ? checkResult.sellTax.toFixed(1) + "%" : ""}`, value: (checkResult.sellTax ?? 0) > 10, bad: true },
                        { label: "On DEX", value: checkResult.isInDex, bad: false },
                      ].map((item, i) => {
                        const isWarning = item.bad ? item.value : !item.value;
                        return (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px",
                            border: `1px solid ${isWarning ? "rgba(255,68,68,0.3)" : "rgba(0,255,0,0.3)"}`,
                            background: isWarning ? "rgba(255,68,68,0.04)" : "rgba(0,255,0,0.04)",
                            fontSize: "11px", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                            color: isWarning ? "#f87171" : G,
                          }} data-testid={`div-contract-flag-${i}`}>
                            <span>{isWarning ? "⚠" : "✓"}</span>
                            <span>{item.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {checkResult.redFlags && checkResult.redFlags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {checkResult.redFlags.map((flag, i) => (
                          <span key={i} style={{ fontSize: "10px", padding: "4px 10px", border: "1px solid rgba(255,68,68,0.4)", background: "rgba(255,68,68,0.06)", color: "#f87171", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }} data-testid={`div-red-flag-${i}`}>
                            {flag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div data-testid="div-apol-summary" style={{ display: "flex", gap: "12px", padding: "14px", border: `1px solid rgba(0,255,0,0.2)`, background: "rgba(0,255,0,0.03)" }}>
                      <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>🦍</div>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 900, color: G, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "4px", fontFamily: "'JetBrains Mono', monospace" }}>APOL DETECTIVE</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, fontStyle: "italic", fontFamily: "'JetBrains Mono', monospace" }}>"{checkResult.apolVerdict}"</div>
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

        {/* Scan X Profile */}
        <Card style={{ background: "rgba(0,0,0,0.6)", border: `1px solid rgba(0,255,0,0.25)` }}>
          <CardHeader style={{ paddingBottom: "8px" }}>
            <CardTitle style={{ fontSize: "14px", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fff", fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: G }} xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.744l7.736-8.848L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Scan X Profile
            </CardTitle>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace", marginTop: "4px" }}>
              Social forensics scan. Checks account age, follower quality, engagement, and AI agent verification.
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
                onClick={handleScanX}
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
                    { label: "Ratio", value: `${r.followRatio}:1` },
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

                {/* Linked CA */}
                {r.linkedCA && (
                  <div style={{ padding: "8px 12px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.3)", fontSize: "11px", fontFamily: "'JetBrains Mono', monospace" }}>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Linked CA: </span>
                    <span style={{ color: G, fontWeight: 700 }}>{r.linkedSymbol} — {r.linkedCA}</span>
                  </div>
                )}

                {/* Verdict */}
                <div style={{ border: `2px solid ${vc}`, background: vc === G ? "rgba(0,255,0,0.06)" : vc === "#f87171" ? "rgba(255,68,68,0.06)" : "rgba(250,204,21,0.04)", padding: "16px", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: "6px" }}>Social Verdict</div>
                  <div style={{ fontSize: "14px", fontWeight: 900, color: vc, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                    {r.verdict}
                  </div>
                </div>

                {/* Note about full scan */}
                <div style={{ padding: "10px 14px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.2)", fontSize: "10px", color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>
                  This is a social-only scan based on X profile data. For a full AI autonomy assessment, use the Agent LARP Scanner above with wallet address, logs URL, and claimed abilities.
                </div>
              </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Evidence Filing — pre-scan (only show for LARP scanner, not CA/wallet) */}
        {!result && !checkResult && (
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
        {result && (
          <div id="larp-result" className="space-y-4">

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

            <div id="advanced-results">
              {deepDiveUnlocked ? (
                <AdvancedResults result={result} />
              ) : (
                <div style={{
                  border: "1px solid rgba(0,255,0,0.2)",
                  background: "#000",
                  padding: "32px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  textAlign: "center",
                }} data-testid="div-advanced-results-locked">
                  <Lock size={28} color="rgba(0,255,0,0.65)" />
                  <p style={{ color: "rgba(0,255,0,0.7)", fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                    Advanced Forensic Report [Locked]
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "11px", maxWidth: "320px", lineHeight: "1.6" }}>
                    Timing pattern matrix, raw log entries, full test narratives, and behavioral fingerprint.
                    Unlock with Deep Dive Scan ({PAYMENT.deepDiveFee} ETH).
                  </p>
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
                    <span className="text-red-400">0–30%</span><span className="text-slate-600"> LOW &nbsp;</span>
                    <span className="text-yellow-400">31–70%</span><span className="text-slate-600"> MID &nbsp;</span>
                    <span className="text-green-400">71–100%</span><span className="text-slate-600"> HIGH</span>
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
