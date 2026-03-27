import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, ExternalLink, Search } from "lucide-react";
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
  telegram: string | null;
  teamName: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  txHash: string | null;
};

function truncateAddr(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

export default function VerifiedBuilders() {
  const [search, setSearch] = useState("");

  const { data: projects = [], isLoading } = useQuery<VerifiedProject[]>({
    queryKey: ["/api/contracts/verified"],
  });

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.projectName.toLowerCase().includes(q) ||
      p.contractAddress.toLowerCase().includes(q) ||
      (p.projectDescription || "").toLowerCase().includes(q) ||
      (p.teamName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        fontFamily: "'JetBrains Mono', monospace",
        padding: "0",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: `1px solid rgba(0,255,0,0.2)`,
          background: "rgba(0,255,0,0.03)",
          padding: "18px 32px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <Link href="/">
          <button
            data-testid="button-back-home"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: G,
              fontSize: "11px",
              letterSpacing: "0.1em",
              padding: 0,
            }}
          >
            <ArrowLeft size={14} />
            HOME
          </button>
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ color: G, fontSize: "13px", fontWeight: 900, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            Verified Builders
          </div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            APOL Agent Certified: Community Vetted Projects
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Shield size={20} color={G} />
          <span style={{ color: G, fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em" }}>
            {projects.length} CERTIFIED
          </span>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>

        {/* Page intro */}
        <div style={{ marginBottom: "32px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Official Registry
          </div>
          <h1 style={{ fontSize: "clamp(24px, 5vw, 42px)", fontWeight: 900, color: "#fff", letterSpacing: "0.04em", lineHeight: 1.1, margin: 0 }}>
            APOL AGENT<br />
            <span style={{ color: G }}>CERTIFIED PROJECTS</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", lineHeight: 1.7, maxWidth: "560px", marginTop: "8px" }}>
            These projects have submitted to and passed the APOL Agent community audit process.
            Each verified entry has undergone contract security review, team vetting, and community scrutiny.
          </p>
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            border: `1px solid rgba(0,255,0,0.3)`,
            padding: "10px 14px",
            marginBottom: "28px",
          }}
        >
          <Search size={14} color="rgba(0,255,0,0.6)" />
          <input
            data-testid="input-search-verified"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, contract, or team..."
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: "12px",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.04em",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "12px" }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(0,255,0,0.6)", fontSize: "12px", letterSpacing: "0.12em" }}>
            [ LOADING REGISTRY... ]
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              border: `1px solid rgba(0,255,0,0.15)`,
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <Shield size={32} color="rgba(0,255,0,0.2)" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontSize: "12px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              {search ? "No projects match your search" : "No verified projects yet"}
            </div>
            <div style={{ fontSize: "10px", marginTop: "8px", color: "rgba(255,255,255,0.2)" }}>
              {search ? "Try a different search term" : "Submit your project for verification on the Get Verified page."}
            </div>
            {!search && (
              <Link href="/get-verified">
                <button
                  data-testid="button-get-verified-empty"
                  style={{
                    marginTop: "20px",
                    border: `1px solid ${G}`,
                    background: "none",
                    color: G,
                    padding: "10px 20px",
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Get Verified
                </button>
              </Link>
            )}
          </div>
        )}

        {/* Grid */}
        {!isLoading && filtered.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1px", background: "rgba(0,255,0,0.1)" }}>
            {filtered.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* CTA */}
        {!isLoading && (
          <div
            style={{
              marginTop: "48px",
              border: `1px solid rgba(0,255,0,0.2)`,
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              textAlign: "center",
            }}
          >
            <Shield size={24} color={G} />
            <div style={{ color: "#fff", fontSize: "14px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Is Your Project Ready for Certification?
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", maxWidth: "420px", lineHeight: 1.7 }}>
              Submit your project contract address, team details, and documentation. Our officers will audit it and add you to the verified registry.
            </div>
            <Link href="/get-verified">
              <button
                data-testid="button-get-verified-cta"
                style={{
                  border: `1px solid ${G}`,
                  background: "none",
                  color: G,
                  padding: "12px 28px",
                  fontSize: "12px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                }}
              >
                Apply for Verification →
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: VerifiedProject }) {
  const chainExplorer = project.chain === "base"
    ? "https://basescan.org"
    : project.chain === "eth"
    ? "https://etherscan.io"
    : project.chain === "bsc"
    ? "https://bscscan.com"
    : CHAIN.explorerUrl;

  return (
    <div
      data-testid={`card-verified-project-${project.id}`}
      style={{
        background: "#000",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        borderBottom: `1px solid rgba(0,255,0,0.1)`,
        position: "relative",
      }}
    >
      {/* Certified badge */}
      <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", alignItems: "center", gap: "5px" }}>
        <Shield size={12} color={G} />
        <span style={{ fontSize: "8px", color: G, fontWeight: 700, letterSpacing: "0.12em" }}>VERIFIED</span>
      </div>

      {/* Project name */}
      <div>
        <div style={{ fontSize: "15px", fontWeight: 900, color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase", paddingRight: "60px" }}>
          {project.projectName}
        </div>
        {project.teamName && (
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginTop: "2px", letterSpacing: "0.08em" }}>
            by {project.teamName}
          </div>
        )}
      </div>

      {/* Description */}
      {project.projectDescription && (
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {project.projectDescription}
        </div>
      )}

      {/* Contract address */}
      <div>
        <div style={{ fontSize: "8px", color: "rgba(0,255,0,0.4)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "3px" }}>
          Contract
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono', monospace" }}>
            {truncateAddr(project.contractAddress)}
          </span>
          <a
            href={`${chainExplorer}/address/${project.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: G }}
            data-testid={`link-explorer-${project.id}`}
          >
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Chain pill */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span style={{
          fontSize: "8px",
          padding: "2px 8px",
          border: `1px solid rgba(0,255,0,0.25)`,
          color: "rgba(0,255,0,0.7)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          {project.chain.toUpperCase()}
        </span>

        {/* Social links */}
        {project.website && (
          <a href={project.website} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", textDecoration: "underline", letterSpacing: "0.04em" }}
            data-testid={`link-website-${project.id}`}
          >
            Web
          </a>
        )}
        {project.twitter && (
          <a href={`https://x.com/${project.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", textDecoration: "underline", letterSpacing: "0.04em" }}
            data-testid={`link-twitter-${project.id}`}
          >
            X
          </a>
        )}
        {project.telegram && (
          <a href={`https://t.me/${project.telegram.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", textDecoration: "underline", letterSpacing: "0.04em" }}
            data-testid={`link-telegram-${project.id}`}
          >
            TG
          </a>
        )}
      </div>

      {/* Certificate link */}
      <Link href={`/verify/${project.contractAddress.toLowerCase()}`}>
        <button
          data-testid={`button-view-cert-${project.id}`}
          style={{
            width: "100%",
            border: `1px solid rgba(0,255,0,0.25)`,
            background: "none",
            color: G,
            padding: "8px",
            fontSize: "9px",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontFamily: "'JetBrains Mono', monospace",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <Shield size={10} />
          View Certificate
        </button>
      </Link>
    </div>
  );
}
