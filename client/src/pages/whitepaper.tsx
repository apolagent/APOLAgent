import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import katex from "katex";
import { ChevronLeft, ChevronRight, Minus, Plus, Download, Printer, RotateCw, Undo2, Redo2, Menu, Images, List } from "lucide-react";

const serif = "'Times New Roman', Georgia, serif";
const mono = "'JetBrains Mono', 'Courier New', monospace";
const sans = "'Segoe UI', 'Inter', -apple-system, sans-serif";
const ACCENT = "#00D1FF";
const TOTAL_PAGES = 5;

const tocItems = [
  { label: "I. Abstract", page: 1 },
  { label: "II. Forensic Heuristics", page: 2 },
  { label: "III. Mathematical Modeling", page: 3 },
  { label: "IV. Tokenomics", page: 4 },
  { label: "V. Security Verdict", page: 5 },
];

const thumbLabels = [
  "Title / Abstract",
  "Forensic Heuristics",
  "Mathematical Modeling",
  "Tokenomics",
  "Security Verdict",
];

function PageId({ num }: { num: number }) {
  return (
    <div style={{ textAlign: "right", marginBottom: 32, fontSize: 10, color: "#aaa", fontFamily: mono, letterSpacing: "0.08em" }}>
      APOL-SEC-0{num}
    </div>
  );
}

function KaTeX({ math }: { math: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) katex.render(math, ref.current, { displayMode: true, throwOnError: false });
  }, [math]);
  return <div ref={ref} style={{ margin: "28px 0", textAlign: "center" }} />;
}

const body: React.CSSProperties = {
  fontSize: 16, lineHeight: 1.6, color: "#222", textAlign: "justify", fontFamily: serif, margin: "0 0 18px",
};
const heading: React.CSSProperties = {
  fontSize: 22, fontWeight: 700, fontFamily: serif, color: "#000", margin: "0 0 20px", letterSpacing: "0.02em",
};
const subheading: React.CSSProperties = {
  fontSize: 17, fontWeight: 700, fontFamily: serif, color: "#111", margin: "28px 0 12px",
};
const defBox: React.CSSProperties = {
  background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "22px 26px", marginBottom: 22,
};
const defLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#555", fontFamily: mono, marginBottom: 10,
};
const hr = () => <hr style={{ border: 0, borderTop: "1px solid #ddd", margin: "0 0 24px" }} />;

function Page1() {
  return (
    <div id="page-1" className="wp-page" data-testid="whitepaper-page-1">
      <PageId num={1} />
      <div style={{ textAlign: "center", padding: "60px 0 40px" }}>
        <img src="/apol-agent-logo.png" alt="APOL Agent" style={{ width: 140, height: 140, margin: "0 auto 24px", display: "block" }} />
        <h1 style={{ fontSize: 44, fontWeight: 800, fontFamily: serif, color: "#000", margin: "0 0 12px", letterSpacing: "0.02em" }} data-testid="text-whitepaper-title">APOL AGENT</h1>
        <p style={{ fontSize: 18, fontFamily: serif, color: "#444", margin: "0 0 6px" }}>Autonomous Onchain Forensics</p>
        <p style={{ fontSize: 14, fontFamily: serif, color: "#888", fontStyle: "italic" }}>Forensic Intelligence Protocol for the Base Ecosystem</p>
      </div>
      <hr style={{ border: 0, borderTop: "1px solid #ddd", margin: "30px 0" }} />
      <h2 style={heading}>I. Abstract</h2>
      <p style={body}>
        APOL Agent is a decentralized forensic intelligence protocol engineered to operate as an autonomous watchdog
        within the Base blockchain ecosystem. The protocol addresses the systemic opacity in decentralized markets by
        providing real-time contract analysis, wallet provenance tracing, AI agent verification, and social forensics.
        Unlike conventional audit platforms that rely on manual review cycles, APOL Agent executes continuous, permissionless
        surveillance across on-chain and off-chain data layers, synthesizing results into actionable threat intelligence
        for retail participants.
      </p>
      <p style={body}>
        The core thesis is that market integrity is a public good. By automating forensic analysis, including contract
        honeypot detection, deployer wallet genealogy, liquidity lock verification, holder concentration mapping, and
        behavioral timing analysis, APOL Agent reduces information asymmetry between sophisticated actors and retail
        holders. The protocol is governed by the $APOL token, which serves as the access layer for premium forensic
        capabilities and the economic substrate for community-driven threat reporting.
      </p>
      <p style={body}>
        This paper presents the mathematical foundations, forensic framework, threat classification taxonomy,
        tokenomic architecture, and protocol design underlying the APOL Agent system. All models are deterministic
        and operate exclusively on publicly available on-chain data, requiring zero trust assumptions from end users.
      </p>
    </div>
  );
}

