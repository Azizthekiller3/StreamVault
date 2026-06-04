import { useState } from "react";
import { useGetSources, useAddSource, useRemoveSource, useFetchManifest, useGetExtensions, useInstallExtension, useUninstallExtension, getGetSourcesQueryKey, getGetExtensionsQueryKey } from "@workspace/api-client-react";
import { Blocks, Loader2, Plus, Trash2, Download, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

export default function Marketplace() {
  const queryClient = useQueryClient();
  const { data: sources, isLoading: isSourcesLoading } = useGetSources();
  const { data: extensions, isLoading: isExtensionsLoading } = useGetExtensions();
  
  const addSource = useAddSource({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSourcesQueryKey() });
      }
    }
  });
  const removeSource = useRemoveSource({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSourcesQueryKey() });
      }
    }
  });
  const installExtension = useInstallExtension({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetExtensionsQueryKey() });
      }
    }
  });
  const uninstallExtension = useUninstallExtension({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetExtensionsQueryKey() });
      }
    }
  });

  const { toast } = useToast();
  const [sourceInput, setSourceInput] = useState("");

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceInput) return;

    try {
      await addSource.mutateAsync({ data: { input: sourceInput } });
      setSourceInput("");
      toast({ title: "Source added successfully" });
    } catch (err) {
      toast({ title: "Failed to add source", variant: "destructive" });
    }
  };

  const handleRemoveSource = async (id: number) => {
    try {
      await removeSource.mutateAsync({ id });
      toast({ title: "Source removed" });
    } catch (err) {
      toast({ title: "Failed to remove source", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto min-h-screen">
      <div className="mb-12">
        <h1 className="text-4xl font-serif font-bold">Marketplace</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">Discover and manage content extensions</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-12 items-start">
        
        {/* Source Contents */}
        <div className="space-y-8">
          {isSourcesLoading && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isSourcesLoading && sources?.map((source) => (
            <SourceSection 
              key={source.id} 
              source={source} 
              extensions={extensions || []}
              onRemove={() => handleRemoveSource(source.id)}
              onInstall={(entry) => installExtension.mutateAsync({
                data: {
                  sourceId: source.id,
                  value: entry.value,
                  displayName: entry.displayName,
                  type: entry.type,
                  icon: entry.icon,
                  version: entry.version,
                }
              })}
              onUninstall={(id) => uninstallExtension.mutateAsync({ id })}
            />
          ))}

          {!isSourcesLoading && (!sources || sources.length === 0) && (
            <div className="text-center py-24 bg-white/5 rounded-2xl border border-white/10 border-dashed">
              <Blocks className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-serif mb-2">No Sources Added</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Add a provider source URL on the right to discover installable extensions.
              </p>
            </div>
          )}
        </div>

        {/* Add Form */}
        <div className="sticky top-24">
          <Card className="bg-card border-border shadow-xl backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-serif">Add Source</CardTitle>
              <CardDescription>Enter a GitHub repository URL or author name (e.g. "author/repo" or full URL) containing Vega-compatible extensions.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSource} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sourceInput">Source URL or Author</Label>
                  <Input 
                    id="sourceInput" 
                    value={sourceInput} 
                    onChange={(e) => setSourceInput(e.target.value)} 
                    placeholder="https://github.com/user/repo"
                    className="bg-black/40 border-white/10 focus-visible:ring-primary font-mono text-sm"
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full mt-2" 
                  disabled={addSource.isPending || !sourceInput}
                >
                  {addSource.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Source
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function SourceSection({ source, extensions, onRemove, onInstall, onUninstall }: any) {
  const { data: manifest, isLoading, isError } = useFetchManifest(
    { sourceId: source.id },
    { query: { enabled: !!source.id } }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h2 className="text-2xl font-serif font-semibold">{source.name}</h2>
          <a href={source.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline font-mono truncate max-w-xs block">
            {source.url}
          </a>
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Failed to load manifest</p>
            <p className="text-sm opacity-80">Check if the source URL is valid and accessible.</p>
          </div>
        </div>
      )}

      {!isLoading && manifest && manifest.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {manifest.map((entry: any, i: number) => {
            const installedExt = extensions.find((ext: any) => ext.value === entry.value);
            const isInstalled = !!installedExt;

            return (
              <motion.div
                key={entry.value}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors h-full flex flex-col">
                  <CardHeader className="p-4 pb-2 flex-row gap-4 items-start space-y-0">
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {entry.icon ? (
                        <img src={entry.icon} alt={entry.displayName} className="w-full h-full object-cover" />
                      ) : (
                        <Blocks className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-serif mb-1 truncate" title={entry.displayName}>{entry.displayName}</CardTitle>
                      <CardDescription className="text-xs uppercase tracking-wider font-mono flex gap-2">
                        <span>{entry.type}</span>
                        <span>v{entry.version}</span>
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-end">
                    {isInstalled ? (
                      <Button 
                        variant="secondary" 
                        className="w-full text-foreground/80 hover:text-destructive hover:bg-destructive/20"
                        onClick={() => onUninstall(installedExt.id)}
                      >
                        <Check className="w-4 h-4 mr-2" /> Installed
                      </Button>
                    ) : (
                      <Button 
                        variant="default" 
                        className="w-full"
                        onClick={() => onInstall(entry)}
                        disabled={entry.disabled}
                      >
                        <Download className="w-4 h-4 mr-2" /> Install
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
