import { useEffect } from "react";
import Navigation from "@/components/navigation";
import HeroSection from "@/components/hero-section";
import MissionSection from "@/components/mission-section";
import TokenomicsSection from "@/components/tokenomics-section";
import ChannelSection from "@/components/channel-section";
import RoadmapSection from "@/components/roadmap-section";
import JoinSection from "@/components/join-section";
import Footer from "@/components/footer";

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
      <MissionSection />
      <TokenomicsSection />
      <ChannelSection />
      <RoadmapSection />
      <JoinSection />
      <Footer />
    </div>
  );
}
