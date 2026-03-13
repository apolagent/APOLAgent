import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/report-scam", label: "Report Scam" },
    { href: "/nominate-hero", label: "Nominate Hero" },
    { href: "/rankings", label: "Rankings" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50" data-testid="navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group" data-testid="link-home-logo">
              <img
                src="/ape-police-logo.png"
                alt="APE POLICE"
                className="w-10 h-10 rounded-full object-cover border-2 border-blue-400/50 group-hover:border-blue-300 transition-all"
              />
              <span className="font-meme text-xl gradient-text">APE POLICE</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    location === link.href
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-gray-300 hover:text-white hover:bg-slate-800"
                  }`}
                  data-testid={`link-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {link.label}
                </span>
              </Link>
            ))}
            <a
              href="https://t.me/apepolice"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-telegram"
            >
              <Button className="ml-2 bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm">
                Join Telegram
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
        <div className="md:hidden bg-slate-800/95 backdrop-blur-xl border-b border-slate-700">
          <div className="px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span
                  className={`block px-4 py-3 rounded-lg text-sm font-medium cursor-pointer ${
                    location === link.href
                      ? "bg-blue-500/20 text-blue-400"
                      : "text-gray-300 hover:text-white hover:bg-slate-700"
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
