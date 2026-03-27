import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Images, List, Download, Printer, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import katex from "katex";
import mermaid from "mermaid";
import { Chart, ArcElement, Tooltip, Legend, PieController } from "chart.js";

Chart.register(ArcElement, Tooltip, Legend, PieController);

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    primaryColor: "#e8f5e9",
    primaryBorderColor: "#00c853",
    primaryTextColor: "#111",
    lineColor: "#00c853",
    secondaryColor: "#f1f8e9",
    tertiaryColor: "#fff",
    fontFamily: "'Computer Modern', 'Times New Roman', serif",
    fontSize: "12px",
  },
});

const serif = "'Times New Roman', 'Computer Modern', Georgia, serif";
const sans = "'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const mono = "'JetBrains Mono', 'Courier New', monospace";

function KaTeX({ math }: { math: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) katex.render(math, ref.current, { displayMode: true, throwOnError: false });
  }, [math]);
  return <div ref={ref} style={{ margin: "16px 0", textAlign: "center" }} />;
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
        datasets: [{ data: [100], backgroundColor: ["#2e7d32"], borderColor: "#fff", borderWidth: 2 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { position: "bottom", labels: { color: "#333", font: { family: serif, size: 11 }, padding: 12 } } },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, []);
  return <div style={{ maxWidth: 260, margin: "16px auto" }}><canvas ref={canvasRef} data-testid="chart-tokenomics" /></div>;
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

const TOTAL_PAGES = 4;

const tocItems = [
  { page: 1, label: "I. Abstract", indent: 0 },
  { page: 2, label: "II. Hierarchical Evaluation Framework", indent: 0 },
  { page: 2, label: "III. Mathematical Foundations", indent: 0 },
  { page: 2, label: "Definition 1 — Resilience Score", indent: 1 },
  { page: 2, label: "Definition 2 — Reward Function", indent: 1 },
  { page: 2, label: "Definition 3 — Cognition Score", indent: 1 },
  { page: 3, label: "IV. Forensic Framework", indent: 0 },
  { page: 3, label: "V. Threat Classification Matrix", indent: 0 },
  { page: 4, label: "VI. Tokenomics", indent: 0 },
  { page: 4, label: "VII. Protocol Architecture", indent: 0 },
];

