const pillars = [
  {
    index: "01",
    title: "VERIFICATION",
    body: "Algorithmic logic checks for autonomous agents.",
  },
  {
    index: "02",
    title: "FORENSICS",
    body: "Live tracking of developer wallet clusters.",
  },
  {
    index: "03",
    title: "INTEGRITY",
    body: "Securing the Base liquidity corridors.",
  },
];

export default function MissionSection() {
  return (
    <section id="mission" className="py-20 relative" data-testid="mission-section">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">Mission Statement</p>
          <h2 className="font-meme text-2xl sm:text-3xl md:text-5xl gradient-text uppercase mb-6" data-testid="text-mission-title">
            Protocol Mission
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
            APOL is a cryptographic verification layer designed to eliminate market asymmetry in the agentic economy. By providing real-time on-chain forensic analysis, we convert speculative risk into verifiable data.
          </p>
        </div>

        {/* Three Pillars */}
        <div className="grid md:grid-cols-3 gap-4">
          {pillars.map((p) => (
            <div
              key={p.index}
              className="bg-slate-900/70 border border-slate-700/60 rounded-xl px-5 py-5"
            >
              <p className="text-xs text-slate-600 mb-1">[{p.index}]</p>
              <p className="text-white font-bold text-sm tracking-widest mb-2 uppercase">{p.title}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
