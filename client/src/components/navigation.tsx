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

function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, truncated, isBase, isConnecting, isSwitching, hasMetaMask, connect, switchToBase } = useWallet();

  const base: React.CSSProperties = {
    ...actionBtnStyle,
    padding: compact ? "5px 8px" : "5px 10px",
  };

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
      <div
        data-testid="div-wallet-connected"
        style={{ ...base, cursor: "default" }}
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
      style={base}
    >
      <Wallet size={11} />
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
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6">

        {/* ── Desktop bar (3-column grid) ── */}
        <div
          className="hidden lg:grid items-center h-14"
          style={{ gridTemplateColumns: "1fr auto 1fr" }}
        >

          {/* Col 1 – Logo */}
          <div className="flex items-center gap-2 justify-self-start">
            <img
              src="/ape-police-logo.png"
              alt="APE POLICE logo"
              className="w-7 h-7 object-cover rounded-full border border-[#00ff00]/40"
            />
            <span className="font-meme text-lg" style={{ color: G }}>
              APE POLICE
            </span>
          </div>

          {/* Col 2 – Nav links (truly centered) */}
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

          {/* Col 3 – Action buttons */}
          <div className="flex items-center gap-2 justify-self-end">
            <Link href="/agent-scanner">
              <span style={actionBtnStyle} data-testid="link-nav-agent-scanner">
                <Bot size={11} />
                Scan Agent
              </span>
            </Link>
            <Link href="/get-verified">
              <span style={actionBtnStyle} data-testid="link-nav-get-verified">
                <ShieldCheck size={11} />
                Get Verified
              </span>
            </Link>
            <WalletButton />
            <button
              style={{
                ...actionBtnStyle,
                background: G,
                border: `1px solid ${G}`,
                color: "#000",
                padding: "5px 14px",
                fontWeight: 900,
              }}
              data-testid="link-buy-apol"
            >
              Buy $APOL
            </button>
          </div>
        </div>

        {/* ── Mobile / tablet bar ── */}
        <div className="flex lg:hidden items-center h-14">

          {/* Logo */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img
              src="/ape-police-logo.png"
              alt="APE POLICE logo"
              className="w-7 h-7 object-cover rounded-full border border-[#00ff00]/40 flex-shrink-0"
            />
            <span className="font-meme text-base truncate" style={{ color: G }}>
              APE POLICE
            </span>
          </div>

          {/* Always-visible right controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <WalletButton compact />
            <button
              style={{
                ...actionBtnStyle,
                background: G,
                border: `1px solid ${G}`,
                color: "#000",
                padding: "5px 10px",
                fontWeight: 900,
              }}
              data-testid="link-buy-apol-mobile"
            >
              Buy $APOL
            </button>
            <button
              className="text-white p-1"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              data-testid="button-mobile-menu"
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {isMobileMenuOpen && (
        <div style={{ background: "#000000", borderTop: "1px solid rgba(0,255,0,0.2)" }}>
          <div className="px-4 pt-2 pb-4 flex flex-col gap-1">
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
            <div style={{ borderTop: "1px solid rgba(0,255,0,0.1)", marginTop: "6px", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <Link href="/agent-scanner" onClick={() => setIsMobileMenuOpen(false)}>
                <span className="flex items-center gap-2 py-1 text-xs uppercase tracking-widest cursor-pointer" style={{ color: G, fontFamily: "'JetBrains Mono', monospace" }}>
                  <Bot size={13} />
                  Scan Agent
                </span>
              </Link>
              <Link href="/get-verified" onClick={() => setIsMobileMenuOpen(false)}>
                <span className="flex items-center gap-2 py-1 text-xs uppercase tracking-widest cursor-pointer" style={{ color: G, fontFamily: "'JetBrains Mono', monospace" }}>
                  <ShieldCheck size={13} />
                  Get Verified
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
