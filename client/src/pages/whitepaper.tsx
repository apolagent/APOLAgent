import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Images, List, Download, Printer, ChevronLeft, ChevronRight, Minus, Plus, RotateCw, Undo2, Redo2, Menu } from "lucide-react";
import katex from "katex";
import mermaid from "mermaid";
import { Chart, ArcElement, Tooltip, Legend, PieController } from "chart.js";

Chart.register(ArcElement, Tooltip, Legend, PieController);

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    primaryColor: "#e0f7ff",
    primaryBorderColor: "#00D1FF",
    primaryTextColor: "#111",
    lineColor: "#00D1FF",
    secondaryColor: "#f0faff",
    tertiaryColor: "#fff",
    fontFamily: "'Times New Roman', serif",
    fontSize: "13px",
  },
});

const ACCENT = "#00D1FF";
const serif = "'Times New Roman', 'Computer Modern', Georgia, serif";
const mono = "'JetBrains Mono', 'Courier New', monospace";
const sans = "'Segoe UI', 'Inter', -apple-system, sans-serif";

function PageLabel({ num }: { num: number }) {
  const code = `APOL-SEC-P${String(num).padStart(2, "0")}`;
  return (
    <div style={{ textAlign: "right", marginBottom: "28px" }}>
      <span style={{ fontSize: "10px", color: "#bbb", fontFamily: sans, letterSpacing: "0.06em" }}>
        {code}
      </span>
    </div>
  );
}

function SectionRule() {
  return <hr style={{ border: "0", borderTop: "1px solid #e0e0e0", margin: "20px 0" }} />;
}

function KaTeX({ math }: { math: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) katex.render(math, ref.current, { displayMode: true, throwOnError: false });
  }, [math]);
  return <div ref={ref} style={{ margin: "18px 0", textAlign: "center" }} />;
}

function MermaidChart({ id, definition }: { id: string; definition: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    mermaid.render(id, definition).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [id, definition]);
  return <div ref={ref} style={{ display: "flex", justifyContent: "center", margin: "20px 0" }} />;
}

function TokenomicsChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "pie",
      data: {
        labels: ["Public Circulation (100%)"],
        datasets: [{ data: [100], backgroundColor: ["#0097b2"], borderColor: "#fff", borderWidth: 2 }],
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { position: "bottom", labels: { color: "#333", font: { family: serif, size: 11 }, padding: 10 } } },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, []);
  return <div style={{ maxWidth: 220, margin: "14px auto" }}><canvas ref={canvasRef} data-testid="chart-tokenomics" /></div>;
}

const hierarchyDef = `graph TD
    CORE["APOL CORE"] --> OC["On-Chain Layer"]
    CORE --> BL["Behavioral Layer"]
    CORE --> EL["Economic Layer"]
    OC --> OC1["Wallet Clusters"]
    OC --> OC2["Shadow ID"]
    OC --> OC3["Funding Trace"]
    BL --> BL1["Narrative Alignment"]
    BL --> BL2["Logic Auditing"]
    BL --> BL3["Agent Autonomy"]
    EL --> EL1["Liquidity Floor"]
    EL --> EL2["Whale Concentration"]`;

const forensicDef = `graph TD
    A["APOL Forensic Engine"] --> B["Wallet Analytics"]
    A --> C["Behavioral Logic"]
    A --> D["Economic Resilience"]
    B --> B1["Transaction Tracing"]
    B --> B2["Funding Source ID"]
    B --> B3["Whale Detection"]
    C --> C1["Timing Analysis"]
    C --> C2["Bot vs Human"]
    C --> C3["LARP Detection"]
    D --> D1["LP Lock Verification"]
    D --> D2["Tax Analysis"]
    D --> D3["Holder Distribution"]`;

const TOTAL_PAGES = 7;

