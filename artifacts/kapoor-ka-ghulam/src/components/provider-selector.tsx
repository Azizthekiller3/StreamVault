import { useState } from "react";
import { Clapperboard, Check, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useGetExtensions, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useActiveExtension } from "@/hooks/use-active-extension";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function ProviderSelector() {
  const [open, setOpen] = useState(false);
  const { data: extensions } = useGetExtensions();
  const { activeExtId, activeExtension } = useActiveExtension();
  const queryClient = useQueryClient();

  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
    },
  });

  const handleSelect = async (id: number) => {
    await updateSettings.mutateAsync({ data: { activeExtId: id } });
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white"
        data-testid="button-provider-selector"
      >
        <Clapperboard className="w-4 h-4 text-primary" />
        <span className="max-w-[120px] truncate">
          {activeExtension?.displayName ?? "Select Provider"}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-white/50" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="bg-[#1a1a1a] border-t border-white/10 rounded-t-2xl px-0 pb-safe"
        >
          <SheetHeader className="px-5 pb-4 border-b border-white/10">
            <SheetTitle className="text-white text-lg font-bold text-left">
              Select Provider
            </SheetTitle>
            <p className="text-white/50 text-sm text-left -mt-1">Content source</p>
          </SheetHeader>
          <div className="overflow-y-auto max-h-[60vh] py-2">
            {!extensions || extensions.length === 0 ? (
              <p className="text-white/40 text-sm px-5 py-6 text-center">
                No extensions installed. Go to Marketplace.
              </p>
            ) : (
              extensions.map((ext) => {
                const isActive = ext.id === activeExtId;
                return (
                  <button
                    key={ext.id}
                    onClick={() => handleSelect(ext.id)}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-4 transition-colors",
                      isActive
                        ? "bg-primary/20 text-primary"
                        : "text-white hover:bg-white/5"
                    )}
                    data-testid={`provider-item-${ext.id}`}
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
    </>
  );
}
