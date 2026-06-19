import { useState } from "react";
import { ArrowLeft, Download, Play, Loader2, Bookmark, Share2, Star, Clock, Calendar, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAddToWatchlist, useRemoveFromWatchlist, useGetWatchlist, getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-base";
import { detectGenres } from "@/lib/genres";
import { getRating, setRating } from "@/lib/flixnest-store";

interface TeraboxQuality { quality: string; url: string; }
interface TelegramMovie {
  id: string; title: string; poster: string;
  audio: string; qualities: TeraboxQuality[]; messageId: number;
}
interface TmdbCastMember { name: string; character: string; photo: string; }
interface TmdbData {
  tmdbId: number; imdbId: string | null; overview: string;
  poster: string; backdrop: string; rating: number; voteCount: number;
  year: string; runtime: number; genres: string[]; cast: TmdbCastMember[]; tagline: string;
}

async function fetchMovie(id: string): Promise<TelegramMovie> {
  const res = await fetch(`${API_BASE}/api/telegram/movies/${id}`);
  if (!res.ok) throw new Error("Failed to load movie");
  return res.json();
}
async function fetchTmdb(title: string): Promise<TmdbData | null> {
  const res = await fetch(`${API_BASE}/api/tmdb/enrich?title=${encodeURIComponent(title)}`);
  if (!res.ok) return null;
  return res.json();
}

function StarRating({ movieId }: { movieId: string }) {
  const [rating, setRatingState] = useState(() => getRating(movieId));
  const [hover, setHover] = useState(0);
  const handleRate = (stars: number) => { setRating(movieId, stars); setRatingState(stars); };
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map((star) => (
        <button key={star} onClick={() => handleRate(star)}
          onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110">
          <Star className={cn("w-5 h-5", (hover || rating) >= star ? "fill-yellow-400 text-yellow-400" : "text-white/30")} />
        </button>
      ))}
      {rating > 0 && <span className="text-white/40 text-xs ml-1">{rating}/5</span>}
    </div>
  );
}

