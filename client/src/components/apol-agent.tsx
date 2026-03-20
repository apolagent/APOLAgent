import { useState, useRef, useEffect } from "react";
import { X, Send, Terminal } from "lucide-react";

type Message = {
  from: "user" | "agent";
  text: string;
};

const KB: { patterns: RegExp[]; answer: string }[] = [
  {
    patterns: [/hello|hi|hey|sup|yo|gm/i],
    answer: "APOL Agent online. Query received. Ask anything about $APOL, scam reporting, or agent verification.",
  },
  {
    patterns: [/what is ape police|what('s| is) this site|about/i],
    answer: "APE POLICE is a community-operated on-chain watchdog. Functions: scam exposure, builder verification, community intelligence. Powered by the $APOL token on Base.",
  },
  {
    patterns: [/\$apol|apol token|tokenomics|supply|tax/i],
    answer: "$APOL :: Total Supply: 1,000,000,000 [HARD CAPPED] :: Buy/Sell Tax: 0% [IMMUTABLE] :: Chain: Base :: Liquidity: BURNED/LOCKED. See Network Specifications section for full data.",
  },
  {
    patterns: [/report.*(scam|fraud|rug)|scam report|how.*report/i],
    answer: "THREAT REPORTING PROTOCOL:\n[01] Navigate to Report a Scam\n[02] Run wallet scan via APE POLICE Detective Service\n[03] Flag address in community database\n[04] Submit community report with evidence",
  },
  {
    patterns: [/check.*address|address.*check|blacklist|detective/i],
    answer: "DETECTIVE SERVICE :: Enter any wallet or contract address on the Report a Scam page. Select chain (ETH, BTC, SOL, Base). Execute scan. Risk flags returned from GoPlus threat database.",
  },
  {
    patterns: [/nominate|hero|good.*dev|honest/i],
    answer: "HERO NOMINATION :: Identify verified builders contributing to ecosystem integrity. Submit nomination via Nominate a Hero. Community voting determines leaderboard placement.",
  },
  {
    patterns: [/leaderboard|ranking|top.*report|most.*report/i],
    answer: "RANKINGS :: Community-ranked scam reports and hero nominations sorted by upvote count. Access via Rankings page in navigation.",
  },
  {
    patterns: [/vote|upvote|community.*vote/i],
    answer: "VOTING :: Upvote scam reports or hero nominations on their respective pages. High-vote entries surface to leaderboard. Consensus-based threat validation.",
  },
  {
    patterns: [/join|community|telegram|channel/i],
    answer: "FIELD COMMS :: Join the APE POLICE channel via the Communications & Access section. Active threat monitoring, scam alerts, and contributor recognition.",
  },
  {
    patterns: [/roadmap|plan|future|phase/i],
    answer: "OPERATIONAL MILESTONES :: Phase 1 [COMPLETED] — token + tools. Phase 2 — Agent-LARP Detector [ACTIVE]. Phase 3 — Predictive Threat Engine. Phase 4 — Institutional API Access. See Roadmap section.",
  },
  {
    patterns: [/buy.*apol|\$apol.*buy|where.*buy|how.*buy/i],
    answer: "NETWORK ACCESS :: Click Acquire Access Key on the homepage to obtain $APOL. Execute own research before committing capital.",
  },
  {
    patterns: [/safe|trust|legit|real/i],
    answer: "APOL operates as a community intelligence layer. No financial advice issued. All data sourced from public on-chain streams. User assumes full trading responsibility.",
  },
  {
    patterns: [/rug|rugpull|scam.*type|type.*scam/i],
    answer: "KNOWN THREAT VECTORS:\n[01] Rug Pull — dev abandons + dumps\n[02] Fake Token — project impersonation\n[03] Ponzi — old investors paid by new\n[04] Phishing — wallet credential theft\n[05] Fake Airdrop — pre-payment required\n\nReport confirmed threats via Report a Scam.",
  },
  {
    patterns: [/dyor|research|how.*safe/i],
    answer: "PRE-INVESTMENT CHECKLIST:\n[01] Verify contract on block explorer\n[02] Run APE POLICE Detective scan\n[03] Confirm team identity\n[04] Check audit status\n[05] Never send crypto to receive crypto",
  },
  {
    patterns: [/help|what can you do|features|how.*work/i],
    answer: "APOL AGENT CAPABILITIES:\n[01] Site and feature navigation\n[02] Scam reporting protocol\n[03] Address scan guidance\n[04] $APOL token data\n[05] Hero nomination flow\n[06] Leaderboard and voting\n[07] Operational threat intel",
  },
  {
    patterns: [/thanks|thank you|thx|ty|appreciate/i],
    answer: "Acknowledged. Stay vigilant. If you identify a threat, report it. APOL network depends on community intelligence.",
  },
  {
    patterns: [/bye|goodbye|cya|later/i],
    answer: "Session closed. APOL Agent standing by.",
  },
];

const FALLBACK = "Query unrecognized. Try: scam reporting / address checking / $APOL data / hero nomination / leaderboard. Type 'help' for full capability list.";

function getAnswer(input: string): string {
  const trimmed = input.trim();
  for (const entry of KB) {
    if (entry.patterns.some((p) => p.test(trimmed))) return entry.answer;
  }
  return FALLBACK;
}

const QUICK_QUESTIONS = [
  "What is APE POLICE?",
  "How do I report a scam?",
  "What is $APOL?",
  "How do I nominate a hero?",
];

const G = "#00ff00";
const BG = "rgba(0,0,0,0.95)";
const BORDER = "1px solid rgba(0,255,0,0.25)";

export default function ApolAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: "agent", text: "APOL AGENT :: SYSTEM ONLINE\nIntelligence layer active. Submit query to begin." },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setMessages((prev) => [
      ...prev,
      { from: "user", text: msg },
      { from: "agent", text: getAnswer(msg) },
    ]);
    setInput("");
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid="button-apol-agent-toggle"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          width: "48px",
          height: "48px",
          borderRadius: "0",
          background: "#000",
          border: `1px solid ${G}`,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 12px rgba(0,255,0,0.3)`,
        }}
      >
        {open ? <X size={18} color={G} /> : <Terminal size={18} color={G} />}
      </button>

      {/* Chat window */}
      {open && (
        <div
          data-testid="div-apol-agent-window"
          style={{
            position: "fixed",
            bottom: "84px",
            right: "24px",
            zIndex: 9998,
            width: "360px",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "520px",
            display: "flex",
            flexDirection: "column",
            borderRadius: "0",
            overflow: "hidden",
            border: BORDER,
            background: BG,
            boxShadow: "0 0 40px rgba(0,255,0,0.1)",
          }}
        >
          {/* Header bar */}
          <div style={{
            background: "rgba(0,255,0,0.05)",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: BORDER,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Terminal size={14} color={G} />
              <span style={{ color: G, fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                APOL Agent
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "6px", height: "6px", background: G, display: "inline-block", borderRadius: "50%" }} />
              <span style={{ color: G, fontSize: "10px", letterSpacing: "0.1em" }}>ONLINE</span>
            </div>
          </div>

          {/* Message log */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  color: m.from === "agent" ? "rgba(0,255,0,0.5)" : "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                }}>
                  {m.from === "agent" ? "[APOL-AGENT]" : "[USER]"}
                </span>
                <div style={{
                  padding: "7px 10px",
                  background: "transparent",
                  border: m.from === "agent" ? `1px solid ${G}` : "1px solid rgba(255,255,255,0.25)",
                  color: m.from === "agent" ? G : "#ffffff",
                  fontSize: "12px",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {m.text}
                </div>
              </div>
            ))}

            {/* Quick queries — only at start */}
            {messages.length === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.82)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  SUGGESTED QUERIES
                </span>
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    data-testid={`button-quick-${q.replace(/\s+/g, "-").toLowerCase()}`}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(0,255,0,0.2)",
                      color: "rgba(0,255,0,0.7)",
                      fontSize: "11px",
                      padding: "5px 8px",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: "0",
                      letterSpacing: "0.03em",
                    }}
                  >
                    &gt; {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={{
            padding: "8px 10px",
            borderTop: BORDER,
            display: "flex",
            gap: "6px",
            alignItems: "center",
            background: "rgba(0,255,0,0.03)",
          }}>
            <span style={{ color: G, fontSize: "13px", flexShrink: 0 }}>&gt;</span>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="enter query..."
              data-testid="input-apol-agent"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: "1px solid rgba(0,255,0,0.2)",
                padding: "4px 0",
                color: "#ffffff",
                fontSize: "12px",
                outline: "none",
                caretColor: G,
              }}
            />
            <button
              onClick={() => send()}
              data-testid="button-apol-agent-send"
              style={{
                background: "transparent",
                border: "1px solid #ffffff",
                borderRadius: "0",
                width: "30px",
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Send size={13} color="#ffffff" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
