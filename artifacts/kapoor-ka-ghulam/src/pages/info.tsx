import { useParams } from "wouter";
import { Loader2, Plus, Check, Play, Star, Calendar, Clock, Globe } from "lucide-react";
import { useGetContentInfo, useGetWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

export default function Info() {
  const { imdbId } = useParams();
  const { toast } = useToast();
  
  const { data: info, isLoading } = useGetContentInfo(
    { imdbId: imdbId || "" },
    { query: { enabled: !!imdbId } }
  );

  const { data: watchlist } = useGetWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const watchlistItem = watchlist?.find(i => i.imdbId === imdbId);
  const isInWatchlist = !!watchlistItem;

  const handleWatchlistToggle = async () => {
    if (!info) return;

    if (isInWatchlist && watchlistItem) {
      await removeFromWatchlist.mutateAsync({ id: watchlistItem.id });
      toast({ title: "Removed from watchlist" });
    } else {
      await addToWatchlist.mutateAsync({
        data: {
          title: info.title,
          poster: info.poster,
          link: `/info/${info.imdbId}`,
          provider: "Imdb",
          type: info.type,
          imdbId: info.imdbId,
          rating: info.rating,
          year: info.year
        }
      });
      toast({ title: "Added to watchlist" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!info) {
    return <div className="p-12 text-center text-muted-foreground">Failed to load info.</div>;
  }

  return (
    <div className="min-h-screen relative pb-24">
      {/* Cinematic Backdrop */}
      <div className="absolute inset-0 h-[80vh] w-full bg-black overflow-hidden -z-10">
        {info.poster && info.poster !== "N/A" ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 scale-105 blur-sm"
              style={{ backgroundImage: `url(${info.poster})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background" />
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 pt-32 pb-12 flex flex-col md:flex-row gap-12 relative z-10">
        
        {/* Poster */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-none w-64 md:w-80"
        >
          <div className="rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl bg-black">
            {info.poster && info.poster !== "N/A" ? (
              <img src={info.poster} alt={info.title} className="w-full aspect-[2/3] object-cover" />
            ) : (
              <div className="w-full aspect-[2/3] flex items-center justify-center bg-zinc-900 text-muted-foreground">
                No Poster
              </div>
            )}
          </div>
        </motion.div>

        {/* Details */}
        <motion.div 
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 space-y-6"
        >
          <div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-2 leading-tight">
              {info.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-sm font-mono text-secondary/80">
              {info.year && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {info.year}</span>}
              {info.runtime && info.runtime !== "N/A" && <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {info.runtime}</span>}
              {info.rating && info.rating !== "N/A" && <span className="flex items-center gap-1 text-yellow-500"><Star className="w-4 h-4 fill-yellow-500" /> {info.rating}</span>}
              {info.country && info.country !== "N/A" && <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> {info.country}</span>}
              <Badge variant="outline" className="uppercase tracking-widest bg-white/5">{info.type}</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
            <Button size="lg" className="rounded-full px-8 gap-2 bg-primary hover:bg-primary/90 text-white shadow-[0_0_40px_-10px_var(--primary)]">
              <Play className="w-5 h-5 fill-current" /> Watch Now
            </Button>
            
            <Button 
              size="lg" 
              variant="outline" 
              className="rounded-full px-6 gap-2 bg-black/40 backdrop-blur-md border-white/20 hover:bg-white/10"
              onClick={handleWatchlistToggle}
              disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
            >
              {isInWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {isInWatchlist ? "In Watchlist" : "Add to Watchlist"}
            </Button>
          </div>

          <div className="space-y-6 pt-6 border-t border-white/10">
            <div>
              <h3 className="text-lg font-serif font-semibold text-white mb-2">Plot</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">{info.plot}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {info.genre && info.genre !== "N/A" && (
                <div>
                  <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-1">Genre</h3>
                  <p className="text-white">{info.genre}</p>
                </div>
              )}
              
              {info.actors && info.actors !== "N/A" && (
                <div>
                  <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-1">Cast</h3>
                  <p className="text-white">{info.actors}</p>
                </div>
              )}
              
              {info.director && info.director !== "N/A" && (
                <div>
                  <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-1">Director</h3>
                  <p className="text-white">{info.director}</p>
                </div>
              )}
              
              {info.language && info.language !== "N/A" && (
                <div>
                  <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-1">Language</h3>
                  <p className="text-white">{info.language}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
