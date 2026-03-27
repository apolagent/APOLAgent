import { Link } from "wouter";
import { useWalletContext } from "@/hooks/use-wallet";

const ADMIN_WALLET = "0x857aca6a8a743c9262d64819d239f509a1cd0a85";

export default function Footer() {
  const { address } = useWalletContext();
  const isAdmin = !!address && address.toLowerCase() === ADMIN_WALLET;

  return (
    <footer
      className="py-12"
      style={{ background: "transparent", borderTop: "1px solid rgba(0,255,0,0.15)" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">

          {/* APOL Logo */}
          <div className="flex justify-center mb-5">
            <img
              src="/apol-agent-logo.png"
              alt="APOL Agent"
              className="w-14 h-14 object-cover"
            />
          </div>

          {/* Main credit */}
          <p className="text-base font-semibold text-white mb-1 tracking-wide">
            <span className="font-meme gradient-text">APOL AGENT</span>
          </p>
          <p className="text-xs uppercase tracking-widest mb-6" style={{ color: "rgba(0,255,0,0.5)" }}>
            Digital Asset Intelligence Network
          </p>

          <div className="mb-6">
            <Link
              href="/whitepaper"
              data-testid="link-whitepaper"
              style={{
                fontSize: "10px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "rgba(0,255,0,0.5)",
                textDecoration: "none",
                fontFamily: "JetBrains Mono, monospace",
                transition: "color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#00ff00")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(0,255,0,0.5)")}
            >
              Whitepaper
            </Link>
          </div>

          {/* Operational disclaimer */}
          <p className="text-xs max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
            © 2026 APOL Agent. Providing on-chain forensics and agent verification for the Base ecosystem.
            Data is aggregated from public streams; users are responsible for all trading decisions.
          </p>

          {/* Admin shortcut — only visible to the admin wallet */}
          {isAdmin && (
            <div className="mt-6">
              <Link
                href="/admin/dashboard"
                data-testid="link-admin-dashboard"
                style={{
                  fontSize: "9px",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(0,255,0,0.3)",
                  textDecoration: "none",
                  fontFamily: "JetBrains Mono, monospace",
                  transition: "color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(0,255,0,0.75)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(0,255,0,0.3)")}
              >
                Admin
              </Link>
            </div>
          )}

        </div>
      </div>
    </footer>
  );
}
