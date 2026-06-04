import { Info, Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useClearHistory } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
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

export default function Settings() {
  const clearHistory = useClearHistory();
  const { toast } = useToast();

  const handleClearData = async () => {
    await clearHistory.mutateAsync();
    toast({ title: "Local data cleared" });
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
              <Info className="w-5 h-5 text-primary" /> About
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono text-sm">v1.0.0 Director's Cut</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Build</span>
              <span className="font-mono text-sm">Replit Agent</span>
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
