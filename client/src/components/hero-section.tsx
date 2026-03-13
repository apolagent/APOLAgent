import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiTelegram } from "react-icons/si";
import { Coins } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden" data-testid="hero-section">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/hero-bg.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/40 via-slate-900/60 to-slate-900" />

      <div className="relative z-10 text-center px-4 max-w-3xl mx-auto pt-16">
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div
              className="w-36 h-36 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-yellow-400 shadow-2xl"
              style={{ boxShadow: '0 0 0 4px rgba(250,204,21,0.3), 0 0 40px rgba(250,204,21,0.3)' }}
            >
              <img
                src="/ape-police-logo.png"
                alt="APE POLICE"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        <h1 className="font-meme text-6xl md:text-8xl lg:text-9xl font-black mb-2 leading-none" style={{ color: '#FFD700', textShadow: '0 4px 20px rgba(255,215,0,0.4)' }}>
          APE POLICE
        </h1>

        <p className="font-meme text-3xl md:text-4xl font-bold mb-6" style={{ color: '#00CC66' }}>
          is Watching
        </p>

        <p className="text-lg md:text-xl text-white mb-10 max-w-xl mx-auto leading-relaxed" data-testid="text-description">
          The <span className="font-semibold" style={{ color: '#00CC66' }}>meme-powered task force</span> protecting crypto from chaos — and celebrating those who make it better.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <a href="https://t.me/apepolice" target="_blank" rel="noopener noreferrer" data-testid="button-join-patrol">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-6 text-lg rounded-xl flex items-center gap-2">
              <SiTelegram className="w-5 h-5" />
              Join the Patrol
            </Button>
          </a>
          <a href="#" data-testid="button-buy-apol">
            <Button className="text-white font-bold px-8 py-6 text-lg rounded-xl flex items-center gap-2" style={{ backgroundColor: '#00CC66' }}>
              <Coins className="w-5 h-5" />
              Buy $APOL
            </Button>
          </a>
        </div>

        <div className="flex justify-center">
          <ChevronDown className="w-7 h-7 text-green-400 animate-bounce" />
        </div>
      </div>
    </section>
  );
}
