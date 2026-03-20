import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, CheckCircle2, XCircle, Loader2, LogOut, RefreshCw, ChevronDown } from "lucide-react";
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
      sessionStorage.setItem(STORAGE_KEY, token);
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
          APE POLICE ADMIN
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
            APE POLICE ADMIN
          </span>
          <span style={{
            padding: "2px 8px", border: `1px solid ${G}`,
            fontSize: "8px", color: G, letterSpacing: "0.14em", textTransform: "uppercase",
          }}>
            SECURE
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
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

              {/* Action buttons — only for pending */}
              {r.status === "pending_verification" && (
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
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
                </div>
              )}
            </div>

            {/* Details grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px 20px" }}>
              {[
                ["Contract", r.contractAddress],
                ["Website", r.website],
                ["Wallet", r.walletAddress || "—"],
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
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setToken(stored);
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  if (!token) return <AuthScreen onAuth={setToken} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
