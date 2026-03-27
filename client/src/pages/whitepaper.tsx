import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { ArrowLeft, Images, List, Download, Printer, ChevronLeft, ChevronRight } from "lucide-react";
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
    fontSize: "12px",
  },
});

const ACCENT = "#00D1FF";
const serif = "'Times New Roman', 'Computer Modern', Georgia, serif";
const sans = "'Inter', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const mono = "'JetBrains Mono', 'Courier New', monospace";

function KaTeX({ math }: { math: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) katex.render(math, ref.current, { displayMode: true, throwOnError: false });
  }, [math]);
  return <div ref={ref} style={{ margin: "14px 0", textAlign: "center" }} />;
}

function MermaidChart({ id, definition }: { id: string; definition: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    mermaid.render(id, definition).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [id, definition]);
  return <div ref={ref} style={{ display: "flex", justifyContent: "center", margin: "16px 0" }} />;
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
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { position: "bottom", labels: { color: "#333", font: { family: serif, size: 10 }, padding: 10 } } },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, []);
  return <div style={{ maxWidth: 200, margin: "12px auto" }}><canvas ref={canvasRef} data-testid="chart-tokenomics" /></div>;
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

const body: React.CSSProperties = { fontSize: "12px", lineHeight: 1.75, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 12px", textIndent: "24px" };
const sH: React.CSSProperties = { fontSize: "13px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.1em", color: "#111", margin: "0 0 6px", textAlign: "center" };
const figC: React.CSSProperties = { fontSize: "10px", color: "#888", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: "4px 0 20px" };
const dBox: React.CSSProperties = { background: "#fafafa", border: "1px solid #e5e5e5", padding: "16px 20px", marginBottom: "16px" };
const dLbl: React.CSSProperties = { fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#666", fontFamily: mono, marginBottom: "6px" };
const dP: React.CSSProperties = { fontSize: "11px", lineHeight: 1.6, color: "#444", textAlign: "justify", fontFamily: serif, margin: "0 0 8px" };
const vBox: React.CSSProperties = { padding: "10px 14px", background: "#fff", border: "1px solid #eaeaea", fontSize: "10.5px", fontFamily: serif, color: "#666", marginTop: "10px" };

const pg: React.CSSProperties = {
  width: "100%",
  background: "#ffffff",
  padding: "40px 52px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
  border: "1px solid #d4d4d4",
  marginBottom: "16px",
  boxSizing: "border-box",
};

function Page1() {
  return (
    <div id="page-1" style={pg}>
      <div style={{ textAlign: "center", margin: "20px 0 36px" }}>
        <img src="/apol-agent-logo.png" alt="APOL Agent" style={{ width: 100, height: 100, margin: "0 auto 16px", display: "block" }} />
        <h1 style={{ fontSize: "36px", fontWeight: 700, fontFamily: serif, color: "#111", margin: "0 0 2px", letterSpacing: "0.03em" }} data-testid="text-whitepaper-title">APOL AGENT</h1>
        <p style={{ fontSize: "11px", fontWeight: 700, fontFamily: mono, color: ACCENT, letterSpacing: "0.18em", margin: "6px 0 0", textTransform: "uppercase" }}>$APOL</p>
      </div>
      <div style={{ textAlign: "center", margin: "0 0 28px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 400, fontFamily: serif, color: "#222", lineHeight: 1.45, margin: 0 }}>
          Autonomous Onchain Forensics and AI-Driven Threat Intelligence
        </h2>
      </div>
      <div style={{ textAlign: "center", margin: "0 0 32px" }}>
        <p style={{ fontSize: "12px", fontFamily: serif, color: "#444", margin: "0 0 1px", fontWeight: 600 }}>APOL Labs</p>
        <p style={{ fontSize: "11px", fontFamily: serif, color: "#888", margin: 0, fontStyle: "italic" }}>Base Network</p>
      </div>
      <div style={{ borderTop: "1px solid #ddd", paddingTop: "24px" }}>
        <h3 style={sH}>I. Abstract</h3>
        <div style={{ columns: 2, columnGap: "28px", marginTop: "10px" }}>
          <p style={body}>
            APOL Agent is a decentralized forensic intelligence protocol engineered to operate as an autonomous watchdog
            within the Base blockchain ecosystem. The protocol addresses the systemic opacity in decentralized markets by
            providing real-time contract analysis, wallet provenance tracing, AI agent verification, and social forensics.
            Unlike conventional audit platforms that rely on manual review cycles, APOL Agent executes continuous, permissionless
            surveillance across on-chain and off-chain data layers, synthesizing results into actionable threat intelligence
            for retail participants.
          </p>
          <p style={body}>
            The core thesis is that market integrity is a public good. By automating forensic analysis — contract honeypot detection,
            deployer wallet genealogy, liquidity lock verification, holder concentration mapping, and behavioral timing analysis —
            APOL Agent reduces information asymmetry between sophisticated actors and retail holders. The protocol is governed by
            the $APOL token, which serves as the access layer for premium forensic capabilities and the economic substrate for
            community-driven threat reporting.
          </p>
          <p style={body}>
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
    <div id="page-2" style={pg}>
      <h3 style={sH}>II. Hierarchical Evaluation Framework</h3>
      <MermaidChart id="fig1-hierarchy" definition={hierarchyDef} />
      <p style={figC}>Fig. 1: Three-layer forensic taxonomy underlying all APOL analysis modules.</p>
      <div style={{ columns: 2, columnGap: "28px", marginBottom: "24px" }}>
        <p style={body}>The <strong>On-Chain Layer</strong> performs Wallet Cluster identification via transaction graph analysis, Shadow ID resolution to unmask connected deployer wallets, and Funding Trace to track capital provenance back to centralized exchanges, bridges, or mixers.</p>
        <p style={body}>The <strong>Behavioral Layer</strong> evaluates Narrative Alignment between public claims and on-chain evidence, Logic Auditing to verify autonomous reasoning patterns, and Agent Autonomy scoring through temporal execution analysis and round-the-clock activity verification.</p>
        <p style={body}>The <strong>Economic Layer</strong> assesses the Liquidity Floor (L<sub>f</sub>) — the minimum locked capital preventing zero-liquidity exits — and the Whale Concentration Ratio (WCR), measuring the cumulative supply share held by the top non-contract holders.</p>
      </div>
      <div style={{ borderTop: "1px solid #ddd", paddingTop: "20px" }}>
        <h3 style={sH}>III. Mathematical Foundations</h3>
        <div style={{ height: 10 }} />
        <div style={dBox}>
          <p style={dLbl}>Definition 1 — Resilience Score (RS)</p>
          <KaTeX math="RS = \\frac{L_{total}}{C_{whale} \\times H_{rank}} \\times 100" />
          <p style={dP}>The Resilience Score quantifies the probability of a liquidity death-spiral based on holder concentration. A high RS indicates that locked liquidity sufficiently buffers against coordinated whale exits. Conversely, a low RS signals structural fragility where a small number of holders can drain the pool.</p>
          <div style={vBox}><strong style={{ color: "#333" }}>Variables:</strong> <em>L<sub>total</sub></em> = total locked liquidity (USD) · <em>C<sub>whale</sub></em> = whale concentration ratio (0 &lt; WCR ≤ 1) · <em>H<sub>rank</sub></em> = Gini-derived holder distribution rank.</div>
        </div>
        <div style={dBox}>
          <p style={dLbl}>Definition 2 — Community Reward Function</p>
          <KaTeX math="Reward = R \\times R_{circulation} \\times M" />
          <p style={dP}>Governs $APOL distribution for community forensic contributions — scam reports, verified intelligence, and threat flagging. The multiplier M scales with contribution quality and verification status, incentivizing high-fidelity threat reports over noise.</p>
          <div style={vBox}><strong style={{ color: "#333" }}>Variables:</strong> <em>R</em> = base reward rate · <em>R<sub>circulation</sub></em> = circulating supply ratio · <em>M</em> = contribution multiplier (quality-weighted).</div>
        </div>
        <div style={{ ...dBox, marginBottom: 0 }}>
          <p style={dLbl}>Definition 3 — Cognition Score (CS)</p>
          <KaTeX math="CS = \\frac{\\sum_{i=1}^{n} w_i \\cdot T_i}{\\sum_{i=1}^{n} w_i} \\times 100" />
          <p style={dP}>Evaluates whether a purported AI agent exhibits genuine autonomous behavior or is human-operated. Scores ≥71% = "Fully Autonomous"; 31–70% = "Semi-Autonomous"; ≤30% = "Digital Puppet." The weighting system prioritizes temporal consistency and cross-platform behavioral coherence.</p>
          <div style={vBox}><strong style={{ color: "#333" }}>Variables:</strong> <em>T<sub>i</sub></em> = individual test score per domain · <em>w<sub>i</sub></em> = forensic significance weight · <em>n</em> = evaluation domains (currently 5).</div>
        </div>
      </div>
    </div>
  );
}

function Page3() {
  return (
    <div id="page-3" style={pg}>
      <h3 style={sH}>IV. Forensic Framework</h3>
      <p style={{ fontSize: "10.5px", color: "#888", textAlign: "center", fontFamily: serif, marginBottom: "8px" }}>Analytical domain decomposition and sub-module taxonomy</p>
      <MermaidChart id="fig2-forensic" definition={forensicDef} />
      <p style={figC}>Fig. 2: APOL Forensic Engine — Complete module hierarchy.</p>
      <div style={{ columns: 2, columnGap: "28px", marginBottom: "24px" }}>
        <p style={body}><strong>Wallet Analytics</strong> encompasses transaction tracing through Base chain history, identification of funding sources via genesis transaction analysis, and whale concentration detection through holder distribution mapping. The engine traces up to 10 levels of transaction depth to identify circular funding patterns and wash trading.</p>
        <p style={body}><strong>Behavioral Logic</strong> evaluates temporal execution patterns to distinguish autonomous AI agents from human-operated wallets, applying timing spread analysis and round-the-clock activity verification. A genuine AI agent should demonstrate consistent sub-second response patterns across all time zones.</p>
        <p style={body}><strong>Economic Resilience</strong> assesses structural integrity through liquidity lock verification, buy/sell tax analysis, and holder rank distribution to quantify rug-pull risk vectors. Projects with unlocked liquidity and concentrated holder bases receive proportionally lower resilience scores.</p>
      </div>
      <div style={{ borderTop: "1px solid #ddd", paddingTop: "20px" }}>
        <h3 style={sH}>V. Threat Classification Matrix</h3>
        <div style={{ height: 10 }} />
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: "11.5px", marginBottom: "8px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #222" }}>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Threat Vector</th>
              <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Severity</th>
              <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Detection Method</th>
              <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Reversible</th>
            </tr>
          </thead>
          <tbody>
            {([
              ["Honeypot Contract", "CRITICAL", "Sell simulation + bytecode analysis", "No"],
              ["Rug Pull (LP Drain)", "CRITICAL", "LP lock verification + holder analysis", "No"],
              ["Hidden Mint Function", "HIGH", "Contract source + owner permissions audit", "No"],
              ["Whale Concentration", "HIGH", "Top holder distribution mapping", "Partial"],
              ["Agent LARP", "MEDIUM", "Cognition Score + timing analysis", "N/A"],
              ["Elevated Tax", "MEDIUM", "Buy/sell tax simulation on-chain", "Yes"],
              ["Social Impersonation", "LOW", "Account age + engagement forensics", "Yes"],
            ] as const).map(([threat, severity, method, rev], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #e0e0e0" }}>
                <td style={{ padding: "7px 12px", color: "#222", fontWeight: 500 }}>{threat}</td>
                <td style={{ padding: "7px 12px", textAlign: "center", fontWeight: 700, fontSize: "10px", fontFamily: mono, color: severity === "CRITICAL" ? "#c62828" : severity === "HIGH" ? "#d84315" : severity === "MEDIUM" ? "#e65100" : "#0097b2" }}>{severity}</td>
                <td style={{ padding: "7px 12px", color: "#555" }}>{method}</td>
                <td style={{ padding: "7px 12px", textAlign: "center", fontWeight: 600, color: rev === "No" ? "#c62828" : "#555" }}>{rev}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: "10px", color: "#888", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: "4px 0 0" }}>Table 1: Severity tiers, detection methodologies, and reversibility assessment for each threat class.</p>
      </div>
    </div>
  );
}

function Page4() {
  return (
    <div id="page-4" style={pg}>
      <h3 style={sH}>VI. Tokenomics</h3>
      <div style={{ display: "flex", gap: "28px", marginTop: "12px", marginBottom: "20px" }}>
        <div style={{ flex: 1 }}>
          <p style={{ ...body, textIndent: 0 }}>The $APOL token employs a maximally fair distribution model with zero insider allocation. The entire supply enters public circulation at launch with no team reserves, no marketing tax, and no vesting schedules. This structure eliminates sell pressure from insider unlocks and aligns all stakeholders from genesis.</p>
          <p style={{ ...body, textIndent: 0 }}>The immutable 0/0 tax structure ensures that no value is extracted from trades. Liquidity is permanently locked or burned, verifiable on-chain, providing a non-revocable floor for market participants. The hard cap of 1,000,000,000 tokens prevents inflationary dilution.</p>
        </div>
        <div style={{ width: 200, flexShrink: 0 }}>
          <TokenomicsChart />
          <p style={{ fontSize: "9px", color: "#999", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: 0 }}>Fig. 3: 100% public circulation</p>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: "11.5px", marginBottom: "24px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #222" }}>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Parameter</th>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {[["Total Supply", "1,000,000,000 (Hard Capped)"], ["Public Circulation", "100%"], ["Team Reserve", "0%"], ["Marketing Tax", "0%"], ["Buy / Sell Tax", "0% / 0% (Immutable)"], ["Liquidity", "Burned / Locked (On-chain verifiable)"], ["Network", "Base (Chain ID: 8453)"]].map(([p, v], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #e0e0e0" }}>
              <td style={{ padding: "6px 12px", fontWeight: 600, color: "#222" }}>{p}</td>
              <td style={{ padding: "6px 12px", color: "#444" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ borderTop: "1px solid #ddd", paddingTop: "20px" }}>
        <h3 style={sH}>VII. Protocol Architecture</h3>
        <div style={{ height: 8 }} />
        <div style={{ columns: 2, columnGap: "28px", marginBottom: "20px" }}>
          <p style={body}>The APOL protocol operates across two complementary interfaces — a web-based forensic terminal and a Telegram bot — both powered by a shared backend intelligence engine. The architecture is designed for low-latency forensic output with minimal trust assumptions. All data sources are publicly verifiable.</p>
          <p style={body}>All forensic analyses are executed server-side and cached for performance. No private keys or user wallet contents are ever accessed — the protocol operates exclusively on publicly available on-chain data. The Telegram bot runs as a persistent process, polling for commands and returning formatted reports.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          <div style={{ background: "#fafafa", border: "1px solid #e5e5e5", padding: "14px 16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#444", fontFamily: mono, marginBottom: "8px" }}>Core Analytic Engine</p>
            <ul style={{ fontSize: "11px", lineHeight: 1.6, color: "#444", fontFamily: serif, paddingLeft: "16px", margin: 0 }}>
              <li><strong>Heuristic Logic Layer:</strong> Proprietary byte-code analysis to detect hidden developer "backdoors."</li>
              <li style={{ marginTop: 3 }}><strong>Cluster Fingerprinting:</strong> Multi-wallet sybil attack and pre-launch accumulation identification.</li>
              <li style={{ marginTop: 3 }}><strong>Cross-Chain Provenance:</strong> Funding source tracing back to centralized exchanges or mixers.</li>
            </ul>
          </div>
          <div style={{ background: "#fafafa", border: "1px solid #e5e5e5", padding: "14px 16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#444", fontFamily: mono, marginBottom: "8px" }}>Intelligence Output</p>
            <ul style={{ fontSize: "11px", lineHeight: 1.6, color: "#444", fontFamily: serif, paddingLeft: "16px", margin: 0 }}>
              <li><strong>Automated Verdicts:</strong> Real-time "Safe" vs "Larp" signal generation for the Telegram interface.</li>
              <li style={{ marginTop: 3 }}><strong>Forensic Dossiers:</strong> High-fidelity reports for institutional-grade project audits.</li>
              <li style={{ marginTop: 3 }}><strong>Verified Registry:</strong> On-chain certification for projects passing the 90+ Resilience Score.</li>
            </ul>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #ddd", paddingTop: "16px", textAlign: "center" }}>
        <p style={{ fontSize: "9px", color: "#aaa", fontFamily: mono, letterSpacing: "0.05em", lineHeight: 1.8 }}>
          APOL AGENT — AUTONOMOUS ONCHAIN FORENSICS PROTOCOL · BASE NETWORK · {new Date().getFullYear()}<br />
          THIS DOCUMENT IS FOR INFORMATIONAL PURPOSES ONLY AND DOES NOT CONSTITUTE FINANCIAL ADVICE.
        </p>
      </div>
    </div>
  );
}

export default function Whitepaper() {
  const [sidebarMode, setSidebarMode] = useState<"thumbs" | "outline">("thumbs");
  const [currentPage, setCurrentPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToPage = useCallback((p: number) => {
    const el = document.getElementById(`page-${p}`);
    if (el && scrollRef.current) {
      const off = el.offsetTop - scrollRef.current.offsetTop;
      scrollRef.current.scrollTo({ top: off, behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    const h = () => {
      const ct = c.scrollTop + 100;
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
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#1e1e1e", fontFamily: sans, overflow: "hidden" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />

      <div style={{
        height: 44,
        background: "#252525",
        borderBottom: "1px solid #333",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: "10px",
        flexShrink: 0,
      }}>
        <Link href="/">
          <button style={{ display: "flex", alignItems: "center", background: "none", border: "none", color: "#999", cursor: "pointer", padding: "4px 6px" }} data-testid="link-back-home">
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>
        </Link>
        <div style={{ width: 1, height: 20, background: "#444" }} />
        <img src="/apol-agent-logo.png" alt="" style={{ width: 18, height: 18 }} />
        <span style={{ color: "#eee", fontSize: "12px", fontWeight: 600, letterSpacing: "0.03em" }}>APOL AGENT</span>
        <span style={{ color: "#555", fontSize: "12px" }}>|</span>
        <span style={{ color: "#777", fontSize: "11px", letterSpacing: "0.02em" }}>TECHNICAL WHITEPAPER V1.0</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: "2px", background: "#1e1e1e", borderRadius: "3px", padding: "2px 4px", border: "1px solid #333" }}>
          <button onClick={() => scrollToPage(Math.max(1, currentPage - 1))} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: "3px", display: "flex" }} data-testid="button-page-prev"><ChevronLeft style={{ width: 14, height: 14 }} /></button>
          <span style={{ color: "#ccc", fontSize: "11px", fontFamily: mono, minWidth: 80, textAlign: "center" }} data-testid="text-page-indicator">{currentPage} / {TOTAL_PAGES}</span>
          <button onClick={() => scrollToPage(Math.min(TOTAL_PAGES, currentPage + 1))} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", padding: "3px", display: "flex" }} data-testid="button-page-next"><ChevronRight style={{ width: 14, height: 14 }} /></button>
        </div>
        <div style={{ width: 1, height: 20, background: "#444" }} />
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "1px solid #444", color: "#bbb", cursor: "pointer", fontFamily: sans, fontSize: "11px", padding: "4px 10px", borderRadius: "3px" }} data-testid="button-print">
          <Printer style={{ width: 12, height: 12 }} /> Print
        </button>
        <button onClick={() => window.print()} style={{ display: "flex", alignItems: "center", gap: "4px", background: ACCENT, border: "none", color: "#000", cursor: "pointer", fontFamily: sans, fontSize: "11px", fontWeight: 600, padding: "4px 12px", borderRadius: "3px" }} data-testid="button-download">
          <Download style={{ width: 12, height: 12 }} /> Download PDF
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        <div style={{
          width: 300,
          minWidth: 300,
          display: "flex",
          flexDirection: "column",
          background: "#f8f9fa",
          borderRight: "1px solid #ddd",
          flexShrink: 0,
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", borderBottom: "1px solid #e0e0e0", flexShrink: 0 }}>
            <button
              onClick={() => setSidebarMode("thumbs")}
              data-testid="button-sidebar-thumbs"
              style={{
                flex: 1, padding: "9px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                background: sidebarMode === "thumbs" ? "#fff" : "transparent",
                border: "none", borderBottom: sidebarMode === "thumbs" ? `2px solid ${ACCENT}` : "2px solid transparent",
                cursor: "pointer", color: sidebarMode === "thumbs" ? ACCENT : "#999", fontSize: "11px", fontWeight: 600, fontFamily: sans,
              }}
            >
              <Images style={{ width: 14, height: 14 }} /> Pages
            </button>
            <button
              onClick={() => setSidebarMode("outline")}
              data-testid="button-sidebar-outline"
              style={{
                flex: 1, padding: "9px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                background: sidebarMode === "outline" ? "#fff" : "transparent",
                border: "none", borderBottom: sidebarMode === "outline" ? `2px solid ${ACCENT}` : "2px solid transparent",
                cursor: "pointer", color: sidebarMode === "outline" ? ACCENT : "#999", fontSize: "11px", fontWeight: 600, fontFamily: sans,
              }}
            >
              <List style={{ width: 14, height: 14 }} /> Outline
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
            {sidebarMode === "thumbs" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Array.from({ length: TOTAL_PAGES }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToPage(i + 1)}
                    data-testid={`button-thumb-page-${i + 1}`}
                    style={{
                      width: "100%", padding: 0, background: "none",
                      border: currentPage === i + 1 ? `2px solid ${ACCENT}` : "2px solid #ccc",
                      borderRadius: "3px", cursor: "pointer", overflow: "hidden",
                      boxShadow: currentPage === i + 1 ? `0 0 0 1px ${ACCENT}30` : "none",
                    }}
                  >
                    <div style={{ background: "#fff", height: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", padding: "10px" }}>
                      {i === 0 && (<>
                        <img src="/apol-agent-logo.png" alt="" style={{ width: 24, height: 24 }} />
                        <div style={{ fontSize: "7px", fontWeight: 700, fontFamily: serif, color: "#111" }}>APOL AGENT</div>
                        <div style={{ fontSize: "5px", color: "#888", fontFamily: serif }}>Autonomous Onchain Forensics</div>
                        <div style={{ width: "50%", height: 1, background: "#ddd", margin: "2px 0" }} />
                        <div style={{ display: "flex", gap: "3px", width: "65%" }}><div style={{ flex: 1, height: 12, background: "#f3f3f3" }} /><div style={{ flex: 1, height: 12, background: "#f3f3f3" }} /></div>
                      </>)}
                      {i === 1 && (<>
                        <div style={{ fontSize: "5px", fontWeight: 700, color: "#111", fontFamily: serif }}>II. EVALUATION FRAMEWORK</div>
                        <div style={{ width: "60%", height: 28, background: "#e0f7ff", borderRadius: "2px" }} />
                        <div style={{ fontSize: "5px", fontWeight: 700, color: "#111", fontFamily: serif }}>III. MATH</div>
                        <div style={{ width: "55%", height: 8, background: "#f3f3f3" }} />
                        <div style={{ width: "55%", height: 8, background: "#f3f3f3" }} />
                        <div style={{ width: "55%", height: 8, background: "#f3f3f3" }} />
                      </>)}
                      {i === 2 && (<>
                        <div style={{ fontSize: "5px", fontWeight: 700, color: "#111", fontFamily: serif }}>IV. FORENSICS</div>
                        <div style={{ width: "60%", height: 24, background: "#e0f7ff", borderRadius: "2px" }} />
                        <div style={{ fontSize: "5px", fontWeight: 700, color: "#111", fontFamily: serif }}>V. THREATS</div>
                        {[1, 2, 3].map(j => <div key={j} style={{ width: "70%", height: 4, background: "#f3f3f3" }} />)}
                      </>)}
                      {i === 3 && (<>
                        <div style={{ fontSize: "5px", fontWeight: 700, color: "#111", fontFamily: serif }}>VI. TOKENOMICS</div>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#0097b2" }} />
                        <div style={{ fontSize: "5px", fontWeight: 700, color: "#111", fontFamily: serif }}>VII. ARCHITECTURE</div>
                        <div style={{ display: "flex", gap: "3px", width: "60%" }}><div style={{ flex: 1, height: 12, background: "#f3f3f3" }} /><div style={{ flex: 1, height: 12, background: "#f3f3f3" }} /></div>
                      </>)}
                    </div>
                    <div style={{ padding: "4px", fontSize: "10px", color: currentPage === i + 1 ? ACCENT : "#888", fontFamily: sans, textAlign: "center", background: "#f2f2f2", borderTop: "1px solid #e8e8e8", fontWeight: currentPage === i + 1 ? 600 : 400 }}>
                      {i + 1}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#aaa", fontFamily: sans, padding: "4px 6px 8px", margin: 0 }}>Document Outline</p>
                {tocItems.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToPage(item.page)}
                    data-testid={`button-toc-${i}`}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      background: currentPage === item.page && !item.indent ? `${ACCENT}0a` : "transparent",
                      border: "none",
                      borderLeft: currentPage === item.page && !item.indent ? `2px solid ${ACCENT}` : "2px solid transparent",
                      padding: `4px 10px 4px ${10 + item.indent * 14}px`,
                      fontSize: item.indent ? "10.5px" : "11.5px", fontFamily: sans,
                      color: currentPage === item.page && !item.indent ? ACCENT : item.indent ? "#aaa" : "#555",
                      fontWeight: item.indent ? 400 : 500, cursor: "pointer", lineHeight: 1.7,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#e8eaed", padding: "20px 24px" }}
        >
          <Page1 />
          <Page2 />
          <Page3 />
          <Page4 />
          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}