function Page2() {
  return (
    <div id="page-2" className="wp-page" data-testid="whitepaper-page-2">
      <PageId num={2} />
      <h2 style={heading}>II. Forensic Heuristics</h2>
      {hr()}
      <p style={body}>
        The APOL forensic engine applies a three-layer heuristic taxonomy to evaluate projects across on-chain,
        behavioral, and economic dimensions. Each layer operates independently, producing isolated risk signals
        that are then aggregated into a composite threat score.
      </p>
      <h3 style={subheading}>On-Chain Layer</h3>
      <p style={body}>
        This layer performs Wallet Cluster identification via transaction graph analysis, Shadow ID resolution
        to unmask connected deployer wallets, and Funding Trace to track capital provenance back to centralized
        exchanges, bridges, or mixers. The engine traces up to 10 levels of transaction depth to identify circular
        funding patterns indicative of wash trading or coordinated launch schemes.
      </p>
      <h3 style={subheading}>Behavioral Layer</h3>
      <p style={body}>
        The behavioral layer evaluates Narrative Alignment between public claims and on-chain evidence, Logic
        Auditing to verify autonomous reasoning patterns, and Agent Autonomy scoring through temporal execution
        analysis. A genuine AI agent should demonstrate consistent sub-second response patterns and round-the-clock
        activity that cannot be replicated by human operators.
      </p>
      <h3 style={subheading}>Economic Layer</h3>
      <p style={body}>
        The economic layer assesses the Liquidity Floor, the minimum locked capital preventing zero-liquidity exits,
        and the Whale Concentration Ratio, measuring the cumulative supply share held by the top non-contract holders.
        Projects with unlocked liquidity receive proportionally lower resilience scores, while high whale concentration
        signals structural fragility susceptible to coordinated exits.
      </p>
      <h3 style={subheading}>Threat Classification</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: 14, marginTop: 12 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Threat Vector</th>
            <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Severity</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Detection Method</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["Honeypot Contract", "CRITICAL", "Sell simulation + bytecode analysis"],
            ["Rug Pull (LP Drain)", "CRITICAL", "LP lock verification + holder analysis"],
            ["Hidden Mint Function", "HIGH", "Contract source + owner permissions"],
            ["Whale Concentration", "HIGH", "Top holder distribution mapping"],
            ["Agent LARP", "MEDIUM", "Cognition Score + timing analysis"],
            ["Elevated Tax", "MEDIUM", "Buy/sell tax simulation"],
          ] as const).map(([threat, severity, method], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 14px", color: "#111" }}>{threat}</td>
              <td style={{
                padding: "8px 14px", textAlign: "center", fontWeight: 700, fontSize: 11, fontFamily: mono,
                color: severity === "CRITICAL" ? "#c62828" : severity === "HIGH" ? "#d84315" : "#e65100",
              }}>{severity}</td>
              <td style={{ padding: "8px 14px", color: "#444" }}>{method}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: "#999", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: "14px 0 0" }}>Table 1: Threat vectors, severity tiers, and detection methodologies.</p>
    </div>
  );
}

