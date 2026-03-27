import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Search, Menu, X, Copy, Check, Info, AlertTriangle, CheckCircle, ChevronRight, Home, BookOpen, Terminal, Shield, Zap, Code, FileText, Lock, Key, BarChart3, Eye, EyeOff, RefreshCw } from "lucide-react";

const ACCENT = "#00D1FF";
const sans = "'Inter', 'Segoe UI', -apple-system, sans-serif";
const mono = "'JetBrains Mono', 'Fira Code', monospace";

type SectionId = "getting-started" | "bot-commands" | "forensic-verdicts" | "security-standards" | "api" | "api-dashboard" | "security-governance";

const navSections: { id: SectionId; label: string; icon: typeof BookOpen }[] = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen },
  { id: "bot-commands", label: "Bot Commands", icon: Terminal },
  { id: "forensic-verdicts", label: "Forensic Verdicts", icon: Shield },
  { id: "security-standards", label: "Security Standards", icon: Zap },
  { id: "api", label: "API", icon: Code },
  { id: "api-dashboard", label: "API Dashboard", icon: BarChart3 },
  { id: "security-governance", label: "Security Protocol", icon: Shield },
];

const sectionOutlines: Record<SectionId, string[]> = {
  "getting-started": ["Add the Bot", "First Health Check", "Running Your First Scan", "Understanding Results"],
  "bot-commands": ["Core Commands", "Forensic Commands", "Community Commands", "Admin Commands", "Command Reference Table"],
  "forensic-verdicts": ["Verdict Overview", "Green Status", "Yellow Status", "Red Status", "Score Breakdown"],
  "security-standards": ["Heuristic Logic Scan", "On-Chain Analysis", "Behavioral Detection", "Economic Resilience"],
  "api": ["Authentication", "Endpoints", "Rate Limits", "Response Format"],
  "api-dashboard": ["Your API Key", "Usage Tracker", "Premium Access", "Authentication Header", "Scan Endpoint", "Integration Guide"],
  "security-governance": ["Privacy Commitment", "Data Handling Policy", "The Verified Standard"],
};

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ background: "#1a1d23", borderRadius: 8, margin: "16px 0", overflow: "hidden", border: "1px solid #2a2d35" }}>
      {label && (
        <div style={{ padding: "8px 16px", background: "#22252d", borderBottom: "1px solid #2a2d35", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#888", fontFamily: mono }}>{label}</span>
        </div>
      )}
      <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <code style={{ fontSize: 14, color: "#e0e0e0", fontFamily: mono, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{code}</code>
        <button
          onClick={handleCopy}
          data-testid={`button-copy-${code.slice(0, 10).replace(/[^a-z0-9]/gi, "")}`}
          style={{
            background: "transparent", border: "1px solid #3a3d45", borderRadius: 6, padding: "6px 8px",
            cursor: "pointer", color: copied ? "#4ade80" : "#888", display: "flex", alignItems: "center", gap: 4,
            fontSize: 12, fontFamily: sans, flexShrink: 0, marginLeft: 12, transition: "all 0.15s",
          }}
        >
          {copied ? <><Check style={{ width: 14, height: 14 }} /> Copied!</> : <><Copy style={{ width: 14, height: 14 }} /> Copy</>}
        </button>
      </div>
    </div>
  );
}

function Callout({ type, children }: { type: "info" | "warning" | "success"; children: React.ReactNode }) {
  const config = {
    info: { bg: "#eff8ff", border: "#b3d9ff", icon: <Info style={{ width: 18, height: 18, color: "#2563eb" }} />, color: "#1e40af" },
    warning: { bg: "#fff8ed", border: "#ffd699", icon: <AlertTriangle style={{ width: 18, height: 18, color: "#d97706" }} />, color: "#92400e" },
    success: { bg: "#f0fdf4", border: "#86efac", icon: <CheckCircle style={{ width: 18, height: 18, color: "#16a34a" }} />, color: "#166534" },
  }[type];
  return (
    <div style={{
      background: config.bg, border: `1px solid ${config.border}`, borderRadius: 8, padding: "16px 20px",
      margin: "20px 0", display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>{config.icon}</div>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: config.color, fontFamily: sans }}>{children}</div>
    </div>
  );
}

function SectionTitle({ children, id }: { children: React.ReactNode; id: string }) {
  return <h2 id={id} style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", fontFamily: sans, margin: "0 0 8px", scrollMarginTop: 80 }}>{children}</h2>;
}

function SubTitle({ children, id }: { children: React.ReactNode; id: string }) {
  return <h3 id={id} style={{ fontSize: 20, fontWeight: 600, color: "#1e293b", fontFamily: sans, margin: "36px 0 12px", scrollMarginTop: 80 }}>{children}</h3>;
}

function Para({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, lineHeight: 1.75, color: "#475569", fontFamily: sans, margin: "0 0 16px" }}>{children}</p>;
}

function GettingStarted() {
  return (
    <>
      <SectionTitle id="getting-started">Getting Started</SectionTitle>
      <Para>Welcome to the APOL Agent documentation. This guide will walk you through setting up the APOL forensic bot and running your first on-chain security scan on the Base network.</Para>

      <SubTitle id="add-the-bot">Add the Bot</SubTitle>
      <Para>APOL Agent operates as a Telegram bot. To begin, add the bot to your Telegram by searching for it or clicking the direct link below:</Para>
      <CopyBlock code="https://t.me/ApolAgentBot" label="Telegram Bot Link" />
      <Callout type="info">The bot is fully operational in Telegram groups and DMs. Add it to your project's group chat for real-time forensic monitoring.</Callout>

      <SubTitle id="first-health-check">First Health Check</SubTitle>
      <Para>Once you have added the bot, verify that it is online and responsive by running the health check command:</Para>
      <CopyBlock code="/health" label="Telegram Command" />
      <Para>If the bot is operational, it will respond with its current status, uptime, and network connection details. This confirms the forensic engine is live and ready to process requests.</Para>

      <SubTitle id="running-your-first-scan">Running Your First Scan</SubTitle>
      <Para>To scan a token contract on Base, use the /scan command followed by the contract address:</Para>
      <CopyBlock code="/scan 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" label="Example: Scan USDC on Base" />
      <Para>The bot will analyze the contract's source code, deployer wallet history, liquidity status, holder distribution, and tax configuration. Results are returned within seconds.</Para>

      <SubTitle id="understanding-results">Understanding Results</SubTitle>
      <Para>Every scan produces a structured forensic report containing a composite safety score (0 to 100), individual risk signals across on-chain, behavioral, and economic layers, and a final verdict classification. Refer to the Forensic Verdicts section for detailed status explanations.</Para>
      <Callout type="success">A score of 90 or above qualifies a project for APOL Verified certification, an on-chain badge of structural integrity.</Callout>
    </>
  );
}

function BotCommands() {
  return (
    <>
      <SectionTitle id="bot-commands">Bot Commands</SectionTitle>
      <Para>Complete reference for all APOL Agent Telegram bot commands. Commands are organized by category for quick lookup.</Para>

      <SubTitle id="core-commands">Core Commands</SubTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14, margin: "16px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Command</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["/start", "Initialize the bot and display the welcome message"],
            ["/health", "Check bot status, uptime, and network connectivity"],
            ["/help", "Display the full list of available commands"],
          ]).map(([cmd, desc], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px" }}><code style={{ fontFamily: mono, fontSize: 13, color: ACCENT, background: "#f0f9ff", padding: "2px 8px", borderRadius: 4 }}>{cmd}</code></td>
              <td style={{ padding: "10px 14px", color: "#475569" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SubTitle id="forensic-commands">Forensic Commands</SubTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14, margin: "16px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Command</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["/scan <address>", "Run a full forensic scan on a token contract"],
            ["/wallet <address>", "Analyze a wallet's transaction history and risk profile"],
            ["/larp <address>", "Detect AI agent LARP behavior via Cognition Score"],
            ["/xscan <username>", "Run social forensics on an X/Twitter account"],
            ["/deepdive <address>", "Premium: Generate a comprehensive forensic dossier"],
          ]).map(([cmd, desc], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px" }}><code style={{ fontFamily: mono, fontSize: 13, color: ACCENT, background: "#f0f9ff", padding: "2px 8px", borderRadius: 4 }}>{cmd}</code></td>
              <td style={{ padding: "10px 14px", color: "#475569" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <CopyBlock code="/scan 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" label="Example: Full Contract Scan" />
      <CopyBlock code="/wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18" label="Example: Wallet Forensics" />
      <CopyBlock code="/larp 0x1234567890abcdef1234567890abcdef12345678" label="Example: AI Agent LARP Check" />

      <SubTitle id="community-commands">Community Commands</SubTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14, margin: "16px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Command</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["/nominate <address>", "Nominate a community hero for recognition"],
            ["/report <address>", "Report a suspicious contract or wallet"],
            ["/leaderboard", "View the community contributor leaderboard"],
          ]).map(([cmd, desc], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px" }}><code style={{ fontFamily: mono, fontSize: 13, color: ACCENT, background: "#f0f9ff", padding: "2px 8px", borderRadius: 4 }}>{cmd}</code></td>
              <td style={{ padding: "10px 14px", color: "#475569" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SubTitle id="admin-commands">Admin Commands</SubTitle>
      <Callout type="warning">Admin commands are restricted to authorized wallets only. Unauthorized access attempts are logged and flagged.</Callout>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14, margin: "16px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Command</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["/verify <address>", "Manually verify a project (admin only)"],
            ["/blacklist <address>", "Add a contract to the threat blacklist"],
            ["/status", "View system metrics and scan queue depth"],
          ]).map(([cmd, desc], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px" }}><code style={{ fontFamily: mono, fontSize: 13, color: ACCENT, background: "#f0f9ff", padding: "2px 8px", borderRadius: 4 }}>{cmd}</code></td>
              <td style={{ padding: "10px 14px", color: "#475569" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SubTitle id="command-reference-table">Command Reference Table</SubTitle>
      <Para>Quick reference of all commands with their access levels and fee requirements:</Para>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14, margin: "16px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Command</th>
            <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Access</th>
            <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Fee</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["/scan", "Public", "Free"],
            ["/wallet", "Public", "Free"],
            ["/larp", "Public", "Free"],
            ["/xscan", "Public", "Free"],
            ["/deepdive", "Public", "0.005 ETH"],
            ["/nominate", "Public", "Free"],
            ["/report", "Public", "Free"],
            ["/verify", "Admin", "0.05 ETH"],
            ["/health", "Public", "Free"],
          ]).map(([cmd, access, fee], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "8px 14px" }}><code style={{ fontFamily: mono, fontSize: 13, color: ACCENT }}>{cmd}</code></td>
              <td style={{ padding: "8px 14px", textAlign: "center", color: access === "Admin" ? "#dc2626" : "#475569", fontWeight: access === "Admin" ? 600 : 400 }}>{access}</td>
              <td style={{ padding: "8px 14px", textAlign: "center", color: fee !== "Free" ? "#d97706" : "#475569" }}>{fee}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ForensicVerdicts() {
  return (
    <>
      <SectionTitle id="forensic-verdicts">Forensic Verdicts</SectionTitle>
      <Para>Every APOL scan produces a deterministic forensic verdict based on aggregated risk signals. Projects are classified into three tiers based on their composite safety score.</Para>

      <SubTitle id="verdict-overview">Verdict Overview</SubTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14, margin: "16px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Status</th>
            <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Score Range</th>
            <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Classification</th>
            <th style={{ textAlign: "left", padding: "12px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#f0fdf4" }}>
            <td style={{ padding: "12px 14px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} /> Green</span></td>
            <td style={{ padding: "12px 14px", fontFamily: mono, color: "#166534" }}>70 to 100</td>
            <td style={{ padding: "12px 14px", fontWeight: 600, color: "#166534" }}>LOW RISK</td>
            <td style={{ padding: "12px 14px", color: "#475569" }}>Safe for standard interaction</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#fff8ed" }}>
            <td style={{ padding: "12px 14px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#eab308", display: "inline-block" }} /> Yellow</span></td>
            <td style={{ padding: "12px 14px", fontFamily: mono, color: "#92400e" }}>40 to 69</td>
            <td style={{ padding: "12px 14px", fontWeight: 600, color: "#92400e" }}>ELEVATED RISK</td>
            <td style={{ padding: "12px 14px", color: "#475569" }}>Proceed with caution; review flagged signals</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #f1f5f9", background: "#fef2f2" }}>
            <td style={{ padding: "12px 14px" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} /> Red</span></td>
            <td style={{ padding: "12px 14px", fontFamily: mono, color: "#991b1b" }}>0 to 39</td>
            <td style={{ padding: "12px 14px", fontWeight: 600, color: "#991b1b" }}>CRITICAL THREAT</td>
            <td style={{ padding: "12px 14px", color: "#475569" }}>Avoid interaction; active threat advisory</td>
          </tr>
        </tbody>
      </table>

      <SubTitle id="green-status">Green Status (70 to 100)</SubTitle>
      <Para>Projects in the green tier have passed all major forensic checks. Liquidity is locked or burned, holder distribution is healthy, no honeypot patterns detected, and the deployer wallet has a clean provenance trail. Projects scoring 90+ are eligible for APOL Verified certification.</Para>
      <Callout type="success">Green does not mean zero risk. It means no critical or high-severity threats were detected by the forensic engine at the time of scan. Always DYOR.</Callout>

      <SubTitle id="yellow-status">Yellow Status (40 to 69)</SubTitle>
      <Para>Yellow tier projects exhibit one or more elevated risk signals that warrant additional scrutiny. Common triggers include partially locked liquidity, moderate whale concentration, unverified deployer history, or elevated buy/sell taxes. These projects are not necessarily malicious but carry structural risks.</Para>
      <Callout type="warning">Yellow-status projects may transition to Red if conditions deteriorate (e.g., liquidity unlocks, whale accumulation increases).</Callout>

      <SubTitle id="red-status">Red Status (0 to 39)</SubTitle>
      <Para>Red tier projects have triggered one or more critical threat signals. This includes confirmed honeypot contracts, hidden mint functions, rug-pull patterns (unlocked LP with high whale concentration), or deployer wallets linked to known scam clusters. An active threat advisory is issued for all red-status projects.</Para>
      <Callout type="info">Red status is deterministic and irreversible for a given contract state. If the underlying on-chain conditions change (e.g., liquidity is locked), a re-scan will produce an updated score.</Callout>

      <SubTitle id="score-breakdown">Score Breakdown</SubTitle>
      <Para>The composite score is derived from three weighted layers:</Para>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14, margin: "16px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Layer</th>
            <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Weight</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Evaluates</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["On-Chain", "40%", "Contract code, deployer history, funding provenance"],
            ["Economic", "35%", "Liquidity locks, holder distribution, tax configuration"],
            ["Behavioral", "25%", "Timing patterns, autonomy signals, narrative consistency"],
          ]).map(([layer, weight, evaluates], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0f172a" }}>{layer}</td>
              <td style={{ padding: "10px 14px", textAlign: "center", fontFamily: mono, color: ACCENT }}>{weight}</td>
              <td style={{ padding: "10px 14px", color: "#475569" }}>{evaluates}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function SecurityStandards() {
  return (
    <>
      <SectionTitle id="security-standards">Security Standards</SectionTitle>
      <Para>APOL Agent employs a multi-layered forensic methodology to evaluate project integrity. Each layer runs independently, producing isolated risk signals that are aggregated into the final composite score.</Para>

      <SubTitle id="heuristic-logic-scan">Heuristic Logic Scan</SubTitle>
      <Para>The heuristic engine performs static and dynamic analysis on smart contract bytecode to detect known malicious patterns. This includes sell-blocking honeypot detection, hidden owner-only mint functions, proxy contract obfuscation, and self-destruct capabilities.</Para>
      <CopyBlock code={`Heuristic Checks:\n  - Sell Simulation: Attempts to execute a sell transaction\n  - Bytecode Pattern Matching: Scans for known exploit signatures\n  - Owner Privilege Audit: Enumerates owner-callable functions\n  - Proxy Detection: Identifies upgradeable contract patterns`} label="Heuristic Analysis Pipeline" />
      <Callout type="info">The heuristic engine updates its signature database continuously. New exploit patterns discovered in the wild are integrated within 24 hours.</Callout>

      <SubTitle id="on-chain-analysis">On-Chain Analysis</SubTitle>
      <Para>The on-chain layer traces the deployer wallet's transaction history back to its funding source. This process identifies connections to known scam clusters, centralized exchange withdrawals, bridge transactions, and mixer usage. The engine traces up to 10 levels of transaction depth.</Para>
      <CopyBlock code={`Deployer Analysis:\n  - Genesis Transaction: First funding source\n  - Wallet Age: Account creation timestamp\n  - Transaction Count: Historical activity volume\n  - Connected Wallets: Graph analysis of related addresses\n  - Cluster Membership: Known scam network detection`} label="Deployer Provenance Check" />

      <SubTitle id="behavioral-detection">Behavioral Detection</SubTitle>
      <Para>For projects claiming AI agent autonomy, the behavioral layer evaluates execution timing patterns, response consistency, and 24/7 operational evidence. The Cognition Score (CS) quantifies genuine autonomy on a 0 to 100 scale:</Para>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14, margin: "16px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>CS Range</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Classification</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["71 to 100", "Fully Autonomous"],
            ["31 to 70", "Semi-Autonomous"],
            ["0 to 30", "Digital Puppet (LARP)"],
          ]).map(([range, cls], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px", fontFamily: mono, color: "#0f172a" }}>{range}</td>
              <td style={{ padding: "10px 14px", color: "#475569" }}>{cls}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Callout type="warning">A low Cognition Score does not necessarily indicate malicious intent. It indicates that the project's claims of AI autonomy are not supported by on-chain evidence.</Callout>

      <SubTitle id="economic-resilience">Economic Resilience</SubTitle>
      <Para>The economic layer quantifies structural integrity through liquidity analysis, holder distribution mapping, and tax configuration verification. Key metrics include:</Para>
      <CopyBlock code={`Economic Metrics:\n  - Liquidity Lock Status: Locked / Burned / Unlocked\n  - Lock Duration: Time remaining on LP lock\n  - Whale Concentration Ratio: Top 10 holder % of supply\n  - Buy Tax: Percentage taken on purchase\n  - Sell Tax: Percentage taken on sale\n  - Holder Count: Total unique token holders`} label="Economic Layer Outputs" />
    </>
  );
}

function ApiDocs() {
  return (
    <>
      <SectionTitle id="api">API</SectionTitle>
      <Para>The APOL Agent API provides programmatic access to forensic scanning capabilities. The API is RESTful and returns JSON responses.</Para>

      <SubTitle id="authentication">Authentication</SubTitle>
      <Para>API access requires an API key passed via the X-API-Key header. Keys are available to $APOL token holders through the verification portal.</Para>
      <CopyBlock code={`curl -X GET "https://apepolice.online/api/scan/0x..." \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -H "Content-Type: application/json"`} label="Authentication Header" />

      <SubTitle id="endpoints">Endpoints</SubTitle>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14, margin: "16px 0" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Method</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Endpoint</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "#0f172a", fontSize: 13 }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {([
            ["GET", "/api/scan/:address", "Full forensic scan of a token contract"],
            ["GET", "/api/wallet/:address", "Wallet risk profile and history"],
            ["GET", "/api/verified", "List all APOL-verified projects"],
            ["GET", "/api/health", "API status and uptime"],
          ]).map(([method, endpoint, desc], i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "10px 14px" }}><code style={{ fontFamily: mono, fontSize: 12, color: "#16a34a", background: "#f0fdf4", padding: "2px 8px", borderRadius: 4 }}>{method}</code></td>
              <td style={{ padding: "10px 14px" }}><code style={{ fontFamily: mono, fontSize: 13, color: ACCENT }}>{endpoint}</code></td>
              <td style={{ padding: "10px 14px", color: "#475569" }}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <SubTitle id="rate-limits">Rate Limits</SubTitle>
      <Para>API requests are rate-limited to prevent abuse. Standard tier allows 60 requests per minute. Premium tier (holders of 100,000+ $APOL) allows 300 requests per minute.</Para>
      <Callout type="info">Rate limit headers (X-RateLimit-Remaining, X-RateLimit-Reset) are included in every API response.</Callout>

      <SubTitle id="response-format">Response Format</SubTitle>
      <CopyBlock code={`{\n  "status": "success",\n  "data": {\n    "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",\n    "name": "USD Coin",\n    "symbol": "USDC",\n    "score": 95,\n    "verdict": "LOW_RISK",\n    "signals": {\n      "honeypot": false,\n      "mintable": false,\n      "lpLocked": true,\n      "whaleConcentration": 0.12\n    },\n    "scannedAt": "2026-03-27T21:00:00Z"\n  }\n}`} label="Example Response: /api/scan/:address" />
    </>
  );
}

function ApiDashboard() {
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyGenerated, setKeyGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const demoKey = "apol_sk_live_7f3a9b2e1d4c8f5a6b0e2d9c4a7f1b3e";
  const usedScans = 5;
  const totalScans = 100;
  const usagePercent = (usedScans / totalScans) * 100;

  const handleGenerate = () => {
    setKeyGenerated(true);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(demoKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <SectionTitle id="api-dashboard">API Management Dashboard</SectionTitle>
      <Para>Manage your API credentials, monitor usage, and unlock premium forensic capabilities from a single dashboard.</Para>

      <SubTitle id="your-api-key">Your API Key</SubTitle>
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
        padding: 28, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Key style={{ width: 20, height: 20, color: ACCENT }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", fontFamily: sans }}>Your API Key</span>
        </div>
        {!keyGenerated ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <Para>Generate an API key to start making forensic scan requests programmatically.</Para>
            <button
              onClick={handleGenerate}
              data-testid="button-generate-key"
              style={{
                background: ACCENT, color: "#fff", border: "none", borderRadius: 8,
                padding: "12px 28px", fontSize: 14, fontWeight: 600, fontFamily: sans,
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              }}
            >
              <RefreshCw style={{ width: 16, height: 16 }} />
              Generate API Key
            </button>
          </div>
        ) : (
          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#1a1d23", borderRadius: 8, padding: "14px 16px",
            }}>
              <code
                data-testid="text-api-key"
                style={{
                  flex: 1, fontSize: 14, fontFamily: mono, letterSpacing: "0.02em",
                  color: keyVisible ? "#e0e0e0" : "transparent",
                  textShadow: keyVisible ? "none" : "0 0 8px rgba(255,255,255,0.5)",
                  userSelect: keyVisible ? "text" : "none",
                }}
              >
                {demoKey}
              </code>
              <button
                onClick={() => setKeyVisible(!keyVisible)}
                data-testid="button-toggle-key-visibility"
                style={{
                  background: "transparent", border: "1px solid #3a3d45", borderRadius: 6,
                  padding: "6px 8px", cursor: "pointer", color: "#888", display: "flex",
                  alignItems: "center", gap: 4, fontSize: 12, fontFamily: sans,
                }}
              >
                {keyVisible ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
                {keyVisible ? "Hide" : "Reveal"}
              </button>
              <button
                onClick={handleCopyKey}
                data-testid="button-copy-api-key"
                style={{
                  background: "transparent", border: "1px solid #3a3d45", borderRadius: 6,
                  padding: "6px 8px", cursor: "pointer",
                  color: copied ? "#4ade80" : "#888",
                  display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: sans,
                }}
              >
                {copied ? <><Check style={{ width: 14, height: 14 }} /> Copied!</> : <><Copy style={{ width: 14, height: 14 }} /> Copy</>}
              </button>
            </div>
            <Callout type="warning">Keep your API key secret. Do not expose it in frontend code or public repositories.</Callout>
          </div>
        )}
      </div>

      <SubTitle id="usage-tracker">Usage Tracker</SubTitle>
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
        padding: 28, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BarChart3 style={{ width: 20, height: 20, color: ACCENT }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", fontFamily: sans }}>Request Credits</span>
          </div>
          <span style={{ fontSize: 13, color: "#64748b", fontFamily: sans }}>Resets monthly</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: "#0f172a", fontFamily: sans }}>{usedScans}</span>
          <span style={{ fontSize: 16, color: "#94a3b8", fontFamily: sans }}>/ {totalScans} scans used</span>
        </div>
        <div style={{
          width: "100%", height: 12, background: "#f1f5f9", borderRadius: 6, overflow: "hidden", marginBottom: 12,
        }}>
          <div
            data-testid="progress-usage"
            style={{
              width: `${usagePercent}%`, height: "100%",
              background: `linear-gradient(90deg, ${ACCENT}, #0ea5e9)`,
              borderRadius: 6, transition: "width 0.5s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#64748b", fontFamily: sans }}>
            Free Tier: {usedScans}/{totalScans} scans used
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: ACCENT, fontFamily: mono,
            background: "#f0f9ff", padding: "4px 10px", borderRadius: 4,
          }}>
            {totalScans - usedScans} remaining
          </span>
        </div>
      </div>

      <SubTitle id="premium-access">Premium Access</SubTitle>
      <div style={{
        background: "linear-gradient(135deg, #0c1220 0%, #1a1d2e 100%)",
        border: "1px solid #2a2d45", borderRadius: 12,
        padding: 32, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -40, right: -40, width: 160, height: 160,
          background: `radial-gradient(circle, ${ACCENT}15 0%, transparent 70%)`,
          borderRadius: "50%",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT}30, ${ACCENT}10)`,
              border: `1px solid ${ACCENT}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Lock style={{ width: 22, height: 22, color: ACCENT }} />
            </div>
            <div>
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: ACCENT, fontFamily: mono,
              }}>Premium</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: sans, margin: 0 }}>
                Unlock Unlimited Forensic API Access
              </p>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <ul style={{ fontSize: 14, lineHeight: 2, color: "#94a3b8", fontFamily: sans, paddingLeft: 20, margin: 0 }}>
              <li>Unlimited scan requests (no monthly cap)</li>
              <li>Priority queue processing</li>
              <li>Deep Dive forensic dossiers via API</li>
              <li>Webhook notifications for monitored contracts</li>
              <li>Batch scanning (up to 50 addresses per request)</li>
            </ul>
          </div>
          <button
            data-testid="button-upgrade-premium"
            style={{
              width: "100%", padding: "14px 24px",
              background: `linear-gradient(135deg, ${ACCENT}, #0ea5e9)`,
              border: "none", borderRadius: 8, cursor: "pointer",
              fontSize: 15, fontWeight: 700, color: "#fff", fontFamily: sans,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: `0 4px 16px ${ACCENT}40`,
            }}
          >
            <Lock style={{ width: 16, height: 16 }} />
            Hold 100,000 $APOL to Upgrade
          </button>
          <p style={{ fontSize: 11, color: "#4a5568", textAlign: "center", fontFamily: sans, margin: "12px 0 0" }}>
            Token balance is verified on-chain via the Base network
          </p>
        </div>
      </div>

      <div style={{ margin: "48px 0 0", padding: "40px 0 0", borderTop: "1px solid #e5e7eb" }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", fontFamily: sans, margin: "0 0 8px" }}>Endpoints & Integration</h2>
        <Para>Technical reference for integrating APOL forensic scanning into your applications.</Para>
      </div>

      <SubTitle id="authentication-header">Authentication Header</SubTitle>
      <Para>All authenticated requests must include your API key in the request header. Pass the key using the X-APOL-AUTH header on every request:</Para>
      <CopyBlock code="X-APOL-AUTH: YOUR_API_KEY" label="Header" />
      <Callout type="info">Replace YOUR_API_KEY with the key generated from the dashboard above. Keys are prefixed with apol_sk_live_ for production access.</Callout>

      <SubTitle id="scan-endpoint">Scan Endpoint</SubTitle>
      <Para>The primary forensic endpoint accepts a contract address and returns a full risk assessment with composite scoring, individual signals, and a final verdict.</Para>
      <div style={{ marginBottom: 8 }}>
        <span style={{
          display: "inline-block", fontSize: 11, fontWeight: 700, fontFamily: mono,
          color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0",
          padding: "2px 10px", borderRadius: 4, marginBottom: 8,
        }}>GET</span>
        <code style={{ fontSize: 14, fontFamily: mono, color: ACCENT, marginLeft: 8 }}>/v1/scan</code>
      </div>
      <CopyBlock code="curl https://api.apolagent.io/v1/scan?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 \\\n  -H &quot;X-APOL-AUTH: apol_sk_live_7f3a9b2e1d4c...&quot;" label="Request" />
      <CopyBlock code={`{
  "status": "success",
  "resilience_score": 88,
  "verdict": "Low Risk",
  "flags": ["Contract Verified", "Liquidity Locked"]
}`} label="Response (200 OK)" />
      <Para>The response includes the composite resilience_score (0 to 100), a human-readable verdict string, and an array of detected flags. Premium holders receive additional fields including cluster_id and creator_provenance.</Para>

      <SubTitle id="integration-guide">Integration Guide</SubTitle>
      <Para>To integrate APOL into your own dApp or Trading Bot, simply call our REST API. Premium holders (50k+ $APOL) receive priority bandwidth and deeper forensic metadata, including Cluster-ID and Creator-Provenance data.</Para>
      <CopyBlock code={`// Example: Node.js Integration
const response = await fetch(
  "https://api.apolagent.io/v1/scan?address=" + contractAddress,
  {
    headers: {
      "X-APOL-AUTH": process.env.APOL_API_KEY,
      "Content-Type": "application/json"
    }
  }
);

const data = await response.json();

if (data.resilience_score < 40) {
  console.warn("CRITICAL THREAT detected:", data.verdict);
  // Block interaction or alert user
}

if (data.resilience_score >= 90) {
  console.log("Project is APOL Verified:", data.flags);
  // Safe to proceed
}`} label="Node.js" />
      <CopyBlock code={`# Example: Python Integration
import requests

headers = {"X-APOL-AUTH": "apol_sk_live_YOUR_KEY"}
url = f"https://api.apolagent.io/v1/scan?address={contract_address}"

response = requests.get(url, headers=headers)
data = response.json()

if data["resilience_score"] < 40:
    print(f"THREAT: {data['verdict']}")
elif data["resilience_score"] >= 90:
    print(f"VERIFIED: {data['flags']}")`} label="Python" />
      <Callout type="success">Premium API responses include additional forensic metadata: cluster_id (linked wallet group identifier), creator_provenance (funding source chain), and whale_map (top 10 holder breakdown with wallet ages).</Callout>
    </>
  );
}

function SecurityGovernance() {
  return (
    <>
      <SectionTitle id="security-governance">Security & Data Governance</SectionTitle>
      <Para>APOL Agent is built on a principle of radical transparency and zero-trust architecture. This section details our commitments to user privacy, data handling integrity, and the verification standards that govern the APOL ecosystem.</Para>

      <SubTitle id="privacy-commitment">Privacy Commitment</SubTitle>
      <div style={{
        background: "linear-gradient(135deg, #0c1220 0%, #111827 100%)",
        border: `1px solid ${ACCENT}30`, borderRadius: 12,
        padding: 32, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -30, left: -30, width: 120, height: 120,
          background: `radial-gradient(circle, ${ACCENT}12 0%, transparent 70%)`, borderRadius: "50%",
        }} />
        <div style={{ position: "relative", display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${ACCENT}25, ${ACCENT}08)`,
            border: `1px solid ${ACCENT}35`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Shield style={{ width: 24, height: 24, color: ACCENT }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: ACCENT, fontFamily: mono, margin: "0 0 10px" }}>Zero-Access Architecture</p>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#e2e8f0", fontFamily: sans, margin: 0 }}>
              APOL Agent operates on a Zero-Access architecture. We never request private keys, seed phrases, or wallet signatures. All forensic data is pulled exclusively from public on-chain ledgers.
            </p>
          </div>
        </div>
      </div>

      <SubTitle id="data-handling-policy">Data Handling Policy</SubTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
          padding: "24px 28px", display: "flex", gap: 16, alignItems: "flex-start",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8, flexShrink: 0,
            background: `${ACCENT}10`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap style={{ width: 20, height: 20, color: ACCENT }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", fontFamily: sans, margin: "0 0 6px" }}>Server-Side Execution</p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#475569", fontFamily: sans, margin: 0 }}>
              All heavy lifting is done on our secure forensic servers to ensure user device safety. No contract bytecode is ever executed client-side, and all analysis runs in isolated sandboxed environments.
            </p>
          </div>
        </div>
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
          padding: "24px 28px", display: "flex", gap: 16, alignItems: "flex-start",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8, flexShrink: 0,
            background: `${ACCENT}10`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <RefreshCw style={{ width: 20, height: 20, color: ACCENT }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", fontFamily: sans, margin: "0 0 6px" }}>Cached Intelligence</p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#475569", fontFamily: sans, margin: 0 }}>
              Scan results are cached for 60 seconds to provide real-time speed while reducing blockchain congestion. Subsequent requests for the same contract within the cache window return instant results with zero RPC overhead.
            </p>
          </div>
        </div>
        <div style={{
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
          padding: "24px 28px", display: "flex", gap: 16, alignItems: "flex-start",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8, flexShrink: 0,
            background: `${ACCENT}10`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <EyeOff style={{ width: 20, height: 20, color: ACCENT }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", fontFamily: sans, margin: "0 0 6px" }}>No Tracking</p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: "#475569", fontFamily: sans, margin: 0 }}>
              We do not link Telegram IDs to specific wallet addresses in our public database. Your privacy is a forensic priority. Scan requests are processed statelessly with no persistent user-to-address mapping.
            </p>
          </div>
        </div>
      </div>

      <SubTitle id="the-verified-standard">The Verified Standard</SubTitle>
      <div style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
        padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: `linear-gradient(135deg, ${ACCENT}, #0ea5e9)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 4px 12px ${ACCENT}40`,
          }}>
            <CheckCircle style={{ width: 24, height: 24, color: "#fff" }} />
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: ACCENT, fontFamily: mono, margin: 0 }}>Golden Checkmark</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontFamily: sans, margin: 0 }}>APOL Verified Standard</p>
          </div>
        </div>
        <Para>Projects only receive an APOL Verified status if they pass our 3-tier check:</Para>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "20px 0" }}>
          {([
            ["HoneyPot Resistance", "Contract must pass sell simulation with zero blocking mechanisms. No hidden transfer restrictions, blacklist functions, or conditional revert logic detected in bytecode."],
            ["Liquidity Lock (Minimum 6 months)", "Liquidity pool tokens must be locked or burned with a minimum duration of 6 months. Lock must be verifiable on-chain through a recognized locker contract."],
            ["Cluster-Free Top Holders", "The top 10 non-contract holders must not belong to the same wallet cluster. No circular funding patterns, shared genesis transactions, or coordinated accumulation detected."],
          ]).map(([title, desc], i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: ACCENT, fontFamily: mono,
              }}>{i + 1}</div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", fontFamily: sans, margin: "0 0 4px" }}>{title}</p>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#475569", fontFamily: sans, margin: 0 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <Callout type="success">Projects that maintain Verified status for 90+ consecutive days are eligible for the APOL Sentinel tier, which includes enhanced visibility in the Verified Builders registry and priority forensic monitoring.</Callout>
      </div>
    </>
  );
}

const sectionComponents: Record<SectionId, () => JSX.Element> = {
  "getting-started": GettingStarted,
  "bot-commands": BotCommands,
  "forensic-verdicts": ForensicVerdicts,
  "security-standards": SecurityStandards,
  "api": ApiDocs,
  "api-dashboard": ApiDashboard,
  "security-governance": SecurityGovernance,
};

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function Docs() {
  const initialSection = (() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("section");
    if (s && navSections.some(n => n.id === s)) return s as SectionId;
    return "getting-started" as SectionId;
  })();
  const [activeSection, setActiveSection] = useState<SectionId>(initialSection);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeOutlineItem, setActiveOutlineItem] = useState("");
  const mainRef = useRef<HTMLDivElement>(null);

  const filteredNav = navSections.filter(s =>
    s.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const ActiveContent = sectionComponents[activeSection];
  const outlineItems = sectionOutlines[activeSection];

  const handleNavClick = useCallback((id: SectionId) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => {
      const items = outlineItems.map(item => document.getElementById(slugify(item)));
      const scrollTop = el.scrollTop + 100;
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i] && items[i]!.offsetTop - el.offsetTop <= scrollTop) {
          setActiveOutlineItem(slugify(outlineItems[i]));
          return;
        }
      }
      if (outlineItems.length > 0) setActiveOutlineItem(slugify(outlineItems[0]));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeSection, outlineItems]);

  const scrollToOutlineItem = (label: string) => {
    const el = document.getElementById(slugify(label));
    if (el && mainRef.current) {
      mainRef.current.scrollTo({ top: el.offsetTop - mainRef.current.offsetTop - 40, behavior: "smooth" });
    }
  };

  const breadcrumb = navSections.find(s => s.id === activeSection)?.label || "";

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#fff", fontFamily: sans }}>
      <style>{`
        .docs-sidebar::-webkit-scrollbar { width: 4px; }
        .docs-sidebar::-webkit-scrollbar-track { background: transparent; }
        .docs-sidebar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
        .docs-main::-webkit-scrollbar { width: 6px; }
        .docs-main::-webkit-scrollbar-track { background: #fafafa; }
        .docs-main::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        .docs-main::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
        .docs-nav-item { transition: all 0.15s ease; }
        .docs-nav-item:hover { background: #f0f9ff !important; color: ${ACCENT} !important; }
        .docs-outline-link { transition: color 0.15s ease; }
        .docs-outline-link:hover { color: ${ACCENT} !important; }
        @media (max-width: 1024px) {
          .docs-right-sidebar { display: none !important; }
        }
        @media (max-width: 768px) {
          .docs-left-sidebar { display: none !important; }
          .docs-left-sidebar.mobile-open { display: flex !important; position: fixed !important; z-index: 50 !important; top: 0 !important; left: 0 !important; bottom: 0 !important; width: 280px !important; box-shadow: 4px 0 24px rgba(0,0,0,0.1); }
          .docs-mobile-overlay { display: block !important; }
        }
      `}</style>

      {mobileMenuOpen && (
        <div
          className="docs-mobile-overlay"
          style={{ display: "none", position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={`docs-left-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}
        style={{
          width: 260, minWidth: 260, height: "100%", overflowY: "auto",
          background: "#fafbfc", borderRight: "1px solid #e5e7eb",
          display: "flex", flexDirection: "column", position: "relative",
        }}
      >
        <div style={{ padding: "20px 20px 12px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <img src="/apol-agent-logo.png" alt="APOL" style={{ width: 32, height: 32, borderRadius: "50%" }} data-testid="link-docs-home" />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", fontFamily: sans }}>APOL Docs</span>
          </Link>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div data-testid="button-back-home" style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 12px", marginBottom: 12,
              background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 6,
              cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#475569", fontFamily: sans,
            }}>
              <Home style={{ width: 14, height: 14, color: ACCENT }} />
              Back to Home
            </div>
          </Link>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="input-search-docs"
              style={{
                width: "100%", padding: "8px 12px 8px 34px", fontSize: 13, fontFamily: sans,
                border: "1px solid #e2e8f0", borderRadius: 8, outline: "none", background: "#fff",
                color: "#334155", boxSizing: "border-box",
              }}
            />
          </div>
        </div>
        <div className="docs-sidebar" style={{ flex: 1, overflowY: "auto", padding: "12px 12px" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", padding: "8px 8px 4px", margin: 0 }}>Documentation</p>
          {filteredNav.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => handleNavClick(s.id)}
                className="docs-nav-item"
                data-testid={`button-nav-${s.id}`}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                  background: activeSection === s.id ? "#e0f2fe" : "transparent",
                  border: "none", borderRadius: 6, padding: "10px 12px", cursor: "pointer",
                  fontSize: 14, fontWeight: activeSection === s.id ? 600 : 400, fontFamily: sans,
                  color: activeSection === s.id ? ACCENT : "#475569",
                  marginBottom: 2,
                }}
              >
                <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                {s.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e7eb", flexShrink: 0 }}>
          <Link href="/whitepaper" style={{ fontSize: 12, color: "#94a3b8", textDecoration: "none", fontFamily: sans, display: "flex", alignItems: "center", gap: 6 }}>
            <FileText style={{ width: 14, height: 14 }} /> Whitepaper
          </Link>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, height: "100%", overflow: "hidden", position: "absolute", top: 0, left: 260, right: 0, bottom: 0 }}>
        <div
          ref={mainRef}
          className="docs-main"
          style={{ flex: 1, overflowY: "auto", padding: "32px 48px 80px" }}
        >
          <div style={{ maxWidth: 780 }}>
            <div style={{ display: "none" }} className="docs-mobile-toggle">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: "none", border: "none", cursor: "pointer", padding: 8 }}>
                {mobileMenuOpen ? <X style={{ width: 24, height: 24 }} /> : <Menu style={{ width: 24, height: 24 }} />}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13, color: "#94a3b8", fontFamily: sans }}>
              <Link href="/docs" style={{ color: "#94a3b8", textDecoration: "none" }} data-testid="breadcrumb-docs">Docs</Link>
              <ChevronRight style={{ width: 14, height: 14 }} />
              <span style={{ color: "#475569" }} data-testid="breadcrumb-current">{breadcrumb}</span>
            </div>

            <ActiveContent />

            <div style={{ marginTop: 60, padding: "24px 0", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between" }}>
              {navSections.findIndex(s => s.id === activeSection) > 0 && (
                <button
                  onClick={() => handleNavClick(navSections[navSections.findIndex(s => s.id === activeSection) - 1].id)}
                  data-testid="button-prev-page"
                  style={{
                    background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 20px",
                    cursor: "pointer", fontSize: 14, color: "#475569", fontFamily: sans,
                  }}
                >
                  Previous: {navSections[navSections.findIndex(s => s.id === activeSection) - 1].label}
                </button>
              )}
              <div style={{ flex: 1 }} />
              {navSections.findIndex(s => s.id === activeSection) < navSections.length - 1 && (
                <button
                  onClick={() => handleNavClick(navSections[navSections.findIndex(s => s.id === activeSection) + 1].id)}
                  data-testid="button-next-page"
                  style={{
                    background: ACCENT, border: "none", borderRadius: 8, padding: "12px 20px",
                    cursor: "pointer", fontSize: 14, color: "#fff", fontWeight: 600, fontFamily: sans,
                  }}
                >
                  Next: {navSections[navSections.findIndex(s => s.id === activeSection) + 1].label}
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          className="docs-right-sidebar"
          style={{
            width: 200, minWidth: 200, padding: "32px 16px", borderLeft: "1px solid #e5e7eb",
            overflowY: "auto", flexShrink: 0,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 12px" }}>On this page</p>
          {outlineItems.map((item, i) => {
            const id = slugify(item);
            return (
              <button
                key={i}
                onClick={() => scrollToOutlineItem(item)}
                className="docs-outline-link"
                data-testid={`button-outline-${id}`}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "none", border: "none",
                  borderLeft: activeOutlineItem === id ? `2px solid ${ACCENT}` : "2px solid transparent",
                  padding: "5px 12px", marginBottom: 2,
                  fontSize: 13, fontFamily: sans, fontWeight: 400,
                  color: activeOutlineItem === id ? ACCENT : "#64748b",
                  cursor: "pointer", lineHeight: 1.6,
                }}
              >{item}</button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        data-testid="button-mobile-menu"
        style={{
          display: "none", position: "fixed", top: 12, left: 12, zIndex: 30,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
          padding: 8, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
        className="docs-mobile-toggle-btn"
      >
        {mobileMenuOpen ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
      </button>

      <style>{`
        @media (max-width: 768px) {
          .docs-mobile-toggle-btn { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
