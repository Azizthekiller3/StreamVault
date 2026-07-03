import { ChevronRight, Info as InfoIcon, PlusCircle, Loader2, RefreshCw, Trash2, RefreshCcw } from "lucide-react";
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

  // Sync Deletions state
  const [syncPanelOpen, setSyncPanelOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ removed: number; liveScraped: number; range: string } | null>(null);

  // Delete Movie state
  const [deletePanelOpen, setDeletePanelOpen] = useState(false);
  const [deleteTitle, setDeleteTitle] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ removed: number; titles: string[] } | null>(null);

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

  const handleSyncDeletions = async () => {
    if (!adminKey.trim()) {
      toast({ title: "Enter your admin key first", variant: "destructive" });
      return;
    }
    setIsSyncing(true);
    setSyncResult(null);
    try {
      localStorage.setItem(ADMIN_KEY, adminKey);
      const res = await fetch(`${API_BASE}/api/telegram/sync-deletions?pages=20`, {
        method: "POST",
        headers: { "x-backfill-secret": adminKey },
      });
      const data = await res.json() as { ok?: boolean; removed?: number; liveScraped?: number; range?: string; error?: string };
      if (!res.ok || !data.ok) {
        toast({ title: data.error ?? "Sync failed", variant: "destructive" });
      } else {
        setSyncResult({ removed: data.removed ?? 0, liveScraped: data.liveScraped ?? 0, range: data.range ?? "" });
        toast({ title: `✅ Synced — ${data.removed ?? 0} deleted movie(s) removed` });
        queryClient.invalidateQueries({ queryKey: ["telegram-movies"] });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteMovie = async () => {
    if (!deleteTitle.trim()) return;
    if (!adminKey.trim()) {
      toast({ title: "Enter your admin key first", variant: "destructive" });
      return;
    }
    setIsDeleting(true);
    setDeleteResult(null);
    try {
      localStorage.setItem(ADMIN_KEY, adminKey);
      const res = await fetch(`${API_BASE}/api/telegram/movie-by-title?title=${encodeURIComponent(deleteTitle.trim())}`, {
        method: "DELETE",
        headers: { "x-backfill-secret": adminKey },
      });
      const data = await res.json() as { ok?: boolean; removed?: number; titles?: string[]; error?: string };
      if (!res.ok || !data.ok) {
        toast({ title: data.error ?? "Delete failed", variant: "destructive" });
      } else if ((data.removed ?? 0) === 0) {
        toast({ title: "No movies matched that title", variant: "destructive" });
      } else {
        setDeleteResult({ removed: data.removed ?? 0, titles: data.titles ?? [] });
        toast({ title: `🗑️ Deleted ${data.removed} movie(s)` });
        setDeleteTitle("");
        queryClient.invalidateQueries({ queryKey: ["telegram-movies"] });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

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

        {/* Sync Deletions (Admin) */}
        <div className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <button
            onClick={() => setSyncPanelOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors"
          >
            <RefreshCcw className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">Sync Deletions</p>
              <p className="text-xs text-white/40 mt-0.5">Remove movies you deleted from your Telegram channel</p>
            </div>
            <ChevronRight className={cn("w-4 h-4 text-white/30 shrink-0 transition-transform", syncPanelOpen && "rotate-90")} />
          </button>
          {syncPanelOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5">
              <p className="text-xs text-white/40 mt-3 leading-relaxed">
                Scrapes your Telegram channel and removes any movies that no longer exist there.
                Use this after deleting posts from your channel — Telegram doesn't notify the app about deletions automatically.
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
              {syncResult && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Removed", value: syncResult.removed, color: "text-red-400" },
                    { label: "Live Posts", value: syncResult.liveScraped, color: "text-green-400" },
                    { label: "ID Range", value: syncResult.range, color: "text-white/50" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/5 rounded-lg p-2">
                      <p className={`text-lg font-bold truncate ${color}`}>{value}</p>
                      <p className="text-[9px] text-white/30 uppercase tracking-wide">{label}</p>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleSyncDeletions}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary/90 hover:bg-primary text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                {isSyncing ? "Syncing… (please wait)" : "Sync Deletions Now"}
              </button>
            </div>
          )}
        </div>

        {/* Delete Movie (Admin) */}
        <div className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <button
            onClick={() => setDeletePanelOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors"
          >
            <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">Delete Movie</p>
              <p className="text-xs text-white/40 mt-0.5">Manually remove a specific movie by title</p>
            </div>
            <ChevronRight className={cn("w-4 h-4 text-white/30 shrink-0 transition-transform", deletePanelOpen && "rotate-90")} />
          </button>
          {deletePanelOpen && (
            <div className="px-4 pb-4 space-y-3 border-t border-white/5">
              <p className="text-xs text-white/40 mt-3 leading-relaxed">
                Type part of the movie title to find and delete it. This permanently removes it from the app and database.
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
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wide mb-1.5 block">Movie Title (partial match)</label>
                <input
                  type="text"
                  value={deleteTitle}
                  onChange={(e) => setDeleteTitle(e.target.value)}
                  placeholder="e.g. sheep detectives"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-primary/60"
                />
              </div>
              {deleteResult && (
                <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 space-y-1">
                  <p className="text-xs text-red-400 font-semibold">Deleted {deleteResult.removed} movie(s):</p>
                  {deleteResult.titles.map((t, i) => (
                    <p key={i} className="text-xs text-white/60 truncate">• {t}</p>
                  ))}
                </div>
              )}
              <button
                onClick={handleDeleteMovie}
                disabled={isDeleting || !deleteTitle.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isDeleting ? "Deleting…" : "Delete Movie"}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
