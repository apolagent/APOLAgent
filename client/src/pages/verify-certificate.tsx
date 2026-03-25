import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import {
  ShieldCheck, CheckCircle2, AlertTriangle, XCircle,
  ExternalLink, Copy, Lock, Unlock, Users, ArrowLeft,
} from "lucide-react";
import Navigation from "@/components/navigation";
import { CHAIN } from "@/lib/chain-config";

const G = "#00FF00";

type AuditData = {
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
  topHolders: Array<{ rank: number; address: string; percent: number; tag: string; isLocked: boolean; isContract: boolean }>;
  top5pct: number;
  flags: string[];
  riskLevel: string;
};

type CertData = {
  project: {
    id: number;
    projectName: string;
    tokenTicker: string;
    contractAddress: string;
    website: string;
    txHash: string;
    walletAddress: string | null;
    reviewedAt: string | null;
    submittedAt: string;
  };
  audit: AuditData;
};

function Check({ label, value, pass, sub }: { label: string; value: string; pass: boolean | null; sub?: string }) {
  const color = pass === null ? "rgba(255,255,255,0.5)" : pass ? G : "#ffaa00";
  const icon = pass === null
    ? <AlertTriangle size={12} color="rgba(255,255,255,0.3)" />
    : pass
      ? <CheckCircle2 size={12} color={G} />
      : <AlertTriangle size={12} color="#ffaa00" />;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 0",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {icon}
        <div>
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.8)" }}>{label}</span>
          {sub && <p style={{ margin: 0, fontSize: "9px", color: "rgba(255,255,255,0.38)", marginTop: "1px" }}>{sub}</p>}
        </div>
      </div>
      <span style={{ fontSize: "11px", fontWeight: 700, color, letterSpacing: "0.06em" }}>{value}</span>
    </div>
  );
}

