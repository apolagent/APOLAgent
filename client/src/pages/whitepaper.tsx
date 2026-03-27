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
    fontFamily: "'Computer Modern', 'Times New Roman', serif",
    fontSize: "12px",
  },
});

function KaTeX({ math }: { math: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      katex.render(math, ref.current, { displayMode: true, throwOnError: false });
    }
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
        datasets: [{
          data: [100],
          backgroundColor: ["#2e7d32"],
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
            labels: { color: "#333", font: { family: "'Times New Roman', serif", size: 11 }, padding: 12 },
          },
        },
      },
    });
    return () => { chartRef.current?.destroy(); };
  }, []);
  return (
    <div style={{ maxWidth: 280, margin: "16px auto" }}>
      <canvas ref={canvasRef} data-testid="chart-tokenomics" />
    </div>
  );
}

const serif = "'Times New Roman', 'Computer Modern', Georgia, serif";
const mono = "'JetBrains Mono', 'Courier New', monospace";

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

export default function Whitepaper() {
  return (
    <div style={{ background: "#e8e8e8", minHeight: "100vh", padding: "20px 16px" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />

      <div style={{ position: "fixed", top: 20, left: 20, zIndex: 100 }}>
        <Link href="/">
          <button style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(0,0,0,0.7)", border: "none", color: "#fff", cursor: "pointer", fontFamily: mono, fontSize: "11px", letterSpacing: "0.06em", padding: "8px 14px", borderRadius: "4px" }} data-testid="link-back-home">
            <ArrowLeft style={{ width: 12, height: 12 }} /> BACK
          </button>
        </Link>
      </div>

      {/* ═══ PAGE 1: COVER ═══ */}
      <div style={{
        maxWidth: 816,
        margin: "0 auto 24px",
        background: "#ffffff",
        padding: "80px 72px 60px",
        boxShadow: "0 1px 8px rgba(0,0,0,0.15)",
        minHeight: 1056,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
      }}>
        <div style={{ textAlign: "center", marginBottom: "60px", marginTop: "40px" }}>
          <img src="/apol-agent-logo.png" alt="APOL Agent" style={{ width: 140, height: 140, margin: "0 auto 24px", display: "block" }} />
          <h1 style={{ fontSize: "42px", fontWeight: 700, fontFamily: serif, color: "#111", margin: "0 0 4px", letterSpacing: "0.04em" }} data-testid="text-whitepaper-title">
            APOL AGENT
          </h1>
          <p style={{ fontSize: "11px", fontWeight: 700, fontFamily: mono, color: "#00c853", letterSpacing: "0.2em", margin: "8px 0 0", textTransform: "uppercase" }}>
            $APOL
          </p>
        </div>

        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: 400, fontFamily: serif, color: "#222", lineHeight: 1.4, margin: "0 auto", maxWidth: 520 }}>
            Autonomous Onchain Forensics<br />and AI-Driven Threat Intelligence
          </h2>
        </div>

        <div style={{ textAlign: "center", marginBottom: "60px" }}>
          <p style={{ fontSize: "13px", fontFamily: serif, color: "#444", margin: "0 0 2px", fontWeight: 600 }}>APOL Labs</p>
          <p style={{ fontSize: "12px", fontFamily: serif, color: "#777", margin: "0", fontStyle: "italic" }}>Base Network</p>
        </div>

        <div style={{ borderTop: "1px solid #ddd", paddingTop: "32px" }}>
          <div style={{ columns: 2, columnGap: "32px" }}>
            <h3 style={{ fontSize: "11px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.12em", color: "#111", marginTop: 0, marginBottom: "8px", textAlign: "center", columnSpan: "all" } as React.CSSProperties}>
              I. Abstract
            </h3>
            <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
              APOL Agent is a decentralized forensic intelligence protocol engineered to operate as an autonomous watchdog
              within the Base blockchain ecosystem. The protocol addresses the systemic opacity in decentralized markets by
              providing real-time contract analysis, wallet provenance tracing, AI agent verification, and social forensics.
              Unlike conventional audit platforms that rely on manual review cycles, APOL Agent executes continuous, permissionless
              surveillance across on-chain and off-chain data layers, synthesizing results into actionable threat intelligence
              for retail participants.
            </p>
            <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
              The core thesis is that market integrity is a public good. By automating forensic analysis — contract honeypot detection,
              deployer wallet genealogy, liquidity lock verification, holder concentration mapping, and behavioral timing analysis —
              APOL Agent reduces information asymmetry between sophisticated actors and retail holders. The protocol is governed by
              the $APOL token, which serves as the access layer for premium forensic capabilities and the economic substrate for
              community-driven threat reporting.
            </p>
            <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
              This paper presents the mathematical foundations, forensic framework, threat classification taxonomy,
              tokenomic architecture, and protocol design underlying the APOL Agent system. All models are deterministic
              and operate exclusively on publicly available on-chain data, requiring zero trust assumptions from end users.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ PAGE 2: FRAMEWORK + MATH ═══ */}
      <div style={{
        maxWidth: 816,
        margin: "0 auto 24px",
        background: "#ffffff",
        padding: "56px 72px",
        boxShadow: "0 1px 8px rgba(0,0,0,0.15)",
        minHeight: 1056,
      }}>
        <div style={{ marginBottom: "36px", textAlign: "center" }}>
          <h3 style={{ fontSize: "11px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.12em", color: "#111", marginBottom: "4px" }}>
            II. Hierarchical Evaluation Framework
          </h3>
        </div>

        <MermaidChart id="fig1-hierarchy" definition={hierarchyDef} />
        <p style={{ fontSize: "10px", color: "#777", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: "-8px 0 28px" }}>
          Fig. 1: Hierarchical Evaluation Framework — Three-layer forensic taxonomy underlying all APOL analysis modules.
        </p>

        <div style={{ columns: 2, columnGap: "32px", marginBottom: "32px" }}>
          <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
            The <strong>On-Chain Layer</strong> performs Wallet Cluster identification via transaction graph analysis,
            Shadow ID resolution to unmask connected deployer wallets, and Funding Trace to track capital provenance
            back to centralized exchanges, bridges, or mixers.
          </p>
          <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
            The <strong>Behavioral Layer</strong> evaluates Narrative Alignment between public claims and on-chain evidence,
            Logic Auditing to verify autonomous reasoning patterns, and Agent Autonomy scoring through temporal
            execution analysis and round-the-clock activity verification.
          </p>
          <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
            The <strong>Economic Layer</strong> assesses the Liquidity Floor (L<sub>f</sub>) — the minimum locked capital
            preventing zero-liquidity exits — and the Whale Concentration Ratio (WCR), measuring the cumulative supply
            share held by the top non-contract holders.
          </p>
        </div>

        <div style={{ borderTop: "1px solid #ddd", paddingTop: "28px" }}>
          <h3 style={{ fontSize: "11px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.12em", color: "#111", marginBottom: "16px", textAlign: "center" }}>
            III. Mathematical Foundations
          </h3>

          <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "20px 24px", marginBottom: "20px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", fontFamily: mono, marginBottom: "8px" }}>
              Definition 1 — Resilience Score (RS)
            </p>
            <KaTeX math="RS = \\frac{L_{total}}{C_{whale} \\times H_{rank}} \\times 100" />
            <div style={{ columns: 2, columnGap: "24px" }}>
              <p style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#444", textAlign: "justify", fontFamily: serif, margin: 0 }}>
                The Resilience Score quantifies the probability of a liquidity death-spiral based on holder concentration.
                A high RS indicates that locked liquidity sufficiently buffers against coordinated whale exits. Conversely,
                a low RS signals structural fragility.
              </p>
              <p style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#555", fontFamily: serif, margin: 0 }}>
                <em>L<sub>total</sub></em> = total locked liquidity (USD).<br />
                <em>C<sub>whale</sub></em> = whale concentration ratio (0 &lt; WCR ≤ 1).<br />
                <em>H<sub>rank</sub></em> = Gini-derived holder distribution rank.
              </p>
            </div>
          </div>

          <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "20px 24px", marginBottom: "20px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", fontFamily: mono, marginBottom: "8px" }}>
              Definition 2 — Community Reward Function
            </p>
            <KaTeX math="Reward = R \\times R_{circulation} \\times M" />
            <div style={{ columns: 2, columnGap: "24px" }}>
              <p style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#444", textAlign: "justify", fontFamily: serif, margin: 0 }}>
                Governs $APOL distribution for community forensic contributions — scam reports,
                verified intelligence, and threat flagging. The multiplier M scales with contribution
                quality and verification status.
              </p>
              <p style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#555", fontFamily: serif, margin: 0 }}>
                <em>R</em> = base reward rate.<br />
                <em>R<sub>circulation</sub></em> = circulating supply ratio.<br />
                <em>M</em> = contribution multiplier (quality-weighted).
              </p>
            </div>
          </div>

          <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "20px 24px" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", fontFamily: mono, marginBottom: "8px" }}>
              Definition 3 — Cognition Score (CS)
            </p>
            <KaTeX math="CS = \\frac{\\sum_{i=1}^{n} w_i \\cdot T_i}{\\sum_{i=1}^{n} w_i} \\times 100" />
            <div style={{ columns: 2, columnGap: "24px" }}>
              <p style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#444", textAlign: "justify", fontFamily: serif, margin: 0 }}>
                Evaluates whether a purported AI agent exhibits genuine autonomous behavior.
                Scores ≥71% = "Fully Autonomous"; 31–70% = "Semi-Autonomous"; ≤30% = "Digital Puppet."
              </p>
              <p style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#555", fontFamily: serif, margin: 0 }}>
                <em>T<sub>i</sub></em> = individual test score per domain.<br />
                <em>w<sub>i</sub></em> = forensic significance weight.<br />
                <em>n</em> = evaluation domains (currently 5).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PAGE 3: FORENSIC ENGINE + THREAT MATRIX ═══ */}
      <div style={{
        maxWidth: 816,
        margin: "0 auto 24px",
        background: "#ffffff",
        padding: "56px 72px",
        boxShadow: "0 1px 8px rgba(0,0,0,0.15)",
        minHeight: 1056,
      }}>
        <h3 style={{ fontSize: "11px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.12em", color: "#111", marginBottom: "4px", textAlign: "center" }}>
          IV. Forensic Framework
        </h3>
        <p style={{ fontSize: "10px", color: "#777", textAlign: "center", fontFamily: serif, marginBottom: "12px" }}>
          Analytical domain decomposition and sub-module taxonomy
        </p>

        <MermaidChart id="fig2-forensic" definition={forensicDef} />
        <p style={{ fontSize: "10px", color: "#777", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: "-8px 0 24px" }}>
          Fig. 2: APOL Forensic Engine — Complete module hierarchy.
        </p>

        <div style={{ columns: 2, columnGap: "32px", marginBottom: "32px" }}>
          <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
            <strong>Wallet Analytics</strong> encompasses transaction tracing through Base chain history, identification of
            funding sources via genesis transaction analysis, and whale concentration detection through holder distribution mapping.
          </p>
          <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
            <strong>Behavioral Logic</strong> evaluates temporal execution patterns to distinguish autonomous AI agents from
            human-operated wallets, applying timing spread analysis and round-the-clock activity verification.
          </p>
          <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
            <strong>Economic Resilience</strong> assesses structural integrity through liquidity lock verification, buy/sell tax
            analysis, and holder rank distribution to quantify rug-pull risk vectors.
          </p>
        </div>

        <div style={{ borderTop: "1px solid #ddd", paddingTop: "28px" }}>
          <h3 style={{ fontSize: "11px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.12em", color: "#111", marginBottom: "16px", textAlign: "center" }}>
            V. Threat Classification Matrix
          </h3>

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
          <p style={{ fontSize: "10px", color: "#777", textAlign: "center", fontStyle: "italic", fontFamily: serif }}>
            Table 1: Severity tiers, detection methodologies, and reversibility assessment.
          </p>
        </div>
      </div>

      {/* ═══ PAGE 4: TOKENOMICS + ARCHITECTURE ═══ */}
      <div style={{
        maxWidth: 816,
        margin: "0 auto 24px",
        background: "#ffffff",
        padding: "56px 72px",
        boxShadow: "0 1px 8px rgba(0,0,0,0.15)",
        minHeight: 1056,
      }}>
        <h3 style={{ fontSize: "11px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.12em", color: "#111", marginBottom: "16px", textAlign: "center" }}>
          VI. Tokenomics
        </h3>

        <div style={{ columns: 2, columnGap: "32px", marginBottom: "20px" }}>
          <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
            The $APOL token employs a maximally fair distribution model with zero insider allocation.
            The entire supply enters public circulation at launch with no team reserves, no marketing tax,
            and no vesting schedules. This structure eliminates sell pressure from insider unlocks and aligns
            all stakeholders from genesis.
          </p>
          <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
            The immutable 0/0 tax structure ensures that no value is extracted from trades. Liquidity is permanently
            locked or burned, verifiable on-chain, providing a non-revocable floor for market participants. The hard cap
            of 1,000,000,000 tokens prevents inflationary dilution.
          </p>
        </div>

        <TokenomicsChart />
        <p style={{ fontSize: "10px", color: "#777", textAlign: "center", fontStyle: "italic", fontFamily: serif, margin: "-4px 0 20px" }}>
          Fig. 3: $APOL Token Distribution — 100% public circulation.
        </p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: serif, fontSize: "11px", marginBottom: "32px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #111" }}>
              <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Parameter</th>
              <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Total Supply", "1,000,000,000 (Hard Capped)"],
              ["Public Circulation", "100%"],
              ["Team Reserve", "0%"],
              ["Marketing Tax", "0%"],
              ["Buy / Sell Tax", "0% / 0% (Immutable)"],
              ["Liquidity", "Burned / Locked (On-chain verifiable)"],
              ["Network", "Base (Chain ID: 8453)"],
            ].map(([param, value], i) => (
              <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "5px 10px", fontWeight: 600, color: "#222" }}>{param}</td>
                <td style={{ padding: "5px 10px", color: "#444" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: "1px solid #ddd", paddingTop: "28px" }}>
          <h3 style={{ fontSize: "11px", fontWeight: 700, fontFamily: serif, textTransform: "uppercase", letterSpacing: "0.12em", color: "#111", marginBottom: "16px", textAlign: "center" }}>
            VII. Protocol Architecture
          </h3>

          <div style={{ columns: 2, columnGap: "32px", marginBottom: "24px" }}>
            <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
              The APOL protocol operates across two complementary interfaces — a web-based forensic terminal and a Telegram
              bot — both powered by a shared backend intelligence engine. The architecture is designed for low-latency
              forensic output with minimal trust assumptions.
            </p>
            <p style={{ fontSize: "11.5px", lineHeight: 1.7, color: "#333", textAlign: "justify", fontFamily: serif, margin: "0 0 10px", textIndent: "24px" }}>
              All forensic analyses are executed server-side and cached for performance. No private keys or user wallet contents
              are ever accessed — the protocol operates exclusively on publicly available on-chain data.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
            <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "16px 18px" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#333", fontFamily: mono, marginBottom: "8px" }}>
                Core Analytic Engine
              </p>
              <ul style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#444", fontFamily: serif, paddingLeft: "16px", margin: 0 }}>
                <li><strong>Heuristic Logic Layer:</strong> Proprietary byte-code analysis to detect hidden developer "backdoors."</li>
                <li style={{ marginTop: "4px" }}><strong>Cluster Fingerprinting:</strong> Identification of multi-wallet sybil attacks and pre-launch accumulation.</li>
                <li style={{ marginTop: "4px" }}><strong>Cross-Chain Provenance:</strong> Tracing funding sources back to centralized exchanges or mixers.</li>
              </ul>
            </div>
            <div style={{ background: "#f8f8f8", border: "1px solid #e0e0e0", padding: "16px 18px" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#333", fontFamily: mono, marginBottom: "8px" }}>
                Intelligence Output
              </p>
              <ul style={{ fontSize: "10.5px", lineHeight: 1.65, color: "#444", fontFamily: serif, paddingLeft: "16px", margin: 0 }}>
                <li><strong>Automated Verdicts:</strong> Real-time generation of "Safe" vs "Larp" signals for the Telegram interface.</li>
                <li style={{ marginTop: "4px" }}><strong>Forensic Dossiers:</strong> High-fidelity PDF reports for institutional-grade project audits.</li>
                <li style={{ marginTop: "4px" }}><strong>Verified Registry:</strong> On-chain certification for projects that pass the 90+ Resilience Score.</li>
              </ul>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #ddd", marginTop: "40px", paddingTop: "20px", textAlign: "center" }}>
          <p style={{ fontSize: "9px", color: "#999", fontFamily: mono, letterSpacing: "0.06em", lineHeight: "1.8" }}>
            APOL AGENT — AUTONOMOUS ONCHAIN FORENSICS PROTOCOL<br />
            BASE NETWORK — {new Date().getFullYear()}<br />
            THIS DOCUMENT IS FOR INFORMATIONAL PURPOSES ONLY AND DOES NOT CONSTITUTE FINANCIAL ADVICE.
          </p>
        </div>
      </div>

    </div>
  );
}
