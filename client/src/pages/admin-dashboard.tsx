import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, CheckCircle2, XCircle, Loader2, LogOut, RefreshCw, Search, AlertTriangle, Lock, Unlock, Users, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { getSelectedProvider } from "@/hooks/use-wallet";
import { apiRequest } from "@/lib/queryClient";

const G = "#00FF00";
const STORAGE_KEY = "apol_admin_token";

type VerificationRequest = {
  id: number;
  projectName: string;
  tokenTicker: string;
  contractAddress: string;
  website: string;
  txHash: string;
  walletAddress: string | null;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  submittedAt: string;
};

type StatusFilter = "all" | "pending_verification" | "verified" | "rejected";

type AuditData = {
  contractAddress: string;
  chain: string;
  tokenName: string;
  tokenSymbol: string;
  holderCount: number;
  isOpenSource: boolean;
  isInDex: boolean;
  honeypot: {
    isHoneypot: boolean;
    simulationSuccess: boolean | null;
    buyTax: number;
    sellTax: number;
    source: string;
  };
  liquidityLock: {
    lockedPercent: number;
    lockLocations: string[];
    status: string;
    lpHoldersChecked: number;
  };
  topHolders: Array<{
    rank: number;
    address: string;
    percent: number;
    tag: string;
    isLocked: boolean;
    isContract: boolean;
  }>;
  top5pct: number;
  flags: string[];
  riskLevel: string;
  dataSource: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending_verification: "PENDING",
  verified: "VERIFIED",
  rejected: "REJECTED",
};

const STATUS_COLORS: Record<string, string> = {
  pending_verification: "rgba(0,255,0,0.7)",
  verified: "#00FF00",
  rejected: "#ff4444",
};

