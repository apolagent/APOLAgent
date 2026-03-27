import { useState } from "react";
import { Send, Coins } from "lucide-react";

const G = "#00ff00";

export default function HeroSection() {
  const [primaryHover, setPrimaryHover] = useState(false);

  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      data-testid="hero-section"
    >
      <div className="text-center px-4 max-w-4xl mx-auto">

        {/* Official seal */}
        <div className="mb-6 inline-block">
          <img
            src="/apol-agent-logo.png"
            alt="APOL Agent official seal"
            className="w-36 h-36 md:w-48 md:h-48 mx-auto object-cover"
          />
        </div>

        {/* Main headline */}
        <h1
          className="font-meme text-3xl md:text-6xl lg:text-7xl mb-5 leading-tight gradient-text uppercase"
          data-testid="text-headline"
        >
          On-Chain Agent Verification
        </h1>

        {/* Sub-header */}
        <p
          className="text-sm md:text-base max-w-2xl mx-auto leading-relaxed mb-12 uppercase tracking-wide"
          style={{ color: "rgba(255,255,255,0.45)" }}
          data-testid="text-description"
        >
          Securing the Base ecosystem through real-time forensic analysis of autonomous agents and developer logic.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">

          {/* PRIMARY — ACCESS TERMINAL */}
          <a
            href="https://t.me/ApolAgentBot"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="button-join-patrol"
            onMouseEnter={() => setPrimaryHover(true)}
            onMouseLeave={() => setPrimaryHover(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "42px",
              width: "100%",
              maxWidth: "240px",
              backgroundColor: primaryHover ? G : "#000000",
              color: primaryHover ? "#000000" : G,
              fontSize: "13px",
              fontWeight: 800,
              borderRadius: "0",
              border: `1px solid ${G}`,
              cursor: "pointer",
              padding: "0 16px",
              gap: "8px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
              boxSizing: "border-box",
              transition: "background-color 0.15s ease, color 0.15s ease",
            }}
          >
            <Send size={16} />
            Access Terminal
          </a>

          {/* SECONDARY — ACQUIRE ACCESS KEY */}
          <button
            data-testid="button-buy-apol"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "42px",
              width: "100%",
              maxWidth: "240px",
              backgroundColor: "transparent",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 800,
              borderRadius: "0",
              border: "1px solid #ffffff",
              cursor: "pointer",
              padding: "0 16px",
              gap: "8px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
              boxSizing: "border-box",
            }}
          >
            <Coins size={16} />
            Acquire Access Key
          </button>

        </div>
      </div>
    </section>
  );
}
