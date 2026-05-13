import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { LayoutGrid, ArrowRight, Database } from "lucide-react";
import Navigation from "@/components/navigation";

const G = "#00ff00";

type CertTier = "ALL" | "GOLD" | "SILVER" | "BRONZE" | "UNVERIFIED";

interface RegistryEntry {
  slug: string;
  agentName: string;
  wallet: string | null;
  tier: string;
  certificationTier: string;
  cognitionScore: number | null;
  verdict: string | null;
  createdAt: string;
}

interface RegistryResponse {
  total: number;
  results: RegistryEntry[];
}

const TIER_PALETTE: Record<string, { border: string; bg: string; text: string; label: string }> = {
  GOLD:       { border: "#fbbf24", bg: "rgba(251,191,36,0.08)",  text: "#fbbf24", label: "GOLD" },
  SILVER:     { border: "#94a3b8", bg: "rgba(148,163,184,0.08)", text: "#b0bec5", label: "SILVER" },
  BRONZE:     { border: "#b87333", bg: "rgba(184,115,51,0.08)",  text: "#cd8f4a", label: "BRONZE" },
  UNVERIFIED: { border: "rgba(255,255,255,0.2)", bg: "rgba(255,255,255,0.03)", text: "rgba(255,255,255,0.4)", label: "UNVERIFIED" },
};

const FILTER_TABS: { value: CertTier; label: string }[] = [
  { value: "ALL",        label: "ALL" },
  { value: "GOLD",       label: "GOLD" },
  { value: "SILVER",     label: "SILVER" },
  { value: "BRONZE",     label: "BRONZE" },
  { value: "UNVERIFIED", label: "UNVERIFIED" },
];

const PAGE_SIZE = 50;

function truncateWallet(wallet: string) {
  if (wallet.length <= 14) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function TierBadge({ tier }: { tier: string }) {
  const p = TIER_PALETTE[tier] ?? TIER_PALETTE.UNVERIFIED;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        border: `1px solid ${p.border}`,
        background: p.bg,
        color: p.text,
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {p.label}
    </span>
  );
}

function CognitionBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "#fbbf24" :
    score >= 50 ? "#94a3b8" :
    score >= 25 ? "#cd8f4a" : "rgba(255,255,255,0.25)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
      <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.07)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${score}%`, background: color }} />
      </div>
      <span style={{ fontSize: "10px", color, fontWeight: 700, minWidth: "28px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
        {score}%
      </span>
    </div>
  );
}

function AgentCard({ entry }: { entry: RegistryEntry }) {
  return (
    <div
      style={{
        background: "#000",
        border: "1px solid rgba(0,255,0,0.15)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "11px",
        transition: "border-color 0.15s ease",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,255,0,0.35)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(0,255,0,0.15)")}
    >
      {/* Name row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#fff",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.03em",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {entry.agentName}
        </span>
        <TierBadge tier={entry.certificationTier} />
      </div>

      {/* Verdict */}
      {entry.verdict && (
        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono', monospace" }}>
          {entry.verdict}
        </div>
      )}

      {/* Cognition score */}
      {entry.cognitionScore !== null && (
        <div>
          <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", fontFamily: "'JetBrains Mono', monospace", marginBottom: "4px" }}>
            COGNITION SCORE
          </div>
          <CognitionBar score={entry.cognitionScore} />
        </div>
      )}

      {/* Wallet + date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "2px" }}>
        {entry.wallet ? (
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
            {truncateWallet(entry.wallet)}
          </span>
        ) : (
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", fontFamily: "'JetBrains Mono', monospace" }}>
            no wallet
          </span>
        )}
        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
          {relativeDate(entry.createdAt)}
        </span>
      </div>

      {/* Scan tier pill + view link */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "6px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span
          style={{
            fontSize: "9px",
            color: entry.tier === "premium" ? "#fbbf24" : "rgba(255,255,255,0.25)",
            background: entry.tier === "premium" ? "rgba(251,191,36,0.07)" : "transparent",
            border: entry.tier === "premium" ? "1px solid rgba(251,191,36,0.3)" : "1px solid transparent",
            padding: "1px 6px",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {entry.tier}
        </span>
        <Link href={`/agent-scanner/${entry.slug}`}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              color: G,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            View Report <ArrowRight size={10} />
          </span>
        </Link>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#000", border: "1px solid rgba(0,255,0,0.08)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "11px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ width: "55%", height: "13px", background: "rgba(255,255,255,0.06)", borderRadius: 2 }} className="animate-pulse" />
        <div style={{ width: "22%", height: "18px", background: "rgba(255,255,255,0.04)", borderRadius: 2 }} className="animate-pulse" />
      </div>
      <div style={{ width: "70%", height: "10px", background: "rgba(255,255,255,0.04)", borderRadius: 2 }} className="animate-pulse" />
      <div style={{ width: "100%", height: "4px", background: "rgba(255,255,255,0.04)", borderRadius: 2 }} className="animate-pulse" />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ width: "38%", height: "10px", background: "rgba(255,255,255,0.04)", borderRadius: 2 }} className="animate-pulse" />
        <div style={{ width: "18%", height: "10px", background: "rgba(255,255,255,0.04)", borderRadius: 2 }} className="animate-pulse" />
      </div>
    </div>
  );
}

function EmptyState({ tier }: { tier: CertTier }) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "14px",
        padding: "60px 20px",
        border: "1px solid rgba(0,255,0,0.08)",
        color: "rgba(255,255,255,0.25)",
      }}
    >
      <Database size={32} style={{ opacity: 0.3 }} />
      <div style={{ fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textAlign: "center" }}>
        {tier === "ALL" ? "No agents have been scanned yet." : `No ${tier} agents found.`}
      </div>
    </div>
  );
}

export default function Registry() {
  const [selectedTier, setSelectedTier] = useState<CertTier>("ALL");
  const [offset, setOffset] = useState(0);
  const [accumulated, setAccumulated] = useState<RegistryEntry[]>([]);

  const queryKey = ["/api/registry", selectedTier, offset];
  const { data, isLoading, isFetching } = useQuery<RegistryResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (selectedTier !== "ALL") params.set("tier", selectedTier);
      const res = await fetch(`/api/registry?${params}`);
      if (!res.ok) throw new Error("Failed to load registry");
      return res.json();
    },
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  // Accumulate pages as user clicks Load More
  const prevKey = `${selectedTier}`;
  const [lastFilterKey, setLastFilterKey] = useState(prevKey);
  if (prevKey !== lastFilterKey) {
    setLastFilterKey(prevKey);
    setOffset(0);
    setAccumulated([]);
  }

  const newEntries = data?.results ?? [];
  const allEntries: RegistryEntry[] = offset === 0 ? newEntries : [...accumulated, ...newEntries];
  if (offset > 0 && accumulated.length < allEntries.length) {
    // keep accumulated in sync after load more
  }

  const total = data?.total ?? 0;
  const hasMore = allEntries.length < total;

  function handleTabChange(tier: CertTier) {
    setSelectedTier(tier);
    setOffset(0);
    setAccumulated([]);
  }

  function handleLoadMore() {
    setAccumulated(allEntries);
    setOffset(allEntries.length);
  }

  const tierColor = (t: CertTier) => {
    if (t === "ALL") return G;
    return TIER_PALETTE[t]?.text ?? G;
  };

  const tierBorder = (t: CertTier) => {
    if (t === "ALL") return G;
    return TIER_PALETTE[t]?.border ?? G;
  };

  return (
    <div style={{ background: "#000", minHeight: "100vh", fontFamily: "'JetBrains Mono', monospace" }}>
      <Navigation />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "100px 20px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <LayoutGrid size={18} color={G} />
            <span style={{ fontSize: "10px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Public Directory
            </span>
          </div>
          <h1
            style={{
              fontSize: "clamp(22px, 4vw, 34px)",
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "0.06em",
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            VERIFIED AGENT{" "}
            <span style={{ color: G }}>REGISTRY</span>
          </h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", marginTop: "10px", lineHeight: 1.6 }}>
            Browsable directory of all agents scanned by APOL, filtered by certification tier.
            {total > 0 && (
              <span style={{ color: "rgba(0,255,0,0.6)", marginLeft: "8px" }}>
                {total.toLocaleString()} unique agent{total !== 1 ? "s" : ""} scanned.
              </span>
            )}
          </p>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            marginBottom: "28px",
            borderBottom: "1px solid rgba(0,255,0,0.1)",
            paddingBottom: "16px",
          }}
        >
          {FILTER_TABS.map(tab => {
            const active = selectedTier === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                style={{
                  padding: "5px 14px",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: "pointer",
                  background: active ? "rgba(0,0,0,0)" : "transparent",
                  border: active ? `1px solid ${tierBorder(tab.value)}` : "1px solid rgba(255,255,255,0.1)",
                  color: active ? tierColor(tab.value) : "rgba(255,255,255,0.35)",
                  transition: "all 0.15s ease",
                  borderRadius: 0,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = active ? tierColor(tab.value) : "rgba(255,255,255,0.6)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = active ? tierBorder(tab.value) : "rgba(255,255,255,0.1)"; e.currentTarget.style.color = active ? tierColor(tab.value) : "rgba(255,255,255,0.35)"; }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "12px",
          }}
        >
          {isLoading && offset === 0
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : allEntries.length === 0
            ? <EmptyState tier={selectedTier} />
            : allEntries.map(entry => <AgentCard key={entry.slug} entry={entry} />)
          }
        </div>

        {/* Load More */}
        {!isLoading && hasMore && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginTop: "32px" }}>
            <button
              onClick={handleLoadMore}
              disabled={isFetching}
              style={{
                padding: "9px 28px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "'JetBrains Mono', monospace",
                cursor: isFetching ? "not-allowed" : "pointer",
                background: "transparent",
                border: `1px solid ${G}`,
                color: G,
                opacity: isFetching ? 0.5 : 1,
                transition: "background 0.15s ease",
              }}
              onMouseEnter={e => { if (!isFetching) e.currentTarget.style.background = "rgba(0,255,0,0.06)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {isFetching ? "Loading…" : `Load More (${total - allEntries.length} remaining)`}
            </button>
          </div>
        )}

        {/* End-of-results marker */}
        {!isLoading && !hasMore && allEntries.length > 0 && (
          <div style={{ textAlign: "center", marginTop: "32px", fontSize: "10px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
            — all {total.toLocaleString()} result{total !== 1 ? "s" : ""} loaded —
          </div>
        )}

      </div>
    </div>
  );
}
