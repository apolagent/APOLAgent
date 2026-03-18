import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Shield, ExternalLink } from "lucide-react";
import type { FlaggedWallet } from "@shared/schema";

const RISK_COLORS: Record<string, { badge: string; border: string; glow: string }> = {
  "High Risk": {
    badge: "bg-red-500/20 text-red-400 border border-red-500/40",
    border: "border-red-500/30",
    glow: "0 0 12px rgba(239,68,68,0.15)",
  },
  "Caution": {
    badge: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40",
    border: "border-yellow-500/30",
    glow: "0 0 12px rgba(234,179,8,0.1)",
  },
  "Clean": {
    badge: "bg-green-500/20 text-green-400 border border-green-500/40",
    border: "border-green-500/30",
    glow: "none",
  },
};

function WalletCard({ wallet }: { wallet: FlaggedWallet }) {
  const colors = RISK_COLORS[wallet.riskLevel] ?? RISK_COLORS["Caution"];
  const short = wallet.address.slice(0, 8) + "…" + wallet.address.slice(-6);
  const isHighRisk = wallet.riskLevel === "High Risk";

  return (
    <div
      className={`rounded-xl p-4 bg-slate-900/80 border ${colors.border} flex flex-col gap-2`}
      style={{ boxShadow: colors.glow }}
      data-testid={`card-flagged-wallet-${wallet.id}`}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {isHighRisk && <span className="text-lg flex-shrink-0">🚨</span>}
          <span className="text-sm text-gray-200 truncate" data-testid={`text-wallet-address-${wallet.id}`}>
            {short}
          </span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${colors.badge}`}>
          {wallet.riskLevel}
          {isHighRisk && ", Serial Rugger"}
        </span>
      </div>

      {wallet.topCategory && (
        <p className="text-xs text-gray-400">
          Category: <span className="text-gray-200 font-medium">{wallet.topCategory.replace(/_/g, " ")}</span>
          {" · "}
          <span className="text-gray-400">{wallet.reportCount} report{wallet.reportCount !== 1 ? "s" : ""}</span>
        </p>
      )}

      <p className="text-xs text-blue-200/80 italic leading-relaxed border-l-2 border-blue-500/40 pl-2">
        "{wallet.apolVerdict.length > 120 ? wallet.apolVerdict.slice(0, 120) + "…" : wallet.apolVerdict}"
      </p>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{new Date(wallet.flaggedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
        <a
          href={`/detective?address=${wallet.address}&chain=${wallet.chain}`}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          data-testid={`link-detective-${wallet.id}`}
        >
          View Intel <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default function RecentlyFlagged() {
  const { data: wallets = [], isLoading } = useQuery<FlaggedWallet[]>({
    queryKey: ["/api/detective/flagged", { limit: 10 }],
    queryFn: () => fetch("/api/detective/flagged?limit=10").then(r => r.json()),
  });

  if (isLoading) {
    return (
      <section className="w-full max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-red-400" />
          <h2 className="text-2xl font-black text-white tracking-wide uppercase font-orbitron">
            Recently Flagged Wallets
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-800/50 animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  if (wallets.length === 0) {
    return (
      <section className="w-full max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-red-400" />
          <h2 className="text-2xl font-black text-white tracking-wide uppercase font-orbitron">
            Recently Flagged Wallets
          </h2>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-8 text-center text-gray-500">
          <p className="text-sm">No flagged wallets yet. Check a wallet address on the Report Scam page to begin tracking.</p>
        </div>
      </section>
    );
  }

  const highRiskCount = wallets.filter(w => w.riskLevel === "High Risk").length;

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-12" data-testid="section-recently-flagged">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-red-400 flex-shrink-0" />
          <h2 className="text-2xl font-black text-white tracking-wide uppercase font-orbitron">
            Recently Flagged Wallets
          </h2>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {highRiskCount > 0 && (
            <span className="flex items-center gap-1 bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-bold text-xs">
              <AlertTriangle className="w-3 h-3" />
              {highRiskCount} High Risk
            </span>
          )}
          <span className="text-gray-500 text-xs">{wallets.length} wallet{wallets.length !== 1 ? "s" : ""} on record</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map(wallet => (
          <WalletCard key={wallet.id} wallet={wallet} />
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-gray-600">
        Powered by APE POLICE Detective Service
      </p>
    </section>
  );
}
