import { ChevronDown, Send, Coins } from "lucide-react";

export default function HeroSection() {
  return (
    <section
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: "#020817" }}
      data-testid="hero-section"
    >
      {/* Grid background */}
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial fade to keep centre dark */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, #020817 80%)",
        }}
      />

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">

        {/* Official seal */}
        <div className="mb-6 inline-block">
          <img
            src="/ape-police-logo.png"
            alt="APE POLICE official seal"
            className="w-20 h-20 md:w-24 md:h-24 mx-auto rounded-full border-2 border-yellow-400 neon-glow object-cover"
          />
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-2">
            Official Seal · $APOL
          </p>
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
              maxWidth: "220px",
              backgroundColor: "#3b82f6",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 800,
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              padding: "0 16px",
              gap: "8px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
          >
            <Send size={16} />
            Access Terminal
          </button>

          <div className="hidden sm:block">
            <ChevronDown className="w-6 h-6 text-slate-600" />
          </div>

          <button
            data-testid="button-buy-apol"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "42px",
              width: "100%",
              maxWidth: "220px",
              backgroundColor: "transparent",
              color: "#22c55e",
              fontSize: "14px",
              fontWeight: 800,
              borderRadius: "10px",
              border: "1px solid #22c55e",
              cursor: "pointer",
              padding: "0 16px",
              gap: "8px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              boxSizing: "border-box",
            }}
          >
            <Coins size={16} />
            Buy $APOL
          </button>
        </div>

      </div>
    </section>
  );
}