const tocItems = [
  { page: 1, label: "I. Abstract", indent: 0 },
  { page: 2, label: "II. Hierarchical Evaluation Framework", indent: 0 },
  { page: 3, label: "III. Mathematical Foundations", indent: 0 },
  { page: 3, label: "Definition 1: Resilience Score", indent: 1 },
  { page: 3, label: "Definition 2: Reward Function", indent: 1 },
  { page: 3, label: "Definition 3: Cognition Score", indent: 1 },
  { page: 4, label: "IV. Forensic Framework", indent: 0 },
  { page: 5, label: "V. Threat Classification Matrix", indent: 0 },
  { page: 6, label: "VI. Tokenomics", indent: 0 },
  { page: 7, label: "VII. Protocol Architecture", indent: 0 },
];

const b: React.CSSProperties = { fontSize: "13px", lineHeight: 1.8, color: "#222", textAlign: "justify", fontFamily: serif, margin: "0 0 14px", textIndent: "20px" };
const sH: React.CSSProperties = { fontSize: "14px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.08em", color: "#000", margin: "0 0 6px", textAlign: "center" };
const fC: React.CSSProperties = { fontSize: "11px", color: "#666", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: "6px 0 24px" };
const dB: React.CSSProperties = { background: "#f9f9f9", border: "1px solid #e0e0e0", padding: "20px 24px", marginBottom: "18px" };
const dL: React.CSSProperties = { fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#555", fontFamily: mono, marginBottom: "8px" };
const dP: React.CSSProperties = { fontSize: "12px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 8px", textIndent: "20px" };
const vB: React.CSSProperties = { padding: "10px 14px", background: "#fff", border: "1px solid #eee", fontSize: "11px", fontFamily: serif, color: "#555", marginTop: "12px" };

function Page1() {
  return (
    <div id="page-1" className="wp-page">
      <PageLabel num={1} />
      <div style={{ textAlign: "center", padding: "40px 0 30px" }}>
        <img src="/apol-agent-logo.png" alt="APOL Agent" style={{ width: 160, height: 160, margin: "0 auto 20px", display: "block" }} />
        <h1 style={{ fontSize: "48px", fontWeight: 800, fontFamily: serif, color: "#000", margin: "0", letterSpacing: "0.03em", lineHeight: 1.1 }} data-testid="text-whitepaper-title">APOL AGENT</h1>
      </div>
      <div style={{ textAlign: "center", margin: "0 0 8px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 400, fontFamily: serif, color: "#111", lineHeight: 1.5, margin: 0 }}>
          Autonomous Onchain Forensics<br />and AI-Driven Threat Intelligence
        </h2>
      </div>
      <div style={{ textAlign: "center", margin: "24px 0 36px" }}>
        <p style={{ fontSize: "13px", fontFamily: serif, color: "#333", margin: "0 0 2px", fontWeight: 600 }}>APOL Labs</p>
        <p style={{ fontSize: "12px", fontFamily: serif, color: "#666", margin: 0, fontStyle: "italic" }}>contact@apepolice.online</p>
      </div>
      <SectionRule />
      <h3 style={{ ...sH, fontSize: "13px", marginBottom: "14px" }}>I. Abstract</h3>
      <div style={{ columns: 2, columnGap: "30px" }}>
        <p style={b}>
          APOL Agent is a decentralized forensic intelligence protocol engineered to operate as an autonomous watchdog
          within the Base blockchain ecosystem. The protocol addresses the systemic opacity in decentralized markets by
          providing real-time contract analysis, wallet provenance tracing, AI agent verification, and social forensics.
          Unlike conventional audit platforms that rely on manual review cycles, APOL Agent executes continuous, permissionless
          surveillance across on-chain and off-chain data layers, synthesizing results into actionable threat intelligence
          for retail participants.
        </p>
        <p style={b}>
          The core thesis is that market integrity is a public good. By automating forensic analysis, including contract honeypot detection,
          deployer wallet genealogy, liquidity lock verification, holder concentration mapping, and behavioral timing analysis,
          APOL Agent reduces information asymmetry between sophisticated actors and retail holders. The protocol is governed by
          the $APOL token, which serves as the access layer for premium forensic capabilities and the economic substrate for
          community-driven threat reporting.
        </p>
        <p style={b}>
          This paper presents the mathematical foundations, forensic framework, threat classification taxonomy,
          tokenomic architecture, and protocol design underlying the APOL Agent system. All models are deterministic
          and operate exclusively on publicly available on-chain data, requiring zero trust assumptions from end users.
        </p>
      </div>
    </div>
  );
}

function Page2() {
  return (
    <div id="page-2" className="wp-page">
      <PageLabel num={2} />
      <h3 style={sH}>II. Hierarchical Evaluation Framework</h3>
      <SectionRule />
      <MermaidChart id="fig1-hierarchy" definition={hierarchyDef} />
      <p style={fC}>Fig. 1: Hierarchical Evaluation Framework. Three-layer forensic taxonomy.</p>
      <div style={{ columns: 2, columnGap: "30px" }}>
        <p style={b}>
          The <strong>On-Chain Layer</strong> performs Wallet Cluster identification via transaction graph analysis, Shadow ID resolution to unmask connected deployer wallets, and Funding Trace to track capital provenance back to centralized exchanges, bridges, or mixers.
        </p>
        <p style={b}>
          The <strong>Behavioral Layer</strong> evaluates Narrative Alignment between public claims and on-chain evidence, Logic Auditing to verify autonomous reasoning patterns, and Agent Autonomy scoring through temporal execution analysis and round-the-clock activity verification.
        </p>
        <p style={b}>
          The <strong>Economic Layer</strong> assesses the Liquidity Floor (L<sub>f</sub>), the minimum locked capital preventing zero-liquidity exits, and the Whale Concentration Ratio (WCR), measuring the cumulative supply share held by the top non-contract holders.
        </p>
      </div>
    </div>
  );
}

function Page3() {
  return (
    <div id="page-3" className="wp-page">
      <PageLabel num={3} />
      <h3 style={sH}>III. Mathematical Foundations</h3>
      <SectionRule />
      <div style={dB}>
        <p style={dL}>Definition 1: Resilience Score (RS)</p>
        <KaTeX math="RS = \\frac{L_{total}}{C_{whale} \\times H_{rank}} \\times 100" />
        <p style={dP}>The Resilience Score quantifies the probability of a liquidity death-spiral based on holder concentration. A high RS indicates that locked liquidity sufficiently buffers against coordinated whale exits. A low RS signals structural fragility.</p>
        <div style={vB}><strong>Variables:</strong> <em>L<sub>total</sub></em> = total locked liquidity (USD) · <em>C<sub>whale</sub></em> = whale concentration ratio (0 &lt; WCR ≤ 1) · <em>H<sub>rank</sub></em> = Gini-derived holder distribution rank.</div>
      </div>
      <div style={dB}>
        <p style={dL}>Definition 2: Community Reward Function</p>
        <KaTeX math="Reward = R \\times R_{circulation} \\times M" />
        <p style={dP}>Governs $APOL distribution for community forensic contributions, including scam reports, verified intelligence, and threat flagging. The multiplier M scales with contribution quality and verification status.</p>
        <div style={vB}><strong>Variables:</strong> <em>R</em> = base reward rate · <em>R<sub>circulation</sub></em> = circulating supply ratio · <em>M</em> = contribution multiplier (quality-weighted).</div>
      </div>
      <div style={{ ...dB, marginBottom: 0 }}>
        <p style={dL}>Definition 3: Cognition Score (CS)</p>
        <KaTeX math="CS = \\frac{\\sum_{i=1}^{n} w_i \\cdot T_i}{\\sum_{i=1}^{n} w_i} \\times 100" />
        <p style={dP}>Evaluates whether a purported AI agent exhibits genuine autonomous behavior. Scores of 71% or above indicate "Fully Autonomous"; 31 to 70% indicate "Semi-Autonomous"; 30% or below indicates "Digital Puppet."</p>
        <div style={vB}><strong>Variables:</strong> <em>T<sub>i</sub></em> = individual test score per domain · <em>w<sub>i</sub></em> = forensic significance weight · <em>n</em> = evaluation domains (currently 5).</div>
      </div>
    </div>
  );
}

function Page4() {
  return (
    <div id="page-4" className="wp-page">
      <PageLabel num={4} />
      <h3 style={sH}>IV. Forensic Framework</h3>
      <SectionRule />
      <p style={{ fontSize: "11px", color: "#888", textAlign: "center", fontFamily: serif, marginBottom: "8px" }}>Analytical domain decomposition and sub-module taxonomy</p>
      <MermaidChart id="fig2-forensic" definition={forensicDef} />
      <p style={fC}>Fig. 2: APOL Forensic Engine. Complete module hierarchy.</p>
      <div style={{ columns: 2, columnGap: "30px" }}>
        <p style={b}>
          <strong>Wallet Analytics</strong> encompasses transaction tracing through Base chain history, identification of funding sources via genesis transaction analysis, and whale concentration detection through holder distribution mapping. The engine traces up to 10 levels of transaction depth to identify circular funding patterns.
        </p>
        <p style={b}>
          <strong>Behavioral Logic</strong> evaluates temporal execution patterns to distinguish autonomous AI agents from human-operated wallets, applying timing spread analysis and round-the-clock activity verification. A genuine AI agent should demonstrate consistent sub-second response patterns.
        </p>
        <p style={b}>
          <strong>Economic Resilience</strong> assesses structural integrity through liquidity lock verification, buy/sell tax analysis, and holder rank distribution to quantify rug-pull risk vectors. Projects with unlocked liquidity receive proportionally lower resilience scores.
        </p>
      </div>
    </div>
  );
}

function Page5() {
  return (
    <div id="page-5" className="wp-page">
      <PageLabel num={5} />
      <h3 style={sH}>V. Threat Classification Matrix</h3>
      <SectionRule />
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: "12px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Threat Vector</th>
            <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Severity</th>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Detection Method</th>
            <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Rev.</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["Honeypot Contract", "CRITICAL", "Sell simulation + bytecode analysis", "No"],
            ["Rug Pull (LP Drain)", "CRITICAL", "LP lock verification + holder analysis", "No"],
            ["Hidden Mint Function", "HIGH", "Contract source + owner permissions", "No"],
            ["Whale Concentration", "HIGH", "Top holder distribution mapping", "Partial"],
            ["Agent LARP", "MEDIUM", "Cognition Score + timing analysis", "N/A"],
            ["Elevated Tax", "MEDIUM", "Buy/sell tax simulation", "Yes"],
            ["Social Impersonation", "LOW", "Account age + engagement forensics", "Yes"],
          ] as const).map(([threat, severity, method, rev], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "7px 12px", color: "#111", fontWeight: 500 }}>{threat}</td>
              <td style={{ padding: "7px 12px", textAlign: "center", fontWeight: 700, fontSize: "10px", fontFamily: mono, color: severity === "CRITICAL" ? "#c62828" : severity === "HIGH" ? "#d84315" : severity === "MEDIUM" ? "#e65100" : "#0097b2" }}>{severity}</td>
              <td style={{ padding: "7px 12px", color: "#444" }}>{method}</td>
              <td style={{ padding: "7px 12px", textAlign: "center", fontWeight: 600, color: rev === "No" ? "#c62828" : "#444" }}>{rev}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: "10px", color: "#888", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: "12px 0 0" }}>Table 1: Severity tiers, detection methodologies, and reversibility assessment.</p>
    </div>
  );
}

