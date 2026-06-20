import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search as SearchIcon, Play, Heart, Sun, Moon, Send, Star, Clock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useGetHistory, useGetWatchlist, useGetCatalog, useGetPosts, getGetCatalogQueryKey, getGetPostsQueryKey } from "@workspace/api-client-react";
import { useActiveExtension } from "@/hooks/use-active-extension";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { ProviderSelector } from "@/components/provider-selector";
import { API_BASE } from "@/lib/api-base";
import { detectGenres, ALL_GENRES } from "@/lib/genres";
import { isInWatchlist, toggleWatchlist, getRecentlyViewed, clearRecentlyViewed, type RecentlyViewedItem } from "@/lib/flixnest-store";

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

/** Pick the "Movie of the Day" — seeded by day-of-year so it changes daily */
function getMovieOfTheDay(movies: TelegramMovie[]): TelegramMovie | null {
  if (!movies.length) return null;
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return movies[dayOfYear % movies.length] ?? movies[0];
}

/** Extract unique language labels from the audio field */
function extractLanguages(movies: TelegramMovie[]): string[] {
  const langs = new Set<string>();
  for (const m of movies) {
    if (!m.audio) continue;
    m.audio.split(/[,&+\/]/).forEach((l) => {
      const lang = l.trim();
      if (lang) langs.add(lang);
    });
  }
  return Array.from(langs).sort();
}

