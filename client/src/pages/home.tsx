import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Navigation from "@/components/navigation";
import HeroSection from "@/components/hero-section";
import MissionSection from "@/components/mission-section";
import TokenomicsSection from "@/components/tokenomics-section";
import ChannelSection from "@/components/channel-section";
import RoadmapSection from "@/components/roadmap-section";
import JoinSection from "@/components/join-section";
import VerifiedByApolSection from "@/components/verified-by-apol-section";
import Footer from "@/components/footer";
import RecentlyFlagged from "@/components/recently-flagged";

type RecentLookup = {
  id: number;
  address: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  lookupCount: number;
  lastScannedAt: string;
};

function ScanTicker() {
  const { data: lookups } = useQuery<RecentLookup[]>({ queryKey: ["/api/lookups/recent"], refetchInterval: 30000 });
  const items = lookups ?? [];
  if (items.length === 0) return null;

  const tickerContent = items.map(l => {
    const label = l.tokenSymbol ? `$${l.tokenSymbol}` : l.tokenName || `${l.address.slice(0, 8)}...`;
    return `${label} 👁️ ${l.lookupCount}`;
  }).join("     ·     ");

  return (
    <div data-testid="scan-ticker" style={{
      background: "#000", borderTop: "1px solid rgba(0,255,0,0.15)", borderBottom: "1px solid rgba(0,255,0,0.15)",
      overflow: "hidden", whiteSpace: "nowrap", padding: "8px 0",
    }}>
      <div style={{
        display: "inline-block",
        animation: "ticker-scroll 20s linear infinite",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11, letterSpacing: "0.05em",
      }}>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>LAST SCANNED: </span>
        <span style={{ color: "#00D1FF" }}>{tickerContent}</span>
        <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 40px" }}>|</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>LAST SCANNED: </span>
        <span style={{ color: "#00D1FF" }}>{tickerContent}</span>
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  useEffect(() => {
    const createSiren = () => {
      const siren = document.createElement('div');
      siren.className = 'fixed w-2 h-2 rounded-full animate-siren pointer-events-none z-0';
      siren.style.left = Math.random() * window.innerWidth + 'px';
      siren.style.top = Math.random() * window.innerHeight + 'px';
      document.body.appendChild(siren);

      setTimeout(() => {
        siren.remove();
      }, 3000);
    };

    const interval = setInterval(createSiren, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-x-hidden">
      <Navigation />
      <HeroSection />
      <ScanTicker />
      <MissionSection />
      <TokenomicsSection />
      <ChannelSection />
      <RecentlyFlagged />
      <RoadmapSection />
      <VerifiedByApolSection />
      <JoinSection />
      <Footer />
    </div>
  );
}
