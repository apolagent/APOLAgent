import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Clock } from "lucide-react";

const roadmapPhases = [
  {
    phase: 1,
    title: "Watchdog Launch",
    status: "completed",
    progress: 100,
    color: "slate",
    items: [
      { text: "Token launch & DEX listing", completed: true },
      { text: "Scam report submission portal", completed: true },
      { text: "Community voting on reports", completed: true },
      { text: "Hero nominations & leaderboard", completed: true },
    ],
  },
  {
    phase: 2,
    title: "On-Chain Intel",
    status: "completed",
    progress: 100,
    color: "blue",
    items: [
      { text: "APOL Detective, on-chain wallet scanner", completed: true },
      { text: "Multi-chain support (ETH, BSC, Base, Solana)", completed: true },
      { text: "Agent-LARP Detector, Cognition Score", completed: true, highlight: true },
      { text: "Evidence image upload on reports", completed: true },
    ],
  },
  {
    phase: 3,
    title: "Intelligence Upgrade",
    status: "in-progress",
    progress: 35,
    color: "teal",
    items: [
      { text: "Predictive Threat Engine", completed: true },
      { text: "Real-Time Intelligence Wire", completed: false },
      { text: "Report bounty rewards in $APOL", completed: false },
      { text: "Token-gated Verified Citizen tier", completed: false },
    ],
  },
  {
    phase: 4,
    title: "Full Deployment",
    status: "planned",
    progress: 0,
    color: "indigo",
    items: [
      { text: "DAO-governed scam flagging votes", completed: false },
      { text: "Browser extension: real-time wallet warnings", completed: false },
      { text: "Institutional API Access", completed: false },
      { text: "Automated Legal Framework (March 2026 MOU)", completed: false },
    ],
  },
];

const colorMap: Record<string, { bg: string; border: string; hoverBorder: string; circle: string; text: string }> = {
  slate: {
    bg: "from-slate-600/20 to-slate-800/20",
    border: "border-slate-500/30",
    hoverBorder: "hover:border-slate-500/60",
    circle: "bg-slate-600",
    text: "text-slate-400",
  },
  blue: {
    bg: "from-blue-600/20 to-blue-800/20",
    border: "border-blue-500/30",
    hoverBorder: "hover:border-blue-500/60",
    circle: "bg-blue-600",
    text: "text-blue-400",
  },
  teal: {
    bg: "from-teal-600/20 to-teal-800/20",
    border: "border-teal-500/30",
    hoverBorder: "hover:border-teal-500/60",
    circle: "bg-teal-600",
    text: "text-teal-400",
  },
  indigo: {
    bg: "from-indigo-600/20 to-indigo-800/20",
    border: "border-indigo-500/30",
    hoverBorder: "hover:border-indigo-500/60",
    circle: "bg-indigo-600",
    text: "text-indigo-400",
  },
};

export default function RoadmapSection() {
  return (
    <section id="roadmap" className="py-20 bg-gradient-to-r from-blue-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-meme text-2xl sm:text-3xl md:text-5xl lg:text-6xl gradient-text mb-4">
            Operational Milestones
          </h2>
          <p className="text-sm md:text-base text-white/60">Deployment phases</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {roadmapPhases.map((phase) => {
            const c = colorMap[phase.color];
            const isPhaseOne = phase.phase === 1;
            return (
              <Card
                key={phase.phase}
                className={`bg-gradient-to-br ${c.bg} ${c.border} ${c.hoverBorder} transition-all duration-300 transform hover:scale-105`}
              >
                <CardHeader>
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 ${c.circle} rounded-full flex items-center justify-center mx-auto mb-4 ${phase.status === "completed" ? "neon-glow" : ""}`}>
                      <span className="text-white font-meme text-xl">{phase.phase}</span>
                    </div>
                    <CardTitle className="font-meme text-2xl text-white mb-2 font-normal">
                      {phase.title}
                    </CardTitle>
                    <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                      <Progress value={phase.progress} className="h-2" />
                    </div>
                    <span className={`text-xs ${c.text} font-semibold uppercase`}>
                      {phase.status.replace("-", " ")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {phase.items.map((item, index) => (
                      <li key={index} className="flex items-start gap-2">
                        {item.completed ? (
                          <Check className={`w-4 h-4 mt-0.5 ${c.text} flex-shrink-0`} />
                        ) : (
                          <Clock className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                        )}
                        <span className={(item as any).highlight ? "text-green-400 font-semibold" : "text-slate-300"}>
                          {item.text}
                          {isPhaseOne && (
                            <span className="ml-1.5 text-slate-500 text-xs">[COMPLETED]</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
