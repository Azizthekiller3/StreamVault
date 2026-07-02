import { useState } from "react";
import { useGetWatchlist, useGetHistory, useRemoveFromWatchlist, getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { Bookmark, PlaySquare, Loader2, X, Clock } from "lucide-react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { useActiveExtension } from "@/hooks/use-active-extension";
import { cn } from "@/lib/utils";

type Tab = "watchlist" | "history";

export default function Watchlist() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("watchlist");
  const queryClient = useQueryClient();
  const { activeExtId } = useActiveExtension();
  const { toast } = useToast();

  const { data: watchlist, isLoading: isWatchlistLoading } = useGetWatchlist();
  const { data: history, isLoading: isHistoryLoading } = useGetHistory();

  const removeFromWatchlist = useRemoveFromWatchlist({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
      },
    },
  });

  const handleRemove = async (id: number) => {
    await removeFromWatchlist.mutateAsync({ id });
    toast({ title: "Removed from watchlist" });
  };

  const navigateToItem = (item: { imdbId?: string | null; link?: string | null }) => {
    if (item.imdbId) setLocation(`/info?imdbId=${item.imdbId}`);
    else if (item.link?.startsWith("/telegram-info")) setLocation(item.link);
    else if (item.link && activeExtId) setLocation(`/info?extId=${activeExtId}&link=${encodeURIComponent(item.link)}`);
  };

  const isLoading = tab === "watchlist" ? isWatchlistLoading : isHistoryLoading;
  const isEmpty = tab === "watchlist" ? !watchlist?.length : !history?.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <h1 className="text-lg font-bold text-white mb-3">My Library</h1>
        <div className="flex gap-1 bg-white/10 rounded-lg p-1">
          <button
            onClick={() => setTab("watchlist")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
              tab === "watchlist" ? "bg-primary text-white" : "text-white/60 hover:text-white"
            )}
            data-testid="tab-watchlist"
          >
            <Bookmark className="w-4 h-4" />
            Watchlist
          </button>
          <button
            onClick={() => setTab("history")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
              tab === "history" ? "bg-primary text-white" : "text-white/60 hover:text-white"
            )}
            data-testid="tab-history"
          >
            <Clock className="w-4 h-4" />
            History
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 pb-6">
        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {tab === "watchlist" ? (
              <>
                <Bookmark className="w-14 h-14 text-white/20 mb-4" />
                <p className="text-white font-semibold text-base mb-1">No saved titles</p>
                <p className="text-white/40 text-sm mb-4">Bookmark content from the info page.</p>
                <Link href="/search">
                  <button className="px-5 py-2.5 bg-primary rounded-lg text-white text-sm font-medium">
                    Find content
                  </button>
                </Link>
              </>
            ) : (
              <>
                <Clock className="w-14 h-14 text-white/20 mb-4" />
                <p className="text-white font-semibold text-base mb-1">No watch history</p>
                <p className="text-white/40 text-sm">Content you watch will appear here.</p>
              </>
            )}
          </div>
        )}

        {!isLoading && !isEmpty && (
          <div className="grid grid-cols-3 gap-3">
            {tab === "watchlist" &&
              watchlist?.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative"
                  data-testid={`watchlist-item-${item.id}`}
                >
                  <div
                    className="relative aspect-[2/3] rounded-lg overflow-hidden bg-white/5 cursor-pointer"
                    onClick={() => navigateToItem(item)}
                  >
                    <ImageWithFallback
                      src={item.poster}
                      alt={item.title}
                      fallbackText={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-white/80 hover:text-white hover:bg-black transition-colors"
                    data-testid={`button-remove-watchlist-${item.id}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[11px] text-white/60 mt-1 line-clamp-1">{item.title}</p>
                </motion.div>
              ))}

            {tab === "history" &&
              history?.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="cursor-pointer"
                  onClick={() => navigateToItem(item)}
                  data-testid={`history-item-${item.id}`}
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-white/5">
                    <ImageWithFallback
                      src={item.poster}
                      alt={item.title}
                      fallbackText={item.title}
                      className="w-full h-full object-cover"
                    />
                    {item.progress != null && item.progress > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(100, item.progress)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-white/60 mt-1 line-clamp-1">{item.title}</p>
                </motion.div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
