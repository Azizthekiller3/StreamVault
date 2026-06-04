import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Search as SearchIcon, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PosterCard } from "@/components/poster-card";
import { useGetHistory, useGetWatchlist } from "@workspace/api-client-react";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const { data: history } = useGetHistory();
  const { data: watchlist } = useGetWatchlist();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const heroItem = history?.[0] || watchlist?.[0];

  return (
    <div className="pb-24">
      {/* Hero Section */}
      <div className="relative h-[60vh] min-h-[400px] w-full bg-black flex items-end">
        {heroItem?.poster && heroItem.poster !== "N/A" ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
              style={{ backgroundImage: `url(${heroItem.poster})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background" />
        )}

        <div className="relative z-10 w-full p-6 md:p-12 max-w-5xl">
          <form onSubmit={handleSearch} className="mb-12 max-w-xl relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input 
              placeholder="Search for movies, shows, or actors..." 
              className="w-full pl-12 h-14 bg-black/40 backdrop-blur-md border-white/10 text-lg rounded-full focus-visible:ring-primary focus-visible:border-primary shadow-2xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          {heroItem && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 text-primary border border-primary/20 rounded-full text-xs font-bold tracking-widest uppercase mb-4">
                Recently {history?.[0] ? "Watched" : "Added"}
              </div>
              <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4 leading-tight">
                {heroItem.title}
              </h1>
              <div className="flex gap-4">
                {heroItem.imdbId && (
                  <Link href={`/info/${heroItem.imdbId}`}>
                    <Button size="lg" className="rounded-full px-8 text-base">
                      More Info
                    </Button>
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="p-6 md:p-12 space-y-16">
        {/* Continue Watching */}
        {history && history.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold tracking-tight">Continue Watching</h2>
              <Link href="/history">
                <Button variant="link" className="text-muted-foreground hover:text-primary p-0">
                  View all <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
              {history.slice(0, 10).map((item, i) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex-none w-[160px] md:w-[200px] snap-start"
                >
                  <PosterCard {...item} />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Watchlist */}
        {watchlist && watchlist.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold tracking-tight">Your Watchlist</h2>
              <Link href="/watchlist">
                <Button variant="link" className="text-muted-foreground hover:text-primary p-0">
                  View all <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
              {watchlist.slice(0, 10).map((item, i) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex-none w-[160px] md:w-[200px] snap-start"
                >
                  <PosterCard {...item} />
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
