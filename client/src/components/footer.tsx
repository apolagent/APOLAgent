export default function Footer() {
  return (
    <footer className="py-12 px-4 bg-slate-900 border-t border-slate-800" data-testid="footer">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-2">
            <img src="/ape-police-logo.png" alt="APE POLICE" className="w-8 h-8 rounded-full object-cover border border-blue-400/40" />
            <span className="font-meme text-lg gradient-text">APE POLICE</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-400">
            <a href="https://t.me/apepolice" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" data-testid="link-footer-telegram">
              Telegram
            </a>
            <a href="https://x.com/apepolice" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" data-testid="link-footer-twitter">
              X (Twitter)
            </a>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8">
          <p className="text-gray-500 text-xs text-center leading-relaxed max-w-3xl mx-auto" data-testid="text-disclaimer">
            ⚠️ Disclaimer: APE POLICE is a community-driven meme token project. It is not financial advice.
            Cryptocurrency investments carry inherent risks. Always do your own research (DYOR) before
            investing. The team is not responsible for any financial losses. This project is for
            entertainment and community purposes. Past performance does not guarantee future results.
          </p>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} APE POLICE. All rights reserved. Protecting the jungle since Day 1. 🦍
          </p>
        </div>
      </div>
    </footer>
  );
}
