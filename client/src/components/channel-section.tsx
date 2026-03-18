import { Button } from "@/components/ui/button";
import { MessageSquare, Trophy, AlertTriangle, Shield } from "lucide-react";
import { Link } from "wouter";

export default function ChannelSection() {
  return (
    <section id="channel" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left column */}
          <div>
            <h2 className="font-meme text-4xl md:text-6xl gradient-text mb-3 uppercase">
              Agent Verification
            </h2>
            <p className="text-xs text-slate-500 tracking-widest mb-10">[SEC:2026-COMPLIANT-SCANNER]</p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 neon-glow flex items-center justify-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Join the Channel</span>
              </Button>
              <Link href="/nominate-hero">
                <Button className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 w-full sm:w-auto">
                  <Trophy className="w-5 h-5" />
                  <span>Nominate a Hero</span>
                </Button>
              </Link>
              <Link href="/report-scam">
                <Button className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 w-full sm:w-auto" data-testid="button-report-scam-channel">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Report a Scam</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Right column — leaderboard */}
          <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-8">
            <div className="text-center mb-6">
              <h3 className="font-meme text-2xl gradient-text mb-1">Community Leaderboard</h3>
              <p className="text-xs text-slate-500 uppercase tracking-widest">Top Contributors This Month</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-yellow-400/10 p-4 rounded-xl border border-yellow-400/30">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-slate-900 font-bold text-sm">1</span>
                  </div>
                  <span className="font-semibold text-white">CryptoDetective</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-white">247 Reports</span>
                </div>
              </div>
              <div className="flex items-center justify-between bg-slate-700/20 p-4 rounded-xl border border-slate-600/30">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-slate-400 rounded-full flex items-center justify-center">
                    <span className="text-slate-900 font-bold text-sm">2</span>
                  </div>
                  <span className="font-semibold text-white">ScamBuster</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-white">189 Reports</span>
                </div>
              </div>
              <div className="flex items-center justify-between bg-orange-600/10 p-4 rounded-xl border border-orange-600/30">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">3</span>
                  </div>
                  <span className="font-semibold text-white">ApeTective</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-white">156 Reports</span>
                </div>
              </div>
            </div>
            <div className="text-center mt-6">
              <Link href="/rankings">
                <button className="text-blue-400 hover:text-blue-300 font-semibold text-sm transition-colors">
                  View Full Rankings →
                </button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
