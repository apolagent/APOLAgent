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
import { Star, Award, ArrowLeft, ThumbsUp, Clock, ExternalLink, Zap, X, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { BrowserProvider, parseEther } from "ethers";
import { insertHeroNominationSchema, type InsertHeroNomination, type HeroNomination } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import { PAYMENT, ensureCorrectNetwork } from "@/lib/chain-config";

const G = "#00ff00";
const PLATFORM_FEE_PCT = 0.2;
const BUILDER_PCT = 0.8;

const categories = [
  "Scam Buster", "Community Leader", "Education & Awareness",
  "Developer / Builder", "Investigator", "Whistleblower", "Content Creator", "Other",
];

type TipState =
  | { phase: "idle" }
  | { phase: "pending_builder"; builderTxHash?: string }
  | { phase: "pending_platform"; builderTxHash: string }
  | { phase: "success"; builderTxHash: string; platformTxHash: string }
  | { phase: "error"; message: string };

function TipModal({
  nomination,
  onClose,
}: {
  nomination: HeroNomination;
  onClose: () => void;
}) {
  const [tipAmount, setTipAmount] = useState("");
  const [builderWallet, setBuilderWallet] = useState(nomination.walletAddress || "");
  const [tipState, setTipState] = useState<TipState>({ phase: "idle" });

  const parsed = parseFloat(tipAmount);
  const isValid = !isNaN(parsed) && parsed > 0 && builderWallet.startsWith("0x") && builderWallet.length === 42;
  const builderAmount = isValid ? (parsed * BUILDER_PCT).toFixed(6) : "–";
  const platformAmount = isValid ? (parsed * PLATFORM_FEE_PCT).toFixed(6) : "–";

  const handleTip = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setTipState({ phase: "error", message: "MetaMask not detected. Please install MetaMask to send tips." });
      return;
    }
    if (!isValid) return;

    setTipState({ phase: "pending_builder" });
    try {
      await ensureCorrectNetwork(eth);
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();

      // TX 1: 80% to builder
      const builderTx = await signer.sendTransaction({
        to: builderWallet,
        value: parseEther((parsed * BUILDER_PCT).toFixed(18)),
      });
      setTipState({ phase: "pending_builder", builderTxHash: builderTx.hash });
      const builderReceipt = await builderTx.wait(1);
      if (!builderReceipt || builderReceipt.status !== 1) {
        setTipState({ phase: "error", message: "Builder tip transaction failed on-chain." });
        return;
      }

      // TX 2: 20% to platform
      setTipState({ phase: "pending_platform", builderTxHash: builderTx.hash });
      const platformTx = await signer.sendTransaction({
        to: PAYMENT.platformWallet,
        value: parseEther((parsed * PLATFORM_FEE_PCT).toFixed(18)),
      });
      const platformReceipt = await platformTx.wait(1);
      if (!platformReceipt || platformReceipt.status !== 1) {
        setTipState({ phase: "error", message: "Platform fee transaction failed on-chain." });
        return;
      }

      setTipState({ phase: "success", builderTxHash: builderTx.hash, platformTxHash: platformTx.hash });
    } catch (e: any) {
      if (e.code === 4001 || e.code === "ACTION_REJECTED" || e.message?.includes("rejected")) {
        setTipState({ phase: "error", message: "Transaction rejected by user." });
      } else {
        setTipState({ phase: "error", message: e.message || "Transaction failed. Please try again." });
      }
    }
  };

  const isPending = tipState.phase === "pending_builder" || tipState.phase === "pending_platform";

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isPending) onClose(); }}
      data-testid="modal-tip-builder"
    >
      <div style={{
        background: "#000",
        border: `1px solid ${G}`,
        width: "100%",
        maxWidth: "440px",
        fontFamily: "'JetBrains Mono', monospace",
        boxShadow: "0 0 60px rgba(0,255,0,0.12)",
      }}>
        {/* Modal header */}
        <div style={{
          background: "rgba(0,255,0,0.06)",
          borderBottom: "1px solid rgba(0,255,0,0.2)",
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Zap size={14} color={G} />
            <span style={{ color: G, fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Tip this Builder
            </span>
          </div>
          {!isPending && (
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: "2px" }} data-testid="button-close-tip-modal">
              <X size={16} />
            </button>
          )}
        </div>

        <div style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Builder name */}
          <div>
            <span style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
              Recipient
            </span>
            <span style={{ color: "#fff", fontSize: "14px", fontWeight: 700 }}>{nomination.name}</span>
          </div>

          {/* Builder wallet input */}
          {!nomination.walletAddress && (
            <div>
              <label style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                Builder Wallet Address
              </label>
              <input
                value={builderWallet}
                onChange={e => setBuilderWallet(e.target.value)}
                placeholder="0x..."
                disabled={isPending || tipState.phase === "success"}
                data-testid="input-builder-wallet"
                style={{
                  width: "100%", background: "transparent", border: "1px solid rgba(0,255,0,0.25)",
                  padding: "8px 10px", color: "#fff", fontSize: "12px", outline: "none",
                  caretColor: G, boxSizing: "border-box", fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          )}

          {/* Amount input */}
          {tipState.phase !== "success" && (
            <div>
              <label style={{ fontSize: "9px", color: "rgba(0,255,0,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                Tip Amount (ETH)
              </label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={tipAmount}
                onChange={e => setTipAmount(e.target.value)}
                placeholder="0.01"
                disabled={isPending}
                data-testid="input-tip-amount"
                style={{
                  width: "100%", background: "transparent", border: "1px solid rgba(0,255,0,0.25)",
                  padding: "8px 10px", color: "#fff", fontSize: "14px", outline: "none",
                  caretColor: G, boxSizing: "border-box", fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          )}

          {/* Split breakdown */}
          {tipState.phase !== "success" && (
            <div style={{ border: "1px solid rgba(0,255,0,0.12)", background: "rgba(0,255,0,0.03)", padding: "12px" }}>
              <div style={{ fontSize: "9px", color: "rgba(0,255,0,0.82)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
                Split Breakdown
              </div>
              {[
                { label: `Builder (${BUILDER_PCT * 100}%)`, value: `${builderAmount} ETH`, color: G },
                { label: `Platform Fee (${PLATFORM_FEE_PCT * 100}%)`, value: `${platformAmount} ETH`, color: "rgba(255,255,255,0.5)" },
              ].map((row, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "5px 0",
                  borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)" }}>{row.label}</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: row.color }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Status messages */}
          {tipState.phase === "pending_builder" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "rgba(0,255,0,0.7)", padding: "8px 10px", border: "1px solid rgba(0,255,0,0.2)" }} data-testid="div-tip-pending-builder">
              <Loader2 size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <span>TX 1/2: Sending builder tip{tipState.builderTxHash ? "..." : " [confirm in MetaMask]"}</span>
            </div>
          )}

          {tipState.phase === "pending_platform" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }} data-testid="div-tip-pending-platform">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: G, padding: "6px 10px", border: `1px solid rgba(0,255,0,0.3)` }}>
                <CheckCircle size={12} style={{ flexShrink: 0 }} />
                TX 1/2: Builder tip confirmed
                <a href={`https://basescan.org/tx/${tipState.builderTxHash}`} target="_blank" rel="noopener noreferrer" style={{ color: G, marginLeft: "auto" }}>
                  <ExternalLink size={11} />
                </a>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "rgba(0,255,0,0.7)", padding: "6px 10px", border: "1px solid rgba(0,255,0,0.2)" }}>
                <Loader2 size={12} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                TX 2/2: Confirm platform fee in MetaMask
              </div>
            </div>
          )}

          {tipState.phase === "success" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }} data-testid="div-tip-success">
              <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
                <CheckCircle size={28} color={G} style={{ margin: "0 auto 8px" }} />
                <p style={{ color: G, fontSize: "13px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Tip Sent Successfully
                </p>
              </div>
              {[
                { label: "Builder Tip (80%)", hash: tipState.builderTxHash },
                { label: "Platform Fee (20%)", hash: tipState.platformTxHash },
              ].map((tx, i) => (
                <a key={i} href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                  data-testid={`link-tx-${i + 1}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 10px", border: "1px solid rgba(0,255,0,0.25)",
                    color: G, fontSize: "11px", textDecoration: "none",
                    background: "rgba(0,255,0,0.04)",
                  }}>
                  <span>{tx.label}: View on BaseScan</span>
                  <ExternalLink size={11} />
                </a>
              ))}
            </div>
          )}

          {tipState.phase === "error" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "#f87171", padding: "8px 10px", border: "1px solid rgba(248,113,113,0.3)" }} data-testid="text-tip-error">
              <AlertTriangle size={12} style={{ flexShrink: 0 }} />
              {tipState.message}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            {tipState.phase !== "success" ? (
              <>
                <button
                  onClick={onClose}
                  disabled={isPending}
                  style={{
                    flex: 1, padding: "10px", fontSize: "11px", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
                    color: "rgba(255,255,255,0.5)", cursor: isPending ? "not-allowed" : "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  data-testid="button-cancel-tip"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTip}
                  disabled={!isValid || isPending}
                  style={{
                    flex: 2, padding: "10px", fontSize: "11px", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    background: isValid && !isPending ? G : "rgba(0,255,0,0.15)",
                    border: `1px solid ${G}`,
                    color: isValid && !isPending ? "#000" : "rgba(0,255,0,0.4)",
                    cursor: isValid && !isPending ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: "background 0.15s ease, color 0.15s ease",
                  }}
                  data-testid="button-send-tip"
                >
                  {isPending
                    ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />Sending…</>
                    : <><Zap size={13} />Send Tip</>
                  }
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: "10px", fontSize: "11px", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  background: "transparent", border: `1px solid ${G}`,
                  color: G, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
                }}
                data-testid="button-close-after-tip"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NominateHero() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tipTarget, setTipTarget] = useState<HeroNomination | null>(null);

  const form = useForm<InsertHeroNomination>({
    resolver: zodResolver(insertHeroNominationSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      evidenceUrl: "",
      walletAddress: "",
      nominatedBy: 1,
    },
  });

  const { data: nominations = [], isLoading } = useQuery<HeroNomination[]>({
    queryKey: ["/api/hero-nominations"],
  });

  const createNominationMutation = useMutation({
    mutationFn: async (data: InsertHeroNomination) => {
      const res = await apiRequest("POST", "/api/hero-nominations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hero-nominations"] });
      toast({ title: "Nomination Filed", description: "Pending community vote." });
      form.reset();
    },
    onError: () => {
      toast({ title: "Submission Failed", description: "Retry or check your connection.", variant: "destructive" });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ targetId, voteType }: { targetId: number; voteType: string }) => {
      const res = await apiRequest("POST", "/api/votes", { userId: 1, targetId, targetType: "hero_nomination", voteType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hero-nominations"] });
    },
  });

  const onSubmit = (data: InsertHeroNomination) => {
    createNominationMutation.mutate(data);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      "Scam Buster": "bg-red-500/20 text-red-400 border-red-500/30",
      "Community Leader": "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "Education & Awareness": "bg-green-500/20 text-green-400 border-green-500/30",
      "Developer / Builder": "bg-purple-500/20 text-purple-400 border-purple-500/30",
      "Investigator": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      "Whistleblower": "bg-orange-500/20 text-orange-400 border-orange-500/30",
      "Content Creator": "bg-pink-500/20 text-pink-400 border-pink-500/30",
    };
    return colors[category] || "bg-gray-500/20 text-gray-400 border-gray-500/30";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Navigation />

      {tipTarget && <TipModal nomination={tipTarget} onClose={() => setTipTarget(null)} />}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 pt-28">
        <div className="text-center mb-12">
          <h1 className="font-meme text-4xl md:text-6xl gradient-text mb-4 flex items-center justify-center gap-3" data-testid="text-page-title">
            <Award className="w-12 h-12 md:w-16 md:h-16 text-yellow-400" />
            Nominate a Hero
          </h1>
          <p className="text-xl text-gray-400 mb-8" data-testid="text-page-description">
            Commend officers making crypto safer.
          </p>
          <Link href="/">
            <Button variant="outline" className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-slate-900" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Nomination form */}
          <Card className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/30 border-yellow-600/50">
            <CardHeader>
              <CardTitle className="text-2xl font-meme text-yellow-400 flex items-center gap-2">
                <Star className="w-6 h-6" />
                Submit Nomination
              </CardTitle>
              <CardDescription className="text-gray-300">
                Name the candidate. Community votes decide ranking.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-nominate-hero">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Hero Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Name or handle"
                          className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400"
                          data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-slate-800 border-slate-600 text-white" data-testid="select-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-white hover:bg-slate-700">{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Why are they a hero? *</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Describe their contributions, impact, and why they deserve recognition..."
                          className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400 min-h-[120px]"
                          data-testid="input-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="walletAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Builder Wallet Address <span className="text-gray-500 text-xs font-normal">· Enables tips</span></FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="0x… (Base, ETH)"
                          className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400 font-mono text-sm"
                          data-testid="input-wallet-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="evidenceUrl" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Evidence URL <span className="text-gray-500 text-xs font-normal">· Optional</span></FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="https://... (Social media, articles, proof of contribution)"
                          className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400"
                          data-testid="input-evidence-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button type="submit" disabled={createNominationMutation.isPending}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-3"
                    data-testid="button-submit-nomination">
                    {createNominationMutation.isPending ? "Submitting..." : "Submit Nomination"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Nominations list */}
          <div className="space-y-4">
            <h3 className="font-meme text-2xl text-white flex items-center gap-2" data-testid="text-recent-nominations">
              <Star className="w-6 h-6 text-yellow-400" />
              Recent Nominations
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
            ) : nominations.length === 0 ? (
              <div className="p-12 rounded-xl bg-slate-800 border border-slate-700 text-center">
                <Star className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No nominations yet</p>
                <p className="text-gray-500 text-sm mt-2">Be the first to nominate a crypto hero!</p>
              </div>
            ) : (
              nominations.map((nomination) => (
                <div key={nomination.id} className="p-6 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors"
                  data-testid={`card-nomination-${nomination.id}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-yellow-400" />
                      <h4 className="font-bold text-white text-lg">{nomination.name}</h4>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getCategoryColor(nomination.category)}`}>
                      {nomination.category}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm mb-4 line-clamp-3">{nomination.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button onClick={() => voteMutation.mutate({ targetId: nomination.id, voteType: "upvote" })}
                        className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors"
                        data-testid={`button-upvote-${nomination.id}`}>
                        <ThumbsUp className="w-4 h-4" />
                        <span className="text-sm font-medium">{nomination.votes}</span>
                      </button>
                      {nomination.evidenceUrl && (
                        <a href={nomination.evidenceUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm">
                          <ExternalLink className="w-3 h-3" />
                          Evidence
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 text-xs">
                      <Clock className="w-3 h-3" />
                      {new Date(nomination.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Tip button */}
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <button
                      onClick={() => setTipTarget(nomination)}
                      data-testid={`button-tip-${nomination.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "7px 14px",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontFamily: "'JetBrains Mono', monospace",
                        background: "transparent",
                        border: `1px solid ${G}`,
                        color: G,
                        cursor: "pointer",
                        borderRadius: "0",
                      }}
                    >
                      <Zap size={12} />
                      Tip this Builder
                    </button>
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
