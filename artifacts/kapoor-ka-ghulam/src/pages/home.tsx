import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon, Menu, Clapperboard, Film, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api-base";

const TELEGRAM_CHANNEL = "https://t.me/backupchannek";
const PAGE_SIZE = 20;

interface TelegramMovie {
  id: string;
  title: string;
  poster: string;
  audio: string;
  qualities: { quality: string; url: string }[];
  messageId?: number;
}

function useTelegramMovies() {
  return useQuery<{ movies: TelegramMovie[]; hasMore: boolean }>({
    queryKey: ["telegram-movies"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/telegram/movies`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function isSeries(title: string): boolean {
  return /\b(S\d{2}|Season|Series|E\d{2}|Episode|Web.?Series)\b/i.test(title);
}

/** Builds the full display title like MoviesDrive:
 *  "Lingam (2026) [Hindi DD5.1 + English] 480p | 720p | 1080p" */
function buildDisplayTitle(movie: TelegramMovie): string {
  const parts: string[] = [movie.title];
  if (movie.audio) parts.push(`[${movie.audio}]`);
  const quals = (movie.qualities ?? []).map((q) => q.quality).filter(Boolean);
  if (quals.length) parts.push(quals.join(" | "));
  return parts.join(" ");
}

function getQualityBadge(movie: TelegramMovie): string {
  const text = [movie.title, ...(movie.qualities ?? []).map((q) => q.quality)].join(" ");
  if (/\b(4[Kk]|2160p)\b/.test(text)) return "4K";
  if (/\bBlu.?Ray\b/i.test(text)) return "BluRay";
  if (/\b1080p\b/.test(text)) return "FHD";
  if (/\b720p\b/.test(text)) return "HD";
  if (/\b480p\b/.test(text)) return "SD";
  return "HD";
}

function cleanDisplayTitle(raw: string): string {
  return raw
    .replace(/\b(480p|720p|1080p|2160p|4[Kk]|HDR|BluRay|BDRip|BRRip|WEB.?DL|WEBRip|HDCAM|HDTC|CAM|HEVC|x\.?264|x\.?265|AAC|AC3|DD5\.1|DDP5\.1|Atmos|ESubs?|HIN|CHI|TEL|TAM|MAL|KAN|HC.?ESub|HQ|DVDRip|DVDScr|AMZN|DSNP|NF|ZEE5)\b/gi, "")
    .replace(/\b(Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Japanese|Chinese|Dual|Multi|Dubbed|Subtitles?|Audio|Line|Rip)\b/gi, "")
    .replace(/\b(WEB|DL|HD|CAM|TS|TC|SCR|R5)\b/g, "")
    .replace(/[-_.]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Split a cleaned title into display name + year, e.g. "Inception 2010" → {name:"Inception", year:"2010"} */
function parseTitleAndYear(raw: string): { name: string; year: string | null } {
  const cleaned = cleanDisplayTitle(raw);
  const m = cleaned.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  if (!m) return { name: cleaned, year: null };
  const year = m[1];
  const name = cleaned.replace(year, "").replace(/[()\[\]]/g, "").replace(/\s{2,}/g, " ").trim();
  return { name, year };
}

// ── Blur-up poster image ────────────────────────────────────────────────────
// Shows a tiny w92 TMDB thumbnail (blurred) instantly, then crossfades to
// the full w342 image once it loads. On slow connections this gives immediate
// visual feedback instead of a blank card for several seconds.
function PosterImage({ src, alt, priority }: { src: string; alt: string; priority: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Derive w92 thumbnail from TMDB URL — e.g. /t/p/w342/abc.jpg → /t/p/w92/abc.jpg
  const isTmdb = src.startsWith("https://image.tmdb.org/");
  const thumbSrc = isTmdb ? src.replace(/\/t\/p\/w\d+\//, "/t/p/w92/") : null;

  if (imgError) return null;

  return (
    <>
      {/* Tiny blurred placeholder — appears almost instantly (w92 ≈ 2-4 KB) */}
      {thumbSrc && (
        <img
          src={thumbSrc}
          alt=""
          aria-hidden={true}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: "blur(14px)",
            transform: "scale(1.12)",
            opacity: loaded ? 0 : 1,
            transition: "opacity 0.4s ease",
          }}
        />
      )}
      {/* Full-quality poster — fades in over the blur once loaded */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease" }}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setImgError(true)}
      />
    </>
  );
}

type Category = "All" | "Bollywood" | "Hollywood" | "South Indian" | "Web Series" | "Netflix";
const CATS: Category[] = ["All", "Bollywood", "Hollywood", "South Indian", "Web Series", "Netflix"];

function applyFilter(movies: TelegramMovie[], cat: Category, q: string): TelegramMovie[] {
  let r = q.trim()
    ? movies.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()))
    : [...movies];
  switch (cat) {
    case "Bollywood":   return r.filter((m) => /hindi/i.test(m.audio || ""));
    case "Hollywood":   return r.filter((m) => /english/i.test(m.audio || "") && !/hindi|tamil|telugu|malayalam|kannada/i.test(m.audio || ""));
    case "South Indian":return r.filter((m) => /tamil|telugu|malayalam|kannada/i.test(m.audio || ""));
    case "Web Series":  return r.filter((m) => isSeries(m.title));
    case "Netflix":     return r.filter((m) => /netflix/i.test(m.title));
    default:            return r;
  }
}

function Pagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  const pages: (number | "…")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i);
    if (page < total - 2) pages.push("…");
    pages.push(total);
  }
  return (
    <div className="flex items-center justify-center gap-1.5 py-6 flex-wrap px-4">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-30 transition-colors"
        style={{ background: "#1e1e1e", color: "rgba(255,255,255,0.7)" }}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`el-${i}`} className="w-9 h-9 flex items-center justify-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className="w-9 h-9 rounded-lg text-sm font-bold transition-all"
            style={{
              background: page === p ? "#dc2626" : "#1e1e1e",
              color: page === p ? "#fff" : "rgba(255,255,255,0.65)",
              border: page === p ? "1.5px solid #dc2626" : "1px solid transparent",
            }}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === total}
        className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-30 transition-colors"
        style={{ background: "#1e1e1e", color: "rgba(255,255,255,0.7)" }}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<Category>("All");
  const [page, setPage] = useState(1);
  const [, setLocation] = useLocation();
  const { data, isLoading, isError } = useTelegramMovies();

  const allMovies = (data?.movies ?? []).slice().sort((a, b) => (b.messageId ?? 0) - (a.messageId ?? 0));
  const filtered = useMemo(() => applyFilter(allMovies, cat, search), [allMovies, cat, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageMovies = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [cat, search]);

  function handlePageChange(p: number) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="min-h-screen" style={{ background: "#0f0f0f" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#dc2626" }}>
            <Clapperboard className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-wide text-white">
            Stream<span style={{ color: "#dc2626" }}>Vault</span>
          </span>
        </div>
        <button onClick={() => setLocation("/settings")} className="p-1">
          <Menu className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-4 mb-5 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search.trim() && setLocation(`/search?q=${encodeURIComponent(search.trim())}`)}
          placeholder="Search movies..."
          className="flex-1 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
          style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.07)" }}
        />
        <button
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#dc2626" }}
          onClick={() => search.trim() && setLocation(`/search?q=${encodeURIComponent(search.trim())}`)}
        >
          <SearchIcon className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ── Category pills ── */}
      <div className="px-4 mb-6 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: cat === c ? "#dc2626" : "transparent",
              border: cat === c ? "1px solid #dc2626" : "1px solid rgba(255,255,255,0.2)",
              color: cat === c ? "#fff" : "rgba(255,255,255,0.65)",
            }}
          >
            {c}
          </button>
        ))}
        <a
          href={TELEGRAM_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium"
          style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.65)" }}
        >
          Join Telegram ✈️
        </a>
      </div>

      {/* ── Section header ── */}
      <div className="flex items-center justify-between px-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-6 rounded-full" style={{ background: "#dc2626" }} />
          <span className="text-white font-bold text-base">🔥 Latest Releases</span>
        </div>
        {!isLoading && filtered.length > 0 && (
          <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
            {page}/{totalPages} · {filtered.length}
          </span>
        )}
      </div>

      {/* ── Error state ── */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <Film className="w-12 h-12 mb-4" style={{ color: "#dc2626", opacity: 0.5 }} />
          <p className="text-white font-semibold mb-1">Could not load movies</p>
          <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>Check your connection or try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#dc2626" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Movie grid ── */}
      {!isError && isLoading && (
        <div className="grid grid-cols-2 gap-3 px-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl" style={{ aspectRatio: "2/3", background: "#1a1a1a" }} />
          ))}
        </div>
      )}
      {!isError && !isLoading && filtered.length === 0 && (
        <p className="text-center mt-20 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No movies found.</p>
      )}
      {!isError && !isLoading && filtered.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4">

            {pageMovies.map((movie, i) => {
              const { name, year } = parseTitleAndYear(movie.title);
              const series = isSeries(movie.title);
              return (
                <motion.div
                  key={movie.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.025, 0.3) }}
                  className="cursor-pointer"
                  onClick={() => setLocation(`/telegram-info?id=${movie.id}`)}
                >
                  {/* ── Poster card ── */}
                  <div
                    className="relative rounded-2xl overflow-hidden"
                    style={{
                      aspectRatio: "2/3",
                      background: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {/* Placeholder — always rendered behind; visible when poster is missing or failed */}
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3"
                      style={{ background: "linear-gradient(135deg,#1c1c1c 0%,#2b1818 100%)" }}
                    >
                      <Film className="w-8 h-8 shrink-0" style={{ color: "#dc2626", opacity: 0.6 }} />
                      <p className="text-center leading-snug line-clamp-4 text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {name}
                      </p>
                    </div>

                    {/* Poster — covers placeholder; blur-up from w92 thumbnail to full w342 */}
                    {movie.poster && (
                      <PosterImage src={movie.poster} alt={name} priority={i < 4} />
                    )}

                    {/* Quality badge — bottom-right */}
                    <span
                      className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-white tracking-wide"
                      style={{ background: "rgba(0,0,0,0.78)", border: "1px solid rgba(255,255,255,0.18)" }}
                    >
                      {getQualityBadge(movie)}
                    </span>
                  </div>

                  {/* ── Full title below card ── */}
                  <div className="mt-2 px-0.5">
                    <p className="text-xs font-medium leading-snug line-clamp-4" style={{ color: "#e5e5e5" }}>
                      {buildDisplayTitle(movie)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <Pagination page={page} total={totalPages} onChange={handlePageChange} />

          <p className="text-center pb-6 text-xs px-4" style={{ color: "rgba(255,255,255,0.18)" }}>
            © StreamVault · We do not claim ownership of any content on this website.
          </p>
        </>
      )}
    </div>
  );
}
