import { useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
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
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "13px",
  },
});

function KaTeX({ math }: { math: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(math, ref.current, { displayMode: true, throwOnError: false });
    }
  }, [math]);
  return <div ref={ref} style={{ margin: "28px 0", textAlign: "center" }} />;
}

function MermaidChart({ id, definition }: { id: string; definition: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    mermaid.render(id, definition).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, [id, definition]);
  return <div ref={ref} style={{ display: "flex", justifyContent: "center", margin: "32px 0" }} />;
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
        datasets: [{
          data: [100],
          backgroundColor: ["#00c853"],
          borderColor: "#ffffff",
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#333", font: { family: "'Times New Roman', serif", size: 13 }, padding: 16 },
          },
        },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, []);
  return (
    <div style={{ maxWidth: 420, margin: "32px auto" }}>
      <canvas ref={canvasRef} data-testid="chart-tokenomics" />
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "#111",
  borderBottom: "2px solid #00c853",
  paddingBottom: "8px",
  marginBottom: "20px",
  marginTop: "48px",
  fontFamily: "'Times New Roman', serif",
};

const bodyText: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.85",
  color: "#333",
  textAlign: "justify",
  fontFamily: "'Times New Roman', serif",
};

const figCaption: React.CSSProperties = {
  fontSize: "12px",
  color: "#666",
  textAlign: "center",
  fontStyle: "italic",
  fontFamily: "'Times New Roman', serif",
  marginTop: "8px",
  marginBottom: "24px",
};

const calloutBox: React.CSSProperties = {
  background: "#f5f5f5",
  border: "1px solid #e0e0e0",
  borderLeft: "4px solid #00c853",
  padding: "24px 28px",
  margin: "24px 0",
};

