import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, ShieldCheck, CheckCircle, Loader2, AlertTriangle,
  ExternalLink, FileSearch, Clock, Award, ShieldAlert, Info,
} from "lucide-react";
import { BrowserProvider, JsonRpcProvider, parseEther } from "ethers";
import { getSelectedProvider } from "@/hooks/use-wallet";
import { useWallet } from "@/hooks/use-wallet";
import Navigation from "@/components/navigation";
import { CHAIN } from "@/lib/chain-config";
import type { VerificationRequest } from "@shared/schema";

// ─── constants ──────────────────────────────────────────────────────────────
const G = "#00ff00";
const AUDIT_WALLET = "0x857aca6A8A743C9262d64819D239f509a1Cd0A85";
const AUDIT_FEE = "0.05";
const LS_TX_KEY = "apol_verify_tx";
const LS_WALLET_KEY = "apol_verify_wallet";
const LS_PENDING_KEY = "apol_verify_pending"; // raw form data stored before DB save

// ─── helpers ────────────────────────────────────────────────────────────────
async function waitForReceipt(txHash: string, timeoutMs = 90_000): Promise<boolean> {
  const rpc = new JsonRpcProvider(CHAIN.rpcUrl);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await rpc.getTransactionReceipt(txHash);
      if (receipt) return receipt.status === 1;
    } catch {}
    await new Promise(r => setTimeout(r, 2500));
  }
  return true;
}

async function fetchSubmissionByTx(txHash: string): Promise<VerificationRequest | null> {
  try {
    const res = await fetch(`/api/verification-requests/by-tx/${txHash}`);
    if (res.ok) return res.json();
  } catch {}
  return null;
}

async function fetchSubmissionByWallet(address: string): Promise<VerificationRequest | null> {
  try {
    const res = await fetch(`/api/verification-requests/by-wallet/${address.toLowerCase()}`);
    if (res.ok) return res.json();
  } catch {}
  return null;
}

