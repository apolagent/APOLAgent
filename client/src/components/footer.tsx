import { ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="py-12 bg-gradient-to-r from-slate-900 to-black border-t border-blue-500/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">

          {/* Shield mark */}
          <div className="flex justify-center mb-5">
            <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          {/* Main credit */}
          <p className="text-base font-semibold text-white mb-1 tracking-wide">
            <span className="font-meme gradient-text">APE POLICE</span>
          </p>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-6">
            Digital Asset Intelligence Network
          </p>

          {/* Operational disclaimer */}
          <p className="text-xs text-slate-500 max-w-2xl mx-auto leading-relaxed">
            © 2026 APE POLICE. Providing on-chain forensics and agent verification for the Base ecosystem.
            Data is aggregated from public streams; users are responsible for all trading decisions.
          </p>

        </div>
      </div>
    </footer>
  );
}
