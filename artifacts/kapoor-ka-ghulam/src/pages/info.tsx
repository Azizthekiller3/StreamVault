import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Bookmark, MoreVertical, Play, ChevronDown, Download, ArrowLeft } from "lucide-react";
import {
  useGetContentInfo,
  useGetMeta,
  useGetEpisodes,
  useGetStreams,
  useGetWatchlist,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  getGetContentInfoQueryKey,
  getGetMetaQueryKey,
  getGetEpisodesQueryKey,
  getGetStreamsQueryKey,
  getGetWatchlistQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function Info() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const imdbId = searchParams.get("imdbId");
  const extId = searchParams.get("extId") ? Number(searchParams.get("extId")) : null;
  const link = searchParams.get("link");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedLinkIdx, setSelectedLinkIdx] = useState(0);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [serverSheetOpen, setServerSheetOpen] = useState(false);
  const [serverEpisodeLink, setServerEpisodeLink] = useState<string | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);

  // OMDB fetch
  const { data: omdbInfo, isLoading: isOmdbLoading } = useGetContentInfo(
    { imdbId: imdbId || "" },
    { query: { enabled: !!imdbId, queryKey: getGetContentInfoQueryKey({ imdbId: imdbId || "" }) } }
  );

  // Extension meta fetch
  const { data: metaInfo, isLoading: isMetaLoading } = useGetMeta(
    { extId: extId!, link: link || "" },
    { query: { enabled: !!extId && !!link, queryKey: getGetMetaQueryKey({ extId: extId!, link: link || "" }) } }
  );

  const info = metaInfo || omdbInfo;
  const isLoading = (!!imdbId && isOmdbLoading) || (!!extId && !!link && isMetaLoading);

  const linkList = (info as any)?.linkList ?? [];
  const selectedLink = linkList[selectedLinkIdx] ?? null;

  // Episodes for the selected link item
  const episodesUrl = selectedLink?.episodesLink ?? "";
  const { data: episodesData, isLoading: isEpisodesLoading } = useGetEpisodes(
    { extId: extId!, url: episodesUrl },
    { query: { enabled: !!extId && !!episodesUrl, queryKey: getGetEpisodesQueryKey({ extId: extId!, url: episodesUrl }) } }
  );

  // Streams for server sheet
  const streamLink = serverEpisodeLink ?? selectedLink?.directLinks?.[0]?.link ?? link ?? "";
  const streamType = serverEpisodeLink ? "tv" : ((info as any)?.type ?? "movie");
  const { data: streams, isLoading: isStreamsLoading } = useGetStreams(
    { extId: extId!, link: streamLink, type: streamType },
    {
      query: {
        enabled: serverSheetOpen && !!extId && !!streamLink,
        queryKey: getGetStreamsQueryKey({ extId: extId!, link: streamLink, type: streamType }),
      },
    }
  );

  // Watchlist
  const { data: watchlist } = useGetWatchlist();
  const addToWatchlist = useAddToWatchlist({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() }) } });
  const removeFromWatchlist = useRemoveFromWatchlist({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() }) } });

  const watchlistItem = watchlist?.find((i) => (imdbId && i.imdbId === imdbId) || (link && i.link === link));
  const isInWatchlist = !!watchlistItem;

  const handleWatchlistToggle = async () => {
    if (!info) return;
    if (isInWatchlist && watchlistItem) {
      await removeFromWatchlist.mutateAsync({ id: watchlistItem.id });
      toast({ title: "Removed from watchlist" });
    } else {
      await addToWatchlist.mutateAsync({
        data: {
          title: (info as any).title,
          poster: (info as any).image || (info as any).poster || "",
          link: link || `/info?imdbId=${imdbId}`,
          provider: extId ? String(extId) : "OMDB",
          type: (info as any).type || "movie",
          imdbId: imdbId || (info as any).imdbId || undefined,
          rating: (info as any).rating,
          year: (info as any).year,
        },
      });
      toast({ title: "Added to watchlist" });
    }
  };

  const handleOpenServerSheet = (epLink?: string) => {
    setServerEpisodeLink(epLink ?? null);
    setServerSheetOpen(true);
  };

  const handlePlayStream = (stream: any) => {
    if (!stream.link) return;
    const params = new URLSearchParams({
      src: stream.link,
      title: (info as any)?.title ?? "Unknown",
      poster: (info as any)?.image || (info as any)?.poster || "",
      type: streamType,
    });
    if (extId) params.set("extId", String(extId));
    if (link) params.set("link", link);
    if (serverEpisodeLink) params.set("link", serverEpisodeLink);
    setServerSheetOpen(false);
    setLocation(`/watch?${params.toString()}`);
  };

  const displayPoster = (info as any)?.image || (info as any)?.poster;
  const synopsis = (info as any)?.synopsis || (info as any)?.plot || "";
  const providerName = extId ? `ext-${extId}` : "OMDB";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-white/50">Failed to load content info.</p>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen pb-6">
      {/* Hero backdrop */}
      <div className="relative w-full" style={{ height: "55vw", minHeight: 220, maxHeight: 380 }}>
        {displayPoster ? (
          <img
            src={displayPoster}
            alt={(info as any).title}
            className="absolute inset-0 w-full h-full object-cover object-top opacity-70"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Title */}
      <div className="px-4 pt-3 pb-4">
        <h1 className="text-2xl font-bold text-white leading-tight">
          {(info as any).title}
        </h1>
      </div>

      {/* Synopsis card */}
      <div className="mx-4 mb-4 bg-[#1c1c1c] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold text-sm">Synopsis</span>
            {extId && (
              <span className="text-[11px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                {providerName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleWatchlistToggle}
              disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
              className={cn("transition-colors", isInWatchlist ? "text-primary" : "text-white/50 hover:text-white")}
              data-testid="button-watchlist-toggle"
            >
              <Bookmark className={cn("w-5 h-5", isInWatchlist && "fill-primary")} />
            </button>
            <button className="text-white/50 hover:text-white transition-colors" data-testid="button-more-options">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        {synopsis ? (
          <div>
            <p className={cn("text-white/70 text-sm leading-relaxed", !synopsisExpanded && "line-clamp-3")}>
              {synopsis}
            </p>
            {synopsis.length > 150 && (
              <button
                onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                className="text-primary text-xs mt-1 font-medium"
                data-testid="button-synopsis-expand"
              >
                {synopsisExpanded ? "read less" : "read more"}
              </button>
            )}
          </div>
        ) : (
          <p className="text-white/40 text-sm">No synopsis available.</p>
        )}
      </div>

      {/* Quality / Link selector (only for extension content with linkList) */}
      {extId && linkList.length > 0 && (
        <div className="mx-4 mb-4">
          <button
            onClick={() => setQualityOpen(!qualityOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#1c1c1c] rounded-xl text-primary font-semibold text-sm"
            data-testid="button-quality-selector"
          >
            <span className="truncate">{selectedLink?.title ?? "Select Quality"}</span>
            <ChevronDown className={cn("w-4 h-4 shrink-0 transition-transform", qualityOpen && "rotate-180")} />
          </button>

          {qualityOpen && linkList.length > 1 && (
            <div className="bg-[#1c1c1c] mt-1 rounded-xl overflow-hidden border border-white/5">
              {linkList.map((lk: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => { setSelectedLinkIdx(idx); setQualityOpen(false); }}
                  className={cn(
                    "w-full text-left px-4 py-3 text-sm border-b border-white/5 last:border-0 transition-colors",
                    idx === selectedLinkIdx ? "text-primary bg-primary/10" : "text-white/70 hover:bg-white/5"
                  )}
                  data-testid={`quality-option-${idx}`}
                >
                  {lk.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Episodes list */}
      {extId && (
        <div className="mx-4 space-y-2">
          {isEpisodesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : episodesData && episodesData.length > 0 ? (
            episodesData.map((ep: any, i: number) => (
              <div
                key={ep.link}
                className="flex items-center gap-3 bg-[#1c1c1c] rounded-xl px-4 py-3"
                data-testid={`episode-row-${i}`}
              >
                <button
                  onClick={() => handleOpenServerSheet(ep.link)}
                  className="w-9 h-9 shrink-0 bg-primary/20 rounded-full flex items-center justify-center text-primary hover:bg-primary/30 transition-colors"
                  data-testid={`button-play-ep-${i}`}
                >
                  <Play className="w-4 h-4 fill-primary" />
                </button>
                <span className="flex-1 text-white text-sm font-medium truncate">{ep.title}</span>
                <button
                  onClick={() => handleOpenServerSheet(ep.link)}
                  className="w-8 h-8 shrink-0 bg-white/10 rounded-full flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors"
                  data-testid={`button-download-ep-${i}`}
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : selectedLink?.directLinks && selectedLink.directLinks.length > 0 ? (
            // Movie direct links - show play button
            <div className="flex justify-center py-4">
              <button
                onClick={() => handleOpenServerSheet()}
                className="flex items-center gap-3 px-8 py-3 bg-primary rounded-xl text-white font-bold text-base hover:bg-primary/90 transition-colors"
                data-testid="button-play-movie"
              >
                <Play className="w-5 h-5 fill-white" />
                Play
              </button>
            </div>
          ) : !episodesUrl && !selectedLink?.directLinks?.length ? (
            <div className="flex justify-center py-4">
              <button
                onClick={() => handleOpenServerSheet()}
                className="flex items-center gap-3 px-8 py-3 bg-primary rounded-xl text-white font-bold text-base hover:bg-primary/90 transition-colors"
                data-testid="button-play-content"
              >
                <Play className="w-5 h-5 fill-white" />
                Play
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* OMDB-only content (no extension) - show info details */}
      {!extId && (
        <div className="mx-4 space-y-3">
          {(info as any).genre && (
            <div className="flex flex-wrap gap-2">
              {(info as any).genre.split(", ").map((g: string) => (
                <span key={g} className="text-xs bg-white/10 text-white/70 px-3 py-1 rounded-full">{g}</span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(info as any).rating && (info as any).rating !== "N/A" && (
              <div className="bg-[#1c1c1c] rounded-lg p-3">
                <p className="text-white/40 text-xs mb-1">IMDB Rating</p>
                <p className="text-yellow-400 font-bold">{(info as any).rating} / 10</p>
              </div>
            )}
            {(info as any).runtime && (info as any).runtime !== "N/A" && (
              <div className="bg-[#1c1c1c] rounded-lg p-3">
                <p className="text-white/40 text-xs mb-1">Runtime</p>
                <p className="text-white font-semibold">{(info as any).runtime}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Server selection bottom sheet */}
      <Sheet open={serverSheetOpen} onOpenChange={setServerSheetOpen}>
        <SheetContent side="bottom" className="bg-[#1a1a1a] border-t border-white/10 rounded-t-2xl px-0 pb-safe">
          <SheetHeader className="px-5 pb-4 border-b border-white/10">
            <SheetTitle className="text-white text-base font-bold text-center">
              Select Server To Stream
            </SheetTitle>
          </SheetHeader>
          <div className="max-h-[50vh] overflow-y-auto">
            {isStreamsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : streams && streams.length > 0 ? (
              streams.map((stream: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handlePlayStream(stream)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                  data-testid={`server-option-${idx}`}
                >
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{stream.server}</p>
                    {stream.quality && (
                      <p className="text-white/40 text-xs mt-0.5">{stream.quality}</p>
                    )}
                  </div>
                  <Play className="w-4 h-4 text-primary shrink-0" />
                </button>
              ))
            ) : (
              <p className="text-white/40 text-sm px-5 py-10 text-center">
                No streams found for this content.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
