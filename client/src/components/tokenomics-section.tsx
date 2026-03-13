import { Coins, Lock, Users, Percent } from "lucide-react";

const tokenDetails = [
  {
    icon: Coins,
    label: "Token Name",
    value: "$APEPOL",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    icon: Lock,
    label: "Total Supply",
    value: "1,000,000,000",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  {
    icon: Percent,
    label: "Tax",
    value: "0%",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/10",
  },
  {
    icon: Users,
    label: "Team Allocation",
    value: "0%",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
];

export default function TokenomicsSection() {
  return (
    <section id="tokenomics" className="py-24 px-4 bg-slate-800/50 relative" data-testid="tokenomics-section">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-meme text-4xl md:text-5xl gradient-text mb-4" data-testid="text-tokenomics-title">
            Tokenomics
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Fair launch. No team tokens. No hidden fees. 100% for the community.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {tokenDetails.map((detail) => (
            <div
              key={detail.label}
              className="p-6 rounded-2xl bg-slate-800 border border-slate-700 text-center hover:border-blue-500/50 transition-all duration-300"
              data-testid={`card-token-${detail.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <div className={`w-14 h-14 rounded-xl ${detail.bgColor} flex items-center justify-center mx-auto mb-4`}>
                <detail.icon className={`w-7 h-7 ${detail.color}`} />
              </div>
              <div className="text-gray-400 text-sm mb-2">{detail.label}</div>
              <div className={`font-orbitron text-2xl font-bold ${detail.color}`}>{detail.value}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-500/30" data-testid="card-lp-locked">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-6 h-6 text-green-400" />
              <h3 className="font-meme text-xl text-green-400">LP Locked</h3>
            </div>
            <p className="text-gray-300">
              Liquidity pool is permanently locked, ensuring that the project cannot be rug pulled.
              Your investment is safe with APE POLICE.
            </p>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-500/30" data-testid="card-community-owned">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-6 h-6 text-blue-400" />
              <h3 className="font-meme text-xl text-blue-400">Community Owned</h3>
            </div>
            <p className="text-gray-300">
              100% community-driven with no team allocation. Every decision is made by the community,
              for the community.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
