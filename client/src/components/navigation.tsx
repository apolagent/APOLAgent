import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const scrollTo = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
};

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const isHome = location === "/";

  const scrollLinks = [
    { id: "mission", label: "Mission" },
    { id: "tokenomics", label: "Tokenomics" },
    { id: "channel", label: "Channel" },
    { id: "roadmap", label: "Roadmap" },
    { id: "join", label: "Join Squad" },
  ];

  const pageLinks = [
    { href: "/report-scam", label: "Report Scam" },
    { href: "/nominate-hero", label: "Nominate Hero" },
    { href: "/rankings", label: "Rankings" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-sm" data-testid="navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group" data-testid="link-home-logo">
              <img
                src="/ape-police-logo.png"
                alt="APE POLICE"
                className="w-9 h-9 rounded-full object-cover border-2 border-yellow-400 group-hover:border-yellow-300 transition-all"
              />
              <span className="font-meme text-lg text-cyan-400 group-hover:text-cyan-300 transition-colors">APE POLICE</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {isHome ? (
              scrollLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className="px-4 py-2 text-sm font-medium text-white hover:text-yellow-400 transition-colors cursor-pointer"
                  data-testid={`link-nav-${link.id}`}
                >
                  {link.label}
                </button>
              ))
            ) : (
              pageLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      location === link.href
                        ? "text-yellow-400"
                        : "text-white hover:text-yellow-400"
                    }`}
                    data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {link.label}
                  </span>
                </Link>
              ))
            )}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <a href="#" data-testid="link-buy-apol">
              <Button className="bg-red-500 hover:bg-red-600 text-white font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-1">
                Buy $APOL <Rocket className="w-4 h-4" />
              </Button>
            </a>
          </div>

          <button
            className="md:hidden text-white"
            onClick={() => setIsOpen(!isOpen)}
            data-testid="button-mobile-menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-xl border-b border-slate-700">
          <div className="px-4 py-4 space-y-2">
            {isHome ? (
              scrollLinks.map((link) => (
                <button
                  key={link.id}
                  onClick={() => { scrollTo(link.id); setIsOpen(false); }}
                  className="block w-full text-left px-4 py-3 rounded-lg text-sm font-medium text-white hover:text-yellow-400 transition-colors"
                >
                  {link.label}
                </button>
              ))
            ) : (
              pageLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    className="block px-4 py-3 rounded-lg text-sm font-medium text-white hover:text-yellow-400 cursor-pointer"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </span>
                </Link>
              ))
            )}
            <a href="#" className="block">
              <Button className="w-full bg-red-500 hover:bg-red-600 text-white font-bold text-sm mt-2">
                Buy $APOL <Rocket className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
