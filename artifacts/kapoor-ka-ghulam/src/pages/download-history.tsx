import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Download, Trash2, Play, ArrowLeft, X, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getDownloadHistory,
  addDownloadHistory,
  removeDownloadItem,
  clearDownloadHistory,
  type DownloadHistoryItem,
} from "@/lib/flixnest-store";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function qualityColor(q: string): string {
  if (q === "1080p") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  if (q === "720p") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (q === "4K") return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  return "bg-green-500/20 text-green-300 border-green-500/30";
}

function groupByDate(items: DownloadHistoryItem[]): { label: string; items: DownloadHistoryItem[] }[] {
  const groups: Record<string, DownloadHistoryItem[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;

  for (const item of items) {
    const d = new Date(item.downloadedAt);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    let label: string;
    if (dayStart === today) label = "Today";
    else if (dayStart === yesterday) label = "Yesterday";
    else label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }));
}

export default function DownloadHistory() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState<DownloadHistoryItem[]>(() => getDownloadHistory());
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const refresh = useCallback(() => setItems(getDownloadHistory()), []);

  const handleRemove = (id: string) => {
    removeDownloadItem(id);
    refresh();
  };

  const handleClearAll = () => {
    clearDownloadHistory();
    refresh();
    setShowClearConfirm(false);
  };

  const handleRedownload = (item: DownloadHistoryItem) => {
    addDownloadHistory({
      movieId: item.movieId,
      title: item.title,
      poster: item.poster,
      quality: item.quality,
      url: item.url,
    });
    refresh();
  };

  const groups = groupByDate(items);

  return (
    <div className="bg-black min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-bold text-base">Download History</h1>
            <p className="text-white/40 text-xs">
              {items.length} {items.length === 1 ? "file" : "files"} downloaded
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Clear confirm bottom sheet */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-white font-bold text-base text-center mb-1">Clear All Downloads?</h3>
              <p className="text-white/50 text-sm text-center mb-5">
                This removes your history only. Your actual files are not deleted.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-5">
            <Download className="w-9 h-9 text-white/20" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">No downloads yet</h2>
          <p className="text-white/40 text-sm mb-6">
            Every time you tap Stream or Download on a movie, it appears here with a quick re-open button.
          </p>
          <button
            onClick={() => setLocation("/")}
            className="px-5 py-2.5 bg-primary rounded-xl text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Browse Movies
          </button>
        </div>
      )}

      {/* Download list grouped by date */}
      <div className="px-4 pt-4 space-y-6">
        {groups.map(({ label, items: groupItems }) => (
          <div key={label}>
            <p className="text-white/30 text-[11px] uppercase tracking-widest font-semibold mb-3 px-1">
              {label}
            </p>
            <div className="space-y-2">
              <AnimatePresence>
                {groupItems.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 bg-[#111] border border-white/5 rounded-2xl p-3"
                  >
                    {/* Poster */}
                    <div
                      className="flex-none w-12 aspect-[2/3] rounded-lg overflow-hidden bg-white/5 cursor-pointer shrink-0"
                      onClick={() => setLocation(`/telegram-info?id=${item.movieId}`)}
                    >
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-black">
                          <Download className="w-4 h-4 text-white/30" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setLocation(`/telegram-info?id=${item.movieId}`)}
                    >
                      <p className="text-white text-sm font-semibold line-clamp-1 leading-snug">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${qualityColor(item.quality)}`}>
                          {item.quality}
                        </span>
                        <span className="text-white/30 text-[10px]">{timeAgo(item.downloadedAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleRedownload(item)}
                        className="p-2 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 transition-colors"
                        title="Stream again"
                      >
                        <Play className="w-3.5 h-3.5 fill-primary" />
                      </a>
                      <a
                        href={item.url}
                        download
                        onClick={() => handleRedownload(item)}
                        className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 transition-colors"
                        title="Download again"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="p-2 rounded-xl text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      {items.length > 0 && (
        <div className="mx-4 mt-6 p-4 bg-white/3 border border-white/5 rounded-2xl">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-white font-bold text-lg">{items.length}</p>
              <p className="text-white/40 text-[10px] uppercase tracking-wide">Total</p>
            </div>
            <div>
              <p className="text-white font-bold text-lg">
                {[...new Set(items.map((i) => i.movieId))].length}
              </p>
              <p className="text-white/40 text-[10px] uppercase tracking-wide">Movies</p>
            </div>
            <div>
              <p className="text-white font-bold text-lg">
                {items.filter((i) => i.quality === "1080p").length}
              </p>
              <p className="text-white/40 text-[10px] uppercase tracking-wide">in 1080p</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
