import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  Share2,
  Star,
  Calendar,
  Send,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Menu,
  Volume2,
  Subtitles,
  HardDrive,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient as useRQClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { API_BASE } from "@/lib/api-base";
import { detectGenres } from "@/lib/genres";
import { getRating, setRating, addRecentlyViewed, addDownloadHistory } from "@/lib/flixnest-store";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { isSeries } from "./home";

const TELEGRAM_CHANNEL = "https://t.me/backupchannek";

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
interface TmdbCastMember {
  name: string;
  character: string;
  photo: string;
}
interface TmdbData {
  tmdbId: number;
  imdbId: string | null;
  overview: string;
  poster: string;
  backdrop: string;
  rating: number;
  voteCount: number;
  year: string;
  runtime: number;
  genres: string[];
  cast: TmdbCastMember[];
  tagline: string;
}
interface Comment {
  id: string;
  movieId: string;
  username: string;
  text: string;
  createdAt: string;
}

async function fetchMovie(id: string): Promise<TelegramMovie> {
  const res = await fetch(`${API_BASE}/api/telegram/movies/${id}`);
  if (!res.ok) throw new Error("Failed to load movie");
  return res.json();
}
async function fetchAllMovies(): Promise<TelegramMovie[]> {
  const res = await fetch(`${API_BASE}/api/telegram/movies`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.movies ?? [];
}
async function fetchTmdb(title: string): Promise<TmdbData | null> {
  const res = await fetch(`${API_BASE}/api/tmdb/enrich?title=${encodeURIComponent(title)}`);
  if (!res.ok) return null;
  return res.json();
}
async function fetchComments(movieId: string): Promise<Comment[]> {
  const res = await fetch(`${API_BASE}/api/comments/${movieId}`);
  if (!res.ok) return [];
  return res.json();
}
async function postComment(movieId: string, username: string, text: string): Promise<Comment> {
  const res = await fetch(`${API_BASE}/api/comments/${movieId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, text }),
  });
  if (!res.ok) throw new Error("Failed to post comment");
  return res.json();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
      {rating > 0 && <span className="text-white/40 text-xs ml-1">{rating}/5</span>}
    </div>
  );
}

function CommentsSection({ movieId }: { movieId: string }) {
  const rqClient = useRQClient();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(
    () => localStorage.getItem("flixnest_username") || ""
  );
  const [text, setText] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", movieId],
    queryFn: () => fetchComments(movieId),
    enabled: open,
    staleTime: 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: ({ u, t }: { u: string; t: string }) => postComment(movieId, u, t),
    onSuccess: () => {
      rqClient.invalidateQueries({ queryKey: ["comments", movieId] });
      setText("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !text.trim()) return;
    localStorage.setItem("flixnest_username", username.trim());
    mutation.mutate({ u: username.trim(), t: text.trim() });
  };

  return (
    <div className="mx-4 mb-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left mb-3"
      >
        <MessageCircle className="w-4 h-4" style={{ color: "#dc2626" }} />
        <span className="text-xs uppercase tracking-wide font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
          Comments
        </span>
        {comments.length > 0 && (
          <span className="text-xs font-bold" style={{ color: "#dc2626" }}>
            ({comments.length})
          </span>
        )}
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 ml-auto" style={{ color: "rgba(255,255,255,0.3)" }} />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 ml-auto" style={{ color: "rgba(255,255,255,0.3)" }} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <form onSubmit={handleSubmit} className="mb-4 space-y-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                maxLength={40}
              />
              <div className="relative">
                <textarea
                  ref={textRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a comment…"
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  maxLength={500}
                />
                <span className="absolute bottom-2 right-2 text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                  {text.length}/500
                </span>
              </div>
              <button
                type="submit"
                disabled={!username.trim() || !text.trim() || mutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-40 transition-colors"
                style={{ background: "#dc2626" }}
              >
                {mutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Post
              </button>
              {mutation.isError && (
                <p className="text-red-400 text-xs">Failed to post — try again.</p>
              )}
            </form>

            {isLoading && (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
                ))}
              </div>
            )}
            {!isLoading && comments.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                No comments yet — be the first!
              </p>
            )}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl px-3.5 py-3"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-xs font-semibold">@{c.username}</span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm leading-snug" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {c.text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function YouMayAlsoLike({
  currentId,
  currentTitle,
  allMovies,
}: {
  currentId: string;
  currentTitle: string;
  allMovies: TelegramMovie[];
}) {
  const [, setLocation] = useLocation();
  const currentGenres = detectGenres(currentTitle).map((g) => g.genre);
  const similar = allMovies
    .filter((m) => m.id !== currentId)
    .map((m) => {
      const genres = detectGenres(m.title).map((g) => g.genre);
      const overlap = genres.filter((g) => currentGenres.includes(g)).length;
      const currentWords = currentTitle
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const titleScore = currentWords.filter((w) => m.title.toLowerCase().includes(w)).length;
      return { movie: m, score: overlap * 2 + titleScore };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.movie);

  if (!similar.length) return null;

  return (
    <div className="mt-6 mb-4 px-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 rounded-full" style={{ background: "#dc2626" }} />
        <h2 className="text-white font-bold text-base">YOU MAY ALSO LIKE</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {similar.map((movie, i) => (
          <motion.div
            key={movie.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="cursor-pointer"
            onClick={() => setLocation(`/telegram-info?id=${movie.id}`)}
          >
            <div
              className="relative rounded-xl overflow-hidden"
              style={{ aspectRatio: "2/3", background: "#1e1e1e" }}
            >
              {movie.poster ? (
                <img
                  src={movie.poster}
                  alt={movie.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-3">
                  <p className="text-xs text-center leading-tight" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {movie.title}
                  </p>
                </div>
              )}
              <div
                className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-white"
                style={{ background: isSeries(movie.title) ? "#7c3aed" : "#dc2626" }}
              >
                {isSeries(movie.title) ? "SERIES" : "MOVIE"}
              </div>
            </div>
            <p
              className="text-xs mt-1.5 leading-snug line-clamp-2 font-medium"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {movie.title}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function TelegramInfo() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const id = searchParams.get("id") || "";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [id]);

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
  const { data: allMovies = [] } = useQuery({
    queryKey: ["telegram-movies-all"],
    queryFn: fetchAllMovies,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (movie) {
      addRecentlyViewed({
        id: movie.id,
        title: movie.title,
        poster: tmdb?.poster || movie.poster || "",
      });
    }
  }, [movie?.id, tmdb?.poster]);

  const handleShare = async () => {
    if (!movie) return;
    const url = `${window.location.origin}/telegram-info?id=${id}`;
    const text = `🎬 ${movie.title} — Watch on StreamVault`;
    if (navigator.share) {
      try {
        await navigator.share({ title: movie.title, text, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!" });
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank");
    }
  };

  const recordDownload = (quality: string, url: string) => {
    if (!movie) return;
    addDownloadHistory({
      movieId: movie.id,
      title: movie.title,
      poster: tmdb?.poster || movie.poster || "",
      quality,
      url,
    });
  };

  const displayPoster = tmdb?.poster || movie?.poster || "";
  const backdropImage = tmdb?.backdrop || tmdb?.poster || movie?.poster || "";
  const allGenres = tmdb?.genres?.length
    ? tmdb.genres
    : (movie ? detectGenres(movie.title).map((g) => g.genre) : []);
  const audioLabel = movie?.audio || "";
  const qualityTag = movie?.qualities?.[0]?.quality || "";

  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "#dc2626" }} />
      </div>
    );
  if (isError || !movie)
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111" }}>
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Failed to load movie details.</p>
      </div>
    );

  return (
    <div className="min-h-screen pb-24" style={{ background: "#111111" }}>
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (window.history.length > 1) window.history.back(); else setLocation("/"); }}
            className="p-1.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "#dc2626" }}
            >
              <Clapperboard className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-extrabold text-lg tracking-wide">
              Stream<span style={{ color: "#dc2626" }}>Vault</span>
            </span>
          </button>
        </div>
        <button
          onClick={() => setLocation("/settings")}
          className="p-1"
        >
          <Menu className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* ── Backdrop ── */}
      <div className="relative w-full" style={{ height: "52vw", minHeight: 200, maxHeight: 320 }}>
        {backdropImage ? (
          <img
            src={backdropImage}
            alt={movie.title}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, #dc2626 0%, #111 100%)" }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 30%, #111111 100%)" }}
        />
        {/* Action buttons */}
        <div className="absolute top-3 right-4 flex gap-2">
          <button
            onClick={handleShare}
            className="p-2 rounded-full"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <Share2 className="w-4 h-4 text-white" />
          </button>
        </div>
        {/* TMDB rating badge */}
        {tmdb && tmdb.rating > 0 && (
          <div
            className="absolute bottom-3 right-4 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-black"
            style={{ background: "#facc15" }}
          >
            <Star className="w-3 h-3 fill-black" />
            {tmdb.rating.toFixed(1)}/10
          </div>
        )}
      </div>

      {/* ── Poster + Info Row ── */}
      <div className="flex gap-3 px-4 -mt-14 relative z-10 mb-4">
        {displayPoster && (
          <img
            src={displayPoster}
            alt={movie.title}
            className="rounded-xl object-cover shrink-0"
            style={{
              width: 100,
              aspectRatio: "2/3",
              border: "2px solid rgba(255,255,255,0.1)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
            }}
          />
        )}
        <div className="flex-1 pt-16 min-w-0">
          <h1 className="text-white font-bold text-base leading-snug mb-2">{movie.title}</h1>
          {/* Date + Type row */}
          <div className="flex flex-wrap gap-2 mb-2">
            {tmdb?.year && (
              <span
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
              >
                <Calendar className="w-3 h-3" />
                {tmdb.year}
              </span>
            )}
            <span
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-white"
              style={{ background: isSeries(movie.title) ? "#7c3aed" : "#dc2626" }}
            >
              {isSeries(movie.title) ? "Series" : "Movie"}
            </span>
          </div>
          {/* Quality + Audio + Subtitle badges */}
          <div className="flex flex-wrap gap-1.5 mb-1">
            {qualityTag && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold text-white"
                style={{ background: "#dc2626" }}
              >
                ★ {qualityTag}
              </span>
            )}
            {audioLabel && (
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-black"
                style={{ background: "#f59e0b" }}
              >
                <Volume2 className="w-2.5 h-2.5" />
                {audioLabel}
              </span>
            )}
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
              style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
            >
              <Subtitles className="w-2.5 h-2.5" />
              English
            </span>
          </div>
        </div>
      </div>

      {/* ── Genre chips ── */}
      {allGenres.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 mb-4">
          {allGenres.map((g) => (
            <span
              key={g}
              className="px-3 py-1 rounded-full text-xs font-medium"
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {/* ── Overview ── */}
      {isTmdbLoading && (
        <div className="px-4 mb-4 space-y-2">
          <div className="h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "100%" }} />
          <div className="h-3 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", width: "80%" }} />
        </div>
      )}
      {tmdb?.overview && (
        <div className="px-4 mb-5">
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            {tmdb.overview}
          </p>
        </div>
      )}

      {/* ── Your Rating ── */}
      <div className="px-4 mb-5">
        <p
          className="text-xs uppercase tracking-wide mb-2 font-medium"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Your Rating
        </p>
        <StarRating movieId={id} />
      </div>

      {/* ── Download Card ── */}
      {movie.qualities.length > 0 && (
        <div
          className="mx-4 mb-5 rounded-2xl overflow-hidden"
          style={{ background: "#1a1a1a" }}
        >
          {/* Card header */}
          <div className="flex items-start justify-between gap-3 p-4 pb-3">
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "#dc2626" }}
              >
                <Download className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-snug">{movie.title}</p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  Choose your preferred quality below
                </p>
              </div>
            </div>
            <div
              className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold text-white text-center"
              style={{ background: "rgba(255,255,255,0.12)", minWidth: 52 }}
            >
              {movie.qualities.length} Links
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

          {/* Quality rows */}
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            {movie.qualities.map((q) => (
              <div key={q.quality} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex-1 text-sm font-semibold text-white">{q.quality}</span>
                <span
                  className="flex items-center gap-1 text-xs mr-2"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  <HardDrive className="w-3 h-3" />
                  Terabox
                </span>
                <a
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => recordDownload(q.quality, q.url)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-bold"
                  style={{ background: "#dc2626" }}
                >
                  <Download className="w-3 h-3" />
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Cast ── */}
      {tmdb?.cast && tmdb.cast.length > 0 && (
        <div className="mb-5">
          <div
            className="flex items-center gap-2 px-4 mb-3"
            style={{ borderLeft: "3px solid #dc2626", marginLeft: 16 }}
          >
            <h2 className="text-white font-bold text-sm pl-2">Cast</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pl-4 pr-4 pb-2 scrollbar-hide">
            {tmdb.cast.map((member) => (
              <div key={member.name} className="flex-none w-16 text-center">
                <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-1" style={{ background: "rgba(255,255,255,0.08)" }}>
                  {member.photo ? (
                    <img src={member.photo} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl" style={{ color: "rgba(255,255,255,0.2)" }}>👤</div>
                  )}
                </div>
                <p className="text-[9px] leading-tight line-clamp-2 font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>{member.name}</p>
                <p className="text-[8px] leading-tight line-clamp-1 mt-0.5 italic" style={{ color: "rgba(255,255,255,0.4)" }}>{member.character}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Comments ── */}
      <CommentsSection movieId={id} />

      {/* ── Join Telegram ── */}
      <div className="mx-4 mb-5">
        <a
          href={TELEGRAM_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3.5 rounded-xl transition-colors"
          style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)" }}
        >
          <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold">Join our Telegram Channel</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>New movies posted daily</p>
          </div>
          <span className="text-xs font-bold text-blue-400">JOIN →</span>
        </a>
      </div>

      {/* ── You May Also Like ── */}
      {allMovies.length > 1 && (
        <YouMayAlsoLike currentId={id} currentTitle={movie.title} allMovies={allMovies} />
      )}
    </div>
  );
}