const bp = "11.5px";
const bpStyle: React.CSSProperties = { fontSize: bp, lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" };
const secHead = (text: string): React.CSSProperties => ({ fontSize: "11px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.12em", color: "#111", marginBottom: "4px", textAlign: "center" });
const figCap: React.CSSProperties = { fontSize: "10px", color: "#777", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: "-8px 0 24px" };
const defBox: React.CSSProperties = { background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "20px 24px", marginBottom: "20px" };
const defLabel: React.CSSProperties = { fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", fontFamily: mono, marginBottom: "8px" };
const defP: React.CSSProperties = { fontSize: "10.5px", lineHeight: 1.65, color: "#444", textAlign: "justify", fontFamily: serif, margin: 0 };
const defVar: React.CSSProperties = { fontSize: "10.5px", lineHeight: 1.65, color: "#555", fontFamily: serif, margin: 0 };
const varBox: React.CSSProperties = { marginTop: "16px", padding: "12px 16px", background: "#fff", border: "1px solid #e8f5e9", fontSize: "10.5px", fontFamily: serif, color: "#555" };

const pageStyle: React.CSSProperties = {
  maxWidth: 816,
  margin: "0 auto 20px",
  background: "#ffffff",
  padding: "56px 72px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  border: "1px solid #d8d8d8",
  minHeight: 1056,
};

function Page1() {
  return (
    <div id="page-1" style={{ ...pageStyle, paddingTop: "80px", display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center", marginBottom: "60px", marginTop: "40px" }}>
        <img src="/apol-agent-logo.png" alt="APOL Agent" style={{ width: 140, height: 140, margin: "0 auto 24px", display: "block" }} />
        <h1 style={{ fontSize: "42px", fontWeight: 700, fontFamily: serif, color: "#111", margin: "0 0 4px", letterSpacing: "0.04em" }} data-testid="text-whitepaper-title">APOL AGENT</h1>
        <p style={{ fontSize: "11px", fontWeight: 700, fontFamily: mono, color: "#00c853", letterSpacing: "0.2em", margin: "8px 0 0", textTransform: "uppercase" }}>$APOL</p>
      </div>
      <div style={{ textAlign: "center", marginBottom: "48px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 400, fontFamily: serif, color: "#222", lineHeight: 1.4, margin: "0 auto", maxWidth: 520 }}>
          Autonomous Onchain Forensics<br />and AI-Driven Threat Intelligence
        </h2>
      </div>
      <div style={{ textAlign: "center", marginBottom: "60px" }}>
        <p style={{ fontSize: "13px", fontFamily: serif, color: "#444", margin: "0 0 2px", fontWeight: 600 }}>APOL Labs</p>
        <p style={{ fontSize: "12px", fontFamily: serif, color: "#777", margin: 0, fontStyle: "italic" }}>Base Network</p>
      </div>
      <div style={{ borderTop: "1px solid #ddd", paddingTop: "32px" }}>
        <div style={{ columns: 2, columnGap: "32px" }}>
          <h3 style={{ ...secHead(""), marginTop: 0, marginBottom: "8px", columnSpan: "all" } as React.CSSProperties}>I. Abstract</h3>
          <p style={bpStyle}>
            APOL Agent is a decentralized forensic intelligence protocol engineered to operate as an autonomous watchdog
            within the Base blockchain ecosystem. The protocol addresses the systemic opacity in decentralized markets by
            providing real-time contract analysis, wallet provenance tracing, AI agent verification, and social forensics.
            Unlike conventional audit platforms that rely on manual review cycles, APOL Agent executes continuous, permissionless
            surveillance across on-chain and off-chain data layers, synthesizing results into actionable threat intelligence
            for retail participants.
          </p>
          <p style={bpStyle}>
            The core thesis is that market integrity is a public good. By automating forensic analysis — contract honeypot detection,
            deployer wallet genealogy, liquidity lock verification, holder concentration mapping, and behavioral timing analysis —
            APOL Agent reduces information asymmetry between sophisticated actors and retail holders. The protocol is governed by
            the $APOL token, which serves as the access layer for premium forensic capabilities and the economic substrate for
            community-driven threat reporting.
          </p>
          <p style={bpStyle}>
            This paper presents the mathematical foundations, forensic framework, threat classification taxonomy,
            tokenomic architecture, and protocol design underlying the APOL Agent system. All models are deterministic
            and operate exclusively on publicly available on-chain data, requiring zero trust assumptions from end users.
          </p>
        </div>
      </div>
    </div>
  );
}

function Page2() {
  return (
    <div id="page-2" style={pageStyle}>
      <h3 style={secHead("")}>II. Hierarchical Evaluation Framework</h3>
      <MermaidChart id="fig1-hierarchy" definition={hierarchyDef} />
      <p style={figCap}>Fig. 1: Hierarchical Evaluation Framework — Three-layer forensic taxonomy underlying all APOL analysis modules.</p>
      <div style={{ columns: 2, columnGap: "32px", marginBottom: "32px" }}>
        <p style={bpStyle}>The <strong>On-Chain Layer</strong> performs Wallet Cluster identification via transaction graph analysis, Shadow ID resolution to unmask connected deployer wallets, and Funding Trace to track capital provenance back to centralized exchanges, bridges, or mixers.</p>
        <p style={bpStyle}>The <strong>Behavioral Layer</strong> evaluates Narrative Alignment between public claims and on-chain evidence, Logic Auditing to verify autonomous reasoning patterns, and Agent Autonomy scoring through temporal execution analysis and round-the-clock activity verification.</p>
        <p style={bpStyle}>The <strong>Economic Layer</strong> assesses the Liquidity Floor (L<sub>f</sub>) — the minimum locked capital preventing zero-liquidity exits — and the Whale Concentration Ratio (WCR), measuring the cumulative supply share held by the top non-contract holders.</p>
      </div>
      <div style={{ borderTop: "1px solid #ddd", paddingTop: "28px" }}>
        <h3 style={secHead("")}>III. Mathematical Foundations</h3>
        <div style={{ height: 16 }} />
        <div style={defBox}>
          <p style={defLabel}>Definition 1 — Resilience Score (RS)</p>
          <KaTeX math="RS = \\frac{L_{total}}{C_{whale} \\times H_{rank}} \\times 100" />
          <p style={defP}>The Resilience Score quantifies the probability of a liquidity death-spiral based on holder concentration. A high RS indicates that locked liquidity sufficiently buffers against coordinated whale exits.</p>
          <div style={varBox}>
            <strong style={{ color: "#333" }}>Variables:</strong> <em>L<sub>total</sub></em> = total locked liquidity (USD). <em>C<sub>whale</sub></em> = whale concentration ratio (0 &lt; WCR ≤ 1). <em>H<sub>rank</sub></em> = Gini-derived holder distribution rank.
          </div>
        </div>
        <div style={defBox}>
          <p style={defLabel}>Definition 2 — Community Reward Function</p>
          <KaTeX math="Reward = R \\times R_{circulation} \\times M" />
          <p style={defP}>Governs $APOL distribution for community forensic contributions — scam reports, verified intelligence, and threat flagging. The multiplier M scales with contribution quality.</p>
          <div style={varBox}>
            <strong style={{ color: "#333" }}>Variables:</strong> <em>R</em> = base reward rate. <em>R<sub>circulation</sub></em> = circulating supply ratio. <em>M</em> = contribution multiplier (quality-weighted).
          </div>
        </div>
        <div style={{ ...defBox, marginBottom: 0 }}>
          <p style={defLabel}>Definition 3 — Cognition Score (CS)</p>
          <KaTeX math="CS = \\frac{\\sum_{i=1}^{n} w_i \\cdot T_i}{\\sum_{i=1}^{n} w_i} \\times 100" />
          <p style={defP}>Evaluates whether a purported AI agent exhibits genuine autonomous behavior. Scores ≥71% = "Fully Autonomous"; 31–70% = "Semi-Autonomous"; ≤30% = "Digital Puppet."</p>
          <div style={varBox}>
            <strong style={{ color: "#333" }}>Variables:</strong> <em>T<sub>i</sub></em> = individual test score per domain. <em>w<sub>i</sub></em> = forensic significance weight. <em>n</em> = evaluation domains (currently 5).
          </div>
        </div>
      </div>
    </div>
  );
}

function Page3() {
  return (
    <div id="page-3" style={pageStyle}>
      <h3 style={secHead("")}>IV. Forensic Framework</h3>
      <p style={{ fontSize: "10px", color: "#777", textAlign: "center", fontFamily: serif, marginBottom: "12px" }}>Analytical domain decomposition and sub-module taxonomy</p>
      <MermaidChart id="fig2-forensic" definition={forensicDef} />
      <p style={figCap}>Fig. 2: APOL Forensic Engine — Complete module hierarchy.</p>
      <div style={{ columns: 2, columnGap: "32px", marginBottom: "32px" }}>
        <p style={bpStyle}><strong>Wallet Analytics</strong> encompasses transaction tracing through Base chain history, identification of funding sources via genesis transaction analysis, and whale concentration detection through holder distribution mapping.</p>
        <p style={bpStyle}><strong>Behavioral Logic</strong> evaluates temporal execution patterns to distinguish autonomous AI agents from human-operated wallets, applying timing spread analysis and round-the-clock activity verification.</p>
        <p style={bpStyle}><strong>Economic Resilience</strong> assesses structural integrity through liquidity lock verification, buy/sell tax analysis, and holder rank distribution to quantify rug-pull risk vectors.</p>
      </div>
      <div style={{ borderTop: "1px solid #ddd", paddingTop: "28px" }}>
        <h3 style={secHead("")}>V. Threat Classification Matrix</h3>
        <div style={{ height: 16 }} />
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: "11px", marginBottom: "8px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #111" }}>
              <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Threat Vector</th>
              <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Severity</th>
              <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Detection Method</th>
              <th style={{ textAlign: "center", padding: "6px 10px", fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Rev.</th>
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
                <td style={{ padding: "5px 10px", color: "#222" }}>{threat}</td>
                <td style={{ padding: "5px 10px", textAlign: "center", fontWeight: 700, fontSize: "9px", fontFamily: mono, color: severity === "CRITICAL" ? "#b71c1c" : severity === "HIGH" ? "#e65100" : severity === "MEDIUM" ? "#f57f17" : "#2e7d32" }}>{severity}</td>
                <td style={{ padding: "5px 10px", color: "#555" }}>{method}</td>
                <td style={{ padding: "5px 10px", textAlign: "center", color: rev === "No" ? "#b71c1c" : "#555" }}>{rev}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: "10px", color: "#777", textAlign: "center", fontStyle: "italic", fontFamily: serif }}>Table 1: Severity tiers, detection methodologies, and reversibility assessment.</p>
      </div>
    </div>
  );
}

function Page4() {
  return (
    <div id="page-4" style={pageStyle}>
      <h3 style={secHead("")}>VI. Tokenomics</h3>
      <div style={{ height: 12 }} />
      <div style={{ columns: 2, columnGap: "32px", marginBottom: "20px" }}>
        <p style={bpStyle}>The $APOL token employs a maximally fair distribution model with zero insider allocation. The entire supply enters public circulation at launch with no team reserves, no marketing tax, and no vesting schedules. This structure eliminates sell pressure from insider unlocks and aligns all stakeholders from genesis.</p>
        <p style={bpStyle}>The immutable 0/0 tax structure ensures that no value is extracted from trades. Liquidity is permanently locked or burned, verifiable on-chain, providing a non-revocable floor for market participants. The hard cap of 1,000,000,000 tokens prevents inflationary dilution.</p>
      </div>
      <TokenomicsChart />
      <p style={{ ...figCap, margin: "-4px 0 20px" }}>Fig. 3: $APOL Token Distribution — 100% public circulation.</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: "11px", marginBottom: "32px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #111" }}>
            <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Parameter</th>
            <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {[["Total Supply", "1,000,000,000 (Hard Capped)"], ["Public Circulation", "100%"], ["Team Reserve", "0%"], ["Marketing Tax", "0%"], ["Buy / Sell Tax", "0% / 0% (Immutable)"], ["Liquidity", "Burned / Locked (On-chain verifiable)"], ["Network", "Base (Chain ID: 8453)"]].map(([p, v], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "5px 10px", fontWeight: 600, color: "#222" }}>{p}</td>
              <td style={{ padding: "5px 10px", color: "#444" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: "1px solid #ddd", paddingTop: "28px" }}>
        <h3 style={secHead("")}>VII. Protocol Architecture</h3>
        <div style={{ height: 12 }} />
        <div style={{ columns: 2, columnGap: "32px", marginBottom: "24px" }}>
          <p style={bpStyle}>The APOL protocol operates across two complementary interfaces — a web-based forensic terminal and a Telegram bot — both powered by a shared backend intelligence engine. The architecture is designed for low-latency forensic output with minimal trust assumptions.</p>
          <p style={bpStyle}>All forensic analyses are executed server-side and cached for performance. No private keys or user wallet contents are ever accessed — the protocol operates exclusively on publicly available on-chain data.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
          <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "16px 18px" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#333", fontFamily: mono, marginBottom: "8px" }}>Core Analytic Engine</p>
            <ul style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#444", fontFamily: serif, paddingLeft: "16px", margin: 0 }}>
              <li><strong>Heuristic Logic Layer:</strong> Proprietary byte-code analysis to detect hidden developer "backdoors."</li>
              <li style={{ marginTop: 4 }}><strong>Cluster Fingerprinting:</strong> Identification of multi-wallet sybil attacks and pre-launch accumulation.</li>
              <li style={{ marginTop: 4 }}><strong>Cross-Chain Provenance:</strong> Tracing funding sources back to centralized exchanges or mixers.</li>
            </ul>
          </div>
          <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "16px 18px" }}>
            <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#333", fontFamily: mono, marginBottom: "8px" }}>Intelligence Output</p>
            <ul style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#444", fontFamily: serif, paddingLeft: "16px", margin: 0 }}>
              <li><strong>Automated Verdicts:</strong> Real-time generation of "Safe" vs "Larp" signals for the Telegram interface.</li>
              <li style={{ marginTop: 4 }}><strong>Forensic Dossiers:</strong> High-fidelity PDF reports for institutional-grade project audits.</li>
              <li style={{ marginTop: 4 }}><strong>Verified Registry:</strong> On-chain certification for projects that pass the 90+ Resilience Score.</li>
            </ul>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #ddd", marginTop: "40px", paddingTop: "20px", textAlign: "center" }}>
        <p style={{ fontSize: "9px", color: "#999", fontFamily: mono, letterSpacing: "0.06em", lineHeight: 1.8 }}>
          APOL AGENT — AUTONOMOUS ONCHAIN FORENSICS PROTOCOL<br />
          BASE NETWORK — {new Date().getFullYear()}<br />
          THIS DOCUMENT IS FOR INFORMATIONAL PURPOSES ONLY AND DOES NOT CONSTITUTE FINANCIAL ADVICE.
        </p>
      </div>
    </div>
  );
}

export default function Whitepaper() {
  const [sidebarMode, setSidebarMode] = useState<"thumbs" | "outline" | null>("thumbs");
  const [currentPage, setCurrentPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);

  const scrollToPage = useCallback((p: number) => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const handleScroll = () => {
      const pages = Array.from({ length: TOTAL_PAGES }, (_, i) => document.getElementById(`page-${i + 1}`));
      const scrollTop = container.scrollTop + 120;
      for (let i = pages.length - 1; i >= 0; i--) {
        if (pages[i] && pages[i]!.offsetTop <= scrollTop) {
          setCurrentPage(i + 1);
          break;
        }
      }
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const sidebarOpen = sidebarMode !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#2b2b2b", fontFamily: sans, overflow: "hidden" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />

      {/* ═══ TOP BAR ═══ */}
      <div style={{
        height: 48,
        background: "#383838",
        borderBottom: "1px solid #4a4a4a",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: "12px",
        flexShrink: 0,
        zIndex: 50,
      }}>
        <Link href="/">
          <button style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", color: "#aaa", cursor: "pointer", fontFamily: sans, fontSize: "12px", padding: "4px 8px" }} data-testid="link-back-home">
            <ArrowLeft style={{ width: 14, height: 14 }} />
          </button>
        </Link>
        <div style={{ width: 1, height: 24, background: "#555" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <img src="/apol-agent-logo.png" alt="" style={{ width: 20, height: 20 }} />
          <span style={{ color: "#ddd", fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em" }}>APOL AGENT</span>
          <span style={{ color: "#888", fontSize: "11px" }}>|</span>
          <span style={{ color: "#999", fontSize: "11px" }}>TECHNICAL WHITEPAPER V1.0</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#2f2f2f", borderRadius: "4px", padding: "2px 4px" }}>
          <button onClick={() => scrollToPage(Math.max(1, currentPage - 1))} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: "4px", display: "flex" }}><ChevronLeft style={{ width: 14, height: 14 }} /></button>
          <span style={{ color: "#ddd", fontSize: "12px", fontFamily: mono, minWidth: 80, textAlign: "center" }}>
            Page {currentPage} of {TOTAL_PAGES}
          </span>
          <button onClick={() => scrollToPage(Math.min(TOTAL_PAGES, currentPage + 1))} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: "4px", display: "flex" }}><ChevronRight style={{ width: 14, height: 14 }} /></button>
        </div>
        <div style={{ width: 1, height: 24, background: "#555" }} />
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "1px solid #555", color: "#ccc", cursor: "pointer", fontFamily: sans, fontSize: "11px", padding: "5px 12px", borderRadius: "4px" }} data-testid="button-print">
          <Printer style={{ width: 13, height: 13 }} /> Print
        </button>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#00c853", border: "none", color: "#fff", cursor: "pointer", fontFamily: sans, fontSize: "11px", fontWeight: 600, padding: "5px 12px", borderRadius: "4px" }} data-testid="button-download">
          <Download style={{ width: 13, height: 13 }} /> Download PDF
        </button>
      </div>

      {/* ═══ BODY ═══ */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ─── ICON TOOLBAR ─── */}
        <div style={{
          width: 48,
          background: "#333",
          borderRight: "1px solid #444",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "12px 0",
          gap: "4px",
          flexShrink: 0,
        }}>
          <button
            onClick={() => setSidebarMode(m => m === "thumbs" ? null : "thumbs")}
            data-testid="button-sidebar-thumbs"
            style={{
              width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
              background: sidebarMode === "thumbs" ? "rgba(0,200,83,0.15)" : "transparent",
              border: "none", borderRadius: "6px", cursor: "pointer", color: sidebarMode === "thumbs" ? "#00c853" : "#999",
            }}
          >
            <Images style={{ width: 18, height: 18 }} />
          </button>
          <button
            onClick={() => setSidebarMode(m => m === "outline" ? null : "outline")}
            data-testid="button-sidebar-outline"
            style={{
              width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
              background: sidebarMode === "outline" ? "rgba(0,200,83,0.15)" : "transparent",
              border: "none", borderRadius: "6px", cursor: "pointer", color: sidebarMode === "outline" ? "#00c853" : "#999",
            }}
          >
            <List style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* ─── SIDEBAR PANEL ─── */}
        {sidebarOpen && (
          <div style={{
            width: 220,
            background: "#2f2f2f",
            borderRight: "1px solid #444",
            overflowY: "auto",
            flexShrink: 0,
            padding: "12px 0",
          }}>
            {sidebarMode === "thumbs" ? (
              <div style={{ padding: "0 12px" }}>
                {Array.from({ length: TOTAL_PAGES }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToPage(i + 1)}
                    data-testid={`button-thumb-page-${i + 1}`}
                    style={{
                      width: "100%",
                      padding: 0,
                      marginBottom: "12px",
                      background: "none",
                      border: currentPage === i + 1 ? "2px solid #00c853" : "2px solid transparent",
                      borderRadius: "4px",
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{
                      background: "#fff",
                      height: 240,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      padding: "12px",
                    }}>
                      {i === 0 && (
                        <>
                          <img src="/apol-agent-logo.png" alt="" style={{ width: 32, height: 32 }} />
                          <div style={{ fontSize: "8px", fontWeight: 700, fontFamily: serif, color: "#111" }}>APOL AGENT</div>
                          <div style={{ fontSize: "6px", color: "#777", fontFamily: serif }}>Autonomous Onchain Forensics</div>
                          <div style={{ width: "60%", height: 1, background: "#ddd", margin: "4px 0" }} />
                          <div style={{ fontSize: "5px", color: "#999" }}>I. Abstract</div>
                          <div style={{ display: "flex", gap: "4px", width: "70%" }}><div style={{ flex: 1, height: 16, background: "#f0f0f0" }} /><div style={{ flex: 1, height: 16, background: "#f0f0f0" }} /></div>
                        </>
                      )}
                      {i === 1 && (
                        <>
                          <div style={{ fontSize: "6px", fontWeight: 700, color: "#111", fontFamily: serif }}>II. EVALUATION FRAMEWORK</div>
                          <div style={{ width: "70%", height: 40, background: "#e8f5e9", borderRadius: "2px" }} />
                          <div style={{ fontSize: "6px", fontWeight: 700, color: "#111", fontFamily: serif }}>III. MATHEMATICAL FOUNDATIONS</div>
                          <div style={{ width: "60%", height: 12, background: "#f8f8f8", border: "1px solid #eee" }} />
                          <div style={{ width: "60%", height: 12, background: "#f8f8f8", border: "1px solid #eee" }} />
                        </>
                      )}
                      {i === 2 && (
                        <>
                          <div style={{ fontSize: "6px", fontWeight: 700, color: "#111", fontFamily: serif }}>IV. FORENSIC FRAMEWORK</div>
                          <div style={{ width: "70%", height: 36, background: "#e8f5e9", borderRadius: "2px" }} />
                          <div style={{ fontSize: "6px", fontWeight: 700, color: "#111", fontFamily: serif }}>V. THREAT MATRIX</div>
                          <div style={{ display: "flex", flexDirection: "column", width: "80%", gap: "2px" }}>
                            {[1, 2, 3].map(j => <div key={j} style={{ height: 6, background: "#f0f0f0" }} />)}
                          </div>
                        </>
                      )}
                      {i === 3 && (
                        <>
                          <div style={{ fontSize: "6px", fontWeight: 700, color: "#111", fontFamily: serif }}>VI. TOKENOMICS</div>
                          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2e7d32" }} />
                          <div style={{ fontSize: "6px", fontWeight: 700, color: "#111", fontFamily: serif }}>VII. ARCHITECTURE</div>
                          <div style={{ display: "flex", gap: "4px", width: "70%" }}><div style={{ flex: 1, height: 16, background: "#f8f8f8", border: "1px solid #eee" }} /><div style={{ flex: 1, height: 16, background: "#f8f8f8", border: "1px solid #eee" }} /></div>
                        </>
                      )}
                    </div>
                    <div style={{ padding: "6px", fontSize: "10px", color: currentPage === i + 1 ? "#00c853" : "#aaa", fontFamily: sans, textAlign: "center", background: "#2a2a2a" }}>
                      Page {i + 1}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: "8px 0" }}>
                <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#666", fontFamily: sans, padding: "4px 16px 8px", margin: 0 }}>
                  Table of Contents
                </p>
                {tocItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToPage(item.page)}
                    data-testid={`button-toc-${i}`}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      background: currentPage === item.page ? "rgba(0,200,83,0.08)" : "transparent",
                      border: "none",
                      borderLeft: currentPage === item.page ? "2px solid #00c853" : "2px solid transparent",
                      padding: `5px 16px 5px ${16 + item.indent * 16}px`,
                      fontSize: item.indent ? "10px" : "11px",
                      fontFamily: sans,
                      color: currentPage === item.page ? "#00c853" : item.indent ? "#888" : "#ccc",
                      fontWeight: item.indent ? 400 : 500,
                      cursor: "pointer",
                      lineHeight: 1.6,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── MAIN CONTENT ─── */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            background: "#f0f2f5",
            padding: "24px 40px",
          }}
        >
          <Page1 />
          <Page2 />
          <Page3 />
          <Page4 />
        </div>
      </div>
    </div>
  );
}
