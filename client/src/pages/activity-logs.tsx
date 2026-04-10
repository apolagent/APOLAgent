import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import Footer from "@/components/footer";
import { Activity, Shield, Search, Bot, ChevronLeft, ChevronRight, Terminal } from "lucide-react";

const G = "#00ff00";
const mono = "'JetBrains Mono', monospace";

type LogEntry = {
  id: number;
  action: string;
  target: string;
  detail: string;
  verdict: string | null;
  source: string;
  metadata: any;
  createdAt: string;
};

type LogResponse = {
  agent: string;
  version: string;
  total: number;
  entries: LogEntry[];
};

const ACTION_META: Record<string, { icon: any; label: string; color: string }> = {
  contract_scan: { icon: Search, label: "Contract Scan", color: G },
  agent_verification: { icon: Bot, label: "Agent Verification", color: "#60a5fa" },
  x_agent_scan: { icon: Shield, label: "X Agent Scan", color: "#a78bfa" },
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  const v = verdict.toLowerCase();
  const color = v.includes("high") || v.includes("larp") ? "#f87171"
    : v.includes("clean") || v.includes("fully") || v.includes("low risk") ? G
    : "#facc15";
  return (
    <span
      data-testid="badge-verdict"
      style={{
        fontSize: "9px",
        fontWeight: 900,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "2px 8px",
        border: `1px solid ${color}40`,
        color,
        fontFamily: mono,
      }}
    >
      {verdict}
    </span>
  );
}

export default function ActivityLogs() {
  const [page, setPage] = useState(0);
  const limit = 30;

  const { data, isLoading } = useQuery<LogResponse>({
    queryKey: ["/api/agent/activity", page],
    queryFn: () => fetch(`/api/agent/activity?limit=${limit}&offset=${page * limit}`).then(r => r.json()),
    refetchInterval: 15000,
  });

  const total = data?.total ?? 0;
  const entries = data?.entries ?? [];
  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff" }}>
      <Navigation />
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "80px 16px 40px" }}>
        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <Terminal size={20} color={G} />
            <h1 style={{ fontSize: "18px", fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: mono, color: "#fff", margin: 0 }} data-testid="heading-activity-logs">
              APOL Reasoning Logs
            </h1>
          </div>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", fontFamily: mono, lineHeight: 1.6 }}>
            Real-time autonomous decision log. Every scan, analysis, and verification performed by APOL Agent is recorded with timestamps and reasoning traces.
          </p>
          <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
            <div style={{ fontSize: "11px", fontFamily: mono, color: G }}>
              <Activity size={12} style={{ display: "inline", marginRight: "4px", verticalAlign: "middle" }} />
              {total.toLocaleString()} total actions
            </div>
            <div style={{ fontSize: "11px", fontFamily: mono, color: "rgba(255,255,255,0.4)" }}>
              Auto-refreshing every 15s
            </div>
          </div>
        </div>

        {isLoading && entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontFamily: mono }}>Loading reasoning logs...</div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", border: "1px solid rgba(255,255,255,0.06)" }}>
            <Bot size={32} color="rgba(255,255,255,0.15)" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", fontFamily: mono }}>No activity logs yet. Logs will appear as APOL performs scans.</div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              {entries.map((entry) => {
                const meta = ACTION_META[entry.action] || { icon: Activity, label: entry.action, color: G };
                const Icon = meta.icon;
                const ts = new Date(entry.createdAt);
                const timeStr = ts.toISOString().replace("T", " ").slice(0, 19) + " UTC";

                return (
                  <div
                    key={entry.id}
                    data-testid={`log-entry-${entry.id}`}
                    style={{
                      padding: "14px 16px",
                      background: "rgba(255,255,255,0.02)",
                      borderLeft: `2px solid ${meta.color}40`,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ flexShrink: 0, marginTop: "2px" }}>
                        <Icon size={14} color={meta.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: meta.color, fontFamily: mono }}>
                            {meta.label}
                          </span>
                          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: mono }}>
                            {entry.target.length > 42 ? entry.target.slice(0, 20) + "..." : entry.target}
                          </span>
                          <VerdictBadge verdict={entry.verdict} />
                          <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontFamily: mono, padding: "1px 6px", border: "1px solid rgba(255,255,255,0.06)" }}>
                            {entry.source}
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", fontFamily: mono, lineHeight: 1.6 }}>
                          {entry.detail}
                        </div>
                        <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontFamily: mono, marginTop: "4px" }}>
                          {timeStr} — {formatTimeAgo(entry.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "24px" }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  data-testid="button-prev-page"
                  style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    fontSize: "10px", fontFamily: mono, fontWeight: 700,
                    color: page === 0 ? "rgba(255,255,255,0.2)" : G,
                    background: "transparent", border: `1px solid ${page === 0 ? "rgba(255,255,255,0.1)" : G + "40"}`,
                    padding: "6px 12px", cursor: page === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: mono }}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  data-testid="button-next-page"
                  style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    fontSize: "10px", fontFamily: mono, fontWeight: 700,
                    color: page >= totalPages - 1 ? "rgba(255,255,255,0.2)" : G,
                    background: "transparent", border: `1px solid ${page >= totalPages - 1 ? "rgba(255,255,255,0.1)" : G + "40"}`,
                    padding: "6px 12px", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
