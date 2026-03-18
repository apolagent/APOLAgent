import { ShieldCheck, ScanLine } from "lucide-react";

const features = [
  {
    icon: <ShieldCheck className="w-6 h-6 text-blue-400" />,
    title: "RISK MITIGATION",
    body: "Cross-references wallet history, transaction velocity, and contract deployment patterns against known threat signatures to flag exposure before capital is committed.",
  },
  {
    icon: <ScanLine className="w-6 h-6 text-green-400" />,
    title: "ALGORITHMIC VERIFICATION",
    body: "Scores agent identities against a multi-chain Cognition Index — detecting low-reasoning LARPs, Sybil clusters, and coordinated manipulation in real time.",
  },
];

export default function MissionSection() {
  return (
    <section id="mission" className="py-20 relative" data-testid="mission-section">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Intelligence Brief</p>
          <h2 className="font-meme text-5xl md:text-6xl gradient-text mb-6" data-testid="text-mission-title">
            APOL Agent: Autonomous Market Integrity
          </h2>
          <p className="text-slate-300 max-w-3xl mx-auto text-base leading-relaxed">
            Ape Police provides a real-time verification layer for the agentic economy. By cross-referencing on-chain execution with autonomous reasoning logs, the APOL Agent eliminates market asymmetry and exposes developer LARPs before they impact the retail holder.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-2 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-slate-900/70 border border-slate-700/60 rounded-xl px-6 py-5 flex gap-4"
            >
              <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                {f.icon}
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1.5">{f.title}</p>
                <p className="text-slate-300 text-sm leading-relaxed">{f.body}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
