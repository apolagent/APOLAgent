import { Trophy, ThumbsUp, Shield, Star } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const leaderboardPreview = [
  { rank: 1, name: "CryptoDetective", reports: 45, badge: "🏆", color: "text-yellow-400" },
  { rank: 2, name: "ScamHunter99", reports: 38, badge: "🥈", color: "text-gray-300" },
  { rank: 3, name: "BlockchainSheriff", reports: 32, badge: "🥉", color: "text-amber-600" },
  { rank: 4, name: "ApeGuardian", reports: 28, badge: "⭐", color: "text-blue-400" },
  { rank: 5, name: "JungleWatcher", reports: 24, badge: "⭐", color: "text-blue-400" },
];

export default function ChannelSection() {
  return (
    <section className="py-24 px-4 bg-slate-900 relative" data-testid="channel-section">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="font-meme text-4xl md:text-5xl gradient-text mb-6" data-testid="text-channel-title">
              The APE Channel
            </h2>
            <p className="text-gray-300 text-lg mb-6 leading-relaxed">
              Join the most active crypto watchdog community on Telegram. Our channel serves as the
              headquarters for reporting scams, nominating heroes, and keeping the jungle safe.
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <span className="text-gray-300">Real-time scam alerts and investigations</span>
              </div>
              <div className="flex items-center gap-3">
                <ThumbsUp className="w-5 h-5 text-green-400 flex-shrink-0" />
                <span className="text-gray-300">Community voting on reported scams</span>
              </div>
              <div className="flex items-center gap-3">
                <Star className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <span className="text-gray-300">Hero nominations and leaderboard rankings</span>
              </div>
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-purple-400 flex-shrink-0" />
                <span className="text-gray-300">Monthly awards for top contributors</span>
              </div>
            </div>

            <a href="https://t.me/apepolice" target="_blank" rel="noopener noreferrer">
              <Button className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-3 rounded-xl text-lg" data-testid="button-join-channel">
                Join APE Channel
              </Button>
            </a>
          </div>

          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden" data-testid="card-leaderboard-preview">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <h3 className="font-meme text-xl text-white">Top Reporters</h3>
              </div>
              <Link href="/rankings">
                <span className="text-blue-400 text-sm hover:underline cursor-pointer" data-testid="link-view-all">View All →</span>
              </Link>
            </div>

            <div className="divide-y divide-slate-700">
              {leaderboardPreview.map((entry) => (
                <div
                  key={entry.rank}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
                  data-testid={`row-leaderboard-${entry.rank}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{entry.badge}</span>
                    <div>
                      <div className={`font-medium ${entry.color}`}>{entry.name}</div>
                      <div className="text-gray-500 text-sm">{entry.reports} reports</div>
                    </div>
                  </div>
                  <div className="font-orbitron text-sm text-gray-400">#{entry.rank}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