function Page3() {
  return (
    <div id="page-3" className="wp-page" data-testid="whitepaper-page-3">
      <PageId num={3} />
      <h2 style={heading}>III. Mathematical Modeling</h2>
      {hr()}
      <p style={body}>
        The APOL forensic engine relies on deterministic mathematical models that produce repeatable scores from
        publicly available on-chain data. The following definitions formalize the core scoring functions used
        across all forensic analyses.
      </p>
      <div style={defBox}>
        <p style={defLabel}>Definition 1: Resilience Score (RS)</p>
        <KaTeX math="RS = \frac{L_{total}}{C_{whale} \times H_{rank}} \times 100" />
        <p style={{ ...body, fontSize: 14 }}>
          The Resilience Score quantifies the probability of a liquidity death-spiral based on holder concentration.
          A high RS indicates that locked liquidity sufficiently buffers against coordinated whale exits.
          A low RS signals structural fragility.
        </p>
        <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #eee", fontSize: 13, fontFamily: serif, color: "#555" }}>
          <strong>Variables:</strong> L<sub>total</sub> = total locked liquidity (USD),
          C<sub>whale</sub> = whale concentration ratio (0 &lt; WCR &le; 1),
          H<sub>rank</sub> = Gini-derived holder distribution rank.
        </div>
      </div>
      <div style={defBox}>
        <p style={defLabel}>Definition 2: Community Reward Function</p>
        <KaTeX math="Reward = R \times R_{circulation} \times M" />
        <p style={{ ...body, fontSize: 14 }}>
          Governs $APOL distribution for community forensic contributions, including scam reports, verified
          intelligence, and threat flagging. The multiplier M scales with contribution quality and verification status.
        </p>
        <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #eee", fontSize: 13, fontFamily: serif, color: "#555" }}>
          <strong>Variables:</strong> R = base reward rate,
          R<sub>circulation</sub> = circulating supply ratio,
          M = contribution multiplier (quality-weighted).
        </div>
      </div>
      <div style={defBox}>
        <p style={defLabel}>Definition 3: Cognition Score (CS)</p>
        <KaTeX math="CS = \frac{\sum_{i=1}^{n} w_i \cdot T_i}{\sum_{i=1}^{n} w_i} \times 100" />
        <p style={{ ...body, fontSize: 14 }}>
          Evaluates whether a purported AI agent exhibits genuine autonomous behavior.
          Scores of 71% or above indicate Fully Autonomous; 31 to 70% indicate Semi-Autonomous;
          30% or below indicates Digital Puppet.
        </p>
        <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid #eee", fontSize: 13, fontFamily: serif, color: "#555" }}>
          <strong>Variables:</strong> T<sub>i</sub> = individual test score per domain,
          w<sub>i</sub> = forensic significance weight,
          n = evaluation domains (currently 5).
        </div>
      </div>
    </div>
  );
}

