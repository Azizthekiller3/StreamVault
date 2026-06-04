import { useState } from "react";
import { useGetProviders, useAddProvider, useRemoveProvider } from "@workspace/api-client-react";
import { Tv, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function Providers() {
  const { data: providers, isLoading } = useGetProviders();
  const addProvider = useAddProvider();
  const removeProvider = useRemoveProvider();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("video");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !type) return;

    try {
      await addProvider.mutateAsync({
        data: { name, url, type }
      });
      setName("");
      setUrl("");
      toast({ title: "Provider added successfully" });
    } catch (err) {
      toast({ title: "Failed to add provider", variant: "destructive" });
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await removeProvider.mutateAsync({ id });
      toast({ title: "Provider removed" });
    } catch (err) {
      toast({ title: "Failed to remove provider", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto min-h-screen">
      <div className="mb-12">
        <h1 className="text-4xl font-serif font-bold">Providers</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">Manage your content sources</p>
      </div>

      <div className="grid md:grid-cols-[1fr_350px] gap-8 items-start">
        
        {/* Provider List */}
        <div className="space-y-4">
          <h2 className="text-xl font-serif font-semibold mb-4">Installed Providers</h2>
          
          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && providers && providers.length === 0 && (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10 border-dashed">
              <Tv className="w-10 h-10 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No providers installed.</p>
            </div>
          )}

          {!isLoading && providers && providers.map((provider, i) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="bg-card border-border/50 shadow-none hover:border-primary/50 transition-colors">
                <CardHeader className="p-4 flex flex-row items-center gap-4">
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-none">
                    {provider.icon ? (
                      <img src={provider.icon} alt={provider.name} className="w-8 h-8" />
                    ) : (
                      <Tv className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg font-serif mb-1">{provider.name}</CardTitle>
                    <CardDescription className="truncate text-xs font-mono">{provider.url}</CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-destructive flex-none"
                    onClick={() => handleRemove(provider.id)}
                    disabled={removeProvider.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Add Form */}
        <div className="sticky top-24">
          <Card className="bg-white/5 border-white/10 shadow-xl backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-serif">Add Provider</CardTitle>
              <CardDescription>Install a new content source</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. Vega Source"
                    className="bg-black/40 border-white/10 focus-visible:ring-primary"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input 
                    id="url" 
                    type="url"
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    placeholder="https://..."
                    className="bg-black/40 border-white/10 focus-visible:ring-primary font-mono text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={type} onValueChange={setType} required>
                    <SelectTrigger className="bg-black/40 border-white/10 focus:ring-primary">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="subtitle">Subtitle</SelectItem>
                      <SelectItem value="tracker">Tracker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  type="submit" 
                  className="w-full mt-2" 
                  disabled={addProvider.isPending || !name || !url}
                >
                  {addProvider.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Install Provider
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
