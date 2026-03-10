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
import { Star, Award, ArrowLeft, ThumbsUp, Clock, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { insertHeroNominationSchema, type InsertHeroNomination, type HeroNomination } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";

const categories = [
  "Scam Buster",
  "Community Leader",
  "Education & Awareness",
  "Developer / Builder",
  "Investigator",
  "Whistleblower",
  "Content Creator",
  "Other",
];

export default function NominateHero() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertHeroNomination>({
    resolver: zodResolver(insertHeroNominationSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      evidenceUrl: "",
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
      toast({
        title: "Nomination Submitted",
        description: "Your hero nomination has been submitted for community review.",
      });
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit nomination. Please try again.",
        variant: "destructive",
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ targetId, voteType }: { targetId: number; voteType: string }) => {
      const res = await apiRequest("POST", "/api/votes", {
        userId: 1,
        targetId,
        targetType: "hero_nomination",
        voteType,
      });
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 pt-28">
        <div className="text-center mb-12">
          <h1 className="font-meme text-4xl md:text-6xl gradient-text mb-4 flex items-center justify-center gap-3" data-testid="text-page-title">
            <Award className="w-12 h-12 md:w-16 md:h-16 text-yellow-400" />
            Nominate a Hero
          </h1>
          <p className="text-xl text-gray-400 mb-8" data-testid="text-page-description">
            Recognize community members who go above and beyond to protect the jungle
          </p>
          <Link href="/">
            <Button variant="outline" className="text-blue-400 border-blue-400 hover:bg-blue-400 hover:text-slate-900" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <Card className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/30 border-yellow-600/50">
            <CardHeader>
              <CardTitle className="text-2xl font-meme text-yellow-400 flex items-center gap-2">
                <Star className="w-6 h-6" />
                Submit Nomination
              </CardTitle>
              <CardDescription className="text-gray-300">
                Nominate someone who has made a positive impact in the crypto community
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-nominate-hero">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Hero Name *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Name or handle of the person you're nominating"
                            className="bg-slate-800 border-slate-600 text-white placeholder:text-gray-400"
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
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
                              <SelectItem key={cat} value={cat} className="text-white hover:bg-slate-700">
                                {cat}
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
                        <FormLabel className="text-white">Why are they a hero? *</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder="Describe their contributions, impact, and why they deserve recognition..."
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
                            placeholder="https://... (Social media, articles, proof of contribution)"
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
                    disabled={createNominationMutation.isPending}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-bold py-3"
                    data-testid="button-submit-nomination"
                  >
                    {createNominationMutation.isPending ? "Submitting..." : "Submit Nomination"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

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
                <div
                  key={nomination.id}
                  className="p-6 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 transition-colors"
                  data-testid={`card-nomination-${nomination.id}`}
                >
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
                      <button
                        onClick={() => voteMutation.mutate({ targetId: nomination.id, voteType: "upvote" })}
                        className="flex items-center gap-1 text-green-400 hover:text-green-300 transition-colors"
                        data-testid={`button-upvote-${nomination.id}`}
                      >
                        <ThumbsUp className="w-4 h-4" />
                        <span className="text-sm font-medium">{nomination.votes}</span>
                      </button>
                      {nomination.evidenceUrl && (
                        <a
                          href={nomination.evidenceUrl}
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
                      {new Date(nomination.createdAt).toLocaleDateString()}
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
