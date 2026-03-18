import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot } from "lucide-react";

type Message = {
  from: "user" | "agent";
  text: string;
};

const KB: { patterns: RegExp[]; answer: string }[] = [
  {
    patterns: [/hello|hi|hey|sup|yo|gm/i],
    answer: "👋 GM, officer! I'm APOL Agent — your guide to the APE POLICE jungle. Ask me anything about the site, $APOL token, or how to fight crypto scams!",
  },
  {
    patterns: [/what is ape police|what('s| is) this site|about/i],
    answer: "🦍 APE POLICE is a community-powered crypto watchdog. We expose scams, celebrate honest builders, and protect the jungle with memes and morals. Powered by the $APOL token.",
  },
  {
    patterns: [/\$apol|apol token|tokenomics|supply|tax/i],
    answer: "🪙 $APOL is the APE POLICE meme token. Total supply: 1,000,000,000. Buy/sell tax: 0%. It's the badge of honor for crypto justice enforcers. Check the Tokenomics section on the homepage for full details!",
  },
  {
    patterns: [/report.*(scam|fraud|rug)|scam report|how.*report/i],
    answer: "🚨 To report a scam:\n1. Click **Report a Scam** in the navigation or channel section\n2. Use **Check Address** to scan any wallet with the APE POLICE Detective Service\n3. Use **Report Address** to flag it in our database\n4. Submit a **Community Report** to warn the APE POLICE community directly",
  },
  {
    patterns: [/check.*address|address.*check|blacklist|detective/i],
    answer: "🔍 The address checker is on the Report a Scam page. Enter any blockchain wallet or contract address, select the chain (ETH, BTC, SOL, Base, etc.) and hit Check. The APE POLICE Detective Service scans it for known risks and flags.",
  },
  {
    patterns: [/nominate|hero|good.*dev|honest/i],
    answer: "🏆 Know an honest dev, influencer, or project making crypto better? Nominate them as a hero! Go to **Nominate a Hero** in the nav. The community votes on nominations and top heroes appear on the leaderboard.",
  },
  {
    patterns: [/leaderboard|ranking|top.*report|most.*report/i],
    answer: "📊 The Rankings page shows the top scam reports and hero nominations voted on by the community. The more upvotes a report gets, the higher it ranks. Check it out in the navigation!",
  },
  {
    patterns: [/vote|upvote|community.*vote/i],
    answer: "👍 You can upvote any scam report or hero nomination on their respective pages. The most-voted entries rise to the top of the leaderboard. It's community justice in action!",
  },
  {
    patterns: [/join|community|telegram|channel/i],
    answer: "🔗 Join the APE POLICE channel to be part of the community! Look for the **Join the Channel** button in the channel section on the homepage. We discuss shady projects, call out frauds, and spotlight trusted builders.",
  },
  {
    patterns: [/roadmap|plan|future|phase/i],
    answer: "🗺️ The APE POLICE roadmap has multiple phases — from launching the token and community tools to expanding the watchdog platform and awarding crypto heroes. Scroll to the Roadmap section on the homepage to see all phases!",
  },
  {
    patterns: [/buy.*apol|\$apol.*buy|where.*buy|how.*buy/i],
    answer: "💰 Click the **Buy $APOL** button on the homepage to get your $APOL tokens. Always DYOR (Do Your Own Research) and never invest more than you can afford to lose!",
  },
  {
    patterns: [/safe|trust|legit|real/i],
    answer: "✅ APE POLICE is community-driven and transparent. We don't give financial advice — just viral justice and jungle protection. Always DYOR before investing in anything!",
  },
  {
    patterns: [/rug|rugpull|scam.*type|type.*scam/i],
    answer: "⚠️ Common crypto scam types we track:\n• Rug Pulls — dev abandons + dumps tokens\n• Fake Tokens — impersonating real projects\n• Ponzi Schemes — paying old investors with new money\n• Phishing — fake sites stealing your wallet\n• Fake Airdrops — requiring you to send crypto first\n\nReport any of these on the Report a Scam page!",
  },
  {
    patterns: [/dyor|research|how.*safe/i],
    answer: "🔬 DYOR = Do Your Own Research! Before investing:\n• Check the contract on a blockchain explorer\n• Scan the address with APE POLICE Detective Service\n• Verify the team's identity\n• Look for audit reports\n• Never send crypto to receive crypto",
  },
  {
    patterns: [/help|what can you do|features|how.*work/i],
    answer: "🤖 I can help with:\n• What APE POLICE is about\n• How to report scams\n• Scanning addresses with the Detective Service\n• Nominating heroes\n• $APOL tokenomics\n• Leaderboard & voting\n• Crypto safety tips\n\nJust ask me anything!",
  },
  {
    patterns: [/thanks|thank you|thx|ty|appreciate/i],
    answer: "🫡 Anytime, officer! Stay safe in the crypto jungle. If you spot a scam, report it — together we protect the community. 🦍🚔",
  },
  {
    patterns: [/bye|goodbye|cya|later/i],
    answer: "👋 Stay safe out there, officer! APE POLICE is always watching. 🦍🔐",
  },
];

const FALLBACK = "🤔 I'm not sure about that one. Try asking about:\n• Reporting scams\n• Checking addresses\n• $APOL tokenomics\n• Nominating heroes\n• The leaderboard\n\nOr type **help** to see everything I can do!";

function getAnswer(input: string): string {
  const trimmed = input.trim();
  for (const entry of KB) {
    if (entry.patterns.some((p) => p.test(trimmed))) {
      return entry.answer;
    }
  }
  return FALLBACK;
}

function formatText(text: string) {
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {line.split(/\*\*(.+?)\*\*/g).map((part, j) =>
        j % 2 === 1 ? <strong key={j}>{part}</strong> : part
      )}
      {i < text.split("\n").length - 1 && <br />}
    </span>
  ));
}