const defTable: React.CSSProperties = {
  fontSize: "13px",
  color: "#555",
  fontFamily: "'Times New Roman', serif",
  lineHeight: "1.7",
};

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
    EL --> EL1["Liquidity Floor (Lf)"]
    EL --> EL2["Whale Concentration (WCR)"]`;

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

export default function Whitepaper() {
  return (
    <div style={{ background: "#f4f4f4", minHeight: "100vh", padding: "40px 16px" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />

      <div style={{ maxWidth: 850, margin: "0 auto", background: "#ffffff", padding: "60px 64px", boxShadow: "0 2px 24px rgba(0,0,0,0.08)" }}>

        <div style={{ marginBottom: "40px" }}>
          <Link href="/">
            <button style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#666", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.06em" }} data-testid="link-back-home">
              <ArrowLeft style={{ width: 14, height: 14 }} /> BACK TO TERMINAL
            </button>
          </Link>
        </div>

        <div style={{ textAlign: "center", marginBottom: "56px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <img src="/apol-agent-logo.png" alt="APOL Agent" style={{ width: 64, height: 64 }} />
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "#111", fontFamily: "'Times New Roman', serif", margin: "0 0 8px" }} data-testid="text-whitepaper-title">
            APOL AGENT
          </h1>
          <p style={{ fontSize: "14px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#666", fontFamily: "'Times New Roman', serif", margin: "0 0 6px" }}>
            Autonomous Onchain Forensics Protocol
          </p>
          <p style={{ fontSize: "12px", color: "#999", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>
            Technical Whitepaper — v1.0 — Base Network
          </p>
          <div style={{ width: "80px", height: "3px", background: "#00c853", margin: "24px auto 0" }} />
        </div>

        {/* ─── TABLE OF CONTENTS ─── */}
        <div style={{ border: "1px solid #e0e0e0", padding: "20px 28px", marginBottom: "40px" }}>
          <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "#111", fontFamily: "'Times New Roman', serif", marginBottom: "12px" }}>
            TABLE OF CONTENTS
          </p>
          {[
            "I. Abstract",
            "II. Mathematical Foundations",
            "III. Forensic Framework",
            "IV. Threat Classification Matrix",
            "V. Tokenomics",
            "VI. Protocol Architecture",
          ].map((item, i) => (
            <p key={i} style={{ fontSize: "13px", color: "#555", fontFamily: "'Times New Roman', serif", lineHeight: "2", borderBottom: i < 5 ? "1px dotted #ddd" : "none", margin: 0 }}>
              {item}
            </p>
          ))}
        </div>

        {/* ─── I. ABSTRACT ─── */}
        <div style={{ borderTop: "1px solid #e0e0e0", paddingTop: "32px" }}>
          <h2 style={{ ...sectionTitle, marginTop: 0 }} data-testid="heading-abstract">I. ABSTRACT</h2>
          <p style={bodyText}>
            APOL Agent is a decentralized forensic intelligence protocol engineered to operate as an autonomous watchdog
            within the Base blockchain ecosystem. The protocol addresses the systemic opacity in decentralized markets by
            providing real-time contract analysis, wallet provenance tracing, AI agent verification, and social forensics.
            Unlike conventional audit platforms that rely on manual review cycles, APOL Agent executes continuous, permissionless
            surveillance across on-chain and off-chain data layers, synthesizing results into actionable threat intelligence
            for retail participants.
          </p>
          <p style={{ ...bodyText, marginTop: "16px" }}>
            The core thesis is that market integrity is a public good. By automating forensic analysis — contract honeypot detection,
            deployer wallet genealogy, liquidity lock verification, holder concentration mapping, and behavioral timing analysis —
            APOL Agent reduces information asymmetry between sophisticated actors and retail holders. The protocol is governed by
            the $APOL token, which serves as the access layer for premium forensic capabilities and the economic substrate for
            community-driven threat reporting.
          </p>

          <MermaidChart id="fig1-hierarchy" definition={hierarchyDef} />
          <p style={figCaption}>Fig. 1: Hierarchical Evaluation Framework — The three-layer forensic taxonomy underlying all APOL analysis modules.</p>
        </div>

        {/* ─── II. MATHEMATICAL FOUNDATIONS ─── */}
        <div>
          <h2 style={sectionTitle} data-testid="heading-math-foundations">II. MATHEMATICAL FOUNDATIONS</h2>
          <p style={bodyText}>
            All APOL forensic outputs are derived from deterministic mathematical models. These models transform raw on-chain
            observables into normalized scores that enable cross-contract and cross-wallet comparison. The following foundational
            equations govern the protocol's core scoring mechanisms.
          </p>

          <div style={calloutBox}>
            <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#1b5e20", fontFamily: "'JetBrains Mono', monospace", marginBottom: "12px" }}>
              DEFINITION 1 — RESILIENCE SCORE (RS)
            </p>
            <KaTeX math="RS = \\frac{L_{total}}{C_{whale} \\times H_{rank}} \\times 100" />
            <p style={defTable}>
              The Resilience Score quantifies the probability of a liquidity death-spiral based on holder concentration.
              A high RS indicates that locked liquidity sufficiently buffers against coordinated whale exits. Conversely,
              a low RS signals structural fragility where a small number of holders can trigger cascading sell pressure.
            </p>
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "#fff", border: "1px solid #e8f5e9", fontSize: "13px", fontFamily: "'Times New Roman', serif", color: "#555" }}>
              <strong style={{ color: "#333" }}>Variable Definitions:</strong><br />
              <em>L<sub>total</sub></em> — Total locked liquidity in USD equivalent, verified via on-chain LP lock contracts.<br />
              <em>C<sub>whale</sub></em> — Whale Concentration Ratio: cumulative share of top-10 non-contract holders (0 &lt; WCR ≤ 1).<br />
              <em>H<sub>rank</sub></em> — Holder Distribution Rank Index: Gini-derived metric of supply distribution (1 = uniform, ∞ = single holder).
            </div>
          </div>

          <div style={calloutBox}>
            <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#1b5e20", fontFamily: "'JetBrains Mono', monospace", marginBottom: "12px" }}>
              DEFINITION 2 — COMMUNITY REWARD FUNCTION
            </p>
            <KaTeX math="Reward = R \\times R_{circulation} \\times M" />
            <p style={defTable}>
              The Reward function governs $APOL token distribution for community forensic contributions — scam reports,
              verified intelligence submissions, and threat flagging operations. The multiplier M scales with contribution
              quality and verification status.
            </p>
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "#fff", border: "1px solid #e8f5e9", fontSize: "13px", fontFamily: "'Times New Roman', serif", color: "#555" }}>
              <strong style={{ color: "#333" }}>Variable Definitions:</strong><br />
              <em>R</em> — Base reward rate, set by protocol governance.<br />
              <em>R<sub>circulation</sub></em> — Circulating supply ratio: proportion of tokens in active circulation vs. total supply.<br />
              <em>M</em> — Contribution multiplier: weighted by report accuracy, community votes, and on-chain verification status.
            </div>
          </div>

          <div style={calloutBox}>
            <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#1b5e20", fontFamily: "'JetBrains Mono', monospace", marginBottom: "12px" }}>
              DEFINITION 3 — COGNITION SCORE (CS)
            </p>
            <KaTeX math="CS = \\frac{\\sum_{i=1}^{n} w_i \\cdot T_i}{\\sum_{i=1}^{n} w_i} \\times 100" />
            <p style={defTable}>
              The Cognition Score evaluates whether a purported AI agent exhibits genuine autonomous behavior
              or is a human-operated LARP. Each test T<sub>i</sub> produces a binary or continuous signal weighted
              by domain importance w<sub>i</sub>. Scores ≥71% classify as "Fully Autonomous"; 31–70% as "Semi-Autonomous";
              ≤30% as "Digital Puppet."
            </p>
            <div style={{ marginTop: "16px", padding: "12px 16px", background: "#fff", border: "1px solid #e8f5e9", fontSize: "13px", fontFamily: "'Times New Roman', serif", color: "#555" }}>
              <strong style={{ color: "#333" }}>Variable Definitions:</strong><br />
              <em>T<sub>i</sub></em> — Individual test score: traceability, timing spread, claim verification, log consistency, social integrity.<br />
              <em>w<sub>i</sub></em> — Weight assigned to test domain based on forensic significance.<br />
              <em>n</em> — Total number of evaluation domains (currently 5).
            </div>
          </div>
        </div>

        {/* ─── III. FORENSIC FRAMEWORK ─── */}
        <div>
          <h2 style={sectionTitle} data-testid="heading-forensic-framework">III. FORENSIC FRAMEWORK</h2>
          <p style={bodyText}>
            The APOL Forensic Engine operates across three interdependent analytical domains. Each domain contributes weighted
            signals to the composite Risk Score and Cognition Score outputs. The hierarchical structure below illustrates
            the full analytical taxonomy:
          </p>
          <MermaidChart id="fig2-forensic" definition={forensicDef} />
          <p style={figCaption}>Fig. 2: APOL Forensic Engine — Analytical domain decomposition and sub-module taxonomy.</p>
          <p style={bodyText}>
            <strong>Wallet Analytics</strong> encompasses transaction tracing through Base chain history, identification of
            funding sources via genesis transaction analysis, and whale concentration detection through holder distribution mapping.
            <strong> Behavioral Logic</strong> evaluates temporal execution patterns to distinguish autonomous AI agents from
            human-operated wallets, applying timing spread analysis and round-the-clock activity verification.
            <strong> Economic Resilience</strong> assesses structural integrity through liquidity lock verification, buy/sell tax
            analysis, and holder rank distribution to quantify rug-pull risk vectors.
          </p>
        </div>

        {/* ─── IV. THREAT CLASSIFICATION MATRIX ─── */}
        <div>
          <h2 style={sectionTitle} data-testid="heading-threat-matrix">IV. THREAT CLASSIFICATION MATRIX</h2>
          <p style={bodyText}>
            APOL Agent classifies detected threats into a standardized severity matrix. Each threat vector is assigned a
            risk tier based on the probability of capital loss and the reversibility of the exploit:
          </p>
          <div style={{ margin: "24px 0", border: "1px solid #e0e0e0", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Times New Roman', serif", fontSize: "14px" }}>
              <thead>
                <tr style={{ background: "#1b5e20", color: "#fff" }}>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "11px" }}>Threat Vector</th>
                  <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "11px" }}>Severity</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "11px" }}>Detection Method</th>
                  <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "11px" }}>Reversible</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["Honeypot Contract", "CRITICAL", "GoPlus API + sell simulation", "No"],
                  ["Rug Pull (LP Drain)", "CRITICAL", "LP lock verification + holder analysis", "No"],
                  ["Hidden Mint Function", "HIGH", "Contract source analysis + owner permissions", "No"],
                  ["Whale Concentration", "HIGH", "Top holder distribution mapping", "Partial"],
                  ["Agent LARP", "MEDIUM", "Cognition Score + timing analysis", "N/A"],
                  ["Elevated Tax", "MEDIUM", "Buy/sell tax simulation", "Yes"],
                  ["Social Impersonation", "LOW", "Account age + engagement forensics", "Yes"],
                ] as const).map(([threat, severity, method, reversible], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e8e8e8", background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#111" }}>{threat}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{
                        fontSize: "10px",
                        fontWeight: 800,
                        letterSpacing: "0.1em",
                        padding: "3px 10px",
                        background: severity === "CRITICAL" ? "#ffebee" : severity === "HIGH" ? "#fff3e0" : severity === "MEDIUM" ? "#fff8e1" : "#e8f5e9",
                        color: severity === "CRITICAL" ? "#c62828" : severity === "HIGH" ? "#e65100" : severity === "MEDIUM" ? "#f57f17" : "#2e7d32",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        {severity}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#555", fontSize: "13px" }}>{method}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center", color: reversible === "No" ? "#c62828" : "#555", fontWeight: reversible === "No" ? 700 : 400 }}>{reversible}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={figCaption}>Table 1: APOL Threat Classification Matrix — Severity tiers, detection methodologies, and reversibility assessment.</p>
        </div>

        {/* ─── V. TOKENOMICS ─── */}
        <div>
          <h2 style={sectionTitle} data-testid="heading-tokenomics">V. TOKENOMICS</h2>
          <p style={bodyText}>
            The $APOL token employs a maximally fair distribution model with zero insider allocation.
            The entire supply enters public circulation at launch with no team reserves, no marketing tax,
            and no vesting schedules. This structure eliminates sell pressure from insider unlocks and aligns
            all stakeholders from day one.
          </p>
          <TokenomicsChart />
          <p style={figCaption}>Fig. 3: $APOL Token Distribution — 100% public circulation model.</p>
          <div style={{ margin: "24px 0", padding: "20px 24px", background: "#f9fbe7", border: "1px solid #e8f5e9" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Times New Roman', serif", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #00c853" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "#111", letterSpacing: "0.08em", textTransform: "uppercase" }}>Parameter</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "#111", letterSpacing: "0.08em", textTransform: "uppercase" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Total Supply", "1,000,000,000 (Hard Capped)"],
                  ["Public Circulation", "100%"],
                  ["Team Reserve", "0%"],
                  ["Marketing Tax", "0%"],
                  ["Buy / Sell Tax", "0% / 0% (Immutable)"],
                  ["Liquidity", "Burned / Locked (Verifiable on-chain)"],
                  ["Network", "Base"],
                ].map(([param, value], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e8f5e9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1b5e20" }}>{param}</td>
                    <td style={{ padding: "10px 12px", color: "#333" }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── VI. PROTOCOL ARCHITECTURE ─── */}
        <div>
          <h2 style={sectionTitle} data-testid="heading-architecture">VI. PROTOCOL ARCHITECTURE</h2>
          <p style={bodyText}>
            The APOL protocol operates across two complementary interfaces — a web-based forensic terminal and a Telegram
            bot — both powered by a shared backend intelligence engine. The architecture is designed for low-latency
            forensic output with minimal trust assumptions:
          </p>
          <div style={{ ...calloutBox, borderLeftColor: "#1b5e20" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div>
                <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1b5e20", fontFamily: "'JetBrains Mono', monospace", marginBottom: "10px" }}>
                  CORE ANALYTIC ENGINE
                </p>
                <ul style={{ ...defTable, paddingLeft: "18px", margin: 0 }}>
                  <li><strong>Heuristic Logic Layer:</strong> Proprietary byte-code analysis to detect hidden developer "backdoors."</li>
                  <li><strong>Cluster Fingerprinting:</strong> Identification of multi-wallet sybil attacks and pre-launch accumulation.</li>
                  <li><strong>Cross-Chain Provenance:</strong> Tracing funding sources back to centralized exchanges or mixers.</li>
                </ul>
              </div>
              <div>
                <p style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1b5e20", fontFamily: "'JetBrains Mono', monospace", marginBottom: "10px" }}>
                  INTELLIGENCE OUTPUT
                </p>
                <ul style={{ ...defTable, paddingLeft: "18px", margin: 0 }}>
                  <li><strong>Automated Verdicts:</strong> Real-time generation of "Safe" vs "Larp" signals for the Telegram interface.</li>
                  <li><strong>Forensic Dossiers:</strong> High-fidelity PDF reports for institutional-grade project audits.</li>
                  <li><strong>Verified Registry:</strong> On-chain certification for projects that pass the 90+ Resilience Score.</li>
                </ul>
              </div>
            </div>
          </div>
          <p style={{ ...bodyText, marginTop: "20px" }}>
            All forensic analyses are executed server-side and cached for performance. No private keys or user wallet contents
            are ever accessed — the protocol operates exclusively on publicly available on-chain data. The Telegram bot runs
            as a persistent process in production, polling for commands and delivering formatted forensic reports directly to
            user chats.
          </p>
        </div>

        {/* ─── FOOTER ─── */}
        <div style={{ marginTop: "56px", paddingTop: "24px", borderTop: "2px solid #00c853", textAlign: "center" }}>
          <p style={{ fontSize: "11px", color: "#999", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em", lineHeight: "1.8" }}>
            APOL AGENT — AUTONOMOUS ONCHAIN FORENSICS PROTOCOL<br />
            BASE NETWORK — {new Date().getFullYear()}<br />
            THIS DOCUMENT IS FOR INFORMATIONAL PURPOSES ONLY AND DOES NOT CONSTITUTE FINANCIAL ADVICE.
          </p>
        </div>

      </div>
    </div>
  );
}