// ─── Audit Panel ───────────────────────────────────────────────────────────
function AuditPanel({ data, onClose }: { data: AuditData | "loading" | "error"; onClose: () => void }) {
  const RISK_COLORS: Record<string, string> = {
    "High Risk": "#ff4444",
    "Caution": "#ffaa00",
    "Watch": "#ffdd44",
    "Looks Clean": "#00FF00",
  };

  if (data === "loading") {
    return (
      <div style={{
        marginTop: "16px", border: "1px solid rgba(0,255,0,0.2)", background: "rgba(0,255,0,0.02)",
        padding: "28px", textAlign: "center",
      }}>
        <Loader2 size={20} color={G} style={{ animation: "spin 1s linear infinite", margin: "0 auto 10px", display: "block" }} />
        <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
          APOL AGENT: running simulated buy/sell scan...
        </p>
      </div>
    );
  }

  if (data === "error") {
    return (
      <div style={{
        marginTop: "16px", border: "1px solid rgba(255,68,68,0.3)", background: "rgba(255,0,0,0.04)",
        padding: "16px",
      }}>
        <p style={{ margin: 0, fontSize: "11px", color: "#ff6666" }}>Audit fetch failed. Check network or try again.</p>
      </div>
    );
  }

  const riskColor = RISK_COLORS[data.riskLevel] || "rgba(255,255,255,0.5)";
  const { honeypot: hp, liquidityLock: liq } = data;

  return (
    <div style={{ marginTop: "16px", border: `1px solid ${riskColor}33`, background: "#000" }}>

      {/* Audit header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: `${riskColor}08`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Search size={13} color={riskColor} />
          <span style={{ fontSize: "9px", color: riskColor, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
            Contract Audit // {data.dataSource}
          </span>
          <span style={{
            padding: "2px 8px", border: `1px solid ${riskColor}`,
            fontSize: "8px", fontWeight: 700, letterSpacing: "0.12em", color: riskColor,
          }}>
            {data.riskLevel.toUpperCase()}
          </span>
          {data.tokenName && (
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)" }}>
              {data.tokenName} / {data.tokenSymbol} · {data.holderCount.toLocaleString()} holders
            </span>
          )}
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.35)",
          cursor: "pointer", fontSize: "16px", lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Flags */}
      {data.flags.length > 0 && (
        <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {data.flags.map((f, i) => (
            <span key={i} style={{
              padding: "3px 10px",
              border: `1px solid ${f.includes("HONEY") || f.includes("Extreme") ? "#ff4444" : "#ffaa00"}`,
              color: f.includes("HONEY") || f.includes("Extreme") ? "#ff6666" : "#ffcc44",
              fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em",
            }}>
              ⚠ {f}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0 }}>

        {/* Honeypot panel */}
        <div style={{ padding: "18px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "14px" }}>
            {hp.isHoneypot
              ? <AlertTriangle size={13} color="#ff4444" />
              : <CheckCircle2 size={13} color={G} />}
            <span style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: hp.isHoneypot ? "#ff4444" : G }}>
              Honeypot Check
            </span>
          </div>

          {[
            ["Result", hp.isHoneypot ? "HONEYPOT ✕" : "SAFE ✓", hp.isHoneypot ? "#ff4444" : G],
            ["Can Buy", !hp.isHoneypot ? "YES ✓" : "BLOCKED ✕", !hp.isHoneypot ? G : "#ff4444"],
            ["Can Sell", !hp.isHoneypot ? "YES ✓" : "BLOCKED ✕", !hp.isHoneypot ? G : "#ff4444"],
            ["Buy Tax", `${hp.buyTax.toFixed(1)}%`, hp.buyTax > 25 ? "#ff4444" : hp.buyTax > 10 ? "#ffaa00" : "rgba(255,255,255,0.8)"],
            ["Sell Tax", `${hp.sellTax.toFixed(1)}%`, hp.sellTax > 25 ? "#ff4444" : hp.sellTax > 10 ? "#ffaa00" : "rgba(255,255,255,0.8)"],
            ["Simulated", hp.simulationSuccess === null ? "Static only" : hp.simulationSuccess ? "YES ✓" : "FAILED ✕",
              hp.simulationSuccess === null ? "rgba(255,255,255,0.4)" : hp.simulationSuccess ? G : "#ffaa00"],
            ["Source", hp.source, "rgba(255,255,255,0.35)"],
          ].map(([k, v, c]) => (
            <div key={k as string} style={{ marginBottom: "8px" }}>
              <p style={{ margin: "0 0 1px", fontSize: "8px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{k}</p>
              <p style={{ margin: 0, fontSize: "11px", color: c as string, fontWeight: 700 }}>{v}</p>
            </div>
          ))}
        </div>

        {/* Liquidity lock panel */}
        <div style={{ padding: "18px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "14px" }}>
            {liq.lockedPercent >= 50 ? <Lock size={13} color={G} /> : <Unlock size={13} color="#ff4444" />}
            <span style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: liq.lockedPercent >= 50 ? G : "#ff4444" }}>
              Liquidity Lock
            </span>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <p style={{ margin: "0 0 4px", fontSize: "8px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Locked %</p>
            <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", marginBottom: "4px" }}>
              <div style={{
                height: "100%", width: `${liq.lockedPercent}%`,
                background: liq.lockedPercent >= 90 ? G : liq.lockedPercent >= 50 ? "#ffaa00" : "#ff4444",
              }} />
            </div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 900, color: liq.lockedPercent >= 50 ? G : "#ff4444" }}>
              {liq.lockedPercent.toFixed(1)}%
            </p>
          </div>

          {[
            ["Status", liq.status, liq.lockedPercent >= 90 ? G : liq.lockedPercent >= 50 ? "#ffaa00" : "#ff4444"],
            ["LP Holders Checked", String(liq.lpHoldersChecked), "rgba(255,255,255,0.7)"],
          ].map(([k, v, c]) => (
            <div key={k as string} style={{ marginBottom: "8px" }}>
              <p style={{ margin: "0 0 1px", fontSize: "8px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{k}</p>
              <p style={{ margin: 0, fontSize: "11px", color: c as string, fontWeight: 700 }}>{v}</p>
            </div>
          ))}

          {liq.lockLocations.length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: "8px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Lock Locations</p>
              {liq.lockLocations.map(loc => (
                <span key={loc} style={{
                  display: "inline-block", marginRight: "6px", marginBottom: "4px",
                  padding: "2px 8px", border: `1px solid ${G}`,
                  fontSize: "9px", color: G, fontWeight: 700,
                }}>
                  {loc}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Top holders panel */}
        <div style={{ padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "14px" }}>
            <Users size={13} color={data.top5pct > 50 ? "#ffaa00" : G} />
            <span style={{ fontSize: "9px", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: data.top5pct > 50 ? "#ffaa00" : G }}>
              Top Holders
            </span>
          </div>

          <div style={{ marginBottom: "10px" }}>
            <p style={{ margin: "0 0 1px", fontSize: "8px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Top 5 Combined</p>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 900, color: data.top5pct > 50 ? "#ffaa00" : G }}>
              {data.top5pct.toFixed(1)}%
            </p>
          </div>

          {data.topHolders.slice(0, 10).map(h => (
            <div key={h.rank} style={{
              display: "flex", alignItems: "center", gap: "6px",
              paddingBottom: "5px", marginBottom: "5px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.25)", width: "14px", flexShrink: 0 }}>#{h.rank}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.tag || `${h.address.slice(0, 6)}…${h.address.slice(-4)}`}
                  </span>
                  {h.isContract && <span style={{ fontSize: "7px", color: "rgba(0,255,0,0.5)", border: "1px solid rgba(0,255,0,0.3)", padding: "0 3px" }}>CONTRACT</span>}
                  {h.isLocked && <Lock size={8} color="rgba(0,255,0,0.6)" />}
                </div>
              </div>
              <span style={{
                fontSize: "10px", fontWeight: 700, flexShrink: 0,
                color: h.percent > 10 ? "#ffaa00" : "rgba(255,255,255,0.75)",
              }}>
                {h.percent.toFixed(2)}%
              </span>
            </div>
          ))}

          {data.topHolders.length === 0 && (
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", margin: 0 }}>No holder data available</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rejection Modal ───────────────────────────────────────────────────────
function RejectModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 10000, padding: "20px",
    }}>
      <div style={{
        background: "#000", border: "1px solid #ff4444",
        maxWidth: "480px", width: "100%", padding: "28px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <XCircle size={16} color="#ff4444" />
          <span style={{ fontSize: "9px", color: "#ff4444", letterSpacing: "0.16em", textTransform: "uppercase" }}>
            Rejection Reason
          </span>
        </div>
        <p style={{ margin: "0 0 18px", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
          Provide a clear reason for rejection. This will be shown to the project owner.
        </p>

        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Liquidity not locked. High dev-hold percentage exceeds 15%."
          rows={4}
          data-testid="input-rejection-reason"
          style={{
            width: "100%", boxSizing: "border-box",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", fontSize: "12px", padding: "12px", resize: "vertical",
            fontFamily: "JetBrains Mono, monospace", outline: "none", lineHeight: "1.6",
          }}
        />

        <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={isPending}
            data-testid="button-cancel-reject"
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.25)",
              color: "rgba(255,255,255,0.72)", padding: "10px 20px",
              fontFamily: "JetBrains Mono, monospace", fontSize: "11px",
              letterSpacing: "0.1em", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim() || isPending}
            data-testid="button-confirm-reject"
            style={{
              background: reason.trim() && !isPending ? "#ff2222" : "transparent",
              border: "1px solid #ff4444",
              color: reason.trim() && !isPending ? "#fff" : "#ff4444",
              padding: "10px 20px",
              fontFamily: "JetBrains Mono, monospace", fontSize: "11px",
              letterSpacing: "0.1em", cursor: reason.trim() && !isPending ? "pointer" : "default",
              opacity: reason.trim() && !isPending ? 1 : 0.5,
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            {isPending && <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />}
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Auth Screen ───────────────────────────────────────────────────────────
function AuthScreen({ onAuth }: { onAuth: (token: string) => void }) {
  const [status, setStatus] = useState<"idle" | "connecting" | "signing" | "verifying" | "error">("idle");
  const [error, setError] = useState("");

  const authenticate = useCallback(async () => {
    setStatus("connecting");
    setError("");
    try {
      const eth = getSelectedProvider();
      if (!eth) throw new Error("No wallet connected. Connect a wallet first.");

      const [address]: string[] = await eth.request({ method: "eth_requestAccounts" });
      if (!address) throw new Error("No account returned from wallet.");

      setStatus("signing");
      const res = await fetch(`/api/admin/nonce?address=${address.toLowerCase()}`);
      const { nonce } = await res.json();

      const signature: string = await eth.request({
        method: "personal_sign",
        params: [nonce, address],
      });

      setStatus("verifying");
      const authRes = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });

      if (!authRes.ok) {
        const { error: msg } = await authRes.json();
        throw new Error(msg || "Authentication failed");
      }

      const { token } = await authRes.json();
      localStorage.setItem(STORAGE_KEY, token);
      onAuth(token);
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      setStatus("error");
    }
  }, [onAuth]);

  const statusText: Record<string, string> = {
    idle: "AUTHENTICATE",
    connecting: "CONNECTING WALLET...",
    signing: "SIGN MESSAGE IN WALLET...",
    verifying: "VERIFYING SIGNATURE...",
    error: "RETRY AUTHENTICATION",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#000", display: "flex",
      alignItems: "center", justifyContent: "center", padding: "20px",
      fontFamily: "JetBrains Mono, monospace",
    }}>
      <div style={{ maxWidth: "440px", width: "100%", textAlign: "center" }}>
        <ShieldAlert size={40} color={G} style={{ marginBottom: "24px" }} />
        <p style={{ margin: "0 0 6px", fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Restricted Area
        </p>
        <h1 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 900, color: "#fff", letterSpacing: "0.04em" }}>
          APOL AGENT ADMIN
        </h1>
        <p style={{ margin: "0 0 32px", fontSize: "12px", color: "rgba(255,255,255,0.55)", lineHeight: "1.7" }}>
          Connect your admin wallet and sign a message to verify ownership. No gas required.
        </p>

        {error && (
          <div style={{
            border: "1px solid #ff4444", background: "rgba(255,0,0,0.06)",
            padding: "12px 16px", marginBottom: "20px", textAlign: "left",
          }}>
            <p style={{ margin: 0, fontSize: "11px", color: "#ff4444" }}>{error}</p>
          </div>
        )}

        <button
          onClick={authenticate}
          disabled={status === "connecting" || status === "signing" || status === "verifying"}
          data-testid="button-admin-auth"
          style={{
            width: "100%", padding: "14px",
            background: "transparent", border: `1px solid ${G}`, color: G,
            fontFamily: "JetBrains Mono, monospace", fontSize: "12px",
            fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            cursor: status === "idle" || status === "error" ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            opacity: status === "idle" || status === "error" ? 1 : 0.6,
          }}
        >
          {(status === "connecting" || status === "signing" || status === "verifying") && (
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
          )}
          {statusText[status]}
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("pending_verification");
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [auditMap, setAuditMap] = useState<Record<number, AuditData | "loading" | "error">>({});

  const fetchAudit = useCallback(async (r: VerificationRequest) => {
    if (auditMap[r.id] && auditMap[r.id] !== "error") return; // already loaded or loading
    setAuditMap(prev => ({ ...prev, [r.id]: "loading" }));
    try {
      const res = await fetch(
        `/api/admin/audit?contractAddress=${encodeURIComponent(r.contractAddress)}&chain=base`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("fetch failed");
      const data: AuditData = await res.json();
      setAuditMap(prev => ({ ...prev, [r.id]: data }));
    } catch {
      setAuditMap(prev => ({ ...prev, [r.id]: "error" }));
    }
  }, [token, auditMap]);

  const closeAudit = useCallback((id: number) => {
    setAuditMap(prev => { const next = { ...prev }; delete next[id]; return next; });
  }, []);

  const { data: requests = [], isLoading, isError, refetch } = useQuery<VerificationRequest[]>({
    queryKey: ["/api/admin/verifications", token],
    queryFn: async () => {
      const res = await fetch("/api/admin/verifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { onLogout(); return []; }
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/verifications/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Approval failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/verifications"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await fetch(`/api/admin/verifications/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Rejection failed");
      return res.json();
    },
    onSuccess: () => {
      setRejectTarget(null);
      qc.invalidateQueries({ queryKey: ["/api/admin/verifications"] });
    },
  });

  const filtered = requests.filter(r =>
    filter === "all" ? true : r.status === filter
  );

  const counts: Record<StatusFilter, number> = {
    all: requests.length,
    pending_verification: requests.filter(r => r.status === "pending_verification").length,
    verified: requests.filter(r => r.status === "verified").length,
    rejected: requests.filter(r => r.status === "rejected").length,
  };

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "ALL" },
    { key: "pending_verification", label: "PENDING" },
    { key: "verified", label: "VERIFIED" },
    { key: "rejected", label: "REJECTED" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#000", fontFamily: "JetBrains Mono, monospace" }}>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(0,255,0,0.2)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ShieldAlert size={18} color={G} />
          <span style={{ fontSize: "13px", fontWeight: 900, color: "#fff", letterSpacing: "0.1em" }}>
            APOL AGENT ADMIN
          </span>
          <span style={{
            padding: "2px 8px", border: `1px solid ${G}`,
            fontSize: "8px", color: G, letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            SECURE
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link
            href="/"
            data-testid="link-back-home"
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.6)", padding: "6px 12px",
              fontFamily: "JetBrains Mono, monospace", fontSize: "10px",
              cursor: "pointer", textDecoration: "none", letterSpacing: "0.08em",
            }}
          >
            <ArrowLeft size={11} /> HOME
          </Link>
          <button
            onClick={() => refetch()}
            data-testid="button-refresh"
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.6)", padding: "6px 12px",
              fontFamily: "JetBrains Mono, monospace", fontSize: "10px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <RefreshCw size={11} /> REFRESH
          </button>
          <button
            onClick={onLogout}
            data-testid="button-logout"
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.6)", padding: "6px 12px",
              fontFamily: "JetBrains Mono, monospace", fontSize: "10px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
            }}
          >
            <LogOut size={11} /> LOGOUT
          </button>
        </div>
      </div>

      <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>

        {/* Status tabs */}
        <div style={{ display: "flex", gap: "0", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: "24px" }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              data-testid={`tab-${tab.key}`}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: filter === tab.key ? `2px solid ${G}` : "2px solid transparent",
                color: filter === tab.key ? G : "rgba(255,255,255,0.45)",
                padding: "10px 20px", marginBottom: "-1px",
                fontFamily: "JetBrains Mono, monospace", fontSize: "10px",
                fontWeight: 700, letterSpacing: "0.12em", cursor: "pointer",
              }}
            >
              {tab.label}
              <span style={{
                marginLeft: "8px",
                fontSize: "9px",
                color: filter === tab.key ? G : "rgba(255,255,255,0.3)",
              }}>
                ({counts[tab.key]})
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Loader2 size={24} color={G} style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Loading submissions...</p>
          </div>
        )}

        {isError && (
          <div style={{ border: "1px solid #ff4444", padding: "16px", color: "#ff4444", fontSize: "12px" }}>
            Failed to load submissions. Your session may have expired.
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div style={{
            border: "1px solid rgba(255,255,255,0.08)", padding: "40px",
            textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "12px",
          }}>
            No {filter === "all" ? "" : STATUS_LABELS[filter] + " "}submissions found.
          </div>
        )}

        {!isLoading && filtered.map(r => (
          <div
            key={r.id}
            data-testid={`row-submission-${r.id}`}
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              borderLeft: `3px solid ${STATUS_COLORS[r.status] || "rgba(255,255,255,0.2)"}`,
              background: "rgba(255,255,255,0.02)",
              padding: "20px 22px",
              marginBottom: "12px",
            }}
          >
            {/* Row header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "14px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 900, color: "#fff" }}>{r.projectName}</span>
                  <span style={{ fontSize: "11px", color: G }}>/ ${r.tokenTicker}</span>
                  <span style={{
                    padding: "2px 8px",
                    border: `1px solid ${STATUS_COLORS[r.status] || "rgba(255,255,255,0.2)"}`,
                    color: STATUS_COLORS[r.status] || "rgba(255,255,255,0.4)",
                    fontSize: "8px", fontWeight: 700, letterSpacing: "0.14em",
                  }}>
                    {STATUS_LABELS[r.status] || r.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.38)" }}>
                  #{r.id} · Submitted {new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {r.reviewedAt && ` · Reviewed ${new Date(r.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </p>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {/* Audit button — always available */}
                <button
                  onClick={() => auditMap[r.id] ? closeAudit(r.id) : fetchAudit(r)}
                  data-testid={`button-audit-${r.id}`}
                  style={{
                    background: "transparent", border: "1px solid rgba(0,255,0,0.4)",
                    color: "rgba(0,255,0,0.7)", padding: "8px 14px",
                    fontFamily: "JetBrains Mono, monospace", fontSize: "10px",
                    fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  <Search size={11} />
                  {auditMap[r.id] ? "HIDE AUDIT" : "AUDIT CONTRACT"}
                </button>

                {/* Approve/Reject — only for pending */}
                {r.status === "pending_verification" && (
                  <>
                    <button
                      onClick={() => approveMutation.mutate(r.id)}
                      disabled={approveMutation.isPending}
                      data-testid={`button-approve-${r.id}`}
                      style={{
                        background: "rgba(0,255,0,0.08)", border: `1px solid ${G}`,
                        color: G, padding: "8px 16px",
                        fontFamily: "JetBrains Mono, monospace", fontSize: "10px",
                        fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      {approveMutation.isPending ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <CheckCircle2 size={11} />}
                      APPROVE
                    </button>
                    <button
                      onClick={() => setRejectTarget(r.id)}
                      data-testid={`button-reject-${r.id}`}
                      style={{
                        background: "transparent", border: "1px solid #ff4444",
                        color: "#ff4444", padding: "8px 16px",
                        fontFamily: "JetBrains Mono, monospace", fontSize: "10px",
                        fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "6px",
                      }}
                    >
                      <XCircle size={11} /> REJECT
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Details grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px 20px" }}>
              {[
                ["Contract", r.contractAddress],
                ["Website", r.website],
                ["Wallet", r.walletAddress || "-"],
                ["TX Hash", r.txHash],
              ].map(([label, value]) => (
                <div key={label}>
                  <p style={{ margin: "0 0 2px", fontSize: "8px", color: "rgba(0,255,0,0.7)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{label}</p>
                  <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.75)", wordBreak: "break-all", lineHeight: "1.5" }}
                    data-testid={`text-${label.toLowerCase().replace(" ", "-")}-${r.id}`}>
                    {value && value.length > 42 ? value.slice(0, 20) + "…" + value.slice(-10) : value}
                  </p>
                </div>
              ))}
            </div>

            {/* Rejection reason */}
            {r.status === "rejected" && r.rejectionReason && (
              <div style={{
                marginTop: "14px", border: "1px solid rgba(255,68,68,0.3)",
                background: "rgba(255,0,0,0.04)", padding: "12px 14px",
              }}>
                <p style={{ margin: "0 0 4px", fontSize: "8px", color: "#ff6666", letterSpacing: "0.14em", textTransform: "uppercase" }}>Rejection Reason</p>
                <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.75)", lineHeight: "1.5" }}>{r.rejectionReason}</p>
              </div>
            )}

            {/* Audit panel */}
            {auditMap[r.id] && (
              <AuditPanel data={auditMap[r.id]} onClose={() => closeAudit(r.id)} />
            )}
          </div>
        ))}
      </div>

      {/* Reject Modal */}
      {rejectTarget !== null && (
        <RejectModal
          onConfirm={(reason) => rejectMutation.mutate({ id: rejectTarget, reason })}
          onCancel={() => setRejectTarget(null)}
          isPending={rejectMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Main Export ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  if (!token) return <AuthScreen onAuth={setToken} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
