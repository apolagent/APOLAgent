import { useState, useRef, useEffect } from "react";
import { X, Send, Terminal } from "lucide-react";

type Message = {
  from: "user" | "agent";
  text: string;
};

const QUICK_QUESTIONS = [
  "What is APOL?",
  "How do I scan an agent?",
  "What are the certification tiers?",
  "What is the SBT certificate?",
];

const G = "#00ff00";
const BG = "rgba(0,0,0,0.95)";
const BORDER = "1px solid rgba(0,255,0,0.25)";

export default function ApolAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { from: "agent", text: "APOL AGENT :: SYSTEM ONLINE\nAsk me anything about APOL forensic certification." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  const send = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput("");

    const history = messages
      .slice(1) // skip initial greeting
      .map(m => ({ role: m.from === "user" ? "user" : "assistant", content: m.text } as const));

    setMessages(prev => [...prev, { from: "user", text: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      const reply: string = data.reply || "Unable to connect. Please try again.";
      setMessages(prev => [...prev, { from: "agent", text: reply }]);
    } catch {
      setMessages(prev => [...prev, { from: "agent", text: "Connection error. Please try again." }]);
    } finally {
      setLoading(false);
    }
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

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{ fontSize: "9px", letterSpacing: "0.1em", color: "rgba(0,255,0,0.5)", textTransform: "uppercase" }}>
                  [APOL-AGENT]
                </span>
                <div style={{
                  padding: "7px 10px",
                  border: `1px solid ${G}`,
                  color: G,
                  fontSize: "12px",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.1em",
                }}>
                  ▋
                </div>
              </div>
            )}

            {/* Quick queries — only at start */}
            {messages.length === 1 && !loading && (
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
              onKeyDown={(e) => e.key === "Enter" && !loading && send()}
              placeholder={loading ? "processing..." : "enter query..."}
              disabled={loading}
              data-testid="input-apol-agent"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                borderBottom: "1px solid rgba(0,255,0,0.2)",
                padding: "4px 0",
                color: loading ? "rgba(255,255,255,0.4)" : "#ffffff",
                fontSize: "12px",
                outline: "none",
                caretColor: G,
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading}
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
                cursor: loading ? "not-allowed" : "pointer",
                flexShrink: 0,
                opacity: loading ? 0.4 : 1,
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
