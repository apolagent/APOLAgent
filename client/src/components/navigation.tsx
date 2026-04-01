import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Menu, X, Bot, Wallet, AlertTriangle, ChevronDown } from "lucide-react";

import { useWalletContext, type EIP6963ProviderDetail } from "@/hooks/use-wallet";
import { useQuery } from "@tanstack/react-query";

const G = "#00ff00";

const navLinks = [
  { id: "mission", label: "Mission" },
  { id: "tokenomics", label: "Network" },
  { id: "channel", label: "Channel" },
  { id: "roadmap", label: "Roadmap" },
  { id: "join", label: "Join" },
];

const actionBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "'JetBrains Mono', monospace",
  cursor: "pointer",
  padding: "5px 10px",
  whiteSpace: "nowrap",
  background: "transparent",
  border: "1px solid rgba(0,255,0,0.4)",
  color: G,
  borderRadius: "0",
  transition: "background 0.15s ease, color 0.15s ease",
  flexShrink: 0,
};

// Wallet picker dropdown
function WalletPicker({
  providers,
  onSelect,
  onClose,
}: {
  providers: EIP6963ProviderDetail[];
  onSelect: (d: EIP6963ProviderDetail) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-testid="div-wallet-picker"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        background: "#000",
        border: "1px solid rgba(0,255,0,0.35)",
        minWidth: "200px",
        zIndex: 9999,
        boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
      }}
    >
      <div style={{
        padding: "8px 12px 6px",
        fontSize: "9px",
        color: "rgba(0,255,0,0.45)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontFamily: "'JetBrains Mono', monospace",
        borderBottom: "1px solid rgba(0,255,0,0.12)",
      }}>
        Select Wallet
      </div>
      {providers.map(d => (
        <button
          key={d.info.uuid}
          onClick={() => onSelect(d)}
          data-testid={`button-wallet-${d.info.rdns}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            width: "100%",
            padding: "10px 14px",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid rgba(0,255,0,0.07)",
            color: "#fff",
            fontSize: "12px",
            fontFamily: "'JetBrains Mono', monospace",
            cursor: "pointer",
            textAlign: "left",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,255,0,0.07)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          {d.info.icon
            ? <img src={d.info.icon} alt={d.info.name} style={{ width: 18, height: 18, flexShrink: 0 }} />
            : <Wallet size={15} color={G} style={{ flexShrink: 0 }} />
          }
          {d.info.name}
        </button>
      ))}
    </div>
  );
}

function WalletButton({ compact = false }: { compact?: boolean }) {
  const {
    address, truncated, isBase, isConnecting, isSwitching,
    isIframe, providers, showPicker, setShowPicker,
    connect, connectWith, switchToBase,
  } = useWalletContext();

  const wrapperRef = useRef<HTMLDivElement>(null);

  const base: React.CSSProperties = {
    ...actionBtnStyle,
    padding: compact ? "5px 8px" : "5px 10px",
  };

  // iframe + no providers = can't use MetaMask
  if (isIframe && providers.length === 0) {
    return (
      <button
        onClick={() => window.open(window.location.href, "_blank")}
        data-testid="button-open-new-tab"
        style={base}
        title="MetaMask requires a direct browser tab"
      >
        <Wallet size={11} />
        {compact ? "Open App" : "Open in Tab"}
      </button>
    );
  }

  if (address && !isBase) {
    return (
      <button
        onClick={switchToBase}
        disabled={isSwitching}
        data-testid="button-switch-network"
        style={{ ...base, border: "1px solid #ff4444", color: "#ff4444" }}
      >
        <AlertTriangle size={11} />
        {isSwitching ? "Switching..." : "Wrong Network"}
      </button>
    );
  }

  if (address && isBase) {
    return (
      <div data-testid="div-wallet-connected" style={{ ...base, cursor: "default" }}>
        <span style={{ width: "6px", height: "6px", background: G, display: "inline-block", flexShrink: 0 }} />
        {truncated}
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        onClick={connect}
        disabled={isConnecting}
        data-testid="button-connect-wallet"
        style={base}
      >
        <Wallet size={11} />
        {isConnecting ? "Connecting..." : "Connect"}
        {providers.length > 1 && !isConnecting && (
          <ChevronDown size={10} style={{ marginLeft: "2px" }} />
        )}
      </button>
      {showPicker && (
        <WalletPicker
          providers={providers}
          onSelect={connectWith}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
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
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6">

        {/* Desktop bar (3-column grid) */}
        <div
          className="hidden lg:grid items-center h-14"
          style={{ gridTemplateColumns: "1fr auto 1fr" }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2 justify-self-start">
            <img
              src="/apol-agent-logo.png"
              alt="APOL Agent logo"
              className="w-7 h-7 object-cover"
            />
            <span className="font-meme text-lg" style={{ color: G }}>APOL AGENT</span>
          </div>

          {/* Center nav links */}
          <div className="flex items-center gap-5">
            {navLinks.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="text-xs uppercase tracking-widest text-white/60 hover:text-[#00ff00] transition-colors"
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", padding: 0, whiteSpace: "nowrap" }}
                data-testid={`link-nav-${id}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 justify-self-end">
            <Link href="/agent-scanner">
              <span style={actionBtnStyle} data-testid="link-nav-agent-scanner">
                <Bot size={11} />
                Scan Agent
              </span>
            </Link>
            <WalletButton />
            <button
              style={{ ...actionBtnStyle, background: G, border: `1px solid ${G}`, color: "#000", padding: "5px 14px", fontWeight: 900 }}
              data-testid="link-buy-apol"
            >
              Buy $APOL
            </button>
          </div>
        </div>

        {/* Mobile / tablet bar */}
        <div className="flex lg:hidden items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <img
              src="/apol-agent-logo.png"
              alt="APOL Agent logo"
              className="w-7 h-7 object-cover flex-shrink-0"
            />
            <span className="font-meme text-base" style={{ color: G }}>APOL AGENT</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-testid="button-mobile-menu"
            style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }}
          >
            {isMobileMenuOpen ? <X size={22} color="#fff" /> : <Menu size={22} color="#fff" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {isMobileMenuOpen && (
        <div style={{ background: "#000000", borderTop: "1px solid rgba(0,255,0,0.2)" }}>
          <div className="px-4 pt-3 pb-5 flex flex-col gap-1">
            {navLinks.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="block w-full text-left py-2 text-xs uppercase tracking-widest text-white/60 hover:text-[#00ff00] transition-colors"
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}
              >
                {label}
              </button>
            ))}
            <div style={{ borderTop: "1px solid rgba(0,255,0,0.1)", marginTop: "8px", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <Link href="/agent-scanner" onClick={() => setIsMobileMenuOpen(false)}>
                <span className="flex items-center gap-2 py-1 text-xs uppercase tracking-widest cursor-pointer" style={{ color: G, fontFamily: "'JetBrains Mono', monospace" }}>
                  <Bot size={13} />
                  Scan Agent
                </span>
              </Link>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <WalletButton />
                <button
                  style={{ ...actionBtnStyle, background: G, border: `1px solid ${G}`, color: "#000", padding: "7px 16px", fontWeight: 900 }}
                  data-testid="link-buy-apol-mobile"
                >
                  Buy $APOL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
