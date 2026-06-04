import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { PosterCard } from "@/components/poster-card";
import { useSearchContent } from "@workspace/api-client-react";

export default function Search() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query) {
        window.history.replaceState(null, "", `/search?q=${encodeURIComponent(query)}`);
      } else {
        window.history.replaceState(null, "", `/search`);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useSearchContent(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 2 } }
  );

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto min-h-screen">
      <div className="mb-12">
        <h1 className="text-4xl font-serif font-bold mb-6">Search</h1>
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input 
            placeholder="Search for movies, shows, or actors..." 
            className="w-full pl-12 h-14 bg-black/40 backdrop-blur-md border-white/10 text-lg rounded-full focus-visible:ring-primary focus-visible:border-primary shadow-2xl"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {isLoading && debouncedQuery.length > 2 && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      )}

      {!isLoading && data?.results && data.results.length > 0 && (
        <div className="space-y-6">
          <p className="text-muted-foreground">
            Found {data.totalResults} results for <span className="text-white font-medium">"{debouncedQuery}"</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {data.results.map((result, i) => (
              <motion.div
                key={`${result.imdbId}-${i}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.5) }}
              >
                <PosterCard {...result} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && debouncedQuery.length > 2 && data?.results?.length === 0 && (
        <div className="text-center py-20">
          <p className="text-xl text-muted-foreground">No results found for "{debouncedQuery}"</p>
        </div>
      )}

      {debouncedQuery.length <= 2 && (
        <div className="text-center py-20 opacity-50">
          <SearchIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-xl font-serif">Type at least 3 characters to search</p>
        </div>
      )}
    </div>
  );
}