function CatalogRow({ extId, filter, title }: { extId: number; filter: string; title: string }) {
  const [, setLocation] = useLocation();
  const { data: posts, isLoading } = useGetPosts(
    { extId, filter, page: 1 },
    { query: { queryKey: getGetPostsQueryKey({ extId, filter, page: 1 }) } }
  );
  return (
    <section>
      <div className="flex items-center justify-between mb-3 px-4">
        <h2 className="text-base font-bold text-primary uppercase tracking-wide">{title}</h2>
        <button onClick={() => setLocation(`/browse?extId=${extId}&filter=${encodeURIComponent(filter)}&title=${encodeURIComponent(title)}`)} className="text-white/50 text-sm hover:text-white transition-colors">more</button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-3 pl-4 pr-4 scrollbar-hide snap-x">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="flex-none w-[110px] aspect-[2/3] rounded-md bg-white/10" />)
          : posts?.slice(0, 12).map((post, i) => (
              <motion.div key={`${post.link}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className="flex-none w-[110px] snap-start cursor-pointer" onClick={() => setLocation(`/info?extId=${extId}&link=${encodeURIComponent(post.link)}`)}>
                <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5">
                  <ImageWithFallback src={post.image} alt={post.title} fallbackText={post.title} className="w-full h-full object-cover" />
                </div>
                <p className="text-[11px] text-white/70 mt-1 line-clamp-1 leading-tight">{post.title}</p>
              </motion.div>
            ))}
      </div>
    </section>
  );
}

function MovieCard({ movie, index, isNew, onWatchlistChange }: { movie: TelegramMovie; index: number; isNew: boolean; onWatchlistChange: () => void }) {
  const [, setLocation] = useLocation();
  const [saved, setSaved] = useState(() => isInWatchlist(movie.id));
  const genres = detectGenres(movie.title);
  const handleWatchlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    const added = toggleWatchlist({ id: movie.id, title: movie.title, poster: movie.poster });
    setSaved(added);
    onWatchlistChange();
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.02 }}
      className="cursor-pointer" onClick={() => setLocation(`/telegram-info?id=${movie.id}`)}>
      <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5">
        {movie.poster
          ? <img src={movie.poster} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-black p-2"><p className="text-white text-[10px] text-center leading-tight">{movie.title}</p></div>}
        {isNew && <div className="absolute top-1 left-1 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">NEW</div>}
        <button onClick={handleWatchlist} className="absolute top-1 right-1 p-1 rounded-full bg-black/50">
          <Heart className={`w-3 h-3 ${saved ? "fill-red-500 text-red-500" : "text-white/70"}`} />
        </button>
        {genres.length > 0 && (
          <div className="absolute top-6 left-1 flex flex-col gap-0.5">
            {genres.map((g) => <span key={g.genre} className="text-[7px] bg-black/70 text-white/90 px-1 rounded font-medium">{g.emoji}</span>)}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 px-1 pb-1 pt-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex gap-0.5 flex-wrap">
            {movie.qualities.map((q) => <span key={q.quality} className="text-[8px] bg-primary/80 text-white px-0.5 rounded font-bold">{q.quality}</span>)}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-white/70 mt-1 line-clamp-2 leading-tight">{movie.title}</p>
    </motion.div>
  );
}

function MovieOfTheDay({ movie }: { movie: TelegramMovie }) {
  const [, setLocation] = useLocation();
  return (
    <div className="mx-4 mb-5 rounded-2xl overflow-hidden relative cursor-pointer border border-yellow-500/20"
      onClick={() => setLocation(`/telegram-info?id=${movie.id}`)}>
      <div className="relative h-40">
        {movie.poster
          ? <img src={movie.poster} alt={movie.title} className="absolute inset-0 w-full h-full object-cover object-top" />
          : <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/40 to-black" />}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center px-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest">Movie of the Day</span>
          </div>
          <h3 className="text-white font-bold text-base leading-snug line-clamp-2 max-w-[65%]">{movie.title}</h3>
          {movie.audio && <p className="text-white/50 text-xs mt-1">🎵 {movie.audio}</p>}
          <div className="flex gap-1 mt-2 flex-wrap">
            {movie.qualities.map((q) => (
              <span key={q.quality} className="text-[9px] bg-primary/80 text-white px-1.5 py-0.5 rounded font-bold">{q.quality}</span>
            ))}
          </div>
        </div>
        {movie.poster && (
          <img src={movie.poster} alt="" className="absolute right-0 top-0 h-full w-28 object-cover object-top opacity-60" style={{ maskImage: "linear-gradient(to left, black 60%, transparent)" }} />
        )}
      </div>
    </div>
  );
}

function RecentlyViewedRow({ items, onClear }: { items: RecentlyViewedItem[]; onClear: () => void }) {
  const [, setLocation] = useLocation();
  if (!items.length) return null;
  return (
    <section className="mt-4">
      <div className="flex items-center justify-between mb-2 px-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="text-base font-bold text-primary uppercase tracking-wide">Recently Viewed</h2>
        </div>
        <button onClick={onClear} className="text-white/30 text-xs hover:text-white/60 flex items-center gap-1">
          <X className="w-3 h-3" /> Clear
        </button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-3 pl-4 pr-4 scrollbar-hide snap-x">
        {items.map((item, i) => (
          <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
            className="flex-none w-[90px] snap-start cursor-pointer" onClick={() => setLocation(`/telegram-info?id=${item.id}`)}>
            <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5">
              {item.poster
                ? <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-black p-1"><p className="text-white text-[9px] text-center leading-tight">{item.title}</p></div>}
              <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-md" />
            </div>
            <p className="text-[10px] text-white/60 mt-1 line-clamp-1 leading-tight">{item.title}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [telegramSearch, setTelegramSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isDark, setIsDark] = useState(() => !document.documentElement.classList.contains("light"));
  const [watchlistTick, setWatchlistTick] = useState(0);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>(() => getRecentlyViewed());
  const [, setLocation] = useLocation();

  const { data: history } = useGetHistory();
  const { data: watchlist } = useGetWatchlist();
  const { activeExtId, isLoading: isExtLoading } = useActiveExtension();
  const { data: telegramData, isLoading: isTelegramLoading } = useTelegramMovies();

  const { data: catalogResponse, isLoading: isCatalogLoading } = useGetCatalog(
    { extId: activeExtId! },
    { query: { enabled: !!activeExtId, queryKey: getGetCatalogQueryKey({ extId: activeExtId! }) } }
  );

  const heroItem = history?.[0] || watchlist?.[0];
  const allCatalogs = catalogResponse?.catalog ?? [];
  const allMovies = telegramData?.movies ?? [];
  const maxMsgId = Math.max(...allMovies.map((m) => parseInt(m.id) || 0), 0);
  const movieOfTheDay = useMemo(() => getMovieOfTheDay(allMovies), [allMovies]);
  const availableLanguages = useMemo(() => extractLanguages(allMovies), [allMovies]);

  const handleThemeToggle = () => {
    const html = document.documentElement;
    if (isDark) { html.classList.replace("dark", "light"); localStorage.setItem("flixnest_theme", "light"); setIsDark(false); }
    else { html.classList.replace("light", "dark"); localStorage.setItem("flixnest_theme", "dark"); setIsDark(true); }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleClearRecent = () => {
    clearRecentlyViewed();
    setRecentlyViewed([]);
  };

  // Refresh recently viewed on focus
  useEffect(() => {
    const refresh = () => setRecentlyViewed(getRecentlyViewed());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  // Filter pipeline
  let filtered = allMovies;
  if (telegramSearch.trim()) filtered = filtered.filter((m) => m.title.toLowerCase().includes(telegramSearch.toLowerCase()));
  if (activeGenre) filtered = filtered.filter((m) => detectGenres(m.title).some((g) => g.genre === activeGenre));
  if (activeLanguage) filtered = filtered.filter((m) => m.audio?.toLowerCase().includes(activeLanguage.toLowerCase()));

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;
  const availableGenres = ALL_GENRES.filter((g) => allMovies.some((m) => detectGenres(m.title).some((dg) => dg.genre === g.genre)));
  const isSearchActive = telegramSearch.trim() || activeGenre || activeLanguage;

  return (
    <div className="bg-background min-h-screen pb-4">
      {/* Fixed top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md border-b border-white/5">
        <h1 className="text-lg font-bold text-white tracking-tight">FlixNest</h1>
        <div className="flex items-center gap-2">
          <a href={TELEGRAM_CHANNEL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-semibold hover:bg-blue-500/30 transition-colors">
            <Send className="w-3.5 h-3.5" /> Join
          </a>
          <button onClick={handleThemeToggle} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            {isDark ? <Sun className="w-4 h-4 text-white/70" /> : <Moon className="w-4 h-4 text-white/70" />}
          </button>
          <ProviderSelector />
        </div>
      </div>

      {/* Hero */}
      <div className="relative w-full bg-black" style={{ height: "52vw", minHeight: 200, maxHeight: 320 }}>
        {heroItem?.poster && heroItem.poster !== "N/A" ? (
          <><img src={heroItem.poster} alt={heroItem.title} className="absolute inset-0 w-full h-full object-cover opacity-50" /><div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" /></>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-black" />
        )}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          {heroItem && (
            <>
              <p className="text-white text-xl font-bold drop-shadow mb-2 line-clamp-2 leading-tight">{heroItem.title}</p>
              <button className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-lg font-bold text-sm shadow-lg hover:bg-white/90 transition-colors"
                onClick={() => { if (heroItem.imdbId) setLocation(`/info?imdbId=${heroItem.imdbId}`); else if (heroItem.link && activeExtId) setLocation(`/info?extId=${activeExtId}&link=${encodeURIComponent(heroItem.link)}`); }}>
                <Play className="w-4 h-4 fill-black" /> Play
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="px-4 py-3 relative">
        <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search movies, shows..."
          className="w-full bg-white/10 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-primary/60" />
      </form>

      {/* No extension onboarding */}
      {!isExtLoading && !activeExtId && (
        <div className="mx-4 mt-4 p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
          <p className="text-white font-semibold text-base mb-1">No provider active</p>
          <p className="text-white/50 text-sm mb-4">Install an extension from the Marketplace to start browsing content.</p>
          <Link href="/marketplace"><Button size="sm" className="bg-primary text-white">Go to Marketplace</Button></Link>
        </div>
      )}

      {/* Movie of the Day */}
      {!isTelegramLoading && movieOfTheDay && !isSearchActive && (
        <div className="mt-4">
          <MovieOfTheDay movie={movieOfTheDay} />
        </div>
      )}

      {/* Recently Viewed */}
      {!isSearchActive && (
        <RecentlyViewedRow items={recentlyViewed} onClear={handleClearRecent} />
      )}

      {/* FlixNest Channel Movies */}
      <div className="mt-4 space-y-3">
        <section>
          {/* Section header + inline search */}
          <div className="flex items-center gap-2 mb-2 px-4">
            <h2 className="text-base font-bold text-primary uppercase tracking-wide shrink-0">🎬 Movies</h2>
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 w-3.5 h-3.5" />
              <input value={telegramSearch} onChange={(e) => { setTelegramSearch(e.target.value); setVisibleCount(20); }} placeholder="Filter movies..."
                className="w-full bg-white/10 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-primary/60" />
              {telegramSearch && (
                <button onClick={() => setTelegramSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs">✕</button>
              )}
            </div>
          </div>

          {/* Genre Filter Chips */}
          {availableGenres.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 px-4 scrollbar-hide mb-1">
              <button onClick={() => { setActiveGenre(null); setVisibleCount(20); }}
                className={`flex-none px-3 py-1 rounded-full text-xs font-semibold border transition-all ${!activeGenre ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}>
                All
              </button>
              {availableGenres.map((g) => (
                <button key={g.genre} onClick={() => { setActiveGenre(activeGenre === g.genre ? null : g.genre); setVisibleCount(20); }}
                  className={`flex-none px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeGenre === g.genre ? "bg-primary border-primary text-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}>
                  {g.emoji} {g.genre}
                </button>
              ))}
            </div>
          )}

          {/* Language Filter Chips */}
          {availableLanguages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 px-4 scrollbar-hide mb-3">
              <span className="flex-none text-white/30 text-[10px] self-center font-medium">Audio:</span>
              <button onClick={() => { setActiveLanguage(null); setVisibleCount(20); }}
                className={`flex-none px-3 py-1 rounded-full text-xs font-semibold border transition-all ${!activeLanguage ? "bg-blue-500/80 border-blue-500 text-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}>
                All
              </button>
              {availableLanguages.map((lang) => (
                <button key={lang} onClick={() => { setActiveLanguage(activeLanguage === lang ? null : lang); setVisibleCount(20); }}
                  className={`flex-none px-3 py-1 rounded-full text-xs font-semibold border transition-all ${activeLanguage === lang ? "bg-blue-500/80 border-blue-500 text-white" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}>
                  🎵 {lang}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {isTelegramLoading && (
            <div className="grid grid-cols-3 gap-2 px-4 pb-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-md bg-white/10" />)}
            </div>
          )}

          {/* No results */}
          {!isTelegramLoading && isSearchActive && filtered.length === 0 && (
            <p className="px-4 text-white/40 text-sm py-4">No movies found. Try a different search or filter.</p>
          )}

          {/* Default horizontal scroll when no filter active */}
          {!isTelegramLoading && !isSearchActive && (
            <div className="flex gap-2.5 overflow-x-auto pb-3 pl-4 pr-4 scrollbar-hide snap-x">
              {allMovies.slice(0, 20).map((movie, i) => (
                <motion.div key={movie.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="flex-none w-[110px] snap-start cursor-pointer relative" onClick={() => setLocation(`/telegram-info?id=${movie.id}`)}>
                  <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5">
                    {movie.poster
                      ? <img src={movie.poster} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-black p-2"><p className="text-white text-[10px] text-center leading-tight">{movie.title}</p></div>}
                    {i < 8 && <div className="absolute top-1 left-1 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">NEW</div>}
                    <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1 pt-4 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="flex gap-1 flex-wrap">
                        {movie.qualities.map((q) => <span key={q.quality} className="text-[9px] bg-primary/80 text-white px-1 rounded font-bold">{q.quality}</span>)}
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/70 mt-1 line-clamp-1 leading-tight">{movie.title}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* Filtered grid */}
          {!isTelegramLoading && isSearchActive && filtered.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                {visible.map((movie, i) => (
                  <MovieCard key={movie.id} movie={movie} index={i} isNew={parseInt(movie.id) > maxMsgId - 50} onWatchlistChange={() => setWatchlistTick(t => t + 1)} />
                ))}
              </div>
              {hasMore && (
                <div className="px-4 pb-2">
                  <button onClick={() => setVisibleCount((c) => c + 20)}
                    className="w-full py-2.5 rounded-xl bg-white/10 border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/20 transition-colors">
                    Load More ({filtered.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </>
          )}

          {/* Browse All button */}
          {!isTelegramLoading && !isSearchActive && allMovies.length > 20 && (
            <div className="px-4 pb-2">
              <button onClick={() => { setTelegramSearch(" "); setTimeout(() => setTelegramSearch(""), 0); setVisibleCount(allMovies.length); setActiveGenre(null); }}
                className="w-full py-2.5 rounded-xl bg-white/10 border border-white/10 text-white/70 text-sm font-semibold hover:bg-white/20 transition-colors">
                Browse All {allMovies.length} Movies
              </button>
            </div>
          )}

          {/* Telegram Join Channel Banner */}
          {!isTelegramLoading && allMovies.length > 0 && !isSearchActive && (
            <div className="mx-4 mt-3 mb-1">
              <a href={TELEGRAM_CHANNEL} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-xl hover:bg-blue-500/20 transition-colors">
                <div className="w-9 h-9 bg-blue-500 rounded-full flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm font-semibold">Join our Telegram Channel</p>
                  <p className="text-white/50 text-xs">Get notified when new movies drop</p>
                </div>
                <span className="text-blue-400 text-xs font-bold">JOIN →</span>
              </a>
            </div>
          )}
        </section>
      </div>

      {/* Catalog rows */}
      <div className="mt-2 space-y-5">
        {isCatalogLoading && activeExtId && (
          <div className="px-4 space-y-1">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-32 bg-white/10 rounded mb-2" />)}</div>
        )}
        {activeExtId && allCatalogs.map((cat, idx) => (
          <CatalogRow key={`${cat.filter}-${idx}`} extId={activeExtId} filter={cat.filter} title={cat.title} />
        ))}

        {/* Continue Watching */}
        {history && history.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 px-4">
              <h2 className="text-base font-bold text-primary uppercase tracking-wide">Continue Watching</h2>
              <Link href="/history"><button className="text-white/50 text-sm hover:text-white transition-colors">more</button></Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-3 pl-4 pr-4 scrollbar-hide snap-x">
              {history.slice(0, 10).map((item) => (
                <motion.div key={item.id} className="flex-none w-[110px] snap-start cursor-pointer"
                  onClick={() => { if (item.imdbId) setLocation(`/info?imdbId=${item.imdbId}`); else if (item.link && activeExtId) setLocation(`/info?extId=${activeExtId}&link=${encodeURIComponent(item.link)}`); }}>
                  <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5">
                    <ImageWithFallback src={item.poster} alt={item.title} fallbackText={item.title} className="w-full h-full object-cover" />
                    {item.progress != null && item.duration != null && item.duration > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (item.progress / item.duration) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                  <p className="text-[11px] text-white/70 mt-1 line-clamp-1">{item.title}</p>
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
