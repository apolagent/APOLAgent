import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Bot, Zap, Eye, Brain, Clock, AlertTriangle, CheckCircle,
  XCircle, Loader2, ChevronRight, Shield, Search, FileText, Twitter, HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TestResult = {
  scored: boolean;
  score: number;
  maxScore: number;
  label: string;
  detail: string;
  timingPattern?: string[];
  isContract?: boolean;
};
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

function TestCard({
  icon,
  title,
  test,
}: {
  icon: React.ReactNode;
  title: string;
  test: TestResult;
}) {
  if (!test.scored) {
    return (
      <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-2 opacity-80">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-bold text-slate-400 bg-slate-700/60 border border-slate-600/40 rounded-full px-2 py-0.5">
            Inconclusive — Missing Evidence
          </span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{test.detail}</p>
      </div>
    );
  }

  const pct = Math.round((test.score / test.maxScore) * 100);
  const barColor = pct >= 60 ? "bg-green-500" : pct >= 35 ? "bg-yellow-400" : "bg-red-500";
  const labelColor = pct >= 60 ? "text-green-300 bg-green-900/40 border-green-700/40" : pct >= 35 ? "text-yellow-300 bg-yellow-900/40 border-yellow-700/40" : "text-red-300 bg-red-900/40 border-red-700/40";

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-300 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <span className="text-xs text-slate-400">{test.score}/{test.maxScore} pts</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${labelColor}`}>{test.label}</span>
        <span className="text-xs text-slate-400">{pct}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{test.detail}</p>
      {test.timingPattern && test.timingPattern.length > 0 && (
        <div className="mt-2 space-y-1 pt-1 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 font-medium">Last on-chain transactions:</p>
          {test.timingPattern.map((t, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-slate-400 font-mono">{t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogsCard({ logs }: { logs: LogsTestResult }) {
  const colors = {
    verified: { border: "border-green-700/50", bg: "bg-green-900/20", icon: <CheckCircle className="w-4 h-4 text-green-400" />, label: "text-green-300 bg-green-900/40 border-green-700/40", tag: "Verified ✓" },
    mismatch: { border: "border-red-700/50", bg: "bg-red-900/20", icon: <XCircle className="w-4 h-4 text-red-400" />, label: "text-red-300 bg-red-900/40 border-red-700/40", tag: "Timestamp Mismatch ⚠️" },
    inconclusive: { border: "border-slate-700/60", bg: "bg-slate-800/40", icon: <HelpCircle className="w-4 h-4 text-slate-500" />, label: "text-slate-400 bg-slate-700/60 border-slate-600/40", tag: "Inconclusive" },
  }[logs.status];

  return (
    <div className={`border rounded-xl p-4 space-y-2 ${colors.border} ${colors.bg}`}>
      <div className="flex items-center gap-2 text-blue-300 text-sm font-semibold">
        <FileText className="w-4 h-4" />
        Reasoning / Logs Verification
      </div>
      <div className="flex items-center gap-2">
        {colors.icon}
        <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${colors.label}`}>{colors.tag}</span>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{logs.detail}</p>
      {logs.logs.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-slate-700/50">
          <p className="text-xs text-slate-500 font-medium">Log timestamps retrieved:</p>
          {logs.logs.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-slate-500" />
              <span className="text-xs text-slate-400 font-mono">{l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SocialCard({ social }: { social: SocialTestResult }) {
  const colors = {
    clear: { border: "border-green-700/50", bg: "bg-green-900/20", icon: <CheckCircle className="w-4 h-4 text-green-400" />, label: "text-green-300 bg-green-900/40 border-green-700/40", tag: "Clear" },
    suspicious: { border: "border-red-700/50", bg: "bg-red-900/20", icon: <AlertTriangle className="w-4 h-4 text-red-400" />, label: "text-red-300 bg-red-900/40 border-red-700/40", tag: "Sybil/Bot Suspected 🚨" },
    inconclusive: { border: "border-slate-700/60", bg: "bg-slate-800/40", icon: <HelpCircle className="w-4 h-4 text-slate-500" />, label: "text-slate-400 bg-slate-700/60 border-slate-600/40", tag: "Inconclusive" },
  }[social.status];

  return (
    <div className={`border rounded-xl p-4 space-y-2 ${colors.border} ${colors.bg}`}>
      <div className="flex items-center gap-2 text-blue-300 text-sm font-semibold">
        <Twitter className="w-4 h-4" />
        Social Integrity Check
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {colors.icon}
        <span className={`text-xs font-bold border rounded-full px-2 py-0.5 ${colors.label}`}>{colors.tag}</span>
        {social.followers !== undefined && (
          <span className="text-xs text-slate-400">{social.followers.toLocaleString()} followers</span>
        )}
        {social.accountAgeDays !== undefined && (
          <span className="text-xs text-slate-400">· ~{social.accountAgeDays} days old</span>
        )}
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">{social.detail}</p>
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

  const v = result?.verdict;
  const isInconclusive = v === "Inconclusive";

  const verdictStyle = !v ? {} : {
    "Fully Autonomous": { color: "text-green-400", bg: "bg-green-900/40 border-green-600/50", icon: <CheckCircle className="w-6 h-6 text-green-400" /> },
    "Semi-Autonomous": { color: "text-yellow-400", bg: "bg-yellow-900/40 border-yellow-600/50", icon: <AlertTriangle className="w-6 h-6 text-yellow-400" /> },
    "Digital Puppet": { color: "text-red-400", bg: "bg-red-900/40 border-red-600/50", icon: <XCircle className="w-6 h-6 text-red-400" /> },
    "Inconclusive": { color: "text-slate-400", bg: "bg-slate-800/60 border-slate-600/50", icon: <HelpCircle className="w-6 h-6 text-slate-400" /> },
  }[v] ?? {};

  const scoreColor = (s: number | null) => s === null ? "text-slate-400" : s >= 71 ? "text-green-400" : s >= 31 ? "text-yellow-400" : "text-red-400";

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

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-blue-900/40 border border-blue-600/40 rounded-full px-4 py-1.5 text-blue-300 text-sm font-semibold">
            <Bot className="w-4 h-4" /> Scan Agent Utility
          </div>
          <h1 className="font-meme text-4xl md:text-5xl gradient-text">Agent-LARP Detector</h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            The Patrol only deals in <strong className="text-white">hard evidence</strong>. No data = no verdict. Submit verifiable details and receive a real Cognition Score.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 0–30% Digital Puppet</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 31–70% Semi-Autonomous</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> 71–100% Fully Autonomous</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> No data = Inconclusive</span>
          </div>
        </div>

        {/* Form */}
        <Card className="bg-slate-900/80 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" /> Run LARP Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block font-medium">Agent Name <span className="text-red-400">*</span></label>
              <Input placeholder="e.g. TruthAgent, AutoTrader99…" value={agentName} onChange={e => setAgentName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-500" data-testid="input-agent-name" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">X or Telegram Link <span className="text-slate-500 text-xs">Optional — enables Social Integrity check</span></label>
                <Input placeholder="https://x.com/AgentHandle" value={socialLink} onChange={e => setSocialLink(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-500" data-testid="input-social-link" />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">Logs URL / API Endpoint <span className="text-slate-500 text-xs">Optional — enables Reasoning Check</span></label>
                <Input placeholder="https://agent-logs.example.com/api/last" value={logsUrl} onChange={e => setLogsUrl(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-500" data-testid="input-logs-url" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">Wallet Address <span className="text-slate-500 text-xs">Optional — enables Speed + Traceability tests</span></label>
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
                <span className="flex items-center gap-1.5"><Brain className="w-4 h-4 text-purple-400" />What does this project claim the agent can do?</span>
              </label>
              <Textarea placeholder="e.g. 'Autonomously trades memecoins 24/7, monitors wallets for rug pulls…'"
                value={claimedAbilities} onChange={e => setClaimedAbilities(e.target.value)} rows={3}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-500 resize-none" data-testid="textarea-claimed-abilities" />
              <p className="text-xs text-slate-500 mt-1">The scanner will look for on-chain proof of these specific actions. More detail = better verdict.</p>
            </div>

            {/* Evidence meter */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-2 font-medium">Evidence available for scan:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Speed Test", active: !!wallet.trim(), note: "wallet required" },
                  { label: "Traceability", active: !!wallet.trim() || !!socialLink.trim(), note: "wallet or social" },
                  { label: "Context", active: !!claimedAbilities.trim(), note: "claims required" },
                  { label: "Logs Check", active: !!logsUrl.trim(), note: "logs URL required" },
                  { label: "Social Check", active: !!socialLink.trim(), note: "social link required" },
                ].map(({ label, active, note }) => (
                  <div key={label} className={`text-xs rounded-full px-2.5 py-1 border flex items-center gap-1 ${active ? "bg-green-900/40 border-green-700/50 text-green-300" : "bg-slate-700/40 border-slate-600/40 text-slate-500"}`}>
                    {active ? <CheckCircle className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
                    {label}
                    {!active && <span className="opacity-60">({note})</span>}
                  </div>
                ))}
              </div>
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
              {isScanning ? <><Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />Analyzing Agent…</>
                : <><Bot style={{ width: 18, height: 18 }} />Run LARP Detection 🕵️</>}
            </button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div id="larp-result" className="space-y-5">
            {/* Score hero */}
            <Card className={`border-2 ${(verdictStyle as any).bg || "bg-slate-800/60 border-slate-600/50"}`}>
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex flex-col items-center gap-1 min-w-[130px]">
                    {result.cognitionScore !== null ? (
                      <>
                        <span className={`font-orbitron text-6xl font-black ${scoreColor(result.cognitionScore)}`} data-testid="text-cognition-score">
                          {result.cognitionScore}%
                        </span>
                        <span className="text-xs text-slate-400">Cognition Score</span>
                        <div className="w-24 bg-slate-700 rounded-full h-2.5 mt-1">
                          <div className={`h-2.5 rounded-full transition-all duration-1000 ${scoreColor(result.cognitionScore).replace("text-", "bg-").replace("400", "500")}`}
                            style={{ width: `${result.cognitionScore}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 mt-1">
                          {result.scoredTests}/{3} tests scored
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-orbitron text-4xl font-black text-slate-500" data-testid="text-cognition-score">—</span>
                        <span className="text-xs text-slate-500">No Score</span>
                      </>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      {(verdictStyle as any).icon}
                      <span className={`font-orbitron text-2xl font-black ${(verdictStyle as any).color}`} data-testid="text-verdict">
                        {result.verdict}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm">
                      Agent: <strong className="text-white">{result.agentName}</strong>
                    </p>
                    {isInconclusive && (
                      <div className="inline-flex items-center gap-1 bg-slate-800 border border-slate-600 rounded-full px-3 py-1 text-slate-400 text-xs font-bold">
                        <HelpCircle className="w-3 h-3" /> Provide a wallet, social link, or logs URL to receive a real verdict
                      </div>
                    )}
                    {result.verdict === "Digital Puppet" && (
                      <div className="inline-flex items-center gap-1 bg-red-900/60 border border-red-700 rounded-full px-3 py-1 text-red-300 text-xs font-bold">
                        <XCircle className="w-3 h-3" /> HIGH LARP RISK — Do Not Trust
                      </div>
                    )}
                    {result.verdict === "Semi-Autonomous" && (
                      <div className="inline-flex items-center gap-1 bg-yellow-900/60 border border-yellow-700 rounded-full px-3 py-1 text-yellow-300 text-xs font-bold">
                        <AlertTriangle className="w-3 h-3" /> Partial Automation — Verify Before Trusting
                      </div>
                    )}
                    {result.verdict === "Fully Autonomous" && (
                      <div className="inline-flex items-center gap-1 bg-green-900/60 border border-green-700 rounded-full px-3 py-1 text-green-300 text-xs font-bold">
                        <CheckCircle className="w-3 h-3" /> Autonomous Signature Detected
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Three scored tests */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TestCard icon={<Zap className="w-4 h-4" />} title="Speed Test" test={result.speedTest} />
              <TestCard icon={<Eye className="w-4 h-4" />} title="Traceability" test={result.traceabilityTest} />
              <TestCard icon={<Brain className="w-4 h-4" />} title="Context / Claims" test={result.contextTest} />
            </div>

            {/* Modifier tests */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LogsCard logs={result.logsTest} />
              <SocialCard social={result.socialTest} />
            </div>

            {/* APOL verdict */}
            <div className="bg-slate-900 border border-blue-600/30 rounded-xl p-5 flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-yellow-400 overflow-hidden">
                  <img src="/ape-police-logo.png" alt="Officer" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-yellow-400 text-xs font-bold mb-1">APOL OFFICER VERDICT</p>
                <p className="text-slate-200 text-sm leading-relaxed" data-testid="text-apol-verdict">{result.apolVerdict}</p>
                <button onClick={() => {
                  const scoreText = result.cognitionScore !== null ? `Cognition Score: ${result.cognitionScore}%` : "No verifiable data";
                  const text = `🦍 APE POLICE Agent-LARP Detection\n\nAgent: ${result.agentName}\n${scoreText}\nVerdict: ${result.verdict}\n\n${result.apolVerdict}\n\nScan any agent at apepolice.io #APOL #LARPDetector`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
                }} className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors" data-testid="button-tweet-verdict">
                  Tweet this verdict <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="text-center">
              <button onClick={() => { setResult(null); setAgentName(""); setSocialLink(""); setWallet(""); setClaimedAbilities(""); setLogsUrl(""); setScanError(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-slate-400 hover:text-white text-sm underline underline-offset-2 transition-colors" data-testid="button-scan-another">
                Scan another agent
              </button>
            </div>
          </div>
        )}

        {/* How it works */}
        {!result && (
          <Card className="bg-slate-900/60 border-slate-700/60">
            <CardHeader>
              <CardTitle className="text-slate-300 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-400" /> How the Cognition Score works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm font-semibold"><Zap className="w-4 h-4" />Speed Test (40 pts)</div>
                  <p className="text-xs text-slate-400 leading-relaxed">Real on-chain tx timestamps from Etherscan, Basescan, or Solana RPC. Agents operating 24/7 score higher. Business-hours-only = Human timing = LARP flag.</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold"><Eye className="w-4 h-4" />Traceability (30 pts)</div>
                  <p className="text-xs text-slate-400 leading-relaxed">GoPlus Security API: is the wallet a smart contract? Any known security flags? Cross-referenced with social presence.</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold"><Brain className="w-4 h-4" />Context / Claims (30 pts)</div>
                  <p className="text-xs text-slate-400 leading-relaxed">What does the project claim vs. what's on-chain? Trading bot with no swaps = LARP. Contract deployed for claimed on-chain actions = verified.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-700/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold"><FileText className="w-4 h-4" />Reasoning Check (modifier)</div>
                  <p className="text-xs text-slate-400 leading-relaxed">Fetches up to 3 entries from your logs URL and checks if their timestamps align with on-chain transactions (±5 min). Verified = +10pts. Mismatch = −12pts.</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-pink-400 text-sm font-semibold"><Twitter className="w-4 h-4" />Social Integrity (modifier)</div>
                  <p className="text-xs text-slate-400 leading-relaxed">Checks X follower count and estimates account age from the Twitter snowflake ID. New account + 10k+ followers = Sybil/Bot Suspected = −15pts.</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-4 border-t border-slate-800 pt-3">If a test cannot be run due to missing data, it shows "Inconclusive — Missing Evidence" and does not contribute to the score. The Patrol only deals in facts.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
