import { Link } from "wouter";
import { ShieldCheck, CheckCircle, ExternalLink } from "lucide-react";

const G = "#00ff00";

const PERKS = [
  "Full on-chain forensic audit",
  "Contract risk assessment",
  "Social verification scan",
  "Official APOL badge & listing",
];

export default function VerifiedByApolSection() {
  return (
    <section
      id="get-verified"
      style={{ padding: "80px 0", background: "transparent" }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 16px" }}>

        {/* Section label */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          marginBottom: "28px",
        }}>
          <span style={{
            display: "inline-block", width: "28px", height: "1px",
            background: "rgba(0,255,0,0.4)",
          }} />
          <span style={{
            fontSize: "9px", color: "rgba(0,255,0,0.85)",
            letterSpacing: "0.18em", textTransform: "uppercase",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            APOL Verification Protocol
          </span>
        </div>

        {/* Main card */}
        <div style={{
          border: `1px solid rgba(0,255,0,0.3)`,
          background: "#000",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0",
          overflow: "hidden",
        }}>

          {/* Left — copy */}
          <div style={{
            padding: "clamp(20px, 5vw, 40px) clamp(16px, 4vw, 36px)",
            borderRight: "1px solid rgba(0,255,0,0.15)",
            display: "flex", flexDirection: "column", gap: "20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <ShieldCheck size={22} color={G} />
              <h2 style={{
                fontSize: "clamp(20px, 3vw, 30px)",
                fontWeight: 900, textTransform: "uppercase",
                letterSpacing: "0.06em", margin: 0,
                background: `linear-gradient(90deg, ${G}, #ffffff)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                Get Verified by APOL
              </h2>
            </div>

            <p style={{
              fontSize: "13px", color: "rgba(255,255,255,0.72)",
              lineHeight: "1.75", margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Submit your project for a full APOL forensic audit.
              Our agents scan your contract, social presence, and on-chain
              activity. Projects that pass receive an official APOL badge
              and listing: a verified clean signal for the community.
            </p>

            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
              {PERKS.map(perk => (
                <li key={perk} style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  fontSize: "12px", color: "rgba(255,255,255,0.82)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  <CheckCircle size={13} color={G} style={{ flexShrink: 0 }} />
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — CTA */}
          <div style={{
            padding: "clamp(20px, 5vw, 40px) clamp(16px, 4vw, 36px)",
            display: "flex", flexDirection: "column",
            justifyContent: "center", alignItems: "flex-start", gap: "24px",
            background: "rgba(0,255,0,0.025)",
          }}>

            {/* Fee block */}
            <div>
              <p style={{
                fontSize: "9px", color: "rgba(0,255,0,0.85)",
                letterSpacing: "0.14em", textTransform: "uppercase",
                fontFamily: "'JetBrains Mono', monospace", margin: "0 0 6px",
              }}>
                Audit Fee
              </p>
              <p style={{
                fontSize: "clamp(26px, 6vw, 42px)", fontWeight: 900, color: G, margin: 0,
                fontFamily: "'JetBrains Mono', monospace", lineHeight: 1,
              }}>
                0.05 ETH
              </p>
              <p style={{
                fontSize: "11px", color: "rgba(255,255,255,0.65)",
                margin: "6px 0 0", fontFamily: "'JetBrains Mono', monospace",
              }}>
                Results returned within 24 hours
              </p>
            </div>

            {/* CTA button */}
            <Link href="/get-verified">
              <button
                data-testid="button-get-verified-cta"
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "13px 24px",
                  background: G, color: "#000",
                  border: `1px solid ${G}`,
                  fontSize: "12px", fontWeight: 900,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: "pointer", borderRadius: "0",
                  whiteSpace: "nowrap",
                  transition: "background 0.15s ease",
                }}
              >
                <ShieldCheck size={14} />
                Submit for Audit
                <ExternalLink size={12} style={{ marginLeft: "2px" }} />
              </button>
            </Link>

            <Link href="/verified-builders">
              <button
                data-testid="button-view-verified-builders"
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 20px",
                  background: "none", color: G,
                  border: `1px solid rgba(0,255,0,0.35)`,
                  fontSize: "11px", fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: "pointer", borderRadius: "0",
                  whiteSpace: "nowrap",
                }}
              >
                <ShieldCheck size={13} />
                View Certified Projects
              </button>
            </Link>

            <p style={{
              fontSize: "10px", color: "rgba(255,255,255,0.6)",
              fontFamily: "'JetBrains Mono', monospace", lineHeight: "1.6",
              margin: 0,
            }}>
              Submitting does not guarantee a passing verdict.
              APOL agents issue impartial findings.
              Payment on Base via MetaMask.
            </p>
          </div>
        </div>
      </div>

      {/* Responsive: stack on small screens */}
      <style>{`
        @media (max-width: 640px) {
          #get-verified [style*="grid-template-columns"] {
            display: flex !important;
            flex-direction: column !important;
          }
          #get-verified [style*="border-right"] {
            border-right: none !important;
            border-bottom: 1px solid rgba(0,255,0,0.15) !important;
          }
          #get-verified [style*="padding: \"40px 36px\""],
          #get-verified > div > div > div {
            padding: 24px 20px !important;
          }
        }
      `}</style>
    </section>
  );
}
