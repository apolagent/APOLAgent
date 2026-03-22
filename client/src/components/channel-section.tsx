import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Shield, ExternalLink, ChevronRight } from "lucide-react";
import { CHAIN } from "@/lib/chain-config";

const G = "#00FF00";

type VerifiedProject = {
  id: number;
  projectName: string;
  contractAddress: string;
  chain: string;
  projectDescription: string | null;
  website: string | null;
  twitter: string | null;
  teamName: string | null;
  status: string;
};

function truncateAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ProjectCard({ project }: { project: VerifiedProject }) {
  const chainExplorer =
    project.chain === "base" ? "https://basescan.org"
    : project.chain === "eth" ? "https://etherscan.io"
    : project.chain === "bsc" ? "https://bscscan.com"
    : CHAIN.explorerUrl;

  return (
    <div
      data-testid={`card-channel-verified-${project.id}`}
      style={{
        border: `1px solid rgba(0,255,0,0.2)`,
        background: "#000",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        position: "relative",
        transition: "border-color 0.15s ease",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = G)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(0,255,0,0.2)")}
    >
      {/* Verified badge */}
      <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
        <Shield size={10} color={G} />
        <span style={{ fontSize: "7px", color: G, fontWeight: 700, letterSpacing: "0.12em" }}>VERIFIED</span>
      </div>

      {/* Name */}
      <div>
        <div style={{ fontSize: "13px", fontWeight: 900, color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase", paddingRight: "60px", fontFamily: "'JetBrains Mono', monospace" }}>
          {project.projectName}
        </div>
        {project.teamName && (
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "2px", letterSpacing: "0.06em", fontFamily: "'JetBrains Mono', monospace" }}>
            by {project.teamName}
          </div>
        )}
      </div>

      {/* Description */}
      {project.projectDescription && (
        <div style={{
          fontSize: "10px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {project.projectDescription}
        </div>
      )}

      {/* Footer: chain + contract + link */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "auto" }}>
        <span style={{
          fontSize: "7px", padding: "2px 6px",
          border: `1px solid rgba(0,255,0,0.2)`, color: "rgba(0,255,0,0.6)",
          letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace",
        }}>
          {project.chain.toUpperCase()}
        </span>
        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
          {truncateAddr(project.contractAddress)}
        </span>
        <a
          href={`${chainExplorer}/address/${project.contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "rgba(0,255,0,0.5)", marginLeft: "auto" }}
          data-testid={`link-channel-explorer-${project.id}`}
        >
          <ExternalLink size={11} />
        </a>
      </div>

      {/* Certificate link */}
      <Link href={`/verify/${project.contractAddress.toLowerCase()}`}>
        <div style={{
          borderTop: `1px solid rgba(0,255,0,0.1)`,
          paddingTop: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}>
          <span style={{ fontSize: "9px", color: G, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
            View Certificate
          </span>
          <ChevronRight size={11} color={G} />
        </div>
      </Link>
    </div>
  );
}

export default function ChannelSection() {
  const { data: projects = [], isLoading } = useQuery<VerifiedProject[]>({
    queryKey: ["/api/contracts/verified"],
  });

  return (
    <section
      id="channel"
      style={{ padding: "80px 0", background: "transparent" }}
    >
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 16px" }}>

        {/* Section header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "36px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ display: "inline-block", width: "28px", height: "1px", background: "rgba(0,255,0,0.4)" }} />
              <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.85)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                APOL Verification Registry
              </span>
            </div>
            <h2 style={{
              fontSize: "clamp(26px, 5vw, 48px)",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              margin: 0,
              lineHeight: 1.1,
              color: "#fff",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              Verified<br />
              <span style={{ color: G }}>Builders</span>
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {projects.length > 0 && (
              <span style={{ fontSize: "10px", color: "rgba(0,255,0,0.6)", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>
                {projects.length} CERTIFIED
              </span>
            )}
            <Link href="/verified-builders">
              <button
                data-testid="button-channel-view-all"
                style={{
                  border: `1px solid ${G}`,
                  background: "none",
                  color: G,
                  padding: "8px 18px",
                  fontSize: "10px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                View All
                <ChevronRight size={12} />
              </button>
            </Link>
          </div>
        </div>

        {/* Projects grid */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(0,255,0,0.5)", fontSize: "11px", letterSpacing: "0.12em", fontFamily: "'JetBrains Mono', monospace" }}>
            [ LOADING REGISTRY... ]
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <div style={{ border: `1px solid rgba(0,255,0,0.15)`, padding: "48px 24px", textAlign: "center" }}>
            <Shield size={28} color="rgba(0,255,0,0.2)" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
              No verified projects yet
            </div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", marginTop: "6px", fontFamily: "'JetBrains Mono', monospace" }}>
              Submit your project for the first APOL audit.
            </div>
          </div>
        )}

        {!isLoading && projects.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1px", background: "rgba(0,255,0,0.08)" }}>
            {projects.slice(0, 6).map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* CTA row */}
        <div style={{ marginTop: "32px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", borderTop: `1px solid rgba(0,255,0,0.12)`, paddingTop: "24px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", lineHeight: 1.6, maxWidth: "480px" }}>
              Projects that pass the Ape Police audit are listed here with an official APOL certificate.
              Each entry has passed contract security review, team vetting, and community scrutiny.
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/get-verified">
              <button
                data-testid="button-channel-get-verified"
                style={{
                  border: `1px solid ${G}`,
                  background: G,
                  color: "#000",
                  padding: "10px 22px",
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Shield size={13} />
                Apply for Verification
              </button>
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
