import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, Bot } from "lucide-react";

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-slate-900/95 backdrop-blur-md border-b border-blue-500/30' : 'bg-transparent'
      }`}
      data-testid="navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse overflow-hidden">
              <img src="/ape-police-logo.png" alt="APE POLICE logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-meme text-xl gradient-text">APE POLICE</span>
          </div>

          <div className="hidden md:flex items-center space-x-5">
            {['mission', 'tokenomics', 'channel', 'roadmap', 'join'].map(id => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="text-white hover:text-yellow-400 transition-colors capitalize text-sm"
                data-testid={`link-nav-${id}`}
              >
                {id === 'join' ? 'Join Squad' : id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
            <Link href="/agent-scanner">
              <span
                className="flex items-center gap-1 text-blue-300 hover:text-blue-200 transition-colors text-sm font-semibold border border-blue-600/40 bg-blue-900/30 rounded-full px-3 py-1 cursor-pointer"
                data-testid="link-nav-agent-scanner"
              >
                <Bot className="w-3.5 h-3.5" />
                Scan Agent
              </span>
            </Link>
          </div>

          <Button
            className="hidden md:flex bg-red-600 hover:bg-red-500 text-white font-bold animate-pulse"
            data-testid="link-buy-apol"
          >
            Buy $APOL 🚨
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-900/95 backdrop-blur-md border-t border-blue-500/30">
          <div className="px-4 pt-2 pb-4 space-y-2">
            {['mission', 'tokenomics', 'channel', 'roadmap', 'join'].map(id => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="block w-full text-left py-2 text-white hover:text-yellow-400 transition-colors"
              >
                {id === 'join' ? 'Join Squad' : id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
            <Link href="/agent-scanner" onClick={() => setIsMobileMenuOpen(false)}>
              <span className="flex items-center gap-2 py-2 text-blue-300 hover:text-blue-200 transition-colors cursor-pointer">
                <Bot className="w-4 h-4" />
                Scan Agent (LARP Detector)
              </span>
            </Link>
            <Button className="w-full mt-4 bg-red-600 hover:bg-red-500 text-white font-bold">
              Buy $APOL 🚨
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
