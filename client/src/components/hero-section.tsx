import { Send, Coins } from "lucide-react";

export default function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      data-testid="hero-section"
    >
      <div className="text-center px-4 max-w-4xl mx-auto">

        {/* Official seal */}
        <div className="mb-6 inline-block">
          <img
            src="/ape-police-logo.png"
            alt="APE POLICE official seal"
            className="w-36 h-36 md:w-48 md:h-48 mx-auto rounded-full border-2 border-yellow-400 neon-glow object-cover"
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
          className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed mb-12 uppercase tracking-wide"
          data-testid="text-description"
        >
          Securing the Base ecosystem through real-time forensic analysis of autonomous agents and developer logic.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
          <button
            data-testid="button-join-patrol"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "42px",
              width: "100%",
              maxWidth: "240px",
              backgroundColor: "#3b82f6",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 800,
              borderRadius: "0",
              border: "none",
              cursor: "pointer",
              padding: "0 16px",
              gap: "8px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
              boxSizing: "border-box",
            }}
          >
            <Send size={16} />
            Access Terminal
          </button>

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
