import { useGetHistory, useDeleteHistoryItem, useClearHistory, getGetHistoryQueryKey } from "@workspace/api-client-react";
import { PosterCard } from "@/components/poster-card";
import { Clock, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function History() {
  const { data: history, isLoading } = useGetHistory();
  const queryClient = useQueryClient();
  const deleteItem = useDeleteHistoryItem({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      }
    }
  });
  const clearHistory = useClearHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      }
    }
  });
  const { toast } = useToast();

  const handleRemove = async (id: number) => {
    await deleteItem.mutateAsync({ id });
    toast({ title: "Removed from history" });
  };

  const handleClear = async () => {
    await clearHistory.mutateAsync();
    toast({ title: "History cleared" });
  };

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-12">
        <div>
          <h1 className="text-4xl font-serif font-bold">History</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">Continue where you left off</p>
        </div>
        
        {history && history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-white/10 hover:bg-white/5 text-destructive hover:text-destructive self-start">
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif">Clear Watch History?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your viewing history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, clear it
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && history && history.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {history.map((item, i) => (
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
                type={item.type}
                progress={item.progress}
                actionIcon="remove"
                onRemove={() => handleRemove(item.id)} 
              />
            </motion.div>
          ))}
        </div>
      )}

      {!isLoading && (!history || history.length === 0) && (
        <div className="text-center py-32 opacity-80">
          <Clock className="w-16 h-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-serif mb-4">No watch history</h2>
          <p className="text-muted-foreground mb-8">Items you watch will appear here.</p>
        </div>
      )}
    </div>
  );
}
