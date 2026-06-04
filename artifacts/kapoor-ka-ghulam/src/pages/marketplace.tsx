import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetSources,
  useAddSource,
  useRemoveSource,
  useFetchManifest,
  useGetExtensions,
  useInstallExtension,
  useUninstallExtension,
  getGetSourcesQueryKey,
  getGetExtensionsQueryKey,
  getFetchManifestQueryKey,
  type ManifestEntry,
} from "@workspace/api-client-react";
import { Blocks, Loader2, Plus, Trash2, Download, Check, AlertTriangle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

export default function Marketplace() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sources, isLoading: isSourcesLoading } = useGetSources();
  const { data: extensions } = useGetExtensions();

  const addSource = useAddSource({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSourcesQueryKey() }) },
  });
  const removeSource = useRemoveSource({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSourcesQueryKey() }) },
  });
  const installExtension = useInstallExtension({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetExtensionsQueryKey() }) },
  });
  const uninstallExtension = useUninstallExtension({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetExtensionsQueryKey() }) },
  });

  const [sourceInput, setSourceInput] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceInput.trim()) return;
    try {
      await addSource.mutateAsync({ data: { input: sourceInput.trim() } });
      setSourceInput("");
      setShowAddForm(false);
      toast({ title: "Source added successfully" });
    } catch {
      toast({ title: "Failed to add source", variant: "destructive" });
    }
  };

  const handleRemoveSource = async (id: number) => {
    try {
      await removeSource.mutateAsync({ id });
      toast({ title: "Source removed" });
    } catch {
      toast({ title: "Failed to remove source", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 bg-black/80 backdrop-blur-md border-b border-white/5 flex items-center gap-3">
        <button
          onClick={() => setLocation("/settings")}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-white flex-1">Marketplace</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          data-testid="button-toggle-add-form"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-4 pb-8 space-y-4">
        {/* Add source form */}
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#1c1c1c] rounded-xl p-4 border border-white/5"
          >
            <p className="text-sm font-semibold text-white mb-1">Add Provider Source</p>
            <p className="text-xs text-white/40 mb-3">
              Enter a GitHub repo URL or "author/repo" shorthand with a Vega-compatible manifest.json
            </p>
            <form onSubmit={handleAddSource} className="flex gap-2">
              <input
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/60 font-mono"
                required
                data-testid="input-source-url"
              />
              <button
                type="submit"
                disabled={addSource.isPending || !sourceInput.trim()}
                className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-2"
                data-testid="button-add-source"
              >
                {addSource.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
              </button>
            </form>
          </motion.div>
        )}

        {/* Sources loading */}
        {isSourcesLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty sources */}
        {!isSourcesLoading && (!sources || sources.length === 0) && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <Blocks className="w-14 h-14 text-white/20 mb-4" />
            <p className="text-white font-semibold text-base mb-1">No sources added</p>
            <p className="text-white/40 text-sm mb-4">
              Add a GitHub provider source to discover and install extensions.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-5 py-2.5 bg-primary rounded-lg text-white text-sm font-medium flex items-center gap-2"
              data-testid="button-add-first-source"
            >
              <Plus className="w-4 h-4" />
              Add Source
            </button>
          </div>
        )}

        {/* Source sections */}
        {!isSourcesLoading &&
          sources?.map((source) => (
            <SourceSection
              key={source.id}
              source={source}
              extensions={extensions || []}
              onRemove={() => handleRemoveSource(source.id)}
              onInstall={(entry: ManifestEntry) =>
                installExtension.mutateAsync({
                  data: {
                    sourceId: source.id,
                    value: entry.value,
                    displayName: entry.displayName,
                    type: entry.type,
                    icon: entry.icon ?? undefined,
                    version: entry.version,
                  },
                })
              }
              onUninstall={(id: number) => uninstallExtension.mutateAsync({ id })}
            />
          ))}
      </div>
    </div>
  );
}

function SourceSection({ source, extensions, onRemove, onInstall, onUninstall }: any) {
  const { data: manifest, isLoading, isError } = useFetchManifest(
    { sourceId: source.id },
    { query: { enabled: !!source.id, queryKey: getFetchManifestQueryKey({ sourceId: source.id }) } }
  );

  return (
    <div className="bg-[#1c1c1c] rounded-xl overflow-hidden border border-white/5">
      {/* Source header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{source.name}</p>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-white/30 hover:text-white/50 font-mono truncate block"
          >
            {source.url}
          </a>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 text-white/30 hover:text-red-400 transition-colors"
          data-testid={`button-remove-source-${source.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Manifest loading */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Manifest error */}
      {isError && (
        <div className="flex items-start gap-3 px-4 py-4 text-red-400/80">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Failed to load manifest</p>
            <p className="text-xs text-white/30 mt-0.5">Check if the source URL is valid.</p>
          </div>
        </div>
      )}

      {/* Extension list */}
      {!isLoading && manifest && manifest.length > 0 && (
        <div>
          {manifest.map((entry: any, i: number) => {
            const installedExt = extensions.find((e: any) => e.value === entry.value);
            const isInstalled = !!installedExt;

            return (
              <motion.div
                key={entry.value}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0"
                data-testid={`ext-entry-${i}`}
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                  {entry.icon ? (
                    <img src={entry.icon} alt={entry.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <Blocks className="w-5 h-5 text-white/30" />
                  )}
                </div>

                {/* Name + type */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{entry.displayName}</p>
                  <p className="text-[11px] text-white/30 font-mono">{entry.type} · v{entry.version}</p>
                </div>

                {/* Install/Uninstall */}
                {isInstalled ? (
                  <button
                    onClick={() => onUninstall(installedExt.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 text-white/60 rounded-lg text-xs font-medium hover:bg-red-900/30 hover:text-red-400 transition-colors"
                    data-testid={`button-uninstall-${i}`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Installed
                  </button>
                ) : (
                  <button
                    onClick={() => onInstall(entry)}
                    disabled={entry.disabled}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-40"
                    data-testid={`button-install-${i}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Install
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {!isLoading && manifest && manifest.length === 0 && (
        <p className="text-white/30 text-sm px-4 py-4">No extensions found in this source.</p>
      )}
    </div>
  );
}