function Page6() {
  return (
    <div id="page-6" className="wp-page">
      <PageLabel num={6} />
      <h3 style={sH}>VI. Tokenomics</h3>
      <SectionRule />
      <div style={{ display: "flex", gap: "30px", marginBottom: "24px" }}>
        <div style={{ flex: 1 }}>
          <p style={b}>
            The $APOL token employs a maximally fair distribution model with zero insider allocation. The entire supply enters public circulation at launch with no team reserves, no marketing tax, and no vesting schedules. This structure eliminates sell pressure from insider unlocks and aligns all stakeholders from genesis.
          </p>
          <p style={b}>
            The immutable 0/0 tax structure ensures that no value is extracted from trades. Liquidity is permanently locked or burned, verifiable on-chain, providing a non-revocable floor for market participants. The hard cap of 1,000,000,000 tokens prevents inflationary dilution.
          </p>
        </div>
        <div style={{ width: 200, flexShrink: 0 }}>
          <TokenomicsChart />
          <p style={{ fontSize: "9px", color: "#999", textAlign: "center", fontStyle: "italic", fontFamily: serif }}>Fig. 3: Distribution</p>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: "12px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Parameter</th>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {[["Total Supply", "1,000,000,000 (Hard Capped)"], ["Public Circulation", "100%"], ["Team Reserve", "0%"], ["Marketing Tax", "0%"], ["Buy / Sell Tax", "0% / 0% (Immutable)"], ["Liquidity", "Burned / Locked (On-chain verifiable)"], ["Network", "Base (Chain ID: 8453)"]].map(([p, v], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "6px 12px", fontWeight: 600, color: "#111" }}>{p}</td>
              <td style={{ padding: "6px 12px", color: "#333" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Page7() {
  return (
    <div id="page-7" className="wp-page">
      <PageLabel num={7} />
      <h3 style={sH}>VII. Protocol Architecture</h3>
      <SectionRule />
      <div style={{ columns: 2, columnGap: "30px", marginBottom: "24px" }}>
        <p style={b}>
          The APOL protocol operates across two complementary interfaces, a web-based forensic terminal and a Telegram bot, both powered by a shared backend intelligence engine. The architecture is designed for low-latency forensic output with minimal trust assumptions.
        </p>
        <p style={b}>
          All forensic analyses are executed server-side and cached for performance. No private keys or user wallet contents are ever accessed; the protocol operates exclusively on publicly available on-chain data. The Telegram bot runs as a persistent process in production.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "36px" }}>
        <div style={{ background: "#f9f9f9", border: "1px solid #e0e0e0", padding: "14px 16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#333", fontFamily: mono, marginBottom: "8px" }}>Core Analytic Engine</p>
          <ul style={{ fontSize: "11.5px", lineHeight: 1.65, color: "#333", fontFamily: serif, paddingLeft: "16px", margin: 0 }}>
            <li><strong>Heuristic Logic Layer:</strong> Proprietary byte-code analysis to detect hidden developer backdoors.</li>
            <li style={{ marginTop: 4 }}><strong>Cluster Fingerprinting:</strong> Multi-wallet sybil attack and pre-launch accumulation identification.</li>
            <li style={{ marginTop: 4 }}><strong>Cross-Chain Provenance:</strong> Funding source tracing to centralized exchanges or mixers.</li>
          </ul>
        </div>
        <div style={{ background: "#f9f9f9", border: "1px solid #e0e0e0", padding: "14px 16px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#333", fontFamily: mono, marginBottom: "8px" }}>Intelligence Output</p>
          <ul style={{ fontSize: "11.5px", lineHeight: 1.65, color: "#333", fontFamily: serif, paddingLeft: "16px", margin: 0 }}>
            <li><strong>Automated Verdicts:</strong> Real-time forensic signal generation for Telegram.</li>
            <li style={{ marginTop: 4 }}><strong>Forensic Dossiers:</strong> High-fidelity reports for institutional-grade project audits.</li>
            <li style={{ marginTop: 4 }}><strong>Verified Registry:</strong> On-chain certification for projects with 90+ RS.</li>
          </ul>
        </div>
      </div>
      <SectionRule />
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "9px", color: "#aaa", fontFamily: mono, letterSpacing: "0.04em", lineHeight: 1.8 }}>
          APOL AGENT · AUTONOMOUS ONCHAIN FORENSICS PROTOCOL · BASE NETWORK · {new Date().getFullYear()}<br />
          THIS DOCUMENT IS FOR INFORMATIONAL PURPOSES ONLY AND DOES NOT CONSTITUTE FINANCIAL ADVICE.
        </p>
      </div>
    </div>
  );
}

