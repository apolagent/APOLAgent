import { useState } from "react";
import { Link } from "wouter";
import { Menu, X, Bot } from "lucide-react";

const navLinks = [
  { id: "mission", label: "Mission" },
  { id: "tokenomics", label: "Network" },
  { id: "channel", label: "Channel" },
  { id: "roadmap", label: "Roadmap" },
  { id: "join", label: "Join" },
];

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
            <span className="font-meme text-lg" style={{ color: "#00ff00" }}>
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
          </div>

          {/* Buy button */}
          <button
            className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2 text-black"
            style={{ background: "#00ff00", border: "none" }}
            data-testid="link-buy-apol"
          >
            Buy $APOL
          </button>

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
            <button
              className="w-full mt-3 py-2 text-xs font-bold uppercase tracking-widest text-black"
              style={{ background: "#00ff00" }}
            >
              Buy $APOL
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
