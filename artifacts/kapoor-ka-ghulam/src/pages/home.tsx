import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon, Menu, Clapperboard } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "@/lib/api-base";

const TELEGRAM_CHANNEL = "https://t.me/dbxixjdb";

interface TelegramMovie {
  id: string;
  title: string;
  poster: string;
  audio: string;
  qualities: { quality: string; url: string }[];
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
  const allMovies = data?.movies ?? [];
  const filtered = useMemo(() => applyFilter(allMovies, cat, search), [allMovies, cat, search]);

  return (
    <div className="min-h-screen pb-24" style={{ background: "#111111" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "#dc2626" }}
          >
            <Clapperboard className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-extrabold text-xl tracking-wide">
            Stream<span style={{ color: "#dc2626" }}>Vault</span>
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
          placeholder="Search movies..."
          className="flex-1 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none"
          style={{
            background: "#1e1e1e",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        />
        <button
          className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "#dc2626" }}
          onClick={() => {}}
        >
          <SearchIcon className="w-4 h-4 text-white" />
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
              border: cat === c ? "1px solid #dc2626" : "1px solid rgba(255,255,255,0.22)",
              color: cat === c ? "#fff" : "rgba(255,255,255,0.7)",
            }}
          >
            {c}
          </button>
        ))}
        <a
          href={TELEGRAM_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-4 py-1.5 rounded-full text-sm font-medium"
          style={{
            border: "1px solid rgba(255,255,255,0.22)",
            color: "rgba(255,255,255,0.7)",
          }}
        >
          Join Telegram ✈️
        </a>
      </div>

      {/* ── Latest Releases header ── */}
      <div className="flex items-center gap-2 px-4 mb-4">
        <div className="w-1 h-6 rounded-full" style={{ background: "#dc2626" }} />
        <span className="text-white font-bold text-base">🔥 Latest Releases</span>
      </div>

      {/* ── Movie grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl"
              style={{ aspectRatio: "2/3", background: "#1e1e1e" }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center mt-16 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          No movies found.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4">
          {filtered.map((movie, i) => (
            <motion.div
              key={movie.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.03, 0.4) }}
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
                    <p
                      className="text-xs text-center leading-tight"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {movie.title}
                    </p>
                  </div>
                )}
                {/* SERIES / MOVIE badge */}
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
      )}
    </div>
  );
}
