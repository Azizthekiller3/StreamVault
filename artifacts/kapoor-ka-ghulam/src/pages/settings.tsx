import { Trash2, ChevronRight, Info as InfoIcon, AlertTriangle, PlusCircle, Loader2 } from "lucide-react";
import {
  useClearHistory,
  useGetStats,
  getGetStatsQueryKey,
  getGetHistoryQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-base";

const ADMIN_KEY = "streamvault_admin_key";

function getStoredAdminKey() {
  try { return localStorage.getItem(ADMIN_KEY) ?? ""; } catch { return ""; }
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [movieText, setMovieText] = useState("");
  const [adminKey, setAdminKey] = useState(getStoredAdminKey);
  const [isAdding, setIsAdding] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const handleAddMovie = async () => {
    if (!movieText.trim()) return;
    if (!adminKey.trim()) {
      toast({ title: "Enter your admin key first", variant: "destructive" });
      return;
    }
    setIsAdding(true);
    try {
      localStorage.setItem(ADMIN_KEY, adminKey);
      const res = await fetch(`${API_BASE}/api/telegram/parse-and-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-backfill-secret": adminKey },
        body: JSON.stringify({ text: movieText }),
      });
      const data = await res.json() as { ok?: boolean; movie?: { title: string }; error?: string };
      if (!res.ok || !data.ok) {
        toast({ title: data.error ?? "Failed to add movie", variant: "destructive" });
      } else {
        toast({ title: `✅ Added: ${data.movie?.title}` });
        setMovieText("");
        queryClient.invalidateQueries({ queryKey: ["telegram-movies"] });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const clearHistory = useClearHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      },
    },
  });

  const { data: stats } = useGetStats();

  const handleClearData = async () => {
    await clearHistory.mutateAsync();
    toast({ title: "History cleared" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 bg-black/80 backdrop-blur-md border-b border-white/5">
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Watched", value: stats?.historyCount ?? 0 },
            { label: "Saved", value: stats?.watchlistCount ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* About */}
        <div className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">About</p>
          </div>
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <InfoIcon className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm font-medium text-white">Version</p>
            </div>
            <p className="text-sm text-white/40 font-mono">v1.0.0</p>
          </div>
        </div>

        {/* Add Movie (Admin) */}
        <div className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <button
            onClick={() => setAddPanelOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors"
          >
            <PlusCircle className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">Add Movie</p>
              <p className="text-xs text-white/40 mt-0.5">Paste a Telegram message to add a movie</p>
            </div>
            <ChevronRight className={cn("w-4 h-4 text-white/30 shrink-0 transition-transform", addPanelOpen && "rotate-90")} />
          </button>
          {addPanelOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5">
              <div className="mt-3">
                <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Admin Key (SESSION_SECRET)</label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Paste your SESSION_SECRET here"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/60"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Telegram Message Text</label>
                <textarea
                  value={movieText}
                  onChange={(e) => setMovieText(e.target.value)}
                  placeholder={"Movie :- Peddi (2026)\n720p:- https://1024terabox.com/s/...\n1080p:- https://1024terabox.com/s/..."}
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/60 resize-none font-mono text-xs"
                />
              </div>
              <button
                onClick={handleAddMovie}
                disabled={isAdding || !movieText.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary/90 hover:bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                {isAdding ? "Adding…" : "Add Movie"}
              </button>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="bg-red-950/20 border border-red-900/20 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-red-900/20">
            <p className="text-xs font-semibold text-red-400/60 uppercase tracking-wider">Danger</p>
          </div>
          <div className="px-4 py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Clear Watch History</p>
              <p className="text-xs text-white/40 mt-0.5">Removes all viewing records</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 text-red-400 rounded-lg text-xs font-medium hover:bg-red-900/60 transition-colors"
                  data-testid="button-clear-history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#1c1c1c] border-white/10 mx-4">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Clear watch history?</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/50">
                    This removes all history records. Watchlist remains intact.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/10 border-white/10 text-white hover:bg-white/20">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData} className="bg-red-700 hover:bg-red-600 text-white">
                    Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
