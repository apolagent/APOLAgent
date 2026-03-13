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
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to bottom, rgba(10,15,40,0.3) 0%, rgba(10,15,40,0.55) 50%, rgba(10,15,40,0.85) 100%)"
        }}
      />

      <div className="relative z-10 text-center px-4 max-w-2xl mx-auto pt-10">
        <div className="mb-5 flex justify-center">
          <div
            className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden"
            style={{
              border: "6px solid #FFD700",
              boxShadow: "0 0 0 2px rgba(255,215,0,0.25), 0 0 30px rgba(255,215,0,0.3)"
            }}
          >
            <img
              src="/ape-police-logo.png"
              alt="APE POLICE"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <h1
          className="font-meme font-black leading-none mb-1"
          style={{
            fontSize: "clamp(3.5rem, 10vw, 7rem)",
            color: "#FFD700",
            textShadow: "0 2px 20px rgba(255,215,0,0.35)"
          }}
          data-testid="text-headline"
        >
          APE POLICE
        </h1>

        <p
          className="font-meme font-bold italic mb-6"
          style={{
            fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
            color: "#00CC44"
          }}
          data-testid="text-tagline"
        >
          is Watching
        </p>

        <p
          className="text-base md:text-lg text-white mb-8 mx-auto leading-relaxed"
          style={{ maxWidth: "520px" }}
          data-testid="text-description"
        >
          The{" "}
          <span className="font-semibold" style={{ color: "#00CC44" }}>
            meme-powered task force
          </span>{" "}
          protecting crypto from chaos — and celebrating those who make it better.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <a href="https://t.me/apepolice" target="_blank" rel="noopener noreferrer" data-testid="button-join-patrol">
            <Button
              className="text-white font-bold px-7 py-5 text-base rounded-xl flex items-center gap-2 min-w-[180px] justify-center"
              style={{ backgroundColor: "#2563eb" }}
            >
              <SiTelegram className="w-4 h-4" />
              Join the Patrol
            </Button>
          </a>
          <a href="#" data-testid="button-buy-apol">
            <Button
              className="text-white font-bold px-7 py-5 text-base rounded-xl flex items-center gap-2 min-w-[160px] justify-center"
              style={{ backgroundColor: "#16a34a" }}
            >
              <Coins className="w-4 h-4" />
              Buy $APOL
            </Button>
          </a>
        </div>

        <div className="flex justify-center">
          <ChevronDown className="w-6 h-6 animate-bounce" style={{ color: "#00CC44" }} />
        </div>
      </div>
    </section>
  );
}
