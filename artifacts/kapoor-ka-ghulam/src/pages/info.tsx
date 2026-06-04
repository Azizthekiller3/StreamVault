import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Plus, Check, Play, Star, Calendar, Clock, ArrowLeft, Tv } from "lucide-react";
import { useGetContentInfo, useGetMeta, useGetEpisodes, useGetStreams, useGetWatchlist, useAddToWatchlist, useRemoveFromWatchlist, getGetMetaQueryKey, getGetEpisodesQueryKey, getGetStreamsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { Link } from "wouter";

export default function Info() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const imdbId = searchParams.get("imdbId");
  const extId = searchParams.get("extId") ? Number(searchParams.get("extId")) : null;
  const link = searchParams.get("link");
  const { toast } = useToast();
  
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  
  const { data: omdbInfo, isLoading: isOmdbLoading } = useGetContentInfo(
    { imdbId: imdbId || "" },
    { query: { enabled: !!imdbId } }
  );

  const { data: metaInfo, isLoading: isMetaLoading } = useGetMeta(
    { extId: extId!, link: link || "" },
    { query: { enabled: !!extId && !!link, queryKey: getGetMetaQueryKey({ extId: extId!, link: link || "" }) } }
  );

  const info = metaInfo || omdbInfo;
  const isLoading = (!!imdbId && isOmdbLoading) || (!!extId && !!link && isMetaLoading);

  const { data: episodesData, isLoading: isEpisodesLoading } = useGetEpisodes(
    { extId: extId!, url: info?.linkList?.[0]?.episodesLink || "" },
    { query: { enabled: !!extId && !!info?.linkList?.[0]?.episodesLink, queryKey: getGetEpisodesQueryKey({ extId: extId!, url: info?.linkList?.[0]?.episodesLink || "" }) } }
  );

  const watchLink = selectedEpisode || info?.linkList?.[0]?.directLinks?.[0]?.link || link;
  const streamType = selectedEpisode ? "tv" : (info?.type || "movie");

  const { data: streams, isLoading: isStreamsLoading } = useGetStreams(
    { extId: extId!, link: watchLink || "", type: streamType },
    { query: { enabled: !!extId && !!watchLink, queryKey: getGetStreamsQueryKey({ extId: extId!, link: watchLink || "", type: streamType }) } }
  );

  const { data: watchlist } = useGetWatchlist();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const watchlistItem = watchlist?.find(i => (imdbId && i.imdbId === imdbId) || (link && i.link === link));
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
          poster: info.image || info.poster || "",
          link: link || `/info?imdbId=${imdbId}`,
          provider: extId ? extId.toString() : "Imdb",
          type: info.type || "movie",
          imdbId: imdbId || info.imdbId || undefined,
          rating: info.rating,
          year: info.year
        }
      });
      toast({ title: "Added to watchlist" });
    }
  };

  const handleWatchStream = (stream: any) => {
    if (!stream.link) return;
    const url = new URL("/watch", window.location.origin);
    url.searchParams.set("src", stream.link);
    url.searchParams.set("title", info?.title || "Unknown");
    url.searchParams.set("poster", info?.image || info?.poster || "");
    if (extId) url.searchParams.set("extId", extId.toString());
    if (link) url.searchParams.set("link", link);
    url.searchParams.set("type", streamType);
    
    if (selectedEpisode && episodesData) {
      const ep = episodesData.find(e => e.link === selectedEpisode);
      if (ep) url.searchParams.set("episodeTitle", ep.title);
    }
    
    setLocation(url.pathname + url.search);
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

  const displayPoster = info.image || info.poster;

  return (
    <div className="min-h-screen relative pb-24">
      <div className="absolute top-6 left-6 z-50">
        <Button variant="ghost" size="icon" className="rounded-full bg-black/40 backdrop-blur hover:bg-black/60 text-white" onClick={() => window.history.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      <div className="absolute inset-0 h-[80vh] w-full bg-black overflow-hidden -z-10">
        {displayPoster && displayPoster !== "N/A" ? (
          <>
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 scale-105 blur-md"
              style={{ backgroundImage: `url(${displayPoster})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background" />
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 pt-32 pb-12 flex flex-col md:flex-row gap-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-none w-64 md:w-80"
        >
          <div className="rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl bg-black aspect-[2/3]">
            <ImageWithFallback src={displayPoster} alt={info.title} fallbackText={info.title} className="w-full h-full object-cover" />
          </div>
        </motion.div>

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
              {info.rating && info.rating !== "N/A" && <span className="flex items-center gap-1 text-yellow-500"><Star className="w-4 h-4 fill-yellow-500" /> {info.rating}</span>}
              {info.type && <Badge variant="outline" className="uppercase tracking-widest bg-white/5">{info.type}</Badge>}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-4">
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

          {(info.synopsis || info.plot) && (
            <div className="pt-6 border-t border-white/10">
              <h3 className="text-lg font-serif font-semibold text-white mb-2">Plot</h3>
              <p className="text-muted-foreground leading-relaxed text-lg">{info.synopsis || info.plot}</p>
            </div>
          )}
          
          {info.cast && info.cast.length > 0 && (
             <div className="pt-4">
              <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-1">Cast</h3>
              <p className="text-white">{info.cast.join(", ")}</p>
             </div>
          )}

          {/* Episode List */}
          {episodesData && episodesData.length > 0 && (
            <div className="pt-8 border-t border-white/10">
              <h3 className="text-2xl font-serif font-semibold text-white mb-4 flex items-center gap-2">
                <Tv className="w-6 h-6" /> Episodes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {episodesData.map((ep: any) => (
                  <Button
                    key={ep.link}
                    variant={selectedEpisode === ep.link ? "default" : "outline"}
                    className="justify-start truncate"
                    onClick={() => setSelectedEpisode(ep.link)}
                  >
                    {ep.title}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Streams */}
          {extId && (
            <div className="pt-8 border-t border-white/10">
              <h3 className="text-2xl font-serif font-semibold text-white mb-4">Streams</h3>
              {isStreamsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Finding streams...</div>
              ) : streams && streams.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {streams.map((stream: any, idx: number) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{stream.server}</div>
                        <div className="text-xs text-muted-foreground">{stream.quality || "Unknown Quality"}</div>
                      </div>
                      <Button onClick={() => handleWatchStream(stream)} size="sm" className="rounded-full">
                        <Play className="w-4 h-4 mr-1 fill-current" /> Watch
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No streams available for this content.</p>
              )}
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
}
