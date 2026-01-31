import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import "vis-timeline/styles/vis-timeline-graph2d.css";
import "./styles/timeline.css";
import "./styles/map.css";
import "./styles/lineage.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Home from "./pages/Home";
import Translate from "./pages/Translate";
import Dashboard from "./pages/Dashboard";
import ExtractionDashboard from "./pages/ExtractionDashboard";
import EntityReviewDashboard from "./pages/EntityReviewDashboard";
import TimelinePage from "./pages/TimelinePage";
import { MapPage } from "./pages/MapPage";
import NetworkPage from "./pages/NetworkPage";
import LineagePage from "./pages/LineagePage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/translate" component={Translate} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/extraction" component={ExtractionDashboard} />
      <Route path="/entity-review" component={EntityReviewDashboard} />
      <Route path="/timeline" component={TimelinePage} />
      <Route path="/map" component={MapPage} />
      <Route path="/network" component={NetworkPage} />
      <Route path="/network/:entityId" component={NetworkPage} />
      <Route path="/lineage/:personId" component={LineagePage} />
      <Route>404 Page Not Found</Route>
    </Switch>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
