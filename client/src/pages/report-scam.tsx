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
import { Shield, AlertTriangle, ArrowLeft, ThumbsUp, Clock, ExternalLink, Upload, ImageIcon, X } from "lucide-react";
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


export default function ReportScam() {
  const { toast } = useToast();
  const queryClient = useQueryClient();




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