export default function VerifyCertificate() {
  const params = useParams<{ contractAddress: string }>();
  const contractAddress = params.contractAddress;

  const [state, setState] = useState<"loading" | "found" | "not_found" | "error">("loading");
  const [data, setData] = useState<CertData | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!contractAddress) { setState("not_found"); return; }
    fetch(`/api/verify/${encodeURIComponent(contractAddress)}`)
      .then(async r => {
        if (r.status === 404) { setState("not_found"); return; }
        if (!r.ok) throw new Error("fetch error");
        const d: CertData = await r.json();
        setData(d);
        setState("found");
      })
      .catch(() => setState("error"));
  }, [contractAddress]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const verifiedDate = data?.project.reviewedAt
    ? new Date(data.project.reviewedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  // Loading
  if (state === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: "#000", fontFamily: "JetBrains Mono, monospace" }}>
        <Navigation />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "32px", height: "32px", border: `2px solid ${G}`, borderTopColor: "transparent", borderRadius: "50%", animation: "rotateSiren 0.8s linear infinite", margin: "0 auto 16px" }} />
            <p style={{ fontSize: "11px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>
              Retrieving Certificate...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (state === "not_found" || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", fontFamily: "JetBrains Mono, monospace" }}>
        <Navigation />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "70vh", padding: "20px" }}>
          <div style={{ textAlign: "center", maxWidth: "480px" }}>
            <XCircle size={40} color="rgba(255,68,68,0.6)" style={{ marginBottom: "20px" }} />
            <p style={{ margin: "0 0 8px", fontSize: "9px", color: "rgba(255,68,68,0.7)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Certificate Not Found
            </p>
            <h1 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: 900, color: "#fff" }}>
              This address is not APOL Verified
            </h1>
            <p style={{ margin: "0 0 28px", fontSize: "12px", color: "rgba(255,255,255,0.5)", lineHeight: "1.7" }}>
              No verified certificate exists for <span style={{ color: G, wordBreak: "break-all" }}>{contractAddress}</span>.
              Only projects that have passed an APOL audit and been approved hold a certificate.
            </p>
            <Link href="/get-verified" style={{
              display: "inline-block", padding: "10px 24px",
              border: `1px solid ${G}`, color: G,
              fontSize: "11px", fontWeight: 700, letterSpacing: "0.12em",
              textDecoration: "none", textTransform: "uppercase",
            }}>
              Apply for Verification
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { project, audit } = data;
  const hp = audit.honeypot;
  const liq = audit.liquidityLock;

  return (
    <div style={{ minHeight: "100vh", background: "#000", fontFamily: "JetBrains Mono, monospace" }}>
      <Navigation />

      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Back link */}
        <Link href="/" style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          color: "rgba(255,255,255,0.4)", fontSize: "10px", textDecoration: "none",
          letterSpacing: "0.1em", marginBottom: "32px",
        }}>
          <ArrowLeft size={12} /> Back to APOL Agent
        </Link>

        {/* ── Certificate Card ─────────────────────────────────────────── */}
        <div style={{
          border: `1px solid ${G}`,
          background: "#000",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Corner decorations */}
          {[
            { top: 0, left: 0, borderRight: "none", borderBottom: "none" },
            { top: 0, right: 0, borderLeft: "none", borderBottom: "none" },
            { bottom: 0, left: 0, borderRight: "none", borderTop: "none" },
            { bottom: 0, right: 0, borderLeft: "none", borderTop: "none" },
          ].map((style, i) => (
            <div key={i} style={{
              position: "absolute", width: "18px", height: "18px",
              border: `2px solid ${G}`, ...style,
            }} />
          ))}

          {/* Header */}
          <div style={{
            borderBottom: "1px solid rgba(0,255,0,0.2)",
            padding: "36px 36px 28px",
            textAlign: "center",
            background: "rgba(0,255,0,0.02)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "16px" }}>
              <ShieldCheck size={32} color={G} />
            </div>
            <p style={{ margin: "0 0 4px", fontSize: "9px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.22em", textTransform: "uppercase" }}>
              APOL Agent · Official Verification Certificate
            </p>
            <h1 style={{ margin: "0 0 6px", fontSize: "28px", fontWeight: 900, color: G, letterSpacing: "0.06em" }}>
              APOL VERIFIED
            </h1>
            <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em" }}>
              Verified on {verifiedDate}
            </p>
          </div>

          {/* Project info */}
          <div style={{ padding: "28px 36px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "9px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.16em", textTransform: "uppercase" }}>Project</p>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: "#fff" }}>{project.projectName}</h2>
                  <span style={{
                    padding: "3px 10px",
                    border: `1px solid ${G}`,
                    fontSize: "11px", fontWeight: 700, color: G,
                  }}>${project.tokenTicker}</span>
                </div>
                {audit.tokenName && audit.tokenName !== project.projectName && (
                  <p style={{ margin: "4px 0 0", fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
                    On-chain: {audit.tokenName}
                  </p>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "0 0 4px", fontSize: "9px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.16em", textTransform: "uppercase" }}>Holders</p>
                <p style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "#fff" }}>
                  {audit.holderCount > 0 ? audit.holderCount.toLocaleString() : "—"}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                ["Contract Address", project.contractAddress],
                ["Website", project.website],
                ["Chain", "Base"],
                ["Submitted", new Date(project.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
              ].map(([k, v]) => (
                <div key={k}>
                  <p style={{ margin: "0 0 2px", fontSize: "8px", color: "rgba(0,255,0,0.7)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{k}</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.82)", wordBreak: "break-all", lineHeight: "1.5" }}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Security Checks ──────────────────────────────────────────── */}
          <div style={{ padding: "28px 36px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
              <ShieldCheck size={13} color={G} />
              <p style={{ margin: 0, fontSize: "9px", color: "rgba(0,255,0,0.7)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                Security Audit Results
              </p>
              <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.3)", marginLeft: "4px" }}>
                · via {hp.source}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
              <div>
                <Check
                  label="Honeypot Check"
                  value={hp.isHoneypot ? "FAIL ✕" : "SAFE ✓"}
                  pass={!hp.isHoneypot}
                  sub="Simulated buy/sell test"
                />
                <Check
                  label="Sell Simulation"
                  value={hp.simulationSuccess === null ? "Static only" : hp.simulationSuccess ? "PASSED ✓" : "FAILED ✕"}
                  pass={hp.simulationSuccess !== false}
                  sub="Token can be sold"
                />
                <Check
                  label="Buy Tax"
                  value={`${hp.buyTax.toFixed(1)}%`}
                  pass={hp.buyTax <= 10}
                  sub={hp.buyTax <= 10 ? "Acceptable range" : "Above 10%"}
                />
                <Check
                  label="Sell Tax"
                  value={`${hp.sellTax.toFixed(1)}%`}
                  pass={hp.sellTax <= 10}
                  sub={hp.sellTax <= 10 ? "Acceptable range" : "Above 10%"}
                />
              </div>
              <div>
                <Check
                  label="Open Source"
                  value={audit.isOpenSource ? "VERIFIED ✓" : "UNVERIFIED"}
                  pass={audit.isOpenSource}
                  sub="Contract code is public"
                />
                <Check
                  label="Listed on DEX"
                  value={audit.isInDex ? "YES ✓" : "NOT LISTED"}
                  pass={audit.isInDex}
                  sub="Active market pair found"
                />
                <Check
                  label="Liquidity Locked"
                  value={liq.lpHoldersChecked > 0 ? `${liq.lockedPercent.toFixed(0)}%` : "N/A"}
                  pass={liq.lpHoldersChecked > 0 ? liq.lockedPercent >= 50 : null}
                  sub={liq.lockLocations.join(", ") || (liq.lpHoldersChecked > 0 ? "No lock detected" : "No LP data")}
                />
                <Check
                  label="Top 5 Concentration"
                  value={`${audit.top5pct.toFixed(1)}%`}
                  pass={audit.top5pct <= 50}
                  sub={audit.top5pct > 50 ? "High concentration risk" : "Healthy distribution"}
                />
              </div>
            </div>

            {/* Flags */}
            {audit.flags.length > 0 && (
              <div style={{
                marginTop: "16px", padding: "12px 14px",
                border: "1px solid rgba(255,170,0,0.3)", background: "rgba(255,170,0,0.04)",
              }}>
                <p style={{ margin: "0 0 8px", fontSize: "8px", color: "#ffcc44", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  Admin Notes / Advisory Flags
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {audit.flags.map((f, i) => (
                    <span key={i} style={{
                      padding: "2px 8px", border: "1px solid rgba(255,170,0,0.4)",
                      fontSize: "9px", color: "#ffcc44",
                    }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Top Holders */}
          {audit.topHolders.length > 0 && (
            <div style={{ padding: "24px 36px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <Users size={12} color="rgba(0,255,0,0.6)" />
                <p style={{ margin: 0, fontSize: "9px", color: "rgba(0,255,0,0.7)", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
                  Top Holders
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0" }}>
                {audit.topHolders.slice(0, 10).map(h => (
                  <div key={h.rank} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "50%", gap: "8px", padding: "5px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    boxSizing: "border-box",
                    paddingRight: h.rank % 2 === 1 ? "16px" : "0",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                      <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.22)", flexShrink: 0 }}>#{h.rank}</span>
                      <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.tag || `${h.address.slice(0, 6)}…${h.address.slice(-4)}`}
                      </span>
                      {h.isLocked && <Lock size={8} color="rgba(0,255,0,0.5)" />}
                    </div>
                    <span style={{
                      fontSize: "9px", fontWeight: 700, flexShrink: 0,
                      color: h.percent > 10 ? "#ffaa00" : "rgba(255,255,255,0.7)",
                    }}>
                      {h.percent.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer / Actions */}
          <div style={{ padding: "22px 36px", background: "rgba(0,255,0,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
              <button
                onClick={copyLink}
                data-testid="button-copy-cert-link"
                style={{
                  display: "flex", alignItems: "center", gap: "7px",
                  background: copied ? "rgba(0,255,0,0.12)" : "transparent",
                  border: `1px solid ${G}`, color: G,
                  padding: "9px 18px", fontFamily: "JetBrains Mono, monospace",
                  fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
                  cursor: "pointer", textTransform: "uppercase",
                }}
              >
                <Copy size={11} />
                {copied ? "LINK COPIED!" : "COPY CERTIFICATE LINK"}
              </button>

              <a
                href={`${CHAIN.explorerUrl}/address/${project.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-basescan-contract"
                style={{
                  display: "flex", alignItems: "center", gap: "7px",
                  border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)",
                  padding: "9px 18px", fontFamily: "JetBrains Mono, monospace",
                  fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
                  textDecoration: "none", textTransform: "uppercase",
                }}
              >
                <ExternalLink size={11} /> View Contract
              </a>

              <a
                href={project.website}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-project-website"
                style={{
                  display: "flex", alignItems: "center", gap: "7px",
                  border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.6)",
                  padding: "9px 18px", fontFamily: "JetBrains Mono, monospace",
                  fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
                  textDecoration: "none", textTransform: "uppercase",
                }}
              >
                <ExternalLink size={11} /> Project Website
              </a>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <p style={{ margin: 0, fontSize: "9px", color: "rgba(255,255,255,0.28)", letterSpacing: "0.1em" }}>
                Certificate ID: {project.contractAddress.toLowerCase()}
              </p>
              <p style={{ margin: 0, fontSize: "9px", color: "rgba(0,255,0,0.4)", letterSpacing: "0.1em" }}>
                VERIFIED BY APOL AGENT — AUTONOMOUS ONCHAIN FORENSICS
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p style={{
          marginTop: "20px", fontSize: "10px", color: "rgba(255,255,255,0.3)",
          lineHeight: "1.7", textAlign: "center",
        }}>
          This certificate reflects the security state at the time of APOL Agent review.
          Blockchain projects can change after verification. Always conduct your own research before investing.
        </p>
      </div>
    </div>
  );
}
