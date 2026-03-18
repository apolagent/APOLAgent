import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import NominateHero from "@/pages/nominate-hero";
import Rankings from "@/pages/rankings";
import ReportScam from "@/pages/report-scam";
import AgentScanner from "@/pages/agent-scanner";
import NotFound from "@/pages/not-found";
import ApolAgent from "@/components/apol-agent";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/nominate-hero" component={NominateHero} />
      <Route path="/rankings" component={Rankings} />
      <Route path="/report-scam" component={ReportScam} />
      <Route path="/agent-scanner" component={AgentScanner} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <ApolAgent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
