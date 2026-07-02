import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Search from "@/pages/search";
import Info from "@/pages/info";
import History from "@/pages/history";
import Marketplace from "@/pages/marketplace";
import Settings from "@/pages/settings";
import Watch from "@/pages/watch";
import Browse from "@/pages/browse";
import TelegramInfo from "@/pages/telegram-info";
import DownloadHistory from "@/pages/download-history";
import AdminPage from "@/pages/admin";
import React from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// ── Error Boundary ──────────────────────────────────────────────────────────
interface EBState { hasError: boolean; message: string }
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: unknown): EBState {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#111",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 16,
          }}
        >
          <span style={{ fontSize: 40 }}>🎬</span>
          <p style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: 16 }}>
            Something went wrong
          </p>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", maxWidth: 300 }}>
            {this.state.message || "An unexpected error occurred loading this page."}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, message: "" }); window.history.back(); }}
            style={{
              marginTop: 8,
              padding: "10px 24px",
              borderRadius: 10,
              background: "#dc2626",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
            }}
          >
            ← Go Back
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 20px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
              fontWeight: 600,
              fontSize: 13,
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <ErrorBoundary>
            <Switch>
              <Route path="/admin" component={AdminPage} />
              <Route path="/watch" component={Watch} />
              <Route>
                <Layout>
                  <ErrorBoundary>
                    <Switch>
                      <Route path="/" component={Home} />
                      <Route path="/search" component={Search} />
                      <Route path="/info" component={Info} />
                      <Route path="/telegram-info" component={TelegramInfo} />
                      <Route path="/downloads" component={DownloadHistory} />
                      <Route path="/browse" component={Browse} />
                      <Route path="/history" component={History} />
                      <Route path="/marketplace" component={Marketplace} />
                      <Route path="/settings" component={Settings} />
                      <Route component={NotFound} />
                    </Switch>
                  </ErrorBoundary>
                </Layout>
              </Route>
            </Switch>
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
