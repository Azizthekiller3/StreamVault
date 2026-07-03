import { ChevronRight, Info as InfoIcon, PlusCircle, Loader2, RefreshCw } from "lucide-react";
import { useGetStats, getGetStatsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-base";

const ADMIN_KEY = "streamvault_admin_key";

function getStoredAdminKey() {
  try { return localStorage.getItem(ADMIN_KEY) ?? ""; } catch { return ""; }
}

interface BackfillResult {
  enriched: number;
  unchanged: number;
  failed: number;
  total: number;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [movieText, setMovieText] = useState("");
  const [adminKey, setAdminKey] = useState(getStoredAdminKey);
  const [isAdding, setIsAdding] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [backfillPanelOpen, setBackfillPanelOpen] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null);

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

  const handleBackfill = async () => {
    if (!adminKey.trim()) {
      toast({ title: "Enter your admin key first", variant: "destructive" });
      return;
    }
    setIsBackfilling(true);
    setBackfillResult(null);
    try {
      localStorage.setItem(ADMIN_KEY, adminKey);
      const res = await fetch(`${API_BASE}/api/admin/backfill`, {
        method: "POST",
        headers: { "x-backfill-secret": adminKey },
      });
      const data = await res.json() as BackfillResult & { error?: string };
      if (!res.ok) {
        toast({ title: data.error ?? "Backfill failed", variant: "destructive" });
      } else {
        setBackfillResult(data);
        toast({ title: `✅ Done — ${data.enriched} updated, ${data.unchanged} unchanged` });
        queryClient.invalidateQueries({ queryKey: ["telegram-movies"] });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsBackfilling(false);
    }
  };

  const { data: stats } = useGetStats();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 bg-black/80 backdrop-blur-md border-b border-white/5">
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
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

        {/* Re-enrich TMDB Data (Admin) */}
        <div className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <button
            onClick={() => setBackfillPanelOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">Fix Movie Info</p>
              <p className="text-xs text-white/40 mt-0.5">Re-fetch correct TMDB posters &amp; data for all movies</p>
            </div>
            <ChevronRight className={cn("w-4 h-4 text-white/30 shrink-0 transition-transform", backfillPanelOpen && "rotate-90")} />
          </button>
          {backfillPanelOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5">
              <p className="text-xs text-white/40 mt-3 leading-relaxed">
                Clears cached TMDB data and re-matches every movie using the improved year + series detection.
                Use this after a mis-identified movie is found (e.g. wrong poster / wrong plot).
                This may take a minute or two depending on how many movies are stored.
              </p>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Admin Key (SESSION_SECRET)</label>
                <input
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Paste your SESSION_SECRET here"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/60"
                />
              </div>
              {backfillResult && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Total", value: backfillResult.total, color: "text-white" },
                    { label: "Updated", value: backfillResult.enriched, color: "text-green-400" },
                    { label: "Same", value: backfillResult.unchanged, color: "text-white/50" },
                    { label: "Failed", value: backfillResult.failed, color: "text-red-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/5 rounded-lg p-2">
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                      <p className="text-[9px] text-white/30 uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleBackfill}
                disabled={isBackfilling}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary/90 hover:bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {isBackfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isBackfilling ? "Re-enriching… (please wait)" : "Re-enrich All Movies"}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
