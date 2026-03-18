import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Bot, FileText, AlertTriangle, CheckCircle,
  XCircle, Loader2, ChevronRight, Search, Brain, HelpCircle, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TestResult = { scored: boolean; score: number; maxScore: number; label: string; detail: string; timingPattern?: string[]; isContract?: boolean };
type LogsTestResult = { status: "verified" | "mismatch" | "inconclusive"; detail: string; logs: string[] };
type SocialTestResult = { status: "clear" | "suspicious" | "inconclusive"; detail: string; followers?: number; accountAgeDays?: number };

type AgentResult = {
  agentName: string;
  cognitionScore: number | null;
  verdict: "Digital Puppet" | "Semi-Autonomous" | "Fully Autonomous" | "Inconclusive";
  apolVerdict: string;
  scoredTests: number;
  speedTest: TestResult;
  traceabilityTest: TestResult;
  contextTest: TestResult;
  logsTest: LogsTestResult;
  socialTest: SocialTestResult;
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

// Derive the 3 Evidence Filing items from result
function getEvidenceFiling(r: AgentResult | null, formState: { wallet: string; logsUrl: string; socialLink: string }) {
  if (!r) {
    // Pre-scan: reflect form readiness
    return [
      {
        emoji: "🕒", label: "Liveliness",
        status: formState.wallet.trim() ? "green" as StatusColor : "grey" as StatusColor,
        tag: formState.wallet.trim() ? "Active" : "Passive",
      },
      {
        emoji: "🧠", label: "Reasoning",
        status: formState.logsUrl.trim() ? "green" as StatusColor : "yellow" as StatusColor,
        tag: formState.logsUrl.trim() ? "Verified" : "Unlinked",
      },
      {
        emoji: "👥", label: "Sybil Check",
        status: formState.socialLink.trim() ? "green" as StatusColor : "grey" as StatusColor,
        tag: formState.socialLink.trim() ? "Clear" : "Pending",
      },
    ];
  }
  // Post-scan: use actual results
  const liveStatus: StatusColor = !r.speedTest.scored ? "grey" : r.speedTest.score >= 12 ? "green" : "red";
  const reasoningStatus: StatusColor = r.logsTest.status === "verified" ? "green" : r.logsTest.status === "mismatch" ? "red" : "yellow";
  const sybilStatus: StatusColor = r.socialTest.status === "clear" ? "green" : r.socialTest.status === "suspicious" ? "red" : "grey";
  return [
    { emoji: "🕒", label: "Liveliness", status: liveStatus, tag: liveStatus === "green" ? "Active" : "Passive" },
    { emoji: "🧠", label: "Reasoning", status: reasoningStatus, tag: reasoningStatus === "green" ? "Verified" : "Unlinked" },
    { emoji: "👥", label: "Sybil Check", status: sybilStatus, tag: sybilStatus === "green" ? "Clear" : sybilStatus === "red" ? "Suspicious" : "Unverified" },
  ];
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

  const handleScan = async () => {
    if (!agentName.trim()) { setScanError("Agent name is required."); return; }
    setIsScanning(true); setScanError(null); setResult(null);
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

  const scoreColor = (s: number | null) =>
    s === null ? "text-slate-400" : s >= 71 ? "text-green-400" : s >= 31 ? "text-yellow-400" : "text-red-400";

  const verdictMeta = (v: string) => ({
    "Fully Autonomous": { color: "text-green-400", border: "border-green-700/50", icon: <CheckCircle className="w-5 h-5 text-green-400" /> },
    "Semi-Autonomous": { color: "text-yellow-400", border: "border-yellow-700/50", icon: <AlertTriangle className="w-5 h-5 text-yellow-400" /> },
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
            <div className="w-8 h-8 rounded-full bg-yellow-400 overflow-hidden">
              <img src="/ape-police-logo.png" alt="APE POLICE" className="w-full h-full object-cover" />
            </div>
            <span className="font-meme text-xl gradient-text">APE POLICE</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        {/* Hero — no scoring legend */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-600/40 rounded-full px-4 py-1.5 text-blue-300 text-sm font-semibold">
            <Bot className="w-4 h-4" /> Scan Agent Utility
          </div>
          <h1 className="font-meme text-4xl md:text-5xl gradient-text">Agent-LARP Detector</h1>
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
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-500 font-mono text-sm" data-testid="input-agent-wallet" />
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

            <button onClick={handleScan} disabled={isScanning} style={{
              background: isScanning ? "#1e3a5f" : "linear-gradient(135deg, #1d4ed8, #7c3aed)",
              color: "white", fontWeight: "bold", padding: "12px 28px", borderRadius: "10px",
              border: "none", cursor: isScanning ? "not-allowed" : "pointer", fontSize: "15px",
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: "8px", opacity: isScanning ? 0.7 : 1,
            }} data-testid="button-run-scan">
              {isScanning
                ? <><Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />Analyzing Agent…</>
                : <><Bot style={{ width: 18, height: 18 }} />Run LARP Detection 🕵️</>}
            </button>
          </CardContent>
        </Card>

        {/* Evidence Filing — pre-scan (form state) */}
        {!result && (
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

            {/* Evidence Filing — post-scan results */}
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
                <div className="w-11 h-11 rounded-full bg-yellow-400 overflow-hidden">
                  <img src="/ape-police-logo.png" alt="Officer" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-yellow-400 text-xs font-bold mb-1 tracking-wider">APOL OFFICER VERDICT</p>
                <p className="text-slate-200 text-sm leading-relaxed" data-testid="text-apol-verdict">{result.apolVerdict}</p>
                <button onClick={() => {
                  const scoreText = result.cognitionScore !== null ? `Cognition Score: ${result.cognitionScore}%` : "No verifiable data";
                  const text = `🦍 APE POLICE Agent-LARP Detection\n\nAgent: ${result.agentName}\n${scoreText}\nVerdict: ${result.verdict}\n\n${result.apolVerdict}\n\nScan at apepolice.io #APOL #LARPDetector`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
                }} className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors" data-testid="button-tweet-verdict">
                  Tweet this verdict <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="text-center pt-1">
              <button onClick={() => { setResult(null); setAgentName(""); setSocialLink(""); setWallet(""); setClaimedAbilities(""); setLogsUrl(""); setScanError(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-slate-500 hover:text-white text-sm underline underline-offset-2 transition-colors" data-testid="button-scan-another">
                Scan another agent
              </button>
            </div>
          </div>
        )}

        {/* System Info — collapsed by default */}
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
