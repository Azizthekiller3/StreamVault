import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search as SearchIcon, Play } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useGetHistory, useGetWatchlist, useGetCatalog, useGetPosts, getGetCatalogQueryKey, getGetPostsQueryKey } from "@workspace/api-client-react";
import { useActiveExtension } from "@/hooks/use-active-extension";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { ProviderSelector } from "@/components/provider-selector";

import { API_BASE } from "@/lib/api-base";

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
        <button
          onClick={() => setLocation(`/browse?extId=${extId}&filter=${encodeURIComponent(filter)}&title=${encodeURIComponent(title)}`)}
          className="text-white/50 text-sm hover:text-white transition-colors"
          data-testid={`link-more-${title.toLowerCase().replace(/\s+/g, "-")}`}
        >
          more
        </button>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-3 pl-4 pr-4 scrollbar-hide snap-x">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="flex-none w-[110px] aspect-[2/3] rounded-md bg-white/10" />
            ))
          : posts?.slice(0, 12).map((post, i) => (
              <motion.div
                key={`${post.link}-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex-none w-[110px] snap-start cursor-pointer"
                onClick={() => setLocation(`/info?extId=${extId}&link=${encodeURIComponent(post.link)}`)}
                data-testid={`poster-card-${i}`}
              >
                <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5">
                  <ImageWithFallback
                    src={post.image}
                    alt={post.title}
                    fallbackText={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-[11px] text-white/70 mt-1 line-clamp-1 leading-tight">{post.title}</p>
              </motion.div>
            ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div className="bg-background min-h-screen pb-4">
      {/* Fixed top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md border-b border-white/5">
        <h1 className="text-lg font-bold text-white tracking-tight">FlixNest</h1>
        <ProviderSelector />
      </div>

      {/* Hero */}
      <div className="relative w-full bg-black" style={{ height: "52vw", minHeight: 200, maxHeight: 320 }}>
        {heroItem?.poster && heroItem.poster !== "N/A" ? (
          <>
            <img
              src={heroItem.poster}
              alt={heroItem.title}
              className="absolute inset-0 w-full h-full object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-black" />
        )}

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          {heroItem && (
            <>
              <p className="text-white text-xl font-bold drop-shadow mb-2 line-clamp-2 leading-tight">
                {heroItem.title}
              </p>
              <button
                className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-lg font-bold text-sm shadow-lg hover:bg-white/90 transition-colors"
                onClick={() => {
                  if (heroItem.imdbId) setLocation(`/info?imdbId=${heroItem.imdbId}`);
                  else if (heroItem.link && activeExtId) setLocation(`/info?extId=${activeExtId}&link=${encodeURIComponent(heroItem.link)}`);
                }}
                data-testid="button-hero-play"
              >
                <Play className="w-4 h-4 fill-black" />
                Play
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="px-4 py-3 relative">
        <SearchIcon className="absolute left-7 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search movies, shows..."
          className="w-full bg-white/10 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-primary/60"
          data-testid="input-search-home"
        />
      </form>

      {/* No extension onboarding */}
      {!isExtLoading && !activeExtId && (
        <div className="mx-4 mt-4 p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
          <p className="text-white font-semibold text-base mb-1">No provider active</p>
          <p className="text-white/50 text-sm mb-4">Install an extension from the Marketplace to start browsing content.</p>
          <Link href="/marketplace">
            <Button size="sm" className="bg-primary text-white">Go to Marketplace</Button>
          </Link>
        </div>
      )}

      {/* FlixNest Channel Movies */}
      <div className="mt-4 space-y-5">
        <section>
          <div className="flex items-center justify-between mb-3 px-4">
            <h2 className="text-base font-bold text-primary uppercase tracking-wide">🎬 Latest Movies</h2>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-3 pl-4 pr-4 scrollbar-hide snap-x">
            {isTelegramLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="flex-none w-[110px] aspect-[2/3] rounded-md bg-white/10" />
                ))
              : telegramData?.movies?.slice(0, 20).map((movie, i) => (
                  <motion.div
                    key={movie.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex-none w-[110px] snap-start cursor-pointer"
                    onClick={() => setLocation(`/telegram-info?id=${movie.id}`)}
                  >
                    <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5">
                      {movie.poster ? (
                        <img src={movie.poster} alt={movie.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 to-black p-2">
                          <p className="text-white text-[10px] text-center leading-tight">{movie.title}</p>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1 pt-4 bg-gradient-to-t from-black/80 to-transparent">
                        <div className="flex gap-1 flex-wrap">
                          {movie.qualities.map((q) => (
                            <span key={q.quality} className="text-[9px] bg-primary/80 text-white px-1 rounded font-bold">{q.quality}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/70 mt-1 line-clamp-1 leading-tight">{movie.title}</p>
                  </motion.div>
                ))}
          </div>
        </section>
      </div>

      {/* Catalog rows */}
      <div className="mt-2 space-y-5">
        {isCatalogLoading && activeExtId && (
          <div className="px-4 space-y-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-32 bg-white/10 rounded mb-2" />
            ))}
          </div>
        )}

        {activeExtId && allCatalogs.map((cat, idx) => (
          <CatalogRow key={`${cat.filter}-${idx}`} extId={activeExtId} filter={cat.filter} title={cat.title} />
        ))}

        {/* Continue Watching */}
        {history && history.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 px-4">
              <h2 className="text-base font-bold text-primary uppercase tracking-wide">Continue Watching</h2>
              <Link href="/history">
                <button className="text-white/50 text-sm hover:text-white transition-colors" data-testid="link-more-history">
                  more
                </button>
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-3 pl-4 pr-4 scrollbar-hide snap-x">
              {history.slice(0, 10).map((item, i) => (
                <motion.div
                  key={item.id}
                  className="flex-none w-[110px] snap-start cursor-pointer"
                  onClick={() => {
                    if (item.imdbId) setLocation(`/info?imdbId=${item.imdbId}`);
                    else if (item.link && activeExtId) setLocation(`/info?extId=${activeExtId}&link=${encodeURIComponent(item.link)}`);
                  }}
                  data-testid={`history-card-${item.id}`}
                >
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
