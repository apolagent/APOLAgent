import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/hooks/use-wallet";
import Home from "@/pages/home";
import NominateHero from "@/pages/nominate-hero";
import Rankings from "@/pages/rankings";
import ReportScam from "@/pages/report-scam";
import AgentScanner from "@/pages/agent-scanner";
import GetVerified from "@/pages/get-verified";
import AdminDashboard from "@/pages/admin-dashboard";
import VerifyCertificate from "@/pages/verify-certificate";
import VerifiedBuilders from "@/pages/verified-builders";
import Whitepaper from "@/pages/whitepaper";
import Docs from "@/pages/docs";
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
      <Route path="/get-verified" component={GetVerified} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/verify/:contractAddress" component={VerifyCertificate} />
      <Route path="/verified-builders" component={VerifiedBuilders} />
      <Route path="/whitepaper" component={Whitepaper} />
      <Route path="/docs" component={Docs} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
          <ApolAgent />
        </TooltipProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
