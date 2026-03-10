import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Trophy, ArrowLeft, Shield, Award, ThumbsUp, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { type ScamReport, type HeroNomination } from "@shared/schema";
import Navigation from "@/components/navigation";
import { useState } from "react";

type TabType = "reports" | "heroes";

export default function Rankings() {
  const [activeTab, setActiveTab] = useState<TabType>("reports");

  const { data: scamReports = [], isLoading: reportsLoading } = useQuery<ScamReport[]>({
    queryKey: ["/api/scam-reports"],
  });

  const { data: heroNominations = [], isLoading: heroesLoading } = useQuery<HeroNomination[]>({
    queryKey: ["/api/hero-nominations"],
  });

  const sortedReports = [...scamReports].sort((a, b) => b.votes - a.votes);
  const sortedHeroes = [...heroNominations].sort((a, b) => b.votes - a.votes);

  const isLoading = reportsLoading || heroesLoading;

  const getRankBadge = (index: number) => {
    if (index === 0) return { emoji: "🏆", color: "text-yellow-400", bgColor: "bg-yellow-500/20 border-yellow-500/30" };
    if (index === 1) return { emoji: "🥈", color: "text-gray-300", bgColor: "bg-gray-500/20 border-gray-500/30" };
    if (index === 2) return { emoji: "🥉", color: "text-amber-600", bgColor: "bg-amber-500/20 border-amber-500/30" };
    return { emoji: "⭐", color: "text-blue-400", bgColor: "bg-slate-700/50 border-slate-600" };
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navigation />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 pt-28">
        <div className="text-center mb-12">
          <h1 className="font-meme text-4xl md:text-6xl gradient-text mb-4 flex items-center justify-center gap-3" data-testid="text-page-title">
            <Trophy className="w-12 h-12 md:w-16 md:h-16 text-yellow-400" />
            Community Rankings
          </h1>
          <p className="text-xl text-gray-400 mb-8" data-testid="text-page-description">
            Top-voted scam reports and community heroes
          </p>
          <Link href="/">
            <Button variant="outline" className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-slate-900" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          <Button
            onClick={() => setActiveTab("reports")}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === "reports"
                ? "bg-red-500 text-white"
                : "bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700"
            }`}
            data-testid="button-tab-reports"
          >
            <Shield className="w-4 h-4 mr-2" />
            Scam Reports
          </Button>
          <Button
            onClick={() => setActiveTab("heroes")}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === "heroes"
                ? "bg-yellow-500 text-slate-900"
                : "bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700"
            }`}
            data-testid="button-tab-heroes"
          >
            <Award className="w-4 h-4 mr-2" />
            Heroes
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-6 rounded-xl bg-slate-800 border border-slate-700 animate-pulse flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-700 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === "reports" ? (
          <div className="space-y-3">
            {sortedReports.length === 0 ? (
              <div className="p-16 rounded-xl bg-slate-800 border border-slate-700 text-center">
                <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-xl">No scam reports yet</p>
                <p className="text-gray-500 mt-2">
                  <Link href="/report-scam">
                    <span className="text-blue-400 hover:underline cursor-pointer">Report a scam</span>
                  </Link>{" "}
                  to get the leaderboard started!
                </p>
              </div>
            ) : (
              sortedReports.map((report, index) => {
                const rank = getRankBadge(index);
                return (
                  <div
                    key={report.id}
                    className={`p-5 rounded-xl border transition-all hover:scale-[1.01] ${rank.bgColor}`}
                    data-testid={`row-ranking-report-${report.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center">
                        <span className="text-2xl">{rank.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white truncate">{report.title}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">
                            {report.scamType}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm truncate">{report.description}</p>
                      </div>
                      <div className="flex items-center gap-2 text-green-400 flex-shrink-0">
                        <ThumbsUp className="w-4 h-4" />
                        <span className="font-orbitron font-bold">{report.votes}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedHeroes.length === 0 ? (
              <div className="p-16 rounded-xl bg-slate-800 border border-slate-700 text-center">
                <Award className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-xl">No hero nominations yet</p>
                <p className="text-gray-500 mt-2">
                  <Link href="/nominate-hero">
                    <span className="text-yellow-400 hover:underline cursor-pointer">Nominate a hero</span>
                  </Link>{" "}
                  to get the leaderboard started!
                </p>
              </div>
            ) : (
              sortedHeroes.map((hero, index) => {
                const rank = getRankBadge(index);
                return (
                  <div
                    key={hero.id}
                    className={`p-5 rounded-xl border transition-all hover:scale-[1.01] ${rank.bgColor}`}
                    data-testid={`row-ranking-hero-${hero.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center">
                        <span className="text-2xl">{rank.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-white truncate">{hero.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                            hero.approved ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                          }`}>
                            {hero.approved ? "✓ Approved" : "Pending"}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm truncate">{hero.description}</p>
                      </div>
                      <div className="flex items-center gap-2 text-green-400 flex-shrink-0">
                        <TrendingUp className="w-4 h-4" />
                        <span className="font-orbitron font-bold">{hero.votes}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="mt-12 grid sm:grid-cols-3 gap-4 text-center">
          <div className="p-6 rounded-xl bg-slate-800 border border-slate-700" data-testid="stat-total-reports">
            <Shield className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="font-orbitron text-2xl font-bold text-white">{scamReports.length}</div>
            <div className="text-gray-400 text-sm">Total Reports</div>
          </div>
          <div className="p-6 rounded-xl bg-slate-800 border border-slate-700" data-testid="stat-total-heroes">
            <Award className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <div className="font-orbitron text-2xl font-bold text-white">{heroNominations.length}</div>
            <div className="text-gray-400 text-sm">Heroes Nominated</div>
          </div>
          <div className="p-6 rounded-xl bg-slate-800 border border-slate-700" data-testid="stat-total-votes">
            <ThumbsUp className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <div className="font-orbitron text-2xl font-bold text-white">
              {scamReports.reduce((sum, r) => sum + r.votes, 0) + heroNominations.reduce((sum, n) => sum + n.votes, 0)}
            </div>
            <div className="text-gray-400 text-sm">Total Votes</div>
          </div>
        </div>
      </div>
    </div>
  );
}
