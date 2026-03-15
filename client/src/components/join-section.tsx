import { Button } from "@/components/ui/button";
import { Send, Radio, Coins } from "lucide-react";
import { Link } from "wouter";

export default function JoinSection() {
  return (
    <section id="join" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-meme text-5xl md:text-6xl gradient-text mb-8">
            Join the APE POLICE Force
          </h2>
          <div className="max-w-4xl mx-auto">
            <p className="text-xl md:text-2xl mb-8 leading-relaxed">
              You don't need a badge, just <span className="text-yellow-400 font-bold">memes and morals</span>. 
              If you're here to fight scams and celebrate legends, you're one of us.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <Button className="w-full bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-6 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 neon-glow flex flex-col items-center space-y-3 h-auto">
            <Send className="w-8 h-8" />
            <span className="text-lg">Telegram</span>
            <span className="text-sm opacity-80">Join the Squad 💬</span>
          </Button>

          <Button className="w-full bg-gradient-to-br from-gray-800 to-black hover:from-gray-700 hover:to-gray-800 text-white font-bold py-6 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 neon-glow flex flex-col items-center space-y-3 h-auto">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="text-lg">X</span>
            <span className="text-sm opacity-80">Follow Updates</span>
          </Button>

          <Link href="/report-scam" className="w-full">
            <Button className="w-full bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-6 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 neon-glow flex flex-col items-center space-y-3 h-auto">
              <Radio className="w-8 h-8" />
              <span className="text-lg">APE Channel</span>
              <span className="text-sm opacity-80">Report Scams 📡</span>
            </Button>
          </Link>

          <Button className="bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-900 font-bold py-6 px-6 rounded-2xl transition-all duration-300 transform hover:scale-105 neon-glow flex flex-col items-center space-y-3 h-auto">
            <Coins className="w-8 h-8" />
            <span className="text-lg">Buy $APOL</span>
            <span className="text-sm opacity-80">Get Badge 🪙</span>
          </Button>
        </div>

        <div className="mt-24 flex justify-center space-x-4 overflow-hidden">
          <img
            src="/squad-scooter.png"
            alt="APE POLICE officer on patrol scooter chasing scammers"
            className="w-20 h-20 md:w-24 md:h-24 rounded-xl border-2 border-blue-500 animate-float object-cover"
          />
          <img
            src="/squad-court.png"
            alt="APE POLICE issuing cringe citation in internet court"
            className="w-24 h-24 md:w-28 md:h-28 rounded-xl border-2 border-yellow-400 animate-float z-10 object-cover"
            style={{ animationDelay: '0.3s' }}
          />
          <img
            src="/squad-memelab.png"
            alt="APE POLICE officers at the meme lab headquarters"
            className="w-20 h-20 md:w-24 md:h-24 rounded-xl border-2 border-green-500 animate-float object-cover"
            style={{ animationDelay: '0.6s' }}
          />
        </div>
      </div>
    </section>
  );
}