function Page4() {
  return (
    <div id="page-4" className="wp-page" data-testid="whitepaper-page-4">
      <PageId num={4} />
      <h2 style={heading}>IV. Tokenomics</h2>
      {hr()}
      <p style={body}>
        The $APOL token employs a maximally fair distribution model with zero insider allocation. The entire supply
        enters public circulation at launch with no team reserves, no marketing tax, and no vesting schedules. This
        structure eliminates sell pressure from insider unlocks and aligns all stakeholders from genesis.
      </p>
      <p style={body}>
        The immutable 0/0 tax structure ensures that no value is extracted from trades. Liquidity is permanently locked
        or burned, verifiable on-chain, providing a non-revocable floor for market participants. The hard cap of
        1,000,000,000 tokens prevents inflationary dilution.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: 14, margin: "28px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Parameter</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["Total Supply", "1,000,000,000 (Hard Capped)"],
            ["Public Circulation", "100%"],
            ["Team Reserve", "0%"],
            ["Marketing Tax", "0%"],
            ["Buy / Sell Tax", "0% / 0% (Immutable)"],
            ["Liquidity", "Burned / Locked (On-chain verifiable)"],
            ["Network", "Base (Chain ID: 8453)"],
          ]).map(([param, value], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 14px", fontWeight: 600, color: "#111" }}>{param}</td>
              <td style={{ padding: "8px 14px", color: "#333" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={body}>
        The protocol operates across two complementary interfaces: a web-based forensic terminal and a Telegram bot,
        both powered by a shared backend intelligence engine. The architecture is designed for low-latency forensic
        output with minimal trust assumptions.
      </p>
      <p style={body}>
        All forensic analyses are executed server-side and cached for performance. No private keys or user wallet
        contents are ever accessed; the protocol operates exclusively on publicly available on-chain data. The
        Telegram bot runs as a persistent process in production, providing 24/7 forensic coverage.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 28 }}>
        <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "18px 20px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#333", fontFamily: mono, marginBottom: 10 }}>Core Analytic Engine</p>
          <ul style={{ fontSize: 14, lineHeight: 1.65, color: "#333", fontFamily: serif, paddingLeft: 18, margin: 0 }}>
            <li>Heuristic byte-code analysis for hidden developer backdoors.</li>
            <li style={{ marginTop: 6 }}>Multi-wallet sybil attack and pre-launch accumulation identification.</li>
            <li style={{ marginTop: 6 }}>Funding source tracing to centralized exchanges or mixers.</li>
          </ul>
        </div>
        <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "18px 20px" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#333", fontFamily: mono, marginBottom: 10 }}>Intelligence Output</p>
          <ul style={{ fontSize: 14, lineHeight: 1.65, color: "#333", fontFamily: serif, paddingLeft: 18, margin: 0 }}>
            <li>Real-time forensic signal generation for Telegram.</li>
            <li style={{ marginTop: 6 }}>High-fidelity reports for institutional-grade project audits.</li>
            <li style={{ marginTop: 6 }}>On-chain certification for projects with 90+ RS.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Page5() {
  return (
    <div id="page-5" className="wp-page" data-testid="whitepaper-page-5" style={{ marginBottom: 0 }}>
      <PageId num={5} />
      <h2 style={heading}>V. Security Verdict</h2>
      {hr()}
      <p style={body}>
        APOL Agent produces deterministic security verdicts by aggregating signals from all three forensic layers.
        Each project receives a composite score ranging from 0 to 100, with the following classification tiers:
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: 14, margin: "20px 0 28px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Score Range</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Classification</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["90 to 100", "VERIFIED SAFE", "Eligible for APOL Certification"],
            ["70 to 89", "LOW RISK", "Standard monitoring"],
            ["40 to 69", "ELEVATED RISK", "Enhanced surveillance recommended"],
            ["0 to 39", "CRITICAL THREAT", "Active threat advisory issued"],
          ]).map(([range, classification, action], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "8px 14px", color: "#111", fontWeight: 600, fontFamily: mono, fontSize: 13 }}>{range}</td>
              <td style={{ padding: "8px 14px", color: "#111", fontWeight: 600 }}>{classification}</td>
              <td style={{ padding: "8px 14px", color: "#444" }}>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={body}>
        Projects achieving a score of 90 or above are eligible for inclusion in the APOL Verified Registry, an
        on-chain certification that signals structural integrity to potential investors. The certification process
        requires payment in ETH and is non-reversible once issued.
      </p>
      <p style={body}>
        The forensic engine operates autonomously and continuously. All scoring is deterministic: the same on-chain
        state will always produce the same verdict, ensuring reproducibility and auditability. No manual override
        exists within the scoring pipeline.
      </p>
      <div style={{
        background: "#111",
        margin: "auto -90px -90px -90px",
        padding: "60px 90px",
        textAlign: "center",
      }}>
        <img src="/apol-agent-logo.png" alt="APOL Agent" style={{ width: 80, height: 80, margin: "0 auto 20px", display: "block" }} />
        <p style={{ fontSize: 20, fontWeight: 800, fontFamily: mono, color: "#fff", letterSpacing: "0.04em", margin: "0 0 10px" }}>
          APOL AGENT
        </p>
        <p style={{ fontSize: 14, fontFamily: serif, color: "#aaa", fontStyle: "italic", margin: "0 0 20px" }}>
          The Forensic Standard for Base.
        </p>
        <p style={{ fontSize: 9, fontFamily: mono, color: "#555", letterSpacing: "0.06em", lineHeight: 1.8, textTransform: "uppercase" }}>
          Autonomous Onchain Forensics Protocol // Base Network // {new Date().getFullYear()}<br />
          This document is for informational purposes only and does not constitute financial advice.
        </p>
      </div>
    </div>
  );
}

