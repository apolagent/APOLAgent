import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, ArrowLeft, ThumbsUp, Clock, ExternalLink, Search, CheckCircle, XCircle, Loader2, Send, Bot, Share2, Upload, ImageIcon, X } from "lucide-react";
import { Link } from "wouter";
import { insertScamReportSchema, type InsertScamReport, type ScamReport } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";

const scamTypes = [
  "Rug Pull",
  "Fake Token",
  "Ponzi Scheme",
  "Phishing Site",
  "Fake Exchange",
  "Romance Scam",
  "Investment Fraud",
  "Fake Airdrop",
  "Impersonation",
  "Other"
];

const chains = [
  { value: "ethereum", label: "Ethereum (ETH)" },
  { value: "bitcoin", label: "Bitcoin (BTC)" },
  { value: "bsc", label: "BNB Smart Chain (BSC)" },
  { value: "solana", label: "Solana (SOL)" },
  { value: "polygon", label: "Polygon (MATIC)" },
  { value: "avalanche", label: "Avalanche (AVAX)" },
  { value: "tron", label: "Tron (TRX)" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "optimism", label: "Optimism" },
  { value: "base", label: "Base" },
  { value: "other", label: "Other" },
];

type DetectiveResult = {
  address?: string;
  chain?: string;
  addressType?: "wallet" | "contract";
  riskLevel?: string;
  apolVerdict?: string;
  isHighRisk?: boolean;
  isNewOffender?: boolean;
  // Wallet fields
  walletFlags?: string[];
  totalFlags?: number;
  // Contract fields
  greenBadge?: boolean;
  redFlags?: string[];
  tokenName?: string;
  tokenSymbol?: string;
  buyTax?: number;
  sellTax?: number;
  isHoneypot?: boolean;
  isMintable?: boolean;
  isOpenSource?: boolean;
  isInDex?: boolean;
};

