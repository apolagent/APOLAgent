import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, Bot, Wallet, AlertTriangle, ShieldCheck } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";

const G = "#00ff00";

const navLinks = [
  { id: "mission", label: "Mission" },
  { id: "tokenomics", label: "Network" },
  { id: "channel", label: "Channel" },
  { id: "roadmap", label: "Roadmap" },
  { id: "join", label: "Join" },
];

function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, truncated, isBase, isConnecting, isSwitching, hasMetaMask, connect, switchToBase } = useWallet();

  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontFamily: "'JetBrains Mono', monospace",
    cursor: "pointer",
    borderRadius: "0",
    padding: compact ? "6px 10px" : "6px 12px",
    whiteSpace: "nowrap",
    transition: "background 0.15s ease, color 0.15s ease",
  };

  if (address && !isBase) {
    return (
      <button
        onClick={switchToBase}
        disabled={isSwitching}
        data-testid="button-switch-network"
        style={{
          ...base,
          background: "transparent",
          border: "1px solid #ff4444",
          color: "#ff4444",
        }}
      >
        <AlertTriangle size={12} />
        {isSwitching ? "Switching..." : "Wrong Network"}
      </button>
    );
  }

  if (address && isBase) {
    return (
      <div
        data-testid="div-wallet-connected"
        style={{
          ...base,
          background: "transparent",
          border: `1px solid ${G}`,
          color: G,
          cursor: "default",
        }}
      >
        <span style={{ width: "6px", height: "6px", background: G, display: "inline-block", flexShrink: 0 }} />
        {truncated}
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      data-testid="button-connect-wallet"
      style={{
        ...base,
        background: "transparent",
        border: `1px solid ${G}`,
        color: G,
      }}
    >
      <Wallet size={12} />
      {isConnecting ? "Connecting..." : hasMetaMask ? "Connect Wallet" : "Install MetaMask"}
    </button>
  );
}

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <nav
      style={{ background: "#000000", borderBottom: "1px solid rgba(0,255,0,0.2)" }}
      className="fixed top-0 w-full z-50"
      data-testid="navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">

          {/* Logo + brand */}
          <div className="flex items-center gap-2">
            <img
              src="/ape-police-logo.png"
              alt="APE POLICE logo"
              className="w-7 h-7 object-cover rounded-full border border-[#00ff00]/40"
            />
            <span className="font-meme text-lg" style={{ color: G }}>
              APE POLICE
            </span>
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="text-xs uppercase tracking-widest text-white/60 hover:text-[#00ff00] transition-colors"
                data-testid={`link-nav-${id}`}
              >
                {label}
              </button>
            ))}
            <Link href="/agent-scanner">
              <span
                className="flex items-center gap-1 text-xs uppercase tracking-widest px-3 py-1.5 cursor-pointer text-[#00ff00] transition-colors"
                style={{ border: "1px solid rgba(0,255,0,0.4)" }}
                data-testid="link-nav-agent-scanner"
              >
                <Bot className="w-3 h-3" />
                Scan Agent
              </span>
            </Link>
            <Link href="/get-verified">
              <span
                className="flex items-center gap-1 text-xs uppercase tracking-widest px-3 py-1.5 cursor-pointer text-[#00ff00] transition-colors"
                style={{ border: "1px solid rgba(0,255,0,0.4)" }}
                data-testid="link-nav-get-verified"
              >
                <ShieldCheck className="w-3 h-3" />
                Get Verified
              </span>
            </Link>
          </div>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-3">
            <WalletButton />
            <button
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 text-black"
              style={{ background: G, border: "none" }}
              data-testid="link-buy-apol"
            >
              Buy $APOL
            </button>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-white p-1"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div style={{ background: "#000000", borderTop: "1px solid rgba(0,255,0,0.2)" }}>
          <div className="px-4 pt-2 pb-4 space-y-1">
            {navLinks.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="block w-full text-left py-2 text-xs uppercase tracking-widest text-white/60 hover:text-[#00ff00] transition-colors"
              >
                {label}
              </button>
            ))}
            <Link href="/agent-scanner" onClick={() => setIsMobileMenuOpen(false)}>
              <span className="flex items-center gap-2 py-2 text-xs uppercase tracking-widest text-[#00ff00] cursor-pointer">
                <Bot className="w-3.5 h-3.5" />
                Scan Agent
              </span>
            </Link>
            <Link href="/get-verified" onClick={() => setIsMobileMenuOpen(false)}>
              <span className="flex items-center gap-2 py-2 text-xs uppercase tracking-widest text-[#00ff00] cursor-pointer">
                <ShieldCheck className="w-3.5 h-3.5" />
                Get Verified
              </span>
            </Link>
            <div className="pt-2 flex flex-col gap-2">
              <WalletButton compact />
              <button
                className="w-full py-2 text-xs font-bold uppercase tracking-widest text-black"
                style={{ background: G }}
              >
                Buy $APOL
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
