export default function Footer() {
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
              src="/ape-police-logo.png"
              alt="APE POLICE"
              className="w-14 h-14 object-cover rounded-full border border-yellow-400 neon-glow"
            />
          </div>

          {/* Main credit */}
          <p className="text-base font-semibold text-white mb-1 tracking-wide">
            <span className="font-meme gradient-text">APE POLICE</span>
          </p>
          <p className="text-xs uppercase tracking-widest mb-6" style={{ color: "rgba(0,255,0,0.5)" }}>
            Digital Asset Intelligence Network
          </p>

          {/* Operational disclaimer */}
          <p className="text-xs max-w-2xl mx-auto leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
            © 2026 APE POLICE. Providing on-chain forensics and agent verification for the Base ecosystem.
            Data is aggregated from public streams; users are responsible for all trading decisions.
          </p>

        </div>
      </div>
    </footer>
  );
}
