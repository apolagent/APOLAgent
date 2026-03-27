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

function MermaidDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const id = "mermaid-" + Date.now();
    const definition = `graph TD
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
    mermaid.render(id, definition).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    });
  }, []);
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
        labels: ["Liquidity (20%)", "Community (45%)", "Ecosystem (15%)", "Treasury (10%)", "Team (10%)"],
        datasets: [{
          data: [20, 45, 15, 10, 10],
          backgroundColor: ["#00c853", "#1b5e20", "#4caf50", "#81c784", "#a5d6a7"],
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
        </div>

        <div>
          <h2 style={sectionTitle} data-testid="heading-forensic-framework">II. FORENSIC FRAMEWORK</h2>
          <p style={bodyText}>
            The APOL Forensic Engine operates across three interdependent analytical domains. Each domain contributes weighted
            signals to the composite Risk Score and Cognition Score outputs. The hierarchical structure below illustrates
            the full analytical taxonomy:
          </p>
          <MermaidDiagram />
          <p style={{ ...bodyText, marginTop: "16px" }}>
            <strong>Wallet Analytics</strong> encompasses transaction tracing through Base chain history, identification of
            funding sources via genesis transaction analysis, and whale concentration detection through holder distribution mapping.
            <strong> Behavioral Logic</strong> evaluates temporal execution patterns to distinguish autonomous AI agents from
            human-operated wallets, applying timing spread analysis and round-the-clock activity verification.
            <strong> Economic Resilience</strong> assesses structural integrity through liquidity lock verification, buy/sell tax
            analysis, and holder rank distribution to quantify rug-pull risk vectors.
          </p>
        </div>

        <div>
          <h2 style={sectionTitle} data-testid="heading-math-modeling">III. MATHEMATICAL MODELING</h2>
          <p style={bodyText}>
            The Risk Score (RS) quantifies the probability of adversarial behavior by normalizing liquidity exposure against
            whale concentration and holder rank. A higher RS indicates greater structural resilience:
          </p>
          <KaTeX math="RS = \\frac{L_{total}}{C_{whale} \\times H_{rank}} \\times 100" />
          <p style={{ ...bodyText, fontSize: "13px", color: "#666", textAlign: "center", marginTop: "-12px", marginBottom: "28px" }}>
            Where L<sub>total</sub> = total locked liquidity, C<sub>whale</sub> = whale concentration coefficient,
            H<sub>rank</sub> = holder distribution rank index
          </p>
          <p style={bodyText}>
            The Reward function governs $APOL token distribution for community forensic contributions — scam reports,
            verified intelligence, and threat flagging:
          </p>
          <KaTeX math="Reward = R \\times R_{circulation} \\times M" />
          <p style={{ ...bodyText, fontSize: "13px", color: "#666", textAlign: "center", marginTop: "-12px", marginBottom: "28px" }}>
            Where R = base reward rate, R<sub>circulation</sub> = circulating supply ratio, M = contribution multiplier
          </p>
        </div>

        <div>
          <h2 style={sectionTitle} data-testid="heading-tokenomics">IV. TOKENOMICS</h2>
          <p style={bodyText}>
            The $APOL token allocation is structured to prioritize community ownership and long-term protocol sustainability.
            The distribution model ensures majority community control while maintaining sufficient reserves for ecosystem
            development, operational treasury, and founding team vesting:
          </p>
          <TokenomicsChart />
          <div style={{ margin: "24px 0", padding: "20px 24px", background: "#f9fbe7", border: "1px solid #e8f5e9" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'Times New Roman', serif", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #00c853" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "#111", letterSpacing: "0.08em", textTransform: "uppercase" }}>Allocation</th>
                  <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 700, color: "#111", letterSpacing: "0.08em", textTransform: "uppercase" }}>Share</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 700, color: "#111", letterSpacing: "0.08em", textTransform: "uppercase" }}>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Liquidity", "20%", "DEX pool seeding and market depth"],
                  ["Community", "45%", "Airdrops, rewards, contributor incentives"],
                  ["Ecosystem", "15%", "Partnerships, integrations, grants"],
                  ["Treasury", "10%", "Operational reserves and protocol development"],
                  ["Team", "10%", "Founding team allocation (12-month vesting)"],
                ].map(([alloc, share, purpose], i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e8f5e9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "#1b5e20" }}>{alloc}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>{share}</td>
                    <td style={{ padding: "10px 12px", color: "#555" }}>{purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