export default function TelegramInfo() {
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

  const { data: tmdb, isLoading: isTmdbLoading } = useQuery({
    queryKey: ["tmdb", movie?.title],
    queryFn: () => fetchTmdb(movie!.title),
    enabled: !!movie?.title,
    staleTime: 30 * 60 * 1000,
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
      await addToWatchlist.mutateAsync({ data: { title: movie.title, poster: tmdb?.poster || movie.poster, link: `/telegram-info?id=${id}`, provider: "telegram", type: "movie" } });
      toast({ title: "Added to watchlist ❤️" });
    }
  };

  const handleShare = async () => {
    if (!movie) return;
    const url = `${window.location.origin}/telegram-info?id=${id}`;
    const text = `🎬 ${movie.title} — Watch on FlixNest`;
    if (navigator.share) { try { await navigator.share({ title: movie.title, text, url }); return; } catch {} }
    try { await navigator.clipboard.writeText(url); toast({ title: "Link copied!" }); } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank");
    }
  };

  const active = selectedQuality ?? movie?.qualities?.[0] ?? null;
  const localGenres = movie ? detectGenres(movie.title) : [];
  const heroImage = tmdb?.backdrop || tmdb?.poster || movie?.poster || "";
  const displayPoster = tmdb?.poster || movie?.poster || "";
  const allGenres = tmdb?.genres?.length ? tmdb.genres : localGenres.map(g => g.genre);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );
  if (isError || !movie) return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <p className="text-white/50">Failed to load movie details.</p>
    </div>
  );

  return (
    <div className="bg-black min-h-screen pb-12">
      {/* Hero backdrop */}
      <div className="relative w-full" style={{ height: "56vw", minHeight: 240, maxHeight: 420 }}>
        {heroImage ? (
          <img src={heroImage} alt={movie.title} className="absolute inset-0 w-full h-full object-cover object-top" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/40" />

        {/* Back */}
        <button onClick={() => window.history.back()} className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/60 text-white backdrop-blur-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Top right actions */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button onClick={handleShare} className="p-2 rounded-full bg-black/60 text-white backdrop-blur-sm">
            <Share2 className="w-5 h-5" />
          </button>
          <button onClick={handleWatchlistToggle} className="p-2 rounded-full bg-black/60 backdrop-blur-sm">
            <Bookmark className={cn("w-5 h-5", isInWatchlist ? "text-primary fill-primary" : "text-white")} />
          </button>
        </div>

        {/* IMDB rating badge */}
        {tmdb && tmdb.rating > 0 && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-yellow-500/90 text-black text-xs font-bold px-2.5 py-1.5 rounded-lg backdrop-blur-sm">
            <Star className="w-3.5 h-3.5 fill-black" />
            {tmdb.rating}/10
            <span className="font-normal text-black/60 text-[10px]">({(tmdb.voteCount / 1000).toFixed(0)}K)</span>
          </div>
        )}
      </div>

      {/* Poster + Title row */}
      <div className="flex gap-3 px-4 -mt-16 relative z-10 mb-4">
        {displayPoster && (
          <img src={displayPoster} alt={movie.title}
            className="w-24 rounded-xl shadow-2xl border border-white/10 shrink-0 aspect-[2/3] object-cover" />
        )}
        <div className="flex-1 pt-14">
          <h1 className="text-xl font-bold text-white leading-tight">{movie.title}</h1>
          {tmdb?.tagline && (
            <p className="text-white/40 text-xs italic mt-0.5">"{tmdb.tagline}"</p>
          )}
          {/* Meta row */}
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            {tmdb?.year && (
              <span className="flex items-center gap-1 text-white/50 text-xs">
                <Calendar className="w-3 h-3" />{tmdb.year}
              </span>
            )}
            {tmdb?.runtime && tmdb.runtime > 0 && (
              <span className="flex items-center gap-1 text-white/50 text-xs">
                <Clock className="w-3 h-3" />{Math.floor(tmdb.runtime / 60)}h {tmdb.runtime % 60}m
              </span>
            )}
            {movie.audio && (
              <span className="text-white/50 text-xs">🎵 {movie.audio}</span>
            )}
          </div>
        </div>
      </div>

      {/* Genre tags */}
      {allGenres.length > 0 && (
        <div className="flex gap-1.5 px-4 flex-wrap mb-4">
          {allGenres.map((g) => (
            <span key={g} className="text-xs bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-medium">{g}</span>
          ))}
        </div>
      )}

      {/* Overview */}
      {isTmdbLoading && (
        <div className="px-4 mb-4 space-y-2">
          <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
          <div className="h-3 bg-white/10 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-white/10 rounded animate-pulse w-3/5" />
        </div>
      )}
      {tmdb?.overview && (
        <div className="px-4 mb-4">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-1.5 font-medium">Overview</p>
          <p className="text-white/80 text-sm leading-relaxed">{tmdb.overview}</p>
        </div>
      )}

      {/* Star rating */}
      <div className="px-4 mb-5">
        <p className="text-white/40 text-xs uppercase tracking-wide mb-1.5 font-medium">Your Rating</p>
        <StarRating movieId={id} />
      </div>

      {/* Quality Selector */}
      {movie.qualities.length > 0 && (
        <div className="px-4 mb-5">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-2 font-medium">Select Quality</p>
          <div className="flex gap-2 flex-wrap">
            {movie.qualities.map((q) => (
              <button key={q.quality} onClick={() => setSelectedQuality(q)}
                className={cn("px-4 py-2 rounded-lg text-sm font-semibold border transition-all",
                  active?.quality === q.quality ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10")}>
                {q.quality}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stream / Download */}
      {active && (
        <div className="px-4 space-y-3 mb-5">
          <a href={active.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-3.5 bg-primary rounded-xl text-white font-bold text-base hover:bg-primary/90 transition-colors">
            <Play className="w-5 h-5 fill-white" /> Stream ({active.quality})
          </a>
          <a href={active.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 w-full py-3.5 bg-white/10 border border-white/10 rounded-xl text-white font-bold text-base hover:bg-white/20 transition-colors">
            <Download className="w-5 h-5" /> Download ({active.quality})
          </a>

          {/* Share shortcuts */}
          <div className="flex gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(`🎬 ${movie.title}\n${window.location.href}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600/20 border border-green-600/30 rounded-xl text-green-400 text-sm font-semibold hover:bg-green-600/30 transition-colors">
              📱 WhatsApp
            </a>
            <a href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(`🎬 ${movie.title}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-400 text-sm font-semibold hover:bg-blue-500/30 transition-colors">
              ✈️ Telegram
            </a>
          </div>
        </div>
      )}

      {/* Cast */}
      {tmdb?.cast && tmdb.cast.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 px-4 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <p className="text-white/40 text-xs uppercase tracking-wide font-medium">Cast</p>
          </div>
          <div className="flex gap-3 overflow-x-auto pl-4 pr-4 pb-2 scrollbar-hide">
            {tmdb.cast.map((member) => (
              <div key={member.name} className="flex-none w-16 text-center">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 mx-auto mb-1">
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl">👤</div>
                  )}
                </div>
                <p className="text-white/80 text-[9px] leading-tight line-clamp-2 font-medium">{member.name}</p>
                <p className="text-white/40 text-[8px] leading-tight line-clamp-1 mt-0.5 italic">{member.character}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All qualities list */}
      {movie.qualities.length > 1 && (
        <div className="mx-4 mt-2">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-3 font-medium">All Available Qualities</p>
          <div className="space-y-2">
            {movie.qualities.map((q) => (
              <div key={q.quality} className="flex items-center gap-3 bg-[#1c1c1c] rounded-xl px-4 py-3">
                <span className="text-primary font-bold text-sm w-14">{q.quality}</span>
                <div className="flex-1 flex gap-2 justify-end">
                  <a href={q.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 rounded-lg text-primary text-xs font-semibold hover:bg-primary/30 transition-colors">
                    <Play className="w-3 h-3 fill-primary" /> Stream
                  </a>
                  <a href={q.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-lg text-white/70 text-xs font-semibold hover:bg-white/20 transition-colors">
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
