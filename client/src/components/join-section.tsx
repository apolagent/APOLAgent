import { Button } from "@/components/ui/button";
import { SiTelegram, SiX } from "react-icons/si";
import { ExternalLink, ShoppingCart } from "lucide-react";

const socialLinks = [
  {
    label: "Telegram",
    icon: SiTelegram,
    href: "https://t.me/apepolice",
    color: "bg-[#0088cc] hover:bg-[#006da3]",
  },
  {
    label: "X (Twitter)",
    icon: SiX,
    href: "https://x.com/apepolice",
    color: "bg-gray-800 hover:bg-gray-700",
  },
  {
    label: "APE Channel",
    icon: ExternalLink,
    href: "https://t.me/apepolice",
    color: "bg-gradient-to-r from-blue-600 to-green-500 hover:from-blue-700 hover:to-green-600",
  },
  {
    label: "Buy $APEPOL",
    icon: ShoppingCart,
    href: "#",
    color: "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600",
  },
];

export default function JoinSection() {
  return (
    <section id="join" className="py-24 px-4 bg-slate-900 relative" data-testid="join-section">
      <div className="absolute inset-0 hero-bg opacity-30" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className="font-meme text-4xl md:text-6xl gradient-text mb-6" data-testid="text-join-title">
          Join the Force
        </h2>
        <p className="text-gray-300 text-xl mb-12 max-w-2xl mx-auto">
          Every ape counts. Join APE POLICE and help us keep the crypto jungle safe.
          Together, we are unstoppable. 🦍🚔
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`button-social-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Button className={`w-full ${link.color} text-white font-bold py-6 rounded-xl text-base`}>
                <link.icon className="w-5 h-5 mr-2" />
                {link.label}
              </Button>
            </a>
          ))}
        </div>

        <div className="mt-16 p-8 rounded-2xl bg-slate-800/50 border border-slate-700" data-testid="card-contract">
          <div className="text-gray-400 text-sm mb-2">Contract Address</div>
          <div className="font-mono text-blue-400 text-sm md:text-base break-all">
            Coming Soon...
          </div>
        </div>
      </div>
    </section>
  );
}
