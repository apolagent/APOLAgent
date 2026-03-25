import { Button } from "@/components/ui/button";
import { Send, Radio, Coins, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

const cards = [
  {
    icon: <Send className="w-8 h-8" />,
    title: "Telegram",
    cta: "FIELD COMMS",
    gradient: "from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
    textColor: "text-white",
    href: "https://t.me/+aR-n79XFWKhjOTg8",
    external: true,
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    title: "X / Twitter",
    cta: "INTELLIGENCE FEED",
    gradient: "from-gray-800 to-black hover:from-gray-700 hover:to-gray-800",
    textColor: "text-white",
    href: "https://x.com/apolagent",
    external: true,
  },
  {
    icon: <Radio className="w-8 h-8" />,
    title: "APE Channel",
    cta: "THREAT REPORTING",
    gradient: "from-green-600 to-green-700 hover:from-green-700 hover:to-green-800",
    textColor: "text-white",
    href: "/report-scam",
    external: false,
  },
  {
    icon: <Coins className="w-8 h-8" />,
    title: "Buy $APOL",
    cta: "NETWORK ACCESS",
    gradient: "from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700",
    textColor: "text-slate-900",
    href: null,
    external: false,
  },
];

export default function JoinSection() {
  return (
    <section id="join" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-meme text-2xl sm:text-3xl md:text-5xl lg:text-6xl gradient-text mb-6">
            Communications &amp; Access
          </h2>
          <p className="text-sm md:text-base text-gray-400 max-w-xl mx-auto">
            Secure a connection to the APOL Intelligence Network.
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {cards.map((card, i) => {
            const btn = (
              <Button
                key={i}
                className={`w-full bg-gradient-to-br ${card.gradient} ${card.textColor} font-bold py-6 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 neon-glow flex flex-col items-center space-y-3 h-auto`}
              >
                {card.icon}
                <span className="text-lg">{card.title}</span>
                <span className="text-xs font-bold tracking-widest opacity-90">{card.cta}</span>
              </Button>
            );
            return card.href ? (
              card.external ? (
                <a key={i} href={card.href} target="_blank" rel="noopener noreferrer" className="w-full block">{btn}</a>
              ) : (
                <Link key={i} href={card.href} className="w-full">{btn}</Link>
              )
            ) : (
              <div key={i} className="w-full">{btn}</div>
            );
          })}
        </div>

        {/* Verified by APOL badge */}
        <div className="mt-20 flex justify-center">
          <div className="inline-flex items-center gap-3 bg-slate-900/80 border border-slate-700/60 rounded-2xl px-8 py-5">
            <ShieldCheck className="w-7 h-7 text-green-400 flex-shrink-0" />
            <div className="text-left">
              <p className="text-xs text-slate-500 uppercase tracking-widest">Network</p>
              <p className="text-white font-bold text-sm tracking-wide">Verified by APOL · Base</p>
            </div>
            <div className="w-px h-8 bg-slate-700 mx-1" />
            <div className="text-left">
              <p className="text-xs text-slate-500 uppercase tracking-widest">Status</p>
              <p className="text-green-400 font-bold text-sm tracking-wide flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Operational
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
