import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";

const CONTRACT_ADDRESS = "TBA";
const CHAIN = "Base";

const rows = [
  {
    key: "CONTRACT",
    isCA: true,
  },
  {
    key: "TOTAL SUPPLY",
    value: "1,000,000,000",
    tag: "HARD CAPPED",
    tagColor: "text-slate-400",
  },
  {
    key: "TAX PROTOCOL",
    value: "0% Buy / 0% Sell",
    tag: "IMMUTABLE",
    tagColor: "text-green-400",
  },
  {
    key: "LIQUIDITY",
    value: "STATUS: BURNED / LOCKED",
    tag: "Verifiable on-chain",
    tagColor: "text-blue-400",
    tagSmall: true,
  },
];

export default function TokenomicsSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="tokenomics" className="py-20 bg-gradient-to-r from-slate-900 to-blue-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="font-meme text-5xl md:text-6xl gradient-text mb-4">
            Network Specifications
          </h2>
          <p className="text-slate-400 font-mono text-sm uppercase tracking-widest">$APOL · {CHAIN}</p>
        </div>

        {/* Data grid */}
        <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl overflow-hidden">
          {rows.map((row, i) => (
            <div
              key={row.key}
              className="flex items-center gap-4 px-6 py-4 font-mono text-sm"
              style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined }}
            >
              {/* Label */}
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-widest w-36 flex-shrink-0">
                {row.key}
              </span>

              {/* Value */}
              {row.isCA ? (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-slate-300 truncate">{CONTRACT_ADDRESS}</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors flex-shrink-0"
                    data-testid="button-copy-ca"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-1 flex-wrap">
                  <span className="text-white font-semibold">{row.value}</span>
                  {row.tag && (
                    <span className={`text-xs ${row.tagColor} ${row.tagSmall ? "opacity-70" : "font-bold"}`}>
                      [{row.tag}]
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Distribution summary */}
        <div
          className="mt-4 bg-slate-900/70 border border-slate-700/60 rounded-xl px-6 py-5 font-mono"
          style={{ borderLeft: "3px solid rgba(148,163,184,0.3)" }}
        >
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1.5">Distribution</p>
          <p className="text-slate-300 text-sm">
            100% Public Circulation.{" "}
            <span className="text-slate-500">0% Team Reserve.</span>{" "}
            <span className="text-slate-500">0% Marketing Tax.</span>
          </p>
        </div>

      </div>
    </section>
  );
}
