import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search as SearchIcon, ChevronRight, Play } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PosterCard } from "@/components/poster-card";
import { useGetHistory, useGetWatchlist, useGetCatalog, getGetCatalogQueryKey } from "@workspace/api-client-react";
import { useActiveExtension } from "@/hooks/use-active-extension";
import { ImageWithFallback } from "@/components/image-with-fallback";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const { data: history } = useGetHistory();
  const { data: watchlist } = useGetWatchlist();
  
  const { activeExtId, activeExtension, isLoading: isExtLoading } = useActiveExtension();

  const { data: catalogResponse, isLoading: isCatalogLoading } = useGetCatalog(
    { extId: activeExtId! },
    { query: { enabled: !!activeExtId, queryKey: getGetCatalogQueryKey({ extId: activeExtId! }) } }
  );

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
      <div className="relative h-[70vh] min-h-[500px] w-full bg-black flex items-end">
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
              <h1 className="text-4xl md:text-7xl font-serif font-bold text-white mb-4 leading-tight drop-shadow-lg">
                {heroItem.title}
              </h1>
              <div className="flex gap-4">
                {heroItem.imdbId ? (
                  <Link href={`/info?imdbId=${heroItem.imdbId}`}>
                    <Button size="lg" className="rounded-full px-8 text-base bg-white text-black hover:bg-white/90">
                      <Play className="w-5 h-5 mr-2 fill-current" /> More Info
                    </Button>
                  </Link>
                ) : heroItem.link && activeExtId ? (
                  <Link href={`/info?extId=${activeExtId}&link=${encodeURIComponent(heroItem.link)}`}>
                    <Button size="lg" className="rounded-full px-8 text-base bg-white text-black hover:bg-white/90">
                      <Play className="w-5 h-5 mr-2 fill-current" /> More Info
                    </Button>
                  </Link>
                ) : null}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="p-6 md:p-12 space-y-16">
        
        {!isExtLoading && !activeExtId && (
          <div className="bg-card border border-border p-8 rounded-2xl text-center max-w-2xl mx-auto my-12">
            <h2 className="text-2xl font-serif font-bold mb-4">Welcome to Kapoor Ka Ghulam</h2>
            <p className="text-muted-foreground mb-8">
              To start streaming, you need to install a provider extension and set it as active.
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/marketplace">
                <Button size="lg">Go to Marketplace</Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" size="lg">Open Settings</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Catalog Rows */}
        {activeExtId && catalogResponse?.catalogs && catalogResponse.catalogs.map((catalog, idx) => (
          <section key={`${catalog.title}-${idx}`}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-serif font-bold tracking-tight">{catalog.title}</h2>
              <Link href={`/browse?extId=${activeExtId}&filter=${encodeURIComponent(catalog.filter || "")}&title=${encodeURIComponent(catalog.title)}`}>
                <Button variant="link" className="text-muted-foreground hover:text-primary p-0">
                  View all <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            
            {catalog.posts && catalog.posts.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-6 snap-x -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
                {catalog.posts.map((post, i) => (
                  <motion.div 
                    key={`${post.link}-${i}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex-none w-[160px] md:w-[200px] snap-start cursor-pointer group"
                    onClick={() => setLocation(`/info?extId=${activeExtId}&link=${encodeURIComponent(post.link)}`)}
                  >
                    <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-muted ring-1 ring-white/10 group-hover:ring-primary/50 transition-all duration-300">
                      <ImageWithFallback 
                        src={post.image} 
                        alt={post.title} 
                        fallbackText={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 group-hover:opacity-60" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <h3 className="font-serif text-sm font-bold text-white leading-tight line-clamp-2">{post.title}</h3>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center bg-white/5 rounded-xl border border-white/5">
                <p className="text-muted-foreground text-sm">No items found</p>
              </div>
            )}
          </section>
        ))}

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

      </div>
    </div>
  );
}
