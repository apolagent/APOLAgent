import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Clock } from "lucide-react";

const roadmapPhases = [
  {
    phase: 1,
    title: "Meme Patrol",
    status: "completed",
    progress: 100,
    color: "slate",
    items: [
      { text: "Launch", completed: true },
      { text: "DEX listing", completed: true },
      { text: "Meme Raid Squads", completed: true }
    ]
  },
  {
    phase: 2,
    title: "Enforcement",
    status: "in-progress",
    progress: 75,
    color: "blue",
    items: [
      { text: "NFT Collection", completed: false },
      { text: "Meme Contests", completed: false },
      { text: "Merch Drop", completed: false }
    ]
  },
  {
    phase: 3,
    title: "Recognition",
    status: "upcoming",
    progress: 25,
    color: "teal",
    items: [
      { text: "Channel Awards Voting", completed: false },
      { text: "Verified Influencer Recognition", completed: false },
      { text: "$APOL-funded Giveaways", completed: false }
    ]
  },
  {
    phase: 4,
    title: "Full Deployment",
    status: "planned",
    progress: 0,
    color: "indigo",
    items: [
      { text: "DAO Voting", completed: false },
      { text: "Meme Game", completed: false },
      { text: "Tier 1 CEX Listings", completed: false }
    ]
  }
];

const colorMap: Record<string, { bg: string; border: string; hoverBorder: string; circle: string; text: string; progress: string }> = {
  slate: {
    bg: "from-slate-600/20 to-slate-800/20",
    border: "border-slate-500/30",
    hoverBorder: "hover:border-slate-500/60",
    circle: "bg-slate-600",
    text: "text-slate-400",
    progress: "bg-slate-500",
  },
  blue: {
    bg: "from-blue-600/20 to-blue-800/20",
    border: "border-blue-500/30",
    hoverBorder: "hover:border-blue-500/60",
    circle: "bg-blue-600",
    text: "text-blue-400",
    progress: "bg-blue-500",
  },
  teal: {
    bg: "from-teal-600/20 to-teal-800/20",
    border: "border-teal-500/30",
    hoverBorder: "hover:border-teal-500/60",
    circle: "bg-teal-600",
    text: "text-teal-400",
    progress: "bg-teal-500",
  },
  indigo: {
    bg: "from-indigo-600/20 to-indigo-800/20",
    border: "border-indigo-500/30",
    hoverBorder: "hover:border-indigo-500/60",
    circle: "bg-indigo-600",
    text: "text-indigo-400",
    progress: "bg-indigo-500",
  },
};

export default function RoadmapSection() {
  return (
    <section id="roadmap" className="py-20 bg-gradient-to-r from-blue-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-meme text-5xl md:text-6xl gradient-text mb-4">
            The Road to Meme Justice
          </h2>
          <p className="text-xl text-white">Our mission phases for crypto protection</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {roadmapPhases.map((phase) => {
            const c = colorMap[phase.color];
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
                      <li key={index} className="flex items-center text-white">
                        {item.completed ? (
                          <Check className={`w-4 h-4 ${c.text} mr-2`} />
                        ) : (
                          <Clock className="w-4 h-4 text-gray-400 mr-2" />
                        )}
                        {item.text}
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
