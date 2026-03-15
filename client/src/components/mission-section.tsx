import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Radio } from "lucide-react";

export default function MissionSection() {
  return (
    <section id="mission" className="py-20 relative" data-testid="mission-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-meme text-5xl md:text-6xl gradient-text mb-8" data-testid="text-mission-title">
            Protect. Meme. Reward.
          </h2>
          <div className="max-w-4xl mx-auto">
            <p className="text-xl md:text-2xl mb-8 leading-relaxed">
              <span className="text-yellow-400 font-bold">APE POLICE</span> is more than just a memecoin,
              it's a crypto watchdog powered by the community. We meme hard and call out harder.
            </p>
            <p className="text-lg md:text-xl mb-12 text-slate-200 leading-relaxed">
              From stopping rugpulls to spotlighting legit devs and influencers, we're here to make crypto fun and safer.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <Card className="bg-gradient-to-r from-blue-700/60 to-blue-900/80 border-blue-500/50 hover:border-blue-400/70 transition-all duration-300 transform hover:scale-105">
            <CardHeader>
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-blue-700 rounded-full flex items-center justify-center mr-4 neon-glow">
                  <Coins className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="font-meme text-2xl md:text-3xl text-white font-normal">
                  Blockchain Patrol
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed mb-4">
                🪙 <span className="font-bold text-yellow-400">Patrol the blockchain</span> with $APOL memecoin
              </p>
              <p className="text-slate-200">
                Our community-driven token serves as the badge of honor for crypto justice enforcers worldwide.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-slate-800/70 to-slate-900/90 border-slate-500/50 hover:border-slate-400/70 transition-all duration-300 transform hover:scale-105">
            <CardHeader>
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mr-4 neon-glow">
                  <Radio className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="font-meme text-2xl md:text-3xl text-white font-normal">
                  Public Forum
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg leading-relaxed mb-4">
                📢 <span className="font-bold text-yellow-400">Run the APE POLICE Channel</span> — a public forum for exposing scams & rewarding real builders
              </p>
              <p className="text-slate-200">
                Where the real work happens - community discussions, scam alerts, and recognition for crypto heroes.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
