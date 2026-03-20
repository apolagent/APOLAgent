import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ShieldCheck, CheckCircle, Loader2, AlertTriangle, ExternalLink, FileSearch } from "lucide-react";
import { BrowserProvider, JsonRpcProvider, parseEther } from "ethers";
import Navigation from "@/components/navigation";
import { CHAIN } from "@/lib/chain-config";

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

const G = "#00ff00";
const AUDIT_WALLET = "0x857aca6A8A743C9262d64819D239f509a1Cd0A85";
const AUDIT_FEE = "0.05";

type Phase = "form" | "awaiting_tx" | "saving" | "success" | "error";

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

export default function GetVerified() {
  const [projectName, setProjectName] = useState("");
  const [tokenTicker, setTokenTicker] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const isFormValid =
    projectName.trim().length > 0 &&
    tokenTicker.trim().length > 0 &&
    contractAddress.trim().startsWith("0x") &&
    contractAddress.trim().length >= 10 &&
    website.trim().length > 0;

  const handleSubmit = async () => {
    if (!isFormValid) return;

    const eth = (window as any).ethereum;
    if (!eth) {
      console.log("[APOL Verified] Error: MetaMask not detected.");
      setErrorMsg("MetaMask not detected. Please install MetaMask to submit for audit.");
      setPhase("error");
      return;
    }

    console.log("[APOL Verified] Initiating audit submission...");
    setPhase("awaiting_tx");
    setErrorMsg("");

    try {
      // Step 1: request accounts via window.ethereum.request
      console.log("[APOL Verified] Requesting accounts...");
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      console.log("[APOL Verified] Account available:", accounts[0]);

      // Step 2: build signer from BrowserProvider (no extra popup)
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();

      // Step 3: send transaction — MetaMask popup opens here
      console.log(`[APOL Verified] Sending ${AUDIT_FEE} ETH to ${AUDIT_WALLET}...`);
      const tx = await signer.sendTransaction({
        to: AUDIT_WALLET,
        value: parseEther(AUDIT_FEE),
      });
      console.log("[APOL Verified] Transaction sent:", tx.hash);
      setTxHash(tx.hash);

      // Step 4: poll for receipt via public RPC
      console.log("[APOL Verified] Waiting for on-chain confirmation...");
      const success = await waitForReceipt(tx.hash);

      if (!success) {
        console.log("[APOL Verified] Transaction reverted on-chain.");
        setErrorMsg("Transaction reverted on-chain. Submission not recorded.");
        setPhase("error");
        return;
      }
      console.log("[APOL Verified] Transaction confirmed.");

      // Step 5: save to DB
      console.log("[APOL Verified] Saving submission to database...");
      setPhase("saving");
      const res = await fetch("/api/verification-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName.trim(),
          tokenTicker: tokenTicker.trim().toUpperCase(),
          contractAddress: contractAddress.trim(),
          website: website.trim(),
          txHash: tx.hash,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Database save failed");
      }

      setPhase("success");
    } catch (e: any) {
      if (e.code === 4001 || e.code === "ACTION_REJECTED" || e.message?.includes("rejected")) {
        console.log("[APOL Verified] User rejected request.");
        setErrorMsg("Transaction rejected by user.");
      } else {
        console.log("[APOL Verified] Error:", e.message);
        setErrorMsg(e.message || "Submission failed. Please try again.");
      }
      setPhase("error");
    } finally {
      console.log("[APOL Verified] Handler complete — spinner cleared.");
    }
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

        {/* Header */}
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
            Submit your project for APOL forensic audit. Our agents will scan your contract,
            social presence, and on-chain activity. Results returned within 24 hours.
          </p>
        </div>

        {/* Success state */}
        {phase === "success" && (
          <div style={{ border: `1px solid ${G}`, background: "#000", padding: "40px 32px", textAlign: "center" }} data-testid="div-verification-success">
            <CheckCircle size={40} color={G} style={{ margin: "0 auto 16px" }} />
            <p style={{ color: G, fontSize: "14px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
              Payment Received
            </p>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "13px", lineHeight: "1.7", marginBottom: "24px" }}>
              Our agents are scanning your project. Results in 24 hours.
            </p>
            {txHash && (
              <a
                href={`${CHAIN.explorerUrl}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-success-tx"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", border: `1px solid ${G}`,
                  color: G, fontSize: "11px", letterSpacing: "0.08em",
                  textTransform: "uppercase", textDecoration: "none",
                }}
              >
                <ExternalLink size={12} />
                View Transaction on BaseScan
              </a>
            )}
          </div>
        )}

        {/* Form */}
        {phase !== "success" && (
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

              {/* Fee info box */}
              <div style={{
                border: "1px solid rgba(0,255,0,0.15)",
                background: "rgba(0,255,0,0.03)",
                padding: "14px 16px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
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

              {/* Status rows */}
              {phase === "awaiting_tx" && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 12px", border: "1px solid rgba(0,255,0,0.25)", fontSize: "11px", color: "rgba(0,255,0,0.8)" }} data-testid="div-awaiting-tx">
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                  {txHash ? "Awaiting on-chain confirmation..." : "Confirm transaction in MetaMask…"}
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
                  transition: "background 0.15s ease, color 0.15s ease",
                  width: "100%",
                }}
              >
                {isPending
                  ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />Processing…</>
                  : <><ShieldCheck size={15} />Submit for Audit ({AUDIT_FEE} ETH)</>
                }
              </button>

              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", textAlign: "center", margin: 0, lineHeight: "1.6" }}>
                Payment is processed on Base Mainnet via MetaMask.
                Submitting does not guarantee a passing verdict — APOL agents issue impartial findings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
