import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon, Menu, Film } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api-base";

const TELEGRAM_CHANNEL = "https://t.me/backupchannek";

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

/** Extract year (1950–2030) from raw title. */
function extractYear(raw: string): string | null {
  return raw.match(/\b(19[5-9]\d|20[0-3]\d)\b/)?.[1] ?? null;
}

/** Strip encoding/quality tags and return a clean human-readable title. */
function cleanDisplayTitle(raw: string): string {
  return raw
    .replace(/\b(19[5-9]\d|20[0-3]\d)\b/g, "")
    .replace(/\b(480p|720p|1080p|2160p|4[Kk]|HDR|BluRay|BDRip|BRRip|WEB.?DL|WEBRip|HDCAM|HDTC|CAM|HEVC|x\.?264|x\.?265|AAC|AC3|DD5\.1|DDP5\.1|Atmos|ESubs?|HIN|CHI|TEL|TAM|MAL|KAN|HC.?ESub|HQ|DVDRip|DVDScr|AMZN|DSNP|NF|ZEE5)\b/gi, "")
    .replace(/\b(Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Japanese|Chinese|Dual|Multi|Dubbed|Subtitles?|Audio|Line|Rip)\b/gi, "")
    .replace(/\b(WEB|DL|HD|CAM|TS|TC|SCR|R5)\b/g, "")
    .replace(/[-_.]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type Category = "All" | "Bollywood" | "Hollywood" | "South Indian" | "Web Series" | "Netflix";
const CATS: Category[] = ["All", "Bollywood", "Hollywood", "South Indian", "Web Series", "Netflix"];

function applyFilter(movies: TelegramMovie[], cat: Category, q: string): TelegramMovie[] {
  let r = q.trim()
    ? movies.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()))
    : [...movies];
  switch (cat) {
    case "Bollywood":
      return r.filter((m) => /hindi/i.test(m.audio || ""));
    case "Hollywood":
      return r.filter(
        (m) =>
          /english/i.test(m.audio || "") &&
          !/hindi|tamil|telugu|malayalam|kannada/i.test(m.audio || "")
      );
    case "South Indian":
      return r.filter((m) => /tamil|telugu|malayalam|kannada/i.test(m.audio || ""));
    case "Web Series":
      return r.filter((m) => isSeries(m.title));
    case "Netflix":
      return r.filter((m) => /netflix/i.test(m.title));
    default:
      return r;
  }
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<Category>("All");
  const [, setLocation] = useLocation();
  const { data, isLoading } = useTelegramMovies();
  const allMovies = (data?.movies ?? []).slice().sort((a, b) => (b.messageId ?? 0) - (a.messageId ?? 0));
  const filtered = useMemo(() => applyFilter(allMovies, cat, search), [allMovies, cat, search]);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0f0f0f" }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-extrabold text-2xl tracking-tight">
            FLIX<span style={{ color: "#dc2626" }}>NEST</span>
          </span>
        </div>
        <button onClick={() => setLocation("/settings")} className="p-1">
          <Menu className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-4 mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && search.trim() && setLocation(`/search?q=${encodeURIComponent(search.trim())}`)
          }
          placeholder="Search movies..."
          className="flex-1 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
          style={{
            background: "#1c1c1c",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
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
      <div className="px-4 mb-5 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: cat === c ? "#dc2626" : "transparent",
              border: cat === c ? "1px solid #dc2626" : "1px solid rgba(255,255,255,0.18)",
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
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            color: "rgba(255,255,255,0.65)",
          }}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" style={{ color: "#29b6f6" }}>
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
          </svg>
          Join Telegram
        </a>
      </div>

      {/* ── Section header ── */}
      <div className="flex items-center gap-2.5 px-4 mb-4">
        <div className="w-1 h-6 rounded-full" style={{ background: "#dc2626" }} />
        <span className="text-white font-bold text-base">🔥 Latest Releases</span>
      </div>

      {/* ── Movie grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div
                className="animate-pulse rounded-xl"
                style={{ aspectRatio: "2/3", background: "#1c1c1c" }}
              />
              <div className="h-3 rounded-full animate-pulse" style={{ background: "#1c1c1c", width: "80%" }} />
              <div className="h-3 rounded-full animate-pulse" style={{ background: "#1c1c1c", width: "40%" }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center mt-16 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
          No movies found.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4">
          {filtered.map((movie, i) => {
            const displayTitle = cleanDisplayTitle(movie.title);
            const year = extractYear(movie.title);
            const series = isSeries(movie.title);
            return (
              <motion.div
                key={movie.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.025, 0.35), duration: 0.25 }}
                className="cursor-pointer"
                onClick={() => setLocation(`/telegram-info?id=${movie.id}`)}
              >
                {/* Poster */}
                <div
                  className="relative rounded-xl overflow-hidden"
                  style={{
                    aspectRatio: "2/3",
                    background: "#1c1c1c",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {movie.poster ? (
                    <img
                      src={movie.poster}
                      alt={displayTitle}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement;
                        el.style.display = "none";
                        const fb = el.nextElementSibling as HTMLElement | null;
                        if (fb) fb.style.display = "flex";
                      }}
                    />
                  ) : null}

                  {/* Fallback when no poster or image fails */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3"
                    style={{
                      display: movie.poster ? "none" : "flex",
                      background: "linear-gradient(135deg, #1a1a1a 0%, #2a1515 100%)",
                    }}
                  >
                    <Film className="w-8 h-8 shrink-0" style={{ color: "#dc2626", opacity: 0.6 }} />
                    <p
                      className="text-center leading-snug line-clamp-4 font-medium text-xs"
                      style={{ color: "rgba(255,255,255,0.7)" }}
                    >
                      {displayTitle}
                    </p>
                  </div>

                  {/* SERIES / MOVIE badge */}
                  <div
                    className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold text-white tracking-wide"
                    style={{
                      background: series ? "#7c3aed" : "#dc2626",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                    }}
                  >
                    {series ? "SERIES" : "MOVIE"}
                  </div>
                </div>

                {/* Title + Year below poster */}
                <div className="mt-2 px-0.5">
                  <p
                    className="text-sm font-semibold leading-snug line-clamp-2"
                    style={{ color: "rgba(255,255,255,0.92)" }}
                  >
                    {displayTitle}
                  </p>
                  {year && (
                    <p
                      className="text-xs mt-0.5 font-medium"
                      style={{ color: "rgba(255,255,255,0.38)" }}
                    >
                      ({year})
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
