import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Download, Play, Loader2, Bookmark } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAddToWatchlist, useRemoveFromWatchlist, useGetWatchlist, getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface TeraboxQuality {
  quality: string;
  url: string;
}

interface TelegramMovie {
  id: string;
  title: string;
  poster: string;
  audio: string;
  qualities: TeraboxQuality[];
  messageId: number;
}

import { API_BASE } from "@/lib/api-base";

async function fetchMovie(id: string): Promise<TelegramMovie> {
  const res = await fetch(`${API_BASE}/api/telegram/movies/${id}`);
  if (!res.ok) throw new Error("Failed to load movie");
  return res.json();
}

export default function TelegramInfo() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id") || "";

  const [selectedQuality, setSelectedQuality] = useState<TeraboxQuality | null>(null);

  const { data: movie, isLoading, isError } = useQuery({
    queryKey: ["telegram-movie", id],
    queryFn: () => fetchMovie(id),
    enabled: !!id,
  });

  const { data: watchlist } = useGetWatchlist();
  const addToWatchlist = useAddToWatchlist({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() }) } });
  const removeFromWatchlist = useRemoveFromWatchlist({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() }) } });

  const watchlistItem = watchlist?.find((i: { link?: string | null }) => i.link === `/telegram-info?id=${id}`);
  const isInWatchlist = !!watchlistItem;

  const handleWatchlistToggle = async () => {
    if (!movie) return;
    if (isInWatchlist && watchlistItem) {
      await removeFromWatchlist.mutateAsync({ id: watchlistItem.id });
      toast({ title: "Removed from watchlist" });
    } else {
      await addToWatchlist.mutateAsync({
        data: {
          title: movie.title,
          poster: movie.poster,
          link: `/telegram-info?id=${id}`,
          provider: "telegram",
          type: "movie",
        },
      });
      toast({ title: "Added to watchlist" });
    }
  };

  const active = selectedQuality ?? movie?.qualities?.[0] ?? null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !movie) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-white/50">Failed to load movie details.</p>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen pb-10">
      {/* Hero */}
      <div className="relative w-full" style={{ height: "60vw", minHeight: 240, maxHeight: 400 }}>
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.title}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-70"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <button
          onClick={() => window.history.back()}
          className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={handleWatchlistToggle}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50"
        >
          <Bookmark className={cn("w-5 h-5", isInWatchlist ? "text-primary fill-primary" : "text-white")} />
        </button>
      </div>

      {/* Title */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold text-white leading-tight">{movie.title}</h1>
        {movie.audio && (
          <p className="text-white/50 text-sm mt-1">🎵 {movie.audio}</p>
        )}
      </div>

      {/* Quality Selector */}
      {movie.qualities.length > 0 && (
        <div className="px-4 mb-5">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-2 font-medium">Select Quality</p>
          <div className="flex gap-2 flex-wrap">
            {movie.qualities.map((q) => (
              <button
                key={q.quality}
                onClick={() => setSelectedQuality(q)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-semibold border transition-all",
                  active?.quality === q.quality
                    ? "bg-primary border-primary text-white"
                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                )}
              >
                {q.quality}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {active && (
        <div className="px-4 space-y-3">
          <a
            href={active.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-3.5 bg-primary rounded-xl text-white font-bold text-base hover:bg-primary/90 transition-colors"
          >
            <Play className="w-5 h-5 fill-white" />
            Stream ({active.quality})
          </a>
          <a
            href={active.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-3.5 bg-white/10 border border-white/10 rounded-xl text-white font-bold text-base hover:bg-white/20 transition-colors"
          >
            <Download className="w-5 h-5" />
            Download ({active.quality})
          </a>
        </div>
      )}

      {/* All qualities list */}
      {movie.qualities.length > 1 && (
        <div className="mx-4 mt-6">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-3 font-medium">All Available Qualities</p>
          <div className="space-y-2">
            {movie.qualities.map((q) => (
              <div
                key={q.quality}
                className="flex items-center gap-3 bg-[#1c1c1c] rounded-xl px-4 py-3"
              >
                <span className="text-primary font-bold text-sm w-14">{q.quality}</span>
                <div className="flex-1 flex gap-2 justify-end">
                  <a
                    href={q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 rounded-lg text-primary text-xs font-semibold hover:bg-primary/30 transition-colors"
                  >
                    <Play className="w-3 h-3 fill-primary" />
                    Stream
                  </a>
                  <a
                    href={q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-white/70 text-xs font-semibold hover:bg-white/20 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
