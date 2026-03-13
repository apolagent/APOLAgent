import { ChevronDown, Send, Coins } from "lucide-react";


export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden hero-bg" data-testid="hero-section">
      <div className="absolute inset-0 z-0">
        <img
          src="/hero-bg.png"
          alt="Crypto city with APE POLICE officers patrolling"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/70 to-slate-900/80"></div>
      </div>

      <div className="relative z-10 text-center px-4 max-w-6xl mx-auto">
        <div className="mb-8 relative inline-block">
          <img
            src="/ape-police-logo.png"
            alt="APE POLICE character in tactical gear with banana and police badge"
            className="w-32 h-32 md:w-48 md:h-48 mx-auto rounded-full border-4 border-yellow-400 animate-float neon-glow object-cover"
          />
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center animate-bounce-slow">
            <span className="text-slate-900 text-lg">🛡️</span>
          </div>
        </div>

        <h1 className="font-meme text-4xl md:text-7xl lg:text-8xl mb-6 leading-tight">
          <span className="block text-yellow-400 animate-pulse" data-testid="text-headline">APE POLICE</span>
          <span className="block gradient-text text-2xl md:text-4xl lg:text-5xl mt-2" data-testid="text-tagline">is Watching</span>
        </h1>

        <p className="text-lg md:text-xl mb-8 max-w-xl mx-auto leading-relaxed text-white text-center" data-testid="text-description">
          The <span className="text-green-400 font-bold">meme-powered task force</span> protecting crypto from chaos —
          and celebrating those who make it better.
        </p>

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginTop: "30px" }}>
          <a
            href="https://t.me/+rHmFDw-NcYcyMjI0"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="button-join-patrol"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "38px",
              minWidth: "210px",
              width: "fit-content",
              backgroundColor: "#3b82f6",
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: 800,
              borderRadius: "10px",
              textDecoration: "none",
              border: "none",
              cursor: "pointer",
              padding: "0 16px",
              gap: "8px",
              boxSizing: "border-box",
            }}
          >
            <Send size={20} />
            Join the Patrol
          </a>
          <button
            data-testid="button-buy-apol"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "38px",
              minWidth: "210px",
              width: "fit-content",
              backgroundColor: "#22c55e",
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: 800,
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              padding: "0 16px",
              gap: "8px",
              boxSizing: "border-box",
            }}
          >
            <Coins size={20} />
            Buy $APOL
          </button>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-8 h-8 text-yellow-400" />
        </div>
      </div>
    </section>
  );
}
