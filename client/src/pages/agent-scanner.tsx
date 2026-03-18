import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Bot, Zap, Eye, Brain, Clock, AlertTriangle, CheckCircle, XCircle, Loader2, ChevronRight, Shield, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AgentResult = {
  agentName: string;
  socialLink?: string;
  wallet?: string;
  claimedAbilities?: string;
  cognitionScore: number;
  verdict: "Digital Puppet" | "Semi-Autonomous" | "Fully Autonomous";
  apolVerdict: string;
  speedTest: { score: number; maxScore: number; label: string; detail: string; timingPattern: string[] };
  traceabilityTest: { score: number; maxScore: number; label: string; detail: string; isContract: boolean; txTotal: number };
  contextTest: { score: number; maxScore: number; label: string; detail: string };
};

function ScoreBar({ score, max, color }: { score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function TestCard({
  icon,
  title,
  label,
  score,
  maxScore,
  detail,
  timingPattern,
  barColor,
}: {
  icon: React.ReactNode;
  title: string;
  label: string;
  score: number;
  maxScore: number;
  detail: string;
  timingPattern?: string[];
  barColor: string;
}) {
  const pct = Math.round((score / maxScore) * 100);
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-300 text-sm font-semibold">
          {icon}
          {title}
        </div>
        <span className="text-xs text-slate-400">{score}/{maxScore} pts</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-yellow-300 bg-yellow-900/40 border border-yellow-700/40 rounded-full px-2 py-0.5">{label}</span>
        <span className="text-xs text-slate-400">{pct}%</span>
      </div>
      <ScoreBar score={score} max={maxScore} color={barColor} />
      <p className="text-xs text-slate-300 leading-relaxed">{detail}</p>
      {timingPattern && timingPattern.length > 0 && (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-slate-500 font-medium">Last transactions:</p>
          {timingPattern.map((t, i) => (
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

export default function AgentScanner() {
  const [agentName, setAgentName] = useState("");
  const [socialLink, setSocialLink] = useState("");
  const [wallet, setWallet] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [claimedAbilities, setClaimedAbilities] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = async () => {
    if (!agentName.trim()) { setScanError("Agent name is required."); return; }
    setIsScanning(true);
    setScanError(null);
    setResult(null);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      setTimeout(() => {
        document.getElementById("larp-result")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e: any) {
      setScanError(e.message || "Scan failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const verdictColor = (v: string) =>
    v === "Fully Autonomous" ? "text-green-400" : v === "Semi-Autonomous" ? "text-yellow-400" : "text-red-400";
  const verdictBg = (v: string) =>
    v === "Fully Autonomous" ? "bg-green-900/40 border-green-600/50" : v === "Semi-Autonomous" ? "bg-yellow-900/40 border-yellow-600/50" : "bg-red-900/40 border-red-600/50";
  const verdictIcon = (v: string) =>
    v === "Fully Autonomous" ? <CheckCircle className="w-6 h-6 text-green-400" /> : v === "Semi-Autonomous" ? <AlertTriangle className="w-6 h-6 text-yellow-400" /> : <XCircle className="w-6 h-6 text-red-400" />;
  const scoreColor = (s: number) =>
    s >= 71 ? "text-green-400" : s >= 31 ? "text-yellow-400" : "text-red-400";
  const scoreBarColor = (s: number) =>
    s >= 71 ? "bg-green-500" : s >= 31 ? "bg-yellow-400" : "bg-red-500";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-blue-500/20 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/">
            <button
              className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
              data-testid="link-back-home"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center overflow-hidden">
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
            <Bot className="w-4 h-4" />
            Scan Agent Utility
          </div>
          <h1 className="font-meme text-4xl md:text-5xl gradient-text">Agent-LARP Detector</h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            Is that "AI Agent" actually autonomous — or just a human clicking buttons?
            Submit the agent's details and receive a <strong className="text-white">Cognition Score</strong> from the APE POLICE.
          </p>
          <div className="flex justify-center gap-4 text-xs text-slate-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> 0–30% Digital Puppet</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 31–70% Semi-Autonomous</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> 71–100% Fully Autonomous</span>
          </div>
        </div>

        {/* Form */}
        <Card className="bg-slate-900/80 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" />
              Run LARP Detection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Agent Name */}
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block font-medium">
                Agent Name <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="e.g. TruthAgent, AutoTrader99, DegenBot…"
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-500"
                data-testid="input-agent-name"
              />
            </div>

            {/* Social Link */}
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block font-medium">
                Social Link (X / Telegram) <span className="text-slate-500">Optional</span>
              </label>
              <Input
                placeholder="https://x.com/AgentHandle or t.me/AgentChannel"
                value={socialLink}
                onChange={e => setSocialLink(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-500"
                data-testid="input-social-link"
              />
            </div>

            {/* Wallet + Chain row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">
                  Agent Wallet Address <span className="text-slate-500">Optional</span>
                </label>
                <Input
                  placeholder="0x… or contract address"
                  value={wallet}
                  onChange={e => setWallet(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder-slate-500 font-mono text-sm"
                  data-testid="input-agent-wallet"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block font-medium">Chain</label>
                <Select value={chain} onValueChange={setChain}>
                  <SelectTrigger
                    className="bg-slate-800 border-slate-600 text-white"
                    data-testid="select-agent-chain"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600 text-white">
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="bsc">BNB Chain</SelectItem>
                    <SelectItem value="polygon">Polygon</SelectItem>
                    <SelectItem value="arbitrum">Arbitrum</SelectItem>
                    <SelectItem value="base">Base</SelectItem>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Claimed Abilities */}
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block font-medium">
                <span className="flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-purple-400" />
                  What does this project claim the agent can do?
                </span>
              </label>
              <Textarea
                placeholder="e.g. 'Autonomously trades memecoins 24/7, monitors wallets for rug pulls, posts on-chain reports to X every hour…'"
                value={claimedAbilities}
                onChange={e => setClaimedAbilities(e.target.value)}
                rows={3}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-500 resize-none"
                data-testid="textarea-claimed-abilities"
              />
              <p className="text-xs text-slate-500 mt-1">
                The scanner will look for on-chain proof of these specific actions.
              </p>
            </div>

            {scanError && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2" data-testid="text-scan-error">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {scanError}
              </div>
            )}

            <button
              onClick={handleScan}
              disabled={isScanning}
              style={{
                background: isScanning ? "#1e3a5f" : "linear-gradient(135deg, #1d4ed8, #7c3aed)",
                color: "white",
                fontWeight: "bold",
                padding: "12px 28px",
                borderRadius: "10px",
                border: "none",
                cursor: isScanning ? "not-allowed" : "pointer",
                fontSize: "15px",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                opacity: isScanning ? 0.7 : 1,
              }}
              data-testid="button-run-scan"
            >
              {isScanning ? (
                <>
                  <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                  Analyzing Agent…
                </>
              ) : (
                <>
                  <Bot style={{ width: 18, height: 18 }} />
                  Run LARP Detection 🕵️
                </>
              )}
            </button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div id="larp-result" className="space-y-6 animate-fade-in">
            {/* Score hero card */}
            <Card className={`border-2 ${verdictBg(result.verdict)}`}>
              <CardContent className="pt-6 pb-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Big score */}
                  <div className="flex flex-col items-center gap-1 min-w-[120px]">
                    <span className={`font-orbitron text-6xl font-black ${scoreColor(result.cognitionScore)}`} data-testid="text-cognition-score">
                      {result.cognitionScore}%
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Cognition Score</span>
                    <div className="w-24 bg-slate-700 rounded-full h-2.5 mt-1">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-1000 ${scoreBarColor(result.cognitionScore)}`}
                        style={{ width: `${result.cognitionScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Verdict + name */}
                  <div className="flex-1 space-y-2 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      {verdictIcon(result.verdict)}
                      <span className={`font-orbitron text-2xl font-black ${verdictColor(result.verdict)}`} data-testid="text-verdict">
                        {result.verdict}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm">
                      Agent: <strong className="text-white">{result.agentName}</strong>
                      {result.wallet && (
                        <span className="ml-2 text-slate-500 font-mono text-xs">
                          {result.wallet.slice(0, 10)}…
                        </span>
                      )}
                    </p>
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

            {/* Three test breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TestCard
                icon={<Zap className="w-4 h-4" />}
                title="Speed Test"
                label={result.speedTest.label}
                score={result.speedTest.score}
                maxScore={result.speedTest.maxScore}
                detail={result.speedTest.detail}
                timingPattern={result.speedTest.timingPattern}
                barColor={result.speedTest.score >= 25 ? "bg-green-500" : result.speedTest.score >= 12 ? "bg-yellow-400" : "bg-red-500"}
              />
              <TestCard
                icon={<Eye className="w-4 h-4" />}
                title="Traceability"
                label={result.traceabilityTest.label}
                score={result.traceabilityTest.score}
                maxScore={result.traceabilityTest.maxScore}
                detail={result.traceabilityTest.detail}
                barColor={result.traceabilityTest.score >= 20 ? "bg-green-500" : result.traceabilityTest.score >= 10 ? "bg-yellow-400" : "bg-red-500"}
              />
              <TestCard
                icon={<Brain className="w-4 h-4" />}
                title="Context / Claims"
                label={result.contextTest.label}
                score={result.contextTest.score}
                maxScore={result.contextTest.maxScore}
                detail={result.contextTest.detail}
                barColor={result.contextTest.score >= 20 ? "bg-green-500" : result.contextTest.score >= 10 ? "bg-yellow-400" : "bg-red-500"}
              />
            </div>

            {/* APOL Officer verdict */}
            <div className="bg-slate-900 border border-blue-600/30 rounded-xl p-5 flex gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-yellow-400 overflow-hidden flex items-center justify-center">
                  <img src="/ape-police-logo.png" alt="Officer" className="w-full h-full object-cover" />
                </div>
              </div>
              <div>
                <p className="text-yellow-400 text-xs font-bold mb-1">APOL OFFICER VERDICT</p>
                <p className="text-slate-200 text-sm leading-relaxed" data-testid="text-apol-verdict">
                  {result.apolVerdict}
                </p>
                <button
                  onClick={() => {
                    const text = `🦍 APE POLICE Agent-LARP Detection\n\nAgent: ${result.agentName}\nCognition Score: ${result.cognitionScore}%\nVerdict: ${result.verdict}\n\n${result.apolVerdict}\n\nScan any agent at apepolice.io #APOL #LARPDetector`;
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
                  }}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  data-testid="button-tweet-verdict"
                >
                  Tweet this verdict <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Scan another */}
            <div className="text-center">
              <button
                onClick={() => { setResult(null); setAgentName(""); setSocialLink(""); setWallet(""); setClaimedAbilities(""); setScanError(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-slate-400 hover:text-white text-sm underline underline-offset-2 transition-colors"
                data-testid="button-scan-another"
              >
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
                <Shield className="w-4 h-4 text-blue-400" />
                How the Cognition Score works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm font-semibold">
                    <Zap className="w-4 h-4" /> Speed Test (40 pts)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Analyzes on-chain transaction timing. Agents operating 24/7 with random intervals score higher. Business-hours-only = Human-like = LARP flag.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold">
                    <Eye className="w-4 h-4" /> Traceability (30 pts)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Checks if the agent has a verifiable on-chain footprint. Real agents deploy contracts, maintain wallets, and post public activity logs.
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold">
                    <Brain className="w-4 h-4" /> Context / Claims (30 pts)
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Compares what the project claims the agent can do against what's actually verifiable on-chain. Unverifiable claims = LARP risk.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
