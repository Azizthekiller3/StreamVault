import { useLocation } from "wouter";
import { Blocks, Trash2, ChevronRight, Info as InfoIcon, AlertTriangle } from "lucide-react";
import {
  useClearHistory,
  useGetSettings,
  useUpdateSettings,
  useGetStats,
  useGetExtensions,
  getGetSettingsQueryKey,
  getGetStatsQueryKey,
  getGetHistoryQueryKey,
} from "@workspace/api-client-react";
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
import { useActiveExtension } from "@/hooks/use-active-extension";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { Check } from "lucide-react";
import { Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Settings() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [extSheetOpen, setExtSheetOpen] = useState(false);

  const clearHistory = useClearHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      },
    },
  });

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
    },
  });

  const { activeExtId, activeExtension, isLoading: isExtLoading } = useActiveExtension();
  const { data: stats } = useGetStats();
  const { data: extensions } = useGetExtensions();

  const handleClearData = async () => {
    await clearHistory.mutateAsync();
    toast({ title: "History cleared" });
  };

  const handleSelectExt = async (id: number | undefined) => {
    await updateSettings.mutateAsync({ data: { activeExtId: id ?? undefined } });
    setExtSheetOpen(false);
    toast({ title: id ? "Active extension updated" : "Extension cleared" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 bg-black/80 backdrop-blur-md border-b border-white/5">
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </div>

      <div className="px-4 py-4 space-y-4 pb-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Watched", value: stats?.historyCount ?? 0 },
            { label: "Saved", value: stats?.watchlistCount ?? 0 },
            { label: "Sources", value: stats?.sourcesCount ?? 0 },
            { label: "Exts", value: stats?.extensionsCount ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Extensions section */}
        <div className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Provider</p>
          </div>

          {/* Active extension */}
          <button
            onClick={() => setExtSheetOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-4 border-b border-white/5 hover:bg-white/5 transition-colors"
            disabled={isExtLoading}
            data-testid="button-change-extension"
          >
            <Clapperboard className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">Active Extension</p>
              <p className="text-xs text-white/40 mt-0.5">
                {activeExtension ? activeExtension.displayName : "None selected"}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
          </button>

          {/* Marketplace link */}
          <button
            onClick={() => setLocation("/marketplace")}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors"
            data-testid="button-go-marketplace"
          >
            <Blocks className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white">Marketplace</p>
              <p className="text-xs text-white/40 mt-0.5">Install extensions &amp; manage sources</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
          </button>
        </div>

        {/* About */}
        <div className="bg-[#1c1c1c] rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">About</p>
          </div>
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <InfoIcon className="w-5 h-5 text-primary shrink-0" />
              <p className="text-sm font-medium text-white">Version</p>
            </div>
            <p className="text-sm text-white/40 font-mono">v1.0.0</p>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-red-950/20 border border-red-900/20 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-red-900/20">
            <p className="text-xs font-semibold text-red-400/60 uppercase tracking-wider">Danger</p>
          </div>
          <div className="px-4 py-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Clear Watch History</p>
              <p className="text-xs text-white/40 mt-0.5">Removes all viewing records</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 text-red-400 rounded-lg text-xs font-medium hover:bg-red-900/60 transition-colors"
                  data-testid="button-clear-history"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#1c1c1c] border-white/10 mx-4">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Clear watch history?</AlertDialogTitle>
                  <AlertDialogDescription className="text-white/50">
                    This removes all history records. Watchlist and extensions remain intact.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-white/10 border-white/10 text-white hover:bg-white/20">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearData} className="bg-red-700 hover:bg-red-600 text-white">
                    Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Extension picker sheet */}
      <Sheet open={extSheetOpen} onOpenChange={setExtSheetOpen}>
        <SheetContent side="bottom" className="bg-[#1a1a1a] border-t border-white/10 rounded-t-2xl px-0 pb-safe">
          <SheetHeader className="px-5 pb-4 border-b border-white/10">
            <SheetTitle className="text-white text-lg font-bold text-left">Active Extension</SheetTitle>
            <p className="text-white/40 text-sm text-left -mt-1">Choose your content provider</p>
          </SheetHeader>
          <div className="max-h-[50vh] overflow-y-auto py-2">
            <button
              onClick={() => handleSelectExt(undefined)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 transition-colors",
                !activeExtId ? "text-primary bg-primary/10" : "text-white/50 hover:bg-white/5"
              )}
              data-testid="ext-option-none"
            >
              <Clapperboard className="w-5 h-5 shrink-0" />
              <span className="flex-1 text-left font-medium">None</span>
              {!activeExtId && <Check className="w-5 h-5 text-primary shrink-0" />}
            </button>
            {!extensions || extensions.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-white/40 text-sm">No extensions installed.</p>
                <button
                  onClick={() => { setExtSheetOpen(false); setLocation("/marketplace"); }}
                  className="mt-3 text-primary text-sm font-medium hover:underline"
                  data-testid="button-go-marketplace-from-sheet"
                >
                  Go to Marketplace
                </button>
              </div>
            ) : (
              extensions.map((ext) => {
                const isActive = ext.id === activeExtId;
                return (
                  <button
                    key={ext.id}
                    onClick={() => handleSelectExt(ext.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 transition-colors",
                      isActive ? "text-primary bg-primary/10" : "text-white hover:bg-white/5"
                    )}
                    data-testid={`ext-option-${ext.id}`}
                  >
                    <Clapperboard className="w-5 h-5 shrink-0" />
                    <span className="flex-1 text-left font-medium">{ext.displayName}</span>
                    {isActive && <Check className="w-5 h-5 text-primary shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
