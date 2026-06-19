import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Download, Play, Loader2, Bookmark, Share2, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAddToWatchlist, useRemoveFromWatchlist, useGetWatchlist, getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-base";
import { detectGenres } from "@/lib/genres";
import { getRating, setRating } from "@/lib/flixnest-store";

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

async function fetchMovie(id: string): Promise<TelegramMovie> {
  const res = await fetch(`${API_BASE}/api/telegram/movies/${id}`);
  if (!res.ok) throw new Error("Failed to load movie");
  return res.json();
}

function StarRating({ movieId }: { movieId: string }) {
  const [rating, setRatingState] = useState(() => getRating(movieId));
  const [hover, setHover] = useState(0);

  const handleRate = (stars: number) => {
    setRating(movieId, stars);
    setRatingState(stars);
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => handleRate(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              "w-5 h-5",
              (hover || rating) >= star ? "fill-yellow-400 text-yellow-400" : "text-white/30"
            )}
          />
        </button>
      ))}
      {rating > 0 && (
        <span className="text-white/40 text-xs ml-1">{rating}/5</span>
      )}
    </div>
  );
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
      toast({ title: "Added to watchlist ❤️" });
    }
  };

  const handleShare = async () => {
    if (!movie) return;
    const url = `${window.location.origin}/telegram-info?id=${id}`;
    const text = `🎬 ${movie.title} — Watch on FlixNest`;

    if (navigator.share) {
      try {
        await navigator.share({ title: movie.title, text, url });
        return;
      } catch {}
    }

    // Fallback: copy to clipboard + show options
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied! Share it on WhatsApp or Telegram." });
    } catch {
      // Last resort: open WhatsApp share
      const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
      window.open(wa, "_blank");
    }
  };

  const active = selectedQuality ?? movie?.qualities?.[0] ?? null;
  const genres = movie ? detectGenres(movie.title) : [];

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
          <img src={movie.poster} alt={movie.title} className="absolute inset-0 w-full h-full object-cover object-top opacity-70" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

        {/* Back */}
        <button onClick={() => window.history.back()} className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Top right actions */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button onClick={handleShare} className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
          <button onClick={handleWatchlistToggle} className="p-2 rounded-full bg-black/50">
            <Bookmark className={cn("w-5 h-5", isInWatchlist ? "text-primary fill-primary" : "text-white")} />
          </button>
        </div>
      </div>

      {/* Title + Meta */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold text-white leading-tight">{movie.title}</h1>

        {/* Genre tags */}
        {genres.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {genres.map((g) => (
              <span key={g.genre} className="text-xs bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-medium">
                {g.emoji} {g.genre}
              </span>
            ))}
          </div>
        )}

        {movie.audio && (
          <p className="text-white/50 text-sm mt-2">🎵 {movie.audio}</p>
        )}

        {/* Star Rating */}
        <div className="mt-3">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-1.5 font-medium">Your Rating</p>
          <StarRating movieId={id} />
        </div>
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

          {/* Share shortcuts */}
          <div className="flex gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`🎬 ${movie.title}\n${window.location.href}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600/20 border border-green-600/30 rounded-xl text-green-400 text-sm font-semibold hover:bg-green-600/30 transition-colors"
            >
              📱 WhatsApp
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`🎬 ${movie.title}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 text-sm font-semibold hover:bg-blue-500/30 transition-colors"
            >
              ✈️ Telegram
            </a>
          </div>
        </div>
      )}

      {/* All qualities list */}
      {movie.qualities.length > 1 && (
        <div className="mx-4 mt-6">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-3 font-medium">All Available Qualities</p>
          <div className="space-y-2">
            {movie.qualities.map((q) => (
              <div key={q.quality} className="flex items-center gap-3 bg-[#1c1c1c] rounded-xl px-4 py-3">
                <span className="text-primary font-bold text-sm w-14">{q.quality}</span>
                <div className="flex-1 flex gap-2 justify-end">
                  <a href={q.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 rounded-lg text-primary text-xs font-semibold hover:bg-primary/30 transition-colors">
                    <Play className="w-3 h-3 fill-primary" /> Stream
                  </a>
                  <a href={q.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-white/70 text-xs font-semibold hover:bg-white/20 transition-colors">
                    <Download className="w-3 h-3" /> Download
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
