import { useGetWatchlist, useRemoveFromWatchlist, getGetWatchlistQueryKey } from "@workspace/api-client-react";
import { PosterCard } from "@/components/poster-card";
import { Bookmark, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Watchlist() {
  const { data: watchlist, isLoading } = useGetWatchlist();
  const queryClient = useQueryClient();
  const removeFromWatchlist = useRemoveFromWatchlist({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
      }
    }
  });
  const { toast } = useToast();

  const handleRemove = async (id: number) => {
    await removeFromWatchlist.mutateAsync({ id });
    toast({ title: "Removed from watchlist" });
  };

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto min-h-screen">
      <div className="mb-12">
        <h1 className="text-4xl font-serif font-bold">Watchlist</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">Titles saved for later</p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && watchlist && watchlist.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {watchlist.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.5) }}
            >
              <PosterCard 
                imdbId={item.imdbId}
                link={item.link}
                title={item.title}
                poster={item.poster}
                year={item.year}
                type={item.type}
                actionIcon="remove"
                onRemove={() => handleRemove(item.id)} 
              />
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && (!watchlist || watchlist.length === 0) && (
        <div className="text-center py-32 opacity-80">
          <Bookmark className="w-16 h-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-serif mb-4">Your watchlist is empty</h2>
          <p className="text-muted-foreground mb-8">Save movies and shows to watch them later.</p>
          <Link href="/search">
            <Button size="lg" className="rounded-full">Find something to watch</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