export default function Whitepaper() {
  const [sidePanel, setSidePanel] = useState<"thumbs" | "outline">("thumbs");
  const [currentPage, setCurrentPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToPage = useCallback((p: number) => {
    const el = document.getElementById(`page-${p}`);
    if (el && scrollRef.current) {
      const off = el.offsetTop - scrollRef.current.offsetTop;
      scrollRef.current.scrollTo({ top: off - 20, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const h = () => {
      const ct = c.scrollTop + 80;
      for (let i = TOTAL_PAGES; i >= 1; i--) {
        const el = document.getElementById(`page-${i}`);
        if (el && el.offsetTop - c.offsetTop <= ct) { setCurrentPage(i); return; }
      }
      setCurrentPage(1);
    };
    c.addEventListener("scroll", h, { passive: true });
    return () => c.removeEventListener("scroll", h);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#e9ecef" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
      <style>{`
        .wp-page {
          width: 850px;
          min-height: 1200px;
          background: #ffffff;
          padding: 48px 64px;
          margin: 0 auto 40px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.18);
          box-sizing: border-box;
          position: relative;
        }
        .wp-page:first-child { margin-top: 0; }
        .wp-icon-btn { background: none; border: none; cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; color: #bbb; }
        .wp-icon-btn:hover { color: #fff; }
        .wp-tb-sep { width: 1px; height: 22px; background: #666; flex-shrink: 0; }
        .wp-sidebar-scroll::-webkit-scrollbar { width: 6px; }
        .wp-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .wp-sidebar-scroll::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
        .wp-content::-webkit-scrollbar { width: 10px; }
        .wp-content::-webkit-scrollbar-track { background: #ddd; }
        .wp-content::-webkit-scrollbar-thumb { background: #aaa; border-radius: 5px; }
        .wp-content::-webkit-scrollbar-thumb:hover { background: #888; }
        .wp-toc-link { transition: color 0.15s ease; }
        .wp-toc-link:hover { color: #00D1FF !important; }
      `}</style>

      {/* Top toolbar - full width */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 20,
        height: 36, background: "#333", borderBottom: "1px solid #555",
        display: "flex", alignItems: "center", padding: "0 8px", gap: "6px",
      }}>
        <Link href="/"><button className="wp-icon-btn" style={{ padding: "4px" }} data-testid="link-back-home"><Menu style={{ width: 16, height: 16 }} /></button></Link>
        <div className="wp-tb-sep" />
        <button className="wp-icon-btn" onClick={() => scrollToPage(Math.max(1, currentPage - 1))} data-testid="button-page-prev"><ChevronLeft style={{ width: 16, height: 16 }} /></button>
        <span style={{ color: "#ddd", fontSize: "12px", fontFamily: sans, minWidth: 44, textAlign: "center" }} data-testid="text-page-indicator">{currentPage} / {TOTAL_PAGES}</span>
        <button className="wp-icon-btn" onClick={() => scrollToPage(Math.min(TOTAL_PAGES, currentPage + 1))} data-testid="button-page-next"><ChevronRight style={{ width: 16, height: 16 }} /></button>
        <div className="wp-tb-sep" />
        <button className="wp-icon-btn"><Minus style={{ width: 14, height: 14 }} /></button>
        <div style={{ background: "#555", borderRadius: "2px", padding: "2px 8px" }}>
          <span style={{ color: "#ddd", fontSize: "11px", fontFamily: sans }}>100%</span>
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

      {/* Sidebar - fixed 300px */}
      <div style={{
        position: "fixed", top: 36, left: 0, bottom: 0, width: 300, zIndex: 10,
        background: "#484848", borderRight: "1px solid #555",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        <div style={{ display: "flex", borderBottom: "1px solid #555", flexShrink: 0 }}>
          <button
            onClick={() => setSidePanel("thumbs")}
            data-testid="button-sidebar-thumbs"
            style={{
              flex: 1, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
              background: sidePanel === "thumbs" ? "#555" : "transparent",
              border: "none", borderBottom: sidePanel === "thumbs" ? `2px solid ${ACCENT}` : "2px solid transparent",
              cursor: "pointer", color: sidePanel === "thumbs" ? "#fff" : "#999",
              fontSize: "11px", fontFamily: sans,
            }}
          >
            <Images style={{ width: 14, height: 14 }} />
          </button>
          <button
            onClick={() => setSidePanel("outline")}
            data-testid="button-sidebar-outline"
            style={{
              flex: 1, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
              background: sidePanel === "outline" ? "#555" : "transparent",
              border: "none", borderBottom: sidePanel === "outline" ? `2px solid ${ACCENT}` : "2px solid transparent",
              cursor: "pointer", color: sidePanel === "outline" ? "#fff" : "#999",
              fontSize: "11px", fontFamily: sans,
            }}
          >
            <List style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div className="wp-sidebar-scroll" style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {sidePanel === "thumbs" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", alignItems: "center" }}>
              {Array.from({ length: TOTAL_PAGES }, (_, i) => {
                const active = currentPage === i + 1;
                const ratio = 1200 / 850;
                const thumbW = 180;
                const thumbH = Math.round(thumbW * ratio);
                const pageLabels = [
                  "Title / Abstract",
                  "Evaluation Framework",
                  "Mathematical Foundations",
                  "Forensic Framework",
                  "Threat Matrix",
                  "Tokenomics",
                  "Protocol Architecture",
                ];
                return (
                  <div key={i} style={{ cursor: "pointer", textAlign: "center" }} onClick={() => scrollToPage(i + 1)} data-testid={`button-thumb-page-${i + 1}`}>
                    <div style={{
                      width: thumbW, height: thumbH,
                      background: "#fff",
                      border: active ? `3px solid ${ACCENT}` : "1px solid #666",
                      boxShadow: active ? `0 0 0 1px ${ACCENT}50, 0 2px 8px rgba(0,0,0,0.3)` : "0 1px 4px rgba(0,0,0,0.3)",
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
                      gap: "2px", padding: "8px 6px", boxSizing: "border-box", overflow: "hidden",
                    }}>
                      <div style={{ alignSelf: "flex-end", fontSize: "4px", color: "#bbb", fontFamily: sans, marginBottom: "4px" }}>
                        APOL-SEC-P{String(i + 1).padStart(2, "0")}
                      </div>
                      <div style={{ fontSize: "5.5px", fontWeight: 700, color: "#000", fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {pageLabels[i]}
                      </div>
                      <div style={{ width: "60%", height: 1, background: "#e0e0e0", margin: "3px 0" }} />
                      {i === 0 && (
                        <img src="/apol-agent-logo.png" alt="" style={{ width: 22, height: 22, marginTop: 4 }} />
                      )}
                      {[1, 2, 3].map(j => (
                        <div key={j} style={{ width: "70%", height: 3, background: "#f0f0f0", marginTop: 2 }} />
                      ))}
                    </div>
                    <div style={{ fontSize: "10px", color: active ? "#fff" : "#aaa", fontFamily: sans, marginTop: "4px" }}>
                      {i + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "4px 0" }}>
              <p style={{ fontSize: "9px", fontWeight: 400, letterSpacing: "0.1em", textTransform: "uppercase", color: "#999", fontFamily: sans, padding: "4px 8px 10px", margin: 0 }}>Document Outline</p>
              {tocItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => scrollToPage(item.page)}
                  data-testid={`button-toc-${i}`}
                  className="wp-toc-link"
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    background: "transparent", border: "none",
                    padding: `5px 10px 5px ${10 + item.indent * 14}px`,
                    fontSize: "14px",
                    fontFamily: sans,
                    color: currentPage === item.page && !item.indent ? "#fff" : item.indent ? "#999" : "#ccc",
                    fontWeight: 400,
                    cursor: "pointer", lineHeight: 1.8,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content area - offset by sidebar width */}
      <div
        ref={scrollRef}
        className="wp-content"
        style={{
          position: "absolute", top: 36, left: 300, right: 0, bottom: 0,
          overflowY: "auto", overflowX: "auto",
          background: "#e9ecef",
          display: "flex", justifyContent: "center",
          padding: "40px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Page1 />
          <Page2 />
          <Page3 />
          <Page4 />
          <Page5 />
          <Page6 />
          <Page7 />
          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  );
}
