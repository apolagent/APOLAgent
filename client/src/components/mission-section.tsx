import { Shield, Eye, Users, Zap } from "lucide-react";

const missions = [
  {
    icon: Shield,
    title: "Protect",
    description: "Shield the crypto community from scammers, rug pullers, and fraudulent projects that prey on unsuspecting investors.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  {
    icon: Eye,
    title: "Expose",
    description: "Investigate and expose crypto scams through community-driven research, evidence collection, and transparent reporting.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  {
    icon: Users,
    title: "Unite",
    description: "Build a strong community of vigilant apes who work together to keep the blockchain jungle safe and fair for everyone.",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  {
    icon: Zap,
    title: "Empower",
    description: "Give power back to the people by providing tools, knowledge, and resources to identify and avoid crypto scams.",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
];

export default function MissionSection() {
  return (
    <section className="py-24 px-4 bg-slate-900 relative" data-testid="mission-section">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800/50 to-slate-900" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="font-meme text-4xl md:text-5xl gradient-text mb-4" data-testid="text-mission-title">
            Our Mission
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            APE POLICE is more than a token — it's a movement to clean up the crypto space
            and make it safer for every ape in the jungle.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {missions.map((mission) => (
            <div
              key={mission.title}
              className={`p-6 rounded-2xl ${mission.bgColor} border ${mission.borderColor} hover:scale-105 transition-all duration-300`}
              data-testid={`card-mission-${mission.title.toLowerCase()}`}
            >
              <div className={`w-14 h-14 rounded-xl ${mission.bgColor} flex items-center justify-center mb-4`}>
                <mission.icon className={`w-7 h-7 ${mission.color}`} />
              </div>
              <h3 className={`font-meme text-xl ${mission.color} mb-3`}>{mission.title}</h3>
              <p className="text-gray-300 text-sm leading-relaxed">{mission.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
