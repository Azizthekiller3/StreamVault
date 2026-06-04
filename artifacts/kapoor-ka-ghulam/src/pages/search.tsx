import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useSearchContent } from "@workspace/api-client-react";
import { ImageWithFallback } from "@/components/image-with-fallback";

export default function Search() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useSearchContent(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 2, queryKey: ["searchContent", debouncedQuery] } }
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky search bar */}
      <div className="sticky top-0 z-20 px-4 py-3 bg-black/80 backdrop-blur-md border-b border-white/5">
        <h1 className="text-lg font-bold text-white mb-3">Search</h1>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, shows..."
            className="w-full bg-white/10 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-primary/60"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {/* Loading */}
        {isLoading && debouncedQuery.length > 2 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        )}

        {/* Results */}
        {!isLoading && data?.results && data.results.length > 0 && (
          <>
            <p className="text-white/40 text-xs mb-3">
              {data.totalResults} results for <span className="text-white/70">"{debouncedQuery}"</span>
            </p>
            <div className="grid grid-cols-3 gap-3">
              {data.results.map((result: any, i: number) => (
                <motion.div
                  key={`${result.imdbId}-${i}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                  className="cursor-pointer"
                  onClick={() => setLocation(`/info?imdbId=${result.imdbId}`)}
                  data-testid={`search-result-${i}`}
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/5">
                    <ImageWithFallback
                      src={result.poster}
                      alt={result.title}
                      fallbackText={result.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[11px] text-white/60 mt-1 line-clamp-1">{result.title}</p>
                  {result.year && <p className="text-[10px] text-white/30">{result.year}</p>}
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* No results */}
        {!isLoading && debouncedQuery.length > 2 && data?.results?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <SearchIcon className="w-12 h-12 text-white/20 mb-4" />
            <p className="text-white font-semibold">No results found</p>
            <p className="text-white/40 text-sm mt-1">Try a different title or keyword.</p>
          </div>
        )}

        {/* Empty state */}
        {debouncedQuery.length <= 2 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <SearchIcon className="w-12 h-12 text-white/20 mb-4" />
            <p className="text-white/60 text-sm">Type at least 3 characters to search OMDB</p>
          </div>
        )}
      </div>
    </div>
  );
}