export default function ReportScam() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [checkAddress, setCheckAddress] = useState("");
  const [checkChain, setCheckChain] = useState("ethereum");
  const [checkResult, setCheckResult] = useState<DetectiveResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 900;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = reject;
        img.src = e.target!.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError(null);
    if (!file.type.startsWith("image/")) {
      setImageError("Please select an image file (JPG, PNG, GIF, WebP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageError("Image must be under 10 MB");
      return;
    }
    try {
      const compressed = await compressImage(file);
      setUploadedImage(compressed);
    } catch {
      setImageError("Failed to process image. Please try another file.");
    }
    e.target.value = "";
  };

  const buildTweetText = (result: DetectiveResult) => {
    const addr = result.address || checkAddress;
    const short = addr.slice(0, 8) + "…" + addr.slice(-4);
    const type = result.addressType === "contract"
      ? `Token ${result.tokenSymbol || ""}`
      : "Wallet";
    const risk = result.riskLevel || "Unknown Risk";
    const issues = result.addressType === "contract"
      ? (result.greenBadge ? "passed all security checks ✅" : `red flags: ${result.redFlags?.join(", ")}`)
      : (result.walletFlags?.length ? `flagged for: ${result.walletFlags.join(", ")}` : "no external flags");
    return encodeURIComponent(
      `🚨 APOL SECURITY ALERT 🚨\n\n${type} ${short}, ${risk}\nAPOL scan: ${issues}\n\nScanned by @ApePolice, #APOL #CryptoSafety #DYOR`
    );
  };

  const form = useForm<InsertScamReport>({
    resolver: zodResolver(insertScamReportSchema),
    defaultValues: {
      title: "",
      description: "",
      scamType: "",
      evidenceUrl: "",
      reportedBy: 1,
    },
  });

  const { data: scamReports = [], isLoading } = useQuery<ScamReport[]>({
    queryKey: ["/api/scam-reports"],
  });

  const createReportMutation = useMutation({
    mutationFn: async (data: InsertScamReport) => {
      const res = await apiRequest("POST", "/api/scam-reports", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scam-reports"] });
      toast({
        title: "Report Submitted",
        description: "Your scam report has been submitted for review by the community.",
      });
      form.reset();
      setUploadedImage(null);
      setImageError(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ targetId, voteType }: { targetId: number; voteType: string }) => {
      const res = await apiRequest("POST", "/api/votes", {
        userId: 1,
        targetId,
        targetType: "scam_report",
        voteType,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scam-reports"] });
    },
  });

  const onSubmit = (data: InsertScamReport) => {
    createReportMutation.mutate({ ...data, evidenceImage: uploadedImage ?? undefined });
  };

  const handleCheckAddress = async () => {
    if (!checkAddress.trim()) {
      toast({ title: "Address Required", description: "Enter a wallet or contract address.", variant: "destructive" });
      return;
    }
    setIsChecking(true);
    setCheckResult(null);
    setCheckError(null);
    try {
      const res = await fetch(
        `/api/detective/analyze?address=${encodeURIComponent(checkAddress.trim())}&chain=${encodeURIComponent(checkChain)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCheckError(data.error || "Failed to check address");
      } else {
        setCheckResult(data);
        if (data.reports && data.reports.length > 0) {
          queryClient.invalidateQueries({ queryKey: ["/api/detective/flagged"] });
        }
      }
    } catch {
      setCheckError("Network error. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };


  const getScamTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      "Rug Pull": "bg-red-500/20 text-red-400 border-red-500/30",
      "Fake Token": "bg-orange-500/20 text-orange-400 border-orange-500/30",
      "Ponzi Scheme": "bg-purple-500/20 text-purple-400 border-purple-500/30",
      "Phishing Site": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      "Fake Exchange": "bg-pink-500/20 text-pink-400 border-pink-500/30",
      "Investment Fraud": "bg-red-500/20 text-red-400 border-red-500/30",
      "Fake Airdrop": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
      "Impersonation": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    };
    return colors[type] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navigation />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 pt-28">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Shield className="w-14 h-14 text-red-500" />
          </div>
          <h1 className="font-meme text-4xl md:text-6xl gradient-text mb-4" data-testid="text-page-title">
            Report a Scam
          </h1>
          <p className="text-xl text-gray-400 mb-8" data-testid="text-page-description">
            Submit evidence. Flag threats. Protect the community.
          </p>
          <Link href="/">
            <Button variant="outline" className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-slate-900" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* APOL Detective Scanner */}
        <Card className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-600/50 mb-10">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" />
              Scan CA or Wallet
            </CardTitle>
            <CardDescription className="text-gray-300">
              Full security scan. Flags honeypots, blacklisted addresses, tax traps, and mint abuse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Select value={checkChain} onValueChange={setCheckChain}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white sm:w-48" data-testid="select-check-chain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {chains.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-white hover:bg-slate-700">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={checkAddress}
                onChange={(e) => setCheckAddress(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckAddress()}
                placeholder="Enter wallet / contract address..."
                className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400 flex-1"
                data-testid="input-check-address"
              />
              <Button
                onClick={handleCheckAddress}
                disabled={isChecking}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                data-testid="button-check-address"
              >
                {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-2">{isChecking ? "Scanning..." : "Scan"}</span>
              </Button>
            </div>

            {checkError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/30 border border-red-600/40 text-red-300" data-testid="text-check-error">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span>{checkError}</span>
              </div>
            )}

            {checkResult && (
              <div data-testid="div-check-result" className="space-y-4">
                {/* ── CONTRACT RESULT ───────────────────────────────── */}
                {checkResult.addressType === "contract" ? (
                  <div className="space-y-4">
                    {/* Token header */}
                    {(checkResult.tokenName || checkResult.tokenSymbol) && (
                      <div className="flex items-center gap-3 px-1">
                        <span className="text-xs uppercase tracking-widest text-gray-400 font-bold">Token</span>
                        <span className="text-white font-bold">
                          {checkResult.tokenName}
                          {checkResult.tokenSymbol && <span className="text-gray-400 font-normal ml-1">({checkResult.tokenSymbol})</span>}
                        </span>
                        {checkResult.isInDex && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Listed on DEX</span>
                        )}
                      </div>
                    )}

                    {/* Green badge OR red alert */}
                    {checkResult.greenBadge ? (
                      <div
                        data-testid="div-green-badge"
                        className="relative overflow-hidden rounded-xl border-2 border-green-500 bg-green-950/50 p-5 text-center"
                        style={{ boxShadow: "0 0 30px rgba(34,197,94,0.3)" }}
                      >
                        <div className="text-5xl mb-2">✅</div>
                        <h3 className="text-2xl font-black text-green-400 tracking-widest uppercase">APE POLICE Green Badge</h3>
                        <p className="text-green-300 mt-1 font-semibold">Status: Cleared. All checks passed.</p>
                      </div>
                    ) : (
                      <div
                        data-testid="div-police-record-alert"
                        className={`relative overflow-hidden rounded-xl border-2 p-5 text-center ${
                          checkResult.isHighRisk ? "border-red-500 bg-red-950/60" : "border-yellow-500 bg-yellow-950/40"
                        }`}
                        style={{ boxShadow: checkResult.isHighRisk ? "0 0 30px rgba(239,68,68,0.4)" : "0 0 20px rgba(234,179,8,0.25)" }}
                      >
                        <div className="text-5xl mb-2">{checkResult.isHighRisk ? "🚨" : "⚠️"}</div>
                        <h3 className={`text-2xl font-black tracking-widest uppercase ${checkResult.isHighRisk ? "text-red-400" : "text-yellow-400"}`}>
                          {checkResult.isHighRisk ? "Contract Danger Detected" : "Security Warnings Found"}
                        </h3>
                        <p className={`mt-1 font-semibold ${checkResult.isHighRisk ? "text-red-300" : "text-yellow-300"}`}>
                          {checkResult.redFlags?.length} risk flag(s), {checkResult.riskLevel}
                        </p>
                      </div>
                    )}

                    {/* Contract security grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: "Honeypot", value: checkResult.isHoneypot, bad: true },
                        { label: "Mintable", value: checkResult.isMintable, bad: true },
                        { label: "Open Source", value: checkResult.isOpenSource, bad: false },
                        { label: `Buy Tax ${checkResult.buyTax !== undefined ? checkResult.buyTax.toFixed(1) + "%" : ""}`, value: (checkResult.buyTax ?? 0) > 10, bad: true },
                        { label: `Sell Tax ${checkResult.sellTax !== undefined ? checkResult.sellTax.toFixed(1) + "%" : ""}`, value: (checkResult.sellTax ?? 0) > 10, bad: true },
                        { label: "On DEX", value: checkResult.isInDex, bad: false },
                      ].map((item, i) => {
                        const isWarning = item.bad ? item.value : !item.value;
                        const icon = isWarning ? "⚠" : "✓";
                        const color = isWarning ? "text-red-400 border-red-500/30 bg-red-900/20" : "text-green-400 border-green-500/30 bg-green-900/20";
                        return (
                          <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold ${color}`} data-testid={`div-contract-flag-${i}`}>
                            <span>{icon}</span>
                            <span>{item.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Red flag list */}
                    {checkResult.redFlags && checkResult.redFlags.length > 0 && (
                      <div className="space-y-1">
                        {checkResult.redFlags.map((flag, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-red-300 px-1" data-testid={`div-red-flag-${i}`}>
                            <XCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                            <span>{flag}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* APOL Verdict */}
                    <div data-testid="div-apol-summary" className="flex gap-3 p-4 rounded-xl bg-blue-950/50 border border-blue-500/40">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm">🦍</div>
                      <div>
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Bot className="w-3 h-3" /> APOL Detective
                        </p>
                        <p className="text-blue-100 text-sm leading-relaxed italic">"{checkResult.apolVerdict}"</p>
                      </div>
                    </div>

                    {/* Share to X */}
                    <a
                      data-testid="button-share-x"
                      href={`https://twitter.com/intent/tweet?text=${buildTweetText(checkResult)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-white transition-all"
                      style={{ background: "#000", border: "1px solid #333" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
                      onMouseLeave={e => (e.currentTarget.style.background = "#000")}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.744l7.736-8.848L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      Share APOL Alert to X
                    </a>
                  </div>

                ) : (
                  /* ── WALLET RESULT ─────────────────────────────────── */
                  <div className="space-y-4">
                    {/* Status banner */}
                    {checkResult.riskLevel === "Clean" && !checkResult.isNewOffender ? (
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-green-900/30 border border-green-600/40 text-green-300">
                        <CheckCircle className="w-6 h-6 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-green-200 tracking-widest uppercase">Status: Clear</p>
                          <p className="text-sm text-green-400 mt-0.5">No flags on record.</p>
                        </div>
                      </div>
                    ) : (
                      <div
                        data-testid="div-police-record-alert"
                        className={`relative overflow-hidden rounded-xl border-2 p-5 text-center ${
                          checkResult.isNewOffender ? "border-orange-500 bg-orange-950/50" : checkResult.isHighRisk ? "border-red-500 bg-red-950/60" : "border-yellow-500 bg-yellow-950/40"
                        }`}
                        style={{ boxShadow: checkResult.isNewOffender ? "0 0 30px rgba(249,115,22,0.35)" : checkResult.isHighRisk ? "0 0 30px rgba(239,68,68,0.4)" : "0 0 20px rgba(234,179,8,0.25)" }}
                      >
                        <div className="text-5xl mb-2">🚨</div>
                        {checkResult.isNewOffender ? (
                          <>
                            <h3 className="text-2xl font-black text-orange-400 tracking-widest uppercase">New Offender Detected</h3>
                            <p className="text-orange-300 mt-1 font-semibold">Flagged: last 24 hours.</p>
                          </>
                        ) : (
                          <>
                            <h3 className={`text-2xl font-black tracking-widest uppercase ${checkResult.isHighRisk ? "text-red-400" : "text-yellow-400"}`}>
                              {checkResult.isHighRisk ? "High Risk Wallet" : "Suspicious Wallet"}
                            </h3>
                            <p className={`mt-1 font-semibold ${checkResult.isHighRisk ? "text-red-300" : "text-yellow-300"}`}>
                              {checkResult.totalFlags} flag(s) detected, {checkResult.riskLevel}
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Risk badge */}
                    {checkResult.riskLevel && checkResult.riskLevel !== "Clean" && (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                          checkResult.isHighRisk ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                        }`}>
                          {checkResult.riskLevel}
                        </span>
                      </div>
                    )}

                    {/* Wallet flags */}
                    {checkResult.walletFlags && checkResult.walletFlags.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Security Flags</p>
                        <div className="flex flex-wrap gap-2">
                          {checkResult.walletFlags.map((flag, i) => (
                            <span key={i} className="text-xs px-3 py-1 rounded-full bg-red-900/40 border border-red-500/40 text-red-300 font-semibold" data-testid={`badge-wallet-flag-${i}`}>
                              🚩 {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* APOL Verdict */}
                    <div data-testid="div-apol-summary" className="flex gap-3 p-4 rounded-xl bg-blue-950/50 border border-blue-500/40">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm">🦍</div>
                      <div>
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Bot className="w-3 h-3" /> APOL Detective
                        </p>
                        <p className="text-blue-100 text-sm leading-relaxed italic">"{checkResult.apolVerdict}"</p>
                      </div>
                    </div>

                    {/* Share to X, only if flagged */}
                    {(checkResult.riskLevel !== "Clean" || checkResult.isNewOffender) && (
                      <a
                        data-testid="button-share-x"
                        href={`https://twitter.com/intent/tweet?text=${buildTweetText(checkResult)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-white transition-all"
                        style={{ background: "#000", border: "1px solid #333" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#000")}
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.402 6.231H2.744l7.736-8.848L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Share APOL Warning to X
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-12">
          <Card className="bg-gradient-to-br from-red-900/20 to-red-800/30 border-red-600/50">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Submit Community Report
              </CardTitle>
              <CardDescription className="text-gray-300">
                Log the threat. All fields marked * are required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-report-scam">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Scam Title *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., FakeToken Rug Pull, Phishing Website"
                            className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400"
                            data-testid="input-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scamType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Scam Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-slate-800 border-slate-600 text-white" data-testid="select-scam-type">
                              <SelectValue placeholder="Select scam type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-slate-800 border-slate-600">
                            {scamTypes.map((type) => (
                              <SelectItem key={type} value={type} className="text-white hover:bg-slate-700">
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Incident Report *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Incident details: methods, actors, losses, warning signs."
                            className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400 min-h-[120px]"
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="evidenceUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Evidence URL (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            placeholder="https://... (Screenshots, blockchain explorer, social media)"
                            className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400"
                            data-testid="input-evidence-url"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Image upload */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-white flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-gray-400" />
                      Evidence Screenshot
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      data-testid="input-image-upload"
                    />
                    {!uploadedImage ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-slate-600 hover:border-red-500/60 rounded-xl p-6 flex flex-col items-center gap-2 text-gray-400 hover:text-red-400 transition-colors bg-slate-800/50"
                        data-testid="button-upload-image"
                      >
                        <Upload className="w-7 h-7" />
                        <span className="text-sm font-medium">Attach screenshot</span>
                        <span className="text-xs text-gray-500">JPG, PNG, GIF, WebP · Max 10 MB</span>
                      </button>
                    ) : (
                      <div className="relative rounded-xl overflow-hidden border border-slate-600 bg-slate-800">
                        <img
                          src={uploadedImage}
                          alt="Evidence preview"
                          className="w-full max-h-64 object-contain"
                          data-testid="img-evidence-preview"
                        />
                        <button
                          type="button"
                          onClick={() => { setUploadedImage(null); setImageError(null); }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-red-600 text-white transition-colors"
                          data-testid="button-remove-image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-black/60 text-xs text-green-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Image ready to submit
                        </div>
                      </div>
                    )}
                    {imageError && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> {imageError}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={createReportMutation.isPending}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3"
                    data-testid="button-submit-report"
                  >
                    {createReportMutation.isPending ? "Submitting..." : "Submit Community Report"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h3 className="font-meme text-2xl text-white flex items-center gap-2" data-testid="text-recent-reports">
              <Shield className="w-6 h-6 text-blue-400" />
              Recent Community Reports
            </h3>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-6 rounded-xl bg-slate-800 border border-slate-700 animate-pulse">
                    <div className="h-4 bg-slate-700 rounded w-3/4 mb-3" />
                    <div className="h-3 bg-slate-700 rounded w-full mb-2" />
                    <div className="h-3 bg-slate-700 rounded w-2/3" />
                  </div>
                ))}
              </div>
            ) : scamReports.length === 0 ? (
              <div className="p-12 rounded-xl bg-slate-800 border border-slate-700 text-center">
                <AlertTriangle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No scam reports yet</p>
                <p className="text-gray-500 text-sm mt-2">Be the first to report a scam and protect the community!</p>
              </div>
            ) : (
              scamReports.map((report) => (
                <div
                  key={report.id}
                  className="p-6 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors"
                  data-testid={`card-report-${report.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-bold text-white text-lg">{report.title}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getScamTypeColor(report.scamType)}`}>
                      {report.scamType}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm mb-4 line-clamp-3">{report.description}</p>

                  {report.evidenceImage && (
                    <div className="mb-4 rounded-lg overflow-hidden border border-slate-600">
                      <img
                        src={report.evidenceImage}
                        alt="Evidence screenshot"
                        className="w-full max-h-48 object-contain bg-slate-900"
                        data-testid={`img-report-evidence-${report.id}`}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => voteMutation.mutate({ targetId: report.id, voteType: "upvote" })}
                        className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors"
                        data-testid={`button-upvote-${report.id}`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        <span className="text-sm font-medium">{report.votes}</span>
                      </button>
                      {report.evidenceUrl && (
                        <a
                          href={report.evidenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Evidence
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(report.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
