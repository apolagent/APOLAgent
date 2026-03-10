import { Rocket, Target, Globe, Crown } from "lucide-react";

const phases = [
  {
    icon: Rocket,
    phase: "Phase 1",
    title: "Launch",
    status: "completed",
    items: [
      "Token launch on Solana",
      "Website & social media setup",
      "Community building on Telegram",
      "Initial scam reporting system",
    ],
    color: "text-green-400",
    borderColor: "border-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    icon: Target,
    phase: "Phase 2",
    title: "Growth",
    status: "active",
    items: [
      "Scam report verification system",
      "Hero nomination & voting platform",
      "Community rankings & leaderboard",
      "Partnership with crypto watchdogs",
    ],
    color: "text-blue-400",
    borderColor: "border-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Globe,
    phase: "Phase 3",
    title: "Expansion",
    status: "upcoming",
    items: [
      "Multi-chain scam tracking",
      "Browser extension for scam detection",
      "API for third-party integrations",
      "Reward system for top reporters",
    ],
    color: "text-purple-400",
    borderColor: "border-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    icon: Crown,
    phase: "Phase 4",
    title: "Domination",
    status: "upcoming",
    items: [
      "DAO governance implementation",
      "Decentralized scam database",
      "Cross-platform mobile app",
      "Global crypto safety standard",
    ],
    color: "text-yellow-400",
    borderColor: "border-yellow-500",
    bgColor: "bg-yellow-500/10",
  },
];

export default function RoadmapSection() {
  return (
    <section className="py-24 px-4 bg-slate-800/50 relative" data-testid="roadmap-section">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-meme text-4xl md:text-5xl gradient-text mb-4" data-testid="text-roadmap-title">
            Roadmap
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Our journey to making crypto safe for every ape in the jungle.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {phases.map((phase) => (
            <div
              key={phase.phase}
              className={`relative p-6 rounded-2xl bg-slate-800 border-2 ${phase.borderColor}/30 hover:${phase.borderColor}/60 transition-all duration-300`}
              data-testid={`card-roadmap-${phase.phase.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {phase.status === "completed" && (
                <div className="absolute -top-3 left-6 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  ✓ Complete
                </div>
              )}
              {phase.status === "active" && (
                <div className="absolute -top-3 left-6 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                  🔥 Active
                </div>
              )}

              <div className={`w-12 h-12 rounded-xl ${phase.bgColor} flex items-center justify-center mb-4`}>
                <phase.icon className={`w-6 h-6 ${phase.color}`} />
              </div>

              <div className={`font-orbitron text-sm ${phase.color} mb-1`}>{phase.phase}</div>
              <h3 className="font-meme text-xl text-white mb-4">{phase.title}</h3>

              <ul className="space-y-2">
                {phase.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      phase.status === "completed" ? "bg-green-400" : "bg-gray-600"
                    }`} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