const QUICK_QUESTIONS = [
  "What is APE POLICE?",
  "How do I report a scam?",
  "What is $APOL?",
  "How do I nominate a hero?",
];

export default function ApolAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: "agent", text: "👋 GM, officer! I'm **APOL Agent** — your APE POLICE guide. Ask me anything about the site, $APOL token, or how to fight crypto scams!" },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    const userMsg: Message = { from: "user", text: msg };
    const agentMsg: Message = { from: "agent", text: getAnswer(msg) };
    setMessages((prev) => [...prev, userMsg, agentMsg]);
    setInput("");
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid="button-apol-agent-toggle"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6, #22c55e)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px rgba(59,130,246,0.5)",
        }}
      >
        {open ? <X size={24} color="#fff" /> : <MessageCircle size={24} color="#fff" />}
      </button>

      {/* Chat window */}
      {open && (
        <div
          data-testid="div-apol-agent-window"
          style={{
            position: "fixed",
            bottom: "90px",
            right: "24px",
            zIndex: 9998,
            width: "340px",
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "520px",
            display: "flex",
            flexDirection: "column",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            border: "1px solid rgba(59,130,246,0.3)",
            background: "#0f172a",
          }}
        >
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #1e3a5f, #1a3a2a)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            borderBottom: "1px solid rgba(59,130,246,0.2)",
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #22c55e)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}>
              <Bot size={20} color="#fff" />
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px", lineHeight: 1.2 }}>APOL Agent</div>
              <div style={{ color: "#22c55e", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
                Online
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: m.from === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "80%",
                  padding: "9px 12px",
                  borderRadius: m.from === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.from === "user" ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "#1e293b",
                  color: "#fff",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  border: m.from === "agent" ? "1px solid rgba(59,130,246,0.2)" : "none",
                }}>
                  {formatText(m.text)}
                </div>
              </div>
            ))}

            {/* Quick questions — show only at start */}
            {messages.length === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    data-testid={`button-quick-${q.replace(/\s+/g, "-").toLowerCase()}`}
                    style={{
                      background: "rgba(59,130,246,0.1)",
                      border: "1px solid rgba(59,130,246,0.3)",
                      borderRadius: "8px",
                      color: "#93c5fd",
                      fontSize: "12px",
                      padding: "6px 10px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid rgba(59,130,246,0.2)",
            display: "flex",
            gap: "8px",
            background: "#0f172a",
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask APOL Agent..."
              data-testid="input-apol-agent"
              style={{
                flex: 1,
                background: "#1e293b",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: "8px",
                padding: "8px 12px",
                color: "#fff",
                fontSize: "13px",
                outline: "none",
              }}
            />
            <button
              onClick={() => send()}
              data-testid="button-apol-agent-send"
              style={{
                background: "linear-gradient(135deg, #3b82f6, #22c55e)",
                border: "none",
                borderRadius: "8px",
                width: "36px",
                height: "36px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <Send size={16} color="#fff" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