// ─── UI sub-components ──────────────────────────────────────────────────────
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label style={{
        fontSize: "9px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.14em",
        textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(0,255,0,0.25)",
  padding: "10px 12px",
  color: "#ffffff",
  fontSize: "13px",
  outline: "none",
  caretColor: G,
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "'JetBrains Mono', monospace",
  transition: "border-color 0.15s ease",
};

// 3-step progress stepper
function ProgressStepper({ status }: { status: string }) {
  const isVerified = status === "verified";
  const isVerifying = status === "verifying";

  const steps = [
    {
      icon: <CheckCircle size={16} color={G} />,
      label: "Payment Received",
      sublabel: "0.05 ETH confirmed on Base",
      active: true,
      done: true,
    },
    {
      icon: isVerified
        ? <CheckCircle size={16} color={G} />
        : <Loader2 size={16} color={G} style={{ animation: "spin 1.2s linear infinite" }} />,
      label: "APOL Agent Verifying",
      sublabel: isVerified ? "Review complete" : "Estimated 24 hours",
      active: true,
      done: isVerified,
    },
    {
      icon: isVerified
        ? <Award size={16} color={G} />
        : <Award size={16} color="rgba(255,255,255,0.2)" />,
      label: "Project Badge Issued",
      sublabel: isVerified ? "Badge active" : "Pending review",
      active: isVerified,
      done: isVerified,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
          {/* connector */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{
              width: "32px", height: "32px",
              border: step.done ? `1px solid ${G}` : step.active ? `1px solid ${G}` : "1px solid rgba(255,255,255,0.1)",
              background: step.done ? "rgba(0,255,0,0.08)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {step.icon}
            </div>
            {i < steps.length - 1 && (
              <div style={{
                width: "1px", height: "32px",
                background: step.done ? "rgba(0,255,0,0.3)" : "rgba(255,255,255,0.08)",
              }} />
            )}
          </div>
          {/* text */}
          <div style={{ paddingTop: "6px", paddingBottom: i < steps.length - 1 ? "0" : "0", minHeight: "64px" }}>
            <p style={{
              margin: "0 0 3px",
              fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              color: step.active ? "#fff" : "rgba(255,255,255,0.25)",
            }}>
              {step.label}
            </p>
            <p style={{
              margin: 0,
              fontSize: "11px", color: step.done ? "rgba(0,255,0,0.7)" : step.active ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)",
            }}>
              {step.sublabel}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// "Why Verify?" box
function WhyVerifyBox() {
  return (
    <div style={{
      border: "1px solid rgba(0,255,0,0.18)",
      background: "rgba(0,255,0,0.03)",
      padding: "18px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
        <Info size={13} color={G} />
        <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Why verify with APOL?
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[
          ["Trusted by APOL Badge", "A verified badge appears next to your project name throughout the site and in our Verified Projects featured list."],
          ["Featured Visibility", "Verified projects are promoted in the 'Verified by APOL' section on the home page, increasing exposure to our community."],
          ["Investor Signal", "Signals to investors and traders that your contract has been forensically scanned for honeypots, rug-pull mechanics, and hidden tax functions."],
        ].map(([title, body]) => (
          <div key={title} style={{ display: "flex", gap: "10px" }}>
            <span style={{ color: G, fontSize: "12px", flexShrink: 0, paddingTop: "1px" }}>›</span>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: "11px", fontWeight: 700, color: "#fff" }}>{title}</p>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.4)", lineHeight: "1.5" }}>{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Status dashboard shown after successful payment
function StatusDashboard({ submission, onReset }: { submission: VerificationRequest; onReset: () => void }) {
  const isVerified = submission.status === "verified";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} data-testid="div-status-dashboard">

      {/* Header card */}
      <div style={{ border: `1px solid ${isVerified ? G : "rgba(0,255,0,0.3)"}`, background: "#000", padding: "24px 24px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
          {isVerified
            ? <Award size={18} color={G} />
            : <Loader2 size={18} color={G} style={{ animation: "spin 1.5s linear infinite" }} />}
          <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.55)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
            {isVerified ? "Verification Complete" : "Verification In Progress"}
          </span>
        </div>

        <p style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 900, color: "#fff", letterSpacing: "0.04em" }} data-testid="text-submission-project">
          {submission.projectName}
        </p>
        <p style={{ margin: "0 0 16px", fontSize: "12px", color: "rgba(0,255,0,0.6)" }}>
          ${submission.tokenTicker}
          {isVerified && (
            <span style={{
              marginLeft: "10px",
              padding: "2px 8px",
              background: "rgba(0,255,0,0.12)",
              border: `1px solid ${G}`,
              fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: G,
            }}>
              APOL VERIFIED
            </span>
          )}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          {[
            ["Contract", submission.contractAddress.slice(0, 10) + "…" + submission.contractAddress.slice(-6)],
            ["Website", submission.website.replace(/^https?:\/\//, "")],
            ["Submitted", new Date(submission.submittedAt).toLocaleDateString()],
            ["Status", submission.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())],
          ].map(([k, v]) => (
            <div key={k}>
              <p style={{ margin: "0 0 2px", fontSize: "9px", color: "rgba(0,255,0,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{k}</p>
              <p style={{ margin: 0, fontSize: "11px", color: "rgba(255,255,255,0.7)", wordBreak: "break-all" }} data-testid={`text-detail-${k.toLowerCase()}`}>{v}</p>
            </div>
          ))}
        </div>

        {submission.txHash && (
          <a
            href={`${CHAIN.explorerUrl}/tx/${submission.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-view-tx"
            style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "6px 12px",
              border: "1px solid rgba(0,255,0,0.3)",
              color: "rgba(0,255,0,0.7)", fontSize: "10px", letterSpacing: "0.1em",
              textTransform: "uppercase", textDecoration: "none",
            }}
          >
            <ExternalLink size={11} />
            View Payment on BaseScan
          </a>
        )}
      </div>

      {/* Progress stepper */}
      <div style={{ border: "1px solid rgba(0,255,0,0.15)", background: "#000", padding: "24px" }}>
        <p style={{ margin: "0 0 20px", fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Verification Progress
        </p>
        <ProgressStepper status={submission.status} />
      </div>

      {/* Why verify box */}
      <WhyVerifyBox />

      {/* Submit another (different wallet) */}
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", textAlign: "center", margin: 0 }}>
        Submitting a different project?{" "}
        <button
          onClick={onReset}
          data-testid="button-submit-another"
          style={{ background: "none", border: "none", color: "rgba(0,255,0,0.5)", cursor: "pointer", fontSize: "10px", textDecoration: "underline", padding: 0 }}
        >
          Start a new submission
        </button>
      </p>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────
type Phase = "checking" | "form" | "awaiting_tx" | "saving" | "dashboard" | "error";

export default function GetVerified() {
  const { address } = useWallet();

  // form fields
  const [projectName, setProjectName] = useState("");
  const [tokenTicker, setTokenTicker] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [website, setWebsite] = useState("");

  const [phase, setPhase] = useState<Phase>("checking");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [submission, setSubmission] = useState<VerificationRequest | null>(null);

  // ── On mount: check localStorage for a stored tx hash ──────────────────
  const restoreFromStorage = useCallback(async () => {
    const storedTx = localStorage.getItem(LS_TX_KEY);
    if (storedTx) {
      console.log("[APOL Verified] Found cached tx in localStorage:", storedTx);
      const existing = await fetchSubmissionByTx(storedTx);
      if (existing) {
        console.log("[APOL Verified] Submission found in DB:", existing.status);
        setSubmission(existing);
        setTxHash(storedTx);
        setPhase("dashboard");
        return true;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    restoreFromStorage().then(found => {
      if (!found) setPhase("form");
    });
  }, [restoreFromStorage]);

  // ── When wallet connects: check DB for existing submission ───────────────
  useEffect(() => {
    if (!address || phase === "dashboard" || phase === "checking") return;
    fetchSubmissionByWallet(address).then(existing => {
      if (existing) {
        console.log("[APOL Verified] Wallet already has a submission:", existing.status);
        localStorage.setItem(LS_TX_KEY, existing.txHash);
        localStorage.setItem(LS_WALLET_KEY, address.toLowerCase());
        setSubmission(existing);
        setTxHash(existing.txHash);
        setPhase("dashboard");
      }
    });
  }, [address, phase]);

  const isFormValid =
    projectName.trim().length > 0 &&
    tokenTicker.trim().length > 0 &&
    contractAddress.trim().startsWith("0x") &&
    contractAddress.trim().length >= 10 &&
    website.trim().length > 0;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    const eth = getSelectedProvider();
    if (!eth) {
      console.log("[APOL Verified] Error: No wallet provider found.");
      setErrorMsg("No wallet detected. Please install MetaMask or connect a wallet.");
      setPhase("error");
      return;
    }

    console.log("[APOL Verified] Initiating audit submission...");
    setPhase("awaiting_tx");
    setErrorMsg("");

    try {
      // Step 1: request accounts
      console.log("[APOL Verified] Requesting accounts...");
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const senderAddress = accounts[0];
      console.log("[APOL Verified] Account:", senderAddress);

      // Step 2: signer + send tx
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      console.log(`[APOL Verified] Sending ${AUDIT_FEE} ETH to ${AUDIT_WALLET}...`);
      const tx = await signer.sendTransaction({
        to: AUDIT_WALLET,
        value: parseEther(AUDIT_FEE),
      });
      console.log("[APOL Verified] Transaction sent:", tx.hash);
      setTxHash(tx.hash);

      // Step 3: cache to localStorage IMMEDIATELY so page refresh is safe
      localStorage.setItem(LS_TX_KEY, tx.hash);
      localStorage.setItem(LS_WALLET_KEY, senderAddress.toLowerCase());
      localStorage.setItem(LS_PENDING_KEY, JSON.stringify({
        projectName: projectName.trim(),
        tokenTicker: tokenTicker.trim().toUpperCase(),
        contractAddress: contractAddress.trim(),
        website: website.trim(),
        walletAddress: senderAddress.toLowerCase(),
        txHash: tx.hash,
      }));
      console.log("[APOL Verified] Cached to localStorage.");

      // Step 4: poll for on-chain receipt
      console.log("[APOL Verified] Waiting for on-chain confirmation...");
      const success = await waitForReceipt(tx.hash);
      if (!success) {
        console.log("[APOL Verified] Transaction reverted.");
        setErrorMsg("Transaction reverted on-chain. Submission not recorded.");
        setPhase("error");
        return;
      }
      console.log("[APOL Verified] Transaction confirmed.");

      // Step 5: save to DB
      setPhase("saving");
      console.log("[APOL Verified] Saving to database...");
      const res = await fetch("/api/verification-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName.trim(),
          tokenTicker: tokenTicker.trim().toUpperCase(),
          contractAddress: contractAddress.trim(),
          website: website.trim(),
          txHash: tx.hash,
          walletAddress: senderAddress.toLowerCase(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Database save failed");
      }

      const saved: VerificationRequest = await res.json();
      console.log("[APOL Verified] Saved to DB:", saved.id);
      localStorage.removeItem(LS_PENDING_KEY);

      setSubmission(saved);
      setPhase("dashboard");
    } catch (e: any) {
      if (e.code === 4001 || e.code === "ACTION_REJECTED" || e.message?.includes("rejected")) {
        console.log("[APOL Verified] User rejected request.");
        setErrorMsg("Transaction rejected by user.");
      } else {
        console.log("[APOL Verified] Error:", e.message);
        setErrorMsg(e.message || "Submission failed. Please try again.");
      }
      setPhase("error");
    }
  };

  const handleReset = () => {
    localStorage.removeItem(LS_TX_KEY);
    localStorage.removeItem(LS_WALLET_KEY);
    localStorage.removeItem(LS_PENDING_KEY);
    setSubmission(null);
    setTxHash(null);
    setPhase("form");
    setProjectName("");
    setTokenTicker("");
    setContractAddress("");
    setWebsite("");
    setErrorMsg("");
  };

  const isPending = phase === "awaiting_tx" || phase === "saving";

  return (
    <div className="min-h-screen text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <Navigation />

      <div style={{ maxWidth: "680px", margin: "0 auto", padding: "120px 24px 80px" }}>

        {/* Back */}
        <Link href="/">
          <button style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.4)", fontSize: "12px",
            letterSpacing: "0.08em", textTransform: "uppercase",
            marginBottom: "40px", padding: 0,
          }} data-testid="link-back-home">
            <ArrowLeft size={14} /> Back to Home
          </button>
        </Link>

        {/* Page header */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <ShieldCheck size={20} color={G} />
            <span style={{ fontSize: "10px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              APOL Verification Protocol
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 900,
            textTransform: "uppercase", letterSpacing: "0.04em",
            lineHeight: 1.1, margin: "0 0 12px",
            background: "linear-gradient(90deg, #00ff00, #ffffff)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }} data-testid="text-page-title">
            Get Verified
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: "1.7", margin: 0 }}>
            Submit your project for APOL forensic audit. Our agents scan your contract,
            social presence, and on-chain activity. Results within 24 hours.
          </p>
        </div>

        {/* ── Checking state ───────────────────────────────────────────── */}
        {phase === "checking" && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "40px 0", color: "rgba(0,255,0,0.5)" }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "12px", letterSpacing: "0.1em" }}>Checking previous submissions…</span>
          </div>
        )}

        {/* ── Status dashboard ─────────────────────────────────────────── */}
        {phase === "dashboard" && submission && (
          <StatusDashboard submission={submission} onReset={handleReset} />
        )}

        {/* ── Submission form ──────────────────────────────────────────── */}
        {(phase === "form" || phase === "awaiting_tx" || phase === "saving" || phase === "error") && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ border: "1px solid rgba(0,255,0,0.2)", background: "#000" }}>

              {/* Form header */}
              <div style={{
                background: "rgba(0,255,0,0.05)",
                borderBottom: "1px solid rgba(0,255,0,0.15)",
                padding: "12px 20px",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <FileSearch size={14} color={G} />
                <span style={{ color: G, fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  Project Audit Submission
                </span>
              </div>

              <div style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <FieldRow label="Project Name *">
                    <input
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      placeholder="e.g. APE POLICE"
                      disabled={isPending}
                      data-testid="input-project-name"
                      style={inputStyle}
                    />
                  </FieldRow>
                  <FieldRow label="Token Ticker *">
                    <input
                      value={tokenTicker}
                      onChange={e => setTokenTicker(e.target.value.toUpperCase())}
                      placeholder="e.g. APOL"
                      maxLength={10}
                      disabled={isPending}
                      data-testid="input-token-ticker"
                      style={inputStyle}
                    />
                  </FieldRow>
                </div>

                <FieldRow label="Contract Address *">
                  <input
                    value={contractAddress}
                    onChange={e => setContractAddress(e.target.value)}
                    placeholder="0x…"
                    disabled={isPending}
                    data-testid="input-contract-address"
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </FieldRow>

                <FieldRow label="Website *">
                  <input
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    placeholder="https://yourproject.io"
                    disabled={isPending}
                    data-testid="input-website"
                    style={inputStyle}
                  />
                </FieldRow>

                {/* Fee info */}
                <div style={{
                  border: "1px solid rgba(0,255,0,0.15)", background: "rgba(0,255,0,0.03)",
                  padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <p style={{ fontSize: "9px", color: "rgba(0,255,0,0.45)", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 4px" }}>
                      Audit Fee
                    </p>
                    <p style={{ fontSize: "20px", fontWeight: 900, color: G, margin: 0 }}>
                      {AUDIT_FEE} ETH
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>
                      Turnaround
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                      24 Hours
                    </p>
                  </div>
                </div>

                {/* In-flight status rows */}
                {phase === "awaiting_tx" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", border: "1px solid rgba(0,255,0,0.25)", fontSize: "11px", color: "rgba(0,255,0,0.8)" }} data-testid="div-awaiting-tx">
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                    {txHash ? "Awaiting on-chain confirmation…" : "Confirm transaction in your wallet…"}
                    {txHash && (
                      <a href={`${CHAIN.explorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: G, marginLeft: "auto" }}>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}

                {phase === "saving" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", border: `1px solid ${G}`, fontSize: "11px", color: G }} data-testid="div-saving">
                    <Loader2 size={13} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                    Transaction confirmed — Recording submission…
                  </div>
                )}

                {phase === "error" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", border: "1px solid rgba(248,113,113,0.4)", fontSize: "11px", color: "#f87171" }} data-testid="text-error">
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    {errorMsg}
                  </div>
                )}

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={!isFormValid || isPending}
                  data-testid="button-submit-audit"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    padding: "14px 24px",
                    fontSize: "12px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                    fontFamily: "'JetBrains Mono', monospace",
                    background: isFormValid && !isPending ? G : "rgba(0,255,0,0.1)",
                    color: isFormValid && !isPending ? "#000" : "rgba(0,255,0,0.35)",
                    border: `1px solid ${G}`,
                    cursor: isFormValid && !isPending ? "pointer" : "not-allowed",
                    width: "100%",
                  }}
                >
                  {isPending
                    ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />Processing…</>
                    : <><ShieldCheck size={15} />Submit for Audit ({AUDIT_FEE} ETH)</>
                  }
                </button>

                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", textAlign: "center", margin: 0, lineHeight: "1.6" }}>
                  Payment is processed on Base via your connected wallet.
                  Submitting does not guarantee a passing verdict — APOL agents issue impartial findings.
                </p>
              </div>
            </div>

            {/* Why verify box on the form page too */}
            <WhyVerifyBox />
          </div>
        )}
      </div>
    </div>
  );
}
