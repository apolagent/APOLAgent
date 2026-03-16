import { useState } from "react";
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
import { Shield, AlertTriangle, ArrowLeft, ThumbsUp, Clock, ExternalLink, Search, CheckCircle, XCircle, Loader2, Send, Bot, Share2 } from "lucide-react";
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

type ChainAbuseReport = {
  id?: string;
  description?: string;
  category?: string;
  createdAt?: string;
};

type ChainAbuseResult = {
  reports?: ChainAbuseReport[];
  total?: number;
  riskLevel?: string;
  topCategory?: string;
  apolVerdict?: string;
  isHighRisk?: boolean;
  isSerial?: boolean;
};

export default function ReportScam() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [checkAddress, setCheckAddress] = useState("");
  const [checkChain, setCheckChain] = useState("ethereum");
  const [checkResult, setCheckResult] = useState<ChainAbuseResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const [reportAddress, setReportAddress] = useState("");
  const [reportChain, setReportChain] = useState("ethereum");
  const [reportDescription, setReportDescription] = useState("");
  const [reportCategory, setReportCategory] = useState("scam");
  const [isSubmittingChain, setIsSubmittingChain] = useState(false);

  const buildApolSummary = (address: string, reports: any[]) => {
    const first = reports[0];
    const category = first?.category || "suspicious activity";
    const dateStr = first?.createdAt
      ? new Date(first.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    const count = reports.length;
    const categoryLabel = category.replace(/_/g, " ");
    const dateClause = dateStr ? ` on ${dateStr}` : "";
    const multi = count > 1 ? ` Repeat offender — ${count} reports on file.` : "";
    return `Citizen, this wallet was flagged for ${categoryLabel}${dateClause}. Approach with extreme caution.${multi} Stay safe out there — APE POLICE have your back. 🚨🦍`;
  };

  const buildTweetText = (address: string, reports: any[]) => {
    const first = reports[0];
    const category = (first?.category || "scam").replace(/_/g, " ");
    const count = reports.length;
    const short = address.slice(0, 6) + "…" + address.slice(-4);
    return encodeURIComponent(
      `🚨 APOL ALERT 🚨\n\nWallet ${short} has ${count} report(s) on ChainAbuse for: ${category}.\n\nVerified by @ApePolice — do NOT interact with this address.\n\n#APOL #CryptoScam #ApePolice #DYOR`
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
    createReportMutation.mutate(data);
  };

  const handleCheckAddress = async () => {
    if (!checkAddress.trim()) {
      toast({ title: "Enter an address", description: "Please enter a blockchain address to check.", variant: "destructive" });
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

  const handleChainAbuseReport = async () => {
    if (!reportAddress.trim() || !reportDescription.trim()) {
      toast({ title: "Missing fields", description: "Address and description are required.", variant: "destructive" });
      return;
    }
    setIsSubmittingChain(true);
    try {
      const res = await fetch("/api/chainabuse/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: reportAddress.trim(),
          chain: reportChain,
          description: reportDescription.trim(),
          category: reportCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Report Failed", description: data.error || "Failed to submit to ChainAbuse.", variant: "destructive" });
      } else {
        toast({ title: "Reported to ChainAbuse!", description: "The address has been flagged on the ChainAbuse database." });
        setReportAddress("");
        setReportDescription("");
      }
    } catch {
      toast({ title: "Error", description: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmittingChain(false);
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
            Help protect the community by reporting suspicious projects and scams
          </p>
          <Link href="/">
            <Button variant="outline" className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-slate-900" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* ChainAbuse Address Checker */}
        <Card className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-600/50 mb-10">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" />
              Check Address on ChainAbuse
            </CardTitle>
            <CardDescription className="text-gray-300">
              Look up any blockchain address to see if it has been flagged for scams
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
                <span className="ml-2">{isChecking ? "Checking..." : "Check"}</span>
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
                {(!checkResult.reports || checkResult.reports.length === 0) ? (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-green-900/30 border border-green-600/40 text-green-300">
                    <CheckCircle className="w-6 h-6 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-green-200">All Clear — No Reports Found</p>
                      <p className="text-sm text-green-400 mt-0.5">This address has no records on ChainAbuse. Proceed with your usual caution.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 🚨 POLICE RECORD FOUND banner */}
                    <div
                      data-testid="div-police-record-alert"
                      className="relative overflow-hidden rounded-xl border-2 border-red-500 bg-red-950/60 p-5 text-center"
                      style={{ boxShadow: "0 0 30px rgba(239,68,68,0.4)" }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-red-900/40 to-transparent pointer-events-none" />
                      <div className="relative z-10">
                        <div className="text-5xl mb-2">🚨</div>
                        <h3 className="text-2xl font-black text-red-400 tracking-widest uppercase">Police Record Found</h3>
                        <p className="text-red-300 mt-1 font-semibold">
                          {checkResult.total ?? checkResult.reports.length} report(s) on file for this address
                        </p>
                      </div>
                    </div>

                    {/* Risk level badge */}
                    {checkResult.riskLevel && checkResult.riskLevel !== "Clean" && (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                          checkResult.isHighRisk
                            ? "bg-red-500/20 text-red-400 border border-red-500/40"
                            : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
                        }`}>
                          {checkResult.riskLevel}{checkResult.isSerial ? " — Suspected Serial Rugger" : ""}
                        </span>
                      </div>
                    )}

                    {/* APOL Agent Summary */}
                    <div
                      data-testid="div-apol-summary"
                      className="flex gap-3 p-4 rounded-xl bg-blue-950/50 border border-blue-500/40"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                        🦍
                      </div>
                      <div>
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                          <Bot className="w-3 h-3" /> APOL Detective
                        </p>
                        <p className="text-blue-100 text-sm leading-relaxed italic">
                          "{checkResult.apolVerdict || buildApolSummary(checkAddress, checkResult.reports)}"
                        </p>
                      </div>
                    </div>

                    {/* Report details */}
                    <div className="space-y-2">
                      {checkResult.reports.map((r: any, i: number) => (
                        <div key={r.id ?? i} className="p-3 rounded-lg bg-slate-800/80 border border-red-500/30 text-sm text-gray-200" data-testid={`div-chainabuse-report-${i}`}>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-semibold uppercase tracking-wide">
                              {(r.category || "scam").replace(/_/g, " ")}
                            </span>
                            {r.createdAt && (
                              <span className="text-xs text-gray-500">
                                {new Date(r.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300">{r.description || "No description provided."}</p>
                        </div>
                      ))}
                    </div>

                    {/* Share to X */}
                    <a
                      data-testid="button-share-x"
                      href={`https://twitter.com/intent/tweet?text=${buildTweetText(checkAddress, checkResult.reports)}`}
                      target="_blank"
                      rel="noopener noreferrer"
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
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ChainAbuse Report Submission */}
        <Card className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-600/40 mb-10">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-400" />
              Report Address to ChainAbuse
            </CardTitle>
            <CardDescription className="text-gray-300">
              Submit a flagged blockchain address directly to the ChainAbuse global database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={reportChain} onValueChange={setReportChain}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white sm:w-48" data-testid="select-report-chain">
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
                  value={reportAddress}
                  onChange={(e) => setReportAddress(e.target.value)}
                  placeholder="Scam wallet / contract address..."
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400 flex-1"
                  data-testid="input-report-address"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={reportCategory} onValueChange={setReportCategory}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white sm:w-48" data-testid="select-report-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="scam" className="text-white hover:bg-slate-700">Scam</SelectItem>
                    <SelectItem value="hack" className="text-white hover:bg-slate-700">Hack</SelectItem>
                    <SelectItem value="rugpull" className="text-white hover:bg-slate-700">Rug Pull</SelectItem>
                    <SelectItem value="phishing" className="text-white hover:bg-slate-700">Phishing</SelectItem>
                    <SelectItem value="other" className="text-white hover:bg-slate-700">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe the scam — what happened, how much was lost, any details..."
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400 min-h-[80px] flex-1"
                  data-testid="input-report-description"
                />
              </div>
              <Button
                onClick={handleChainAbuseReport}
                disabled={isSubmittingChain}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3"
                data-testid="button-submit-chainabuse"
              >
                {isSubmittingChain ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {isSubmittingChain ? "Submitting to ChainAbuse..." : "Submit to ChainAbuse Database"}
              </Button>
            </div>
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
                Provide detailed information about the scam to warn our community
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
                        <FormLabel className="text-white">Detailed Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Describe the scam in detail: How it works, who's behind it, estimated losses, warning signs, etc."
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
