import { Siren, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center hero-bg overflow-hidden pt-16" data-testid="hero-section">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-20 h-20 rounded-full bg-blue-500/10 animate-float" />
        <div className="absolute top-40 right-20 w-32 h-32 rounded-full bg-green-500/10 animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-40 left-1/4 w-16 h-16 rounded-full bg-yellow-500/10 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/3 right-1/3 w-24 h-24 rounded-full bg-pink-500/10 animate-float" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10 text-center px-4 max-w-5xl mx-auto">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-4 border-blue-400/40 shadow-2xl animate-float" style={{ boxShadow: '0 0 40px rgba(59,130,246,0.4), 0 0 80px rgba(59,130,246,0.2)' }}>
              <img
                src="/ape-police-logo.png"
                alt="APE POLICE"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full animate-siren-flash" />
            <div className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full animate-siren-flash" style={{ animationDelay: '0.2s' }} />
          </div>
        </div>

        <h1 className="font-meme text-5xl md:text-7xl lg:text-8xl mb-6">
          <span className="gradient-text">APE POLICE</span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-300 mb-4 font-medium" data-testid="text-tagline">
          🚨 Protecting the Jungle from Crypto Scams 🚨
        </p>

        <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto" data-testid="text-description">
          Community-driven crypto watchdog on a mission to expose scammers,
          celebrate heroes, and keep the blockchain jungle safe for all apes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/report-scam">
            <Button className="bg-red-500 hover:bg-red-600 text-white font-bold px-8 py-6 text-lg rounded-xl neon-glow" data-testid="button-report-scam">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Report a Scam
            </Button>
          </Link>
          <Link href="/nominate-hero">
            <Button className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-6 text-lg rounded-xl" data-testid="button-nominate-hero">
              <Siren className="w-5 h-5 mr-2" />
              Nominate a Hero
            </Button>
          </Link>
          <Link href="/rankings">
            <Button variant="outline" className="border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-slate-900 font-bold px-8 py-6 text-lg rounded-xl" data-testid="button-rankings">
              View Rankings
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
          <div className="text-center" data-testid="stat-community">
            <div className="font-orbitron text-3xl md:text-4xl font-bold text-blue-400">10K+</div>
            <div className="text-gray-400 text-sm mt-1">Community</div>
          </div>
          <div className="text-center" data-testid="stat-scams-reported">
            <div className="font-orbitron text-3xl md:text-4xl font-bold text-red-400">500+</div>
            <div className="text-gray-400 text-sm mt-1">Scams Reported</div>
          </div>
          <div className="text-center" data-testid="stat-heroes">
            <div className="font-orbitron text-3xl md:text-4xl font-bold text-green-400">150+</div>
            <div className="text-gray-400 text-sm mt-1">Heroes Named</div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce-slow">
        <div className="w-6 h-10 border-2 border-gray-400 rounded-full flex justify-center pt-2">
          <div className="w-1 h-3 bg-gray-400 rounded-full animate-float" />
        </div>
      </div>
    </section>
  );
}
