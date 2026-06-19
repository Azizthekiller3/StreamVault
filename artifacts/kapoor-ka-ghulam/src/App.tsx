import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Search from "@/pages/search";
import Info from "@/pages/info";
import Watchlist from "@/pages/watchlist";
import History from "@/pages/history";
import Marketplace from "@/pages/marketplace";
import Settings from "@/pages/settings";
import Watch from "@/pages/watch";
import Browse from "@/pages/browse";
import TelegramInfo from "@/pages/telegram-info";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
          <Switch>
            <Route path="/watch" component={Watch} />
            <Route>
              <Layout>
                <Switch>
                  <Route path="/" component={Home} />
                  <Route path="/search" component={Search} />
                  <Route path="/info" component={Info} />
                  <Route path="/telegram-info" component={TelegramInfo} />
                  <Route path="/browse" component={Browse} />
                  <Route path="/watchlist" component={Watchlist} />
                  <Route path="/history" component={History} />
                  <Route path="/marketplace" component={Marketplace} />
                  <Route path="/settings" component={Settings} />
                  <Route component={NotFound} />
                </Switch>
              </Layout>
            </Route>
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