export default function Whitepaper() {
  const [currentPage, setCurrentPage] = useState(1);
  const [sidePanel, setSidePanel] = useState<"thumbs" | "outline">("thumbs");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToPage = useCallback((p: number) => {
    const el = document.getElementById(`page-${p}`);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTo({ top: el.offsetTop - scrollRef.current.offsetTop - 30, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const onScroll = () => {
      const ct = c.scrollTop + 100;
      for (let i = TOTAL_PAGES; i >= 1; i--) {
        const el = document.getElementById(`page-${i}`);
        if (el && el.offsetTop - c.offsetTop <= ct) { setCurrentPage(i); return; }
      }
      setCurrentPage(1);
    };
    c.addEventListener("scroll", onScroll, { passive: true });
    return () => c.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#525659", display: "flex", flexDirection: "column" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
      <style>{`
        .wp-page {
          width: 850px;
          min-height: 1200px;
          background: #ffffff;
          padding: 90px;
          margin: 0 auto 50px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.25);
          box-sizing: border-box;
          position: relative;
        }
        .wp-icon-btn { background: none; border: none; cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; color: #bbb; }
        .wp-icon-btn:hover { color: #fff; }
        .wp-tb-sep { width: 1px; height: 22px; background: #666; flex-shrink: 0; }
        .wp-sidebar-scroll::-webkit-scrollbar { width: 6px; }
        .wp-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .wp-sidebar-scroll::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
        .wp-main-scroll::-webkit-scrollbar { width: 10px; }
        .wp-main-scroll::-webkit-scrollbar-track { background: #3a3d40; }
        .wp-main-scroll::-webkit-scrollbar-thumb { background: #6b6e72; border-radius: 5px; }
        .wp-main-scroll::-webkit-scrollbar-thumb:hover { background: #888; }
        .wp-toc-link { transition: color 0.15s ease; }
        .wp-toc-link:hover { color: #00D1FF !important; }
      `}</style>

      <div style={{
        height: 36, flexShrink: 0,
        background: "#333", borderBottom: "1px solid #555",
        display: "flex", alignItems: "center", padding: "0 8px", gap: 6,
      }}>
        <Link href="/"><button className="wp-icon-btn" style={{ padding: 4 }} data-testid="link-back-home"><Menu style={{ width: 16, height: 16 }} /></button></Link>
        <div className="wp-tb-sep" />
        <button className="wp-icon-btn" onClick={() => scrollToPage(Math.max(1, currentPage - 1))} data-testid="button-page-prev"><ChevronLeft style={{ width: 16, height: 16 }} /></button>
        <span style={{ color: "#ddd", fontSize: 12, fontFamily: sans, minWidth: 44, textAlign: "center" }} data-testid="text-page-indicator">{currentPage} / {TOTAL_PAGES}</span>
        <button className="wp-icon-btn" onClick={() => scrollToPage(Math.min(TOTAL_PAGES, currentPage + 1))} data-testid="button-page-next"><ChevronRight style={{ width: 16, height: 16 }} /></button>
        <div className="wp-tb-sep" />
        <button className="wp-icon-btn"><Minus style={{ width: 14, height: 14 }} /></button>
        <div style={{ background: "#555", borderRadius: 2, padding: "2px 8px" }}>
          <span style={{ color: "#ddd", fontSize: 11, fontFamily: sans }}>100%</span>
        </div>
        <button className="wp-icon-btn"><Plus style={{ width: 14, height: 14 }} /></button>
        <div className="wp-tb-sep" />
        <button className="wp-icon-btn"><RotateCw style={{ width: 14, height: 14 }} /></button>
        <button className="wp-icon-btn"><Undo2 style={{ width: 14, height: 14 }} /></button>
        <button className="wp-icon-btn"><Redo2 style={{ width: 14, height: 14 }} /></button>
        <div style={{ flex: 1 }} />
        <button className="wp-icon-btn" onClick={() => window.print()} data-testid="button-download"><Download style={{ width: 16, height: 16 }} /></button>
        <button className="wp-icon-btn" onClick={() => window.print()} data-testid="button-print"><Printer style={{ width: 16, height: 16 }} /></button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{
          width: 200, minWidth: 200, background: "#404040", borderRight: "1px solid #4a4a4a",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ display: "flex", borderBottom: "1px solid #555", flexShrink: 0 }}>
            <button
              onClick={() => setSidePanel("thumbs")}
              data-testid="button-sidebar-thumbs"
              style={{
                flex: 1, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center",
                background: sidePanel === "thumbs" ? "#555" : "transparent",
                border: "none", borderBottom: sidePanel === "thumbs" ? `2px solid ${ACCENT}` : "2px solid transparent",
                cursor: "pointer", color: sidePanel === "thumbs" ? "#fff" : "#999", fontSize: 11, fontFamily: sans,
              }}
            ><Images style={{ width: 14, height: 14 }} /></button>
            <button
              onClick={() => setSidePanel("outline")}
              data-testid="button-sidebar-outline"
              style={{
                flex: 1, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center",
                background: sidePanel === "outline" ? "#555" : "transparent",
                border: "none", borderBottom: sidePanel === "outline" ? `2px solid ${ACCENT}` : "2px solid transparent",
                cursor: "pointer", color: sidePanel === "outline" ? "#fff" : "#999", fontSize: 11, fontFamily: sans,
              }}
            ><List style={{ width: 14, height: 14 }} /></button>
          </div>

          <div className="wp-sidebar-scroll" style={{ flex: 1, overflowY: "auto", padding: 10 }}>
            {sidePanel === "thumbs" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
                {Array.from({ length: TOTAL_PAGES }, (_, i) => {
                  const active = currentPage === i + 1;
                  const thumbW = 140;
                  const thumbH = Math.round(thumbW * (1200 / 850));
                  return (
                    <div key={i} style={{ cursor: "pointer", textAlign: "center" }} onClick={() => scrollToPage(i + 1)} data-testid={`button-thumb-page-${i + 1}`}>
                      <div style={{
                        width: thumbW, height: thumbH, background: "#fff",
                        border: active ? `3px solid ${ACCENT}` : "1px solid #666",
                        boxShadow: active ? `0 0 0 1px ${ACCENT}50, 0 2px 8px rgba(0,0,0,0.3)` : "0 1px 4px rgba(0,0,0,0.3)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                        gap: 2, padding: "8px 6px", boxSizing: "border-box", overflow: "hidden",
                      }}>
                        <div style={{ alignSelf: "flex-end", fontSize: 4, color: "#bbb", fontFamily: sans, marginBottom: 4 }}>
                          APOL-SEC-0{i + 1}
                        </div>
                        <div style={{ fontSize: 5, fontWeight: 700, color: "#000", fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {thumbLabels[i]}
                        </div>
                        <div style={{ width: "60%", height: 1, background: "#e0e0e0", margin: "3px 0" }} />
                        {i === 0 && <img src="/apol-agent-logo.png" alt="" style={{ width: 18, height: 18, marginTop: 4 }} />}
                        {[1, 2, 3].map(j => <div key={j} style={{ width: "70%", height: 3, background: "#f0f0f0", marginTop: 2 }} />)}
                      </div>
                      <div style={{ fontSize: 10, color: active ? "#fff" : "#aaa", fontFamily: sans, marginTop: 4 }}>{i + 1}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "4px 0" }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", fontFamily: sans, padding: "4px 8px 10px", margin: 0 }}>Document Outline</p>
                {tocItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToPage(item.page)}
                    data-testid={`button-toc-${i}`}
                    className="wp-toc-link"
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      background: "transparent", border: "none",
                      padding: "5px 10px",
                      fontSize: 13, fontFamily: sans, fontWeight: 400,
                      color: currentPage === item.page ? "#fff" : "#ccc",
                      cursor: "pointer", lineHeight: 1.8,
                    }}
                  >{item.label}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="wp-main-scroll"
          style={{
            flex: 1, overflowY: "auto", overflowX: "auto",
            background: "#525659", padding: "40px 0",
          }}
        >
          <Page1 />
          <Page2 />
          <Page3 />
          <Page4 />
          <Page5 />
        </div>
      </div>
    </div>
  );
}
