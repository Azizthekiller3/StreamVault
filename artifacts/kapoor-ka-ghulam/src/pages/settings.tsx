import { Info, Settings as SettingsIcon, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClearHistory, useGetSettings, useUpdateSettings, useGetStats, useGetExtensions, getGetSettingsQueryKey, getGetStatsQueryKey, getGetHistoryQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveExtension } from "@/hooks/use-active-extension";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Settings() {
  const queryClient = useQueryClient();
  const clearHistory = useClearHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      }
    }
  });
  
  const updateSettings = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      }
    }
  });

  const { activeExtId, isLoading: isExtLoading } = useActiveExtension();
  const { data: stats } = useGetStats();
  const { data: extensions } = useGetExtensions();
  const { toast } = useToast();

  const handleClearData = async () => {
    await clearHistory.mutateAsync();
    toast({ title: "Local data cleared" });
  };

  const handleExtensionChange = async (val: string) => {
    await updateSettings.mutateAsync({
      data: {
        activeExtId: val === "none" ? null : Number(val)
      }
    });
    toast({ title: "Active extension updated" });
  };

  return (
    <div className="p-6 md:p-12 max-w-4xl mx-auto min-h-screen">
      <div className="mb-12">
        <h1 className="text-4xl font-serif font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">App configuration and data</p>
      </div>

      <div className="space-y-8">
        
        <Card className="bg-card border-border/50 shadow-none">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" /> Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Active Extension</Label>
              <Select 
                value={activeExtId ? activeExtId.toString() : "none"} 
                onValueChange={handleExtensionChange}
                disabled={isExtLoading}
              >
                <SelectTrigger className="bg-black/40 border-white/10">
                  <SelectValue placeholder="Select an extension" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {extensions?.map((ext) => (
                    <SelectItem key={ext.id} value={ext.id.toString()}>
                      {ext.displayName} v{ext.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">This extension will be used for browsing and searching content.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-none">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> About & Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold font-mono">{stats?.historyCount || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">History</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold font-mono">{stats?.watchlistCount || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Watchlist</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold font-mono">{stats?.sourcesCount || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Sources</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold font-mono">{stats?.extensionsCount || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Extensions</div>
              </div>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono text-sm">v1.0.0 Director's Cut</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Theme</span>
              <span className="capitalize font-mono text-sm">Dark (Cinematic)</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-950/10 border-red-900/20 shadow-none">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Danger Zone
            </CardTitle>
            <CardDescription className="text-red-900/60 dark:text-red-200/50">
              Irreversible actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
              <div>
                <h4 className="font-medium text-white mb-1">Clear Local Data</h4>
                <p className="text-sm text-muted-foreground">Removes all history and cached data.</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Clear Data</Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif">Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all your local watch history and cached data. Watchlist and Providers will remain intact.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearData} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Yes, clear data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
