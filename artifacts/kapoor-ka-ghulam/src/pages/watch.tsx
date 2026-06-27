import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { useUpsertHistory, getGetHistoryQueryKey } from "@workspace/api-client-react";
import { ChevronLeft, Maximize, Minimize } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export default function Watch() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  
  const src = searchParams.get("src") || "";
  const title = searchParams.get("title") || "Unknown";
  const poster = searchParams.get("poster") || "";
  const extId = searchParams.get("extId");
  const link = searchParams.get("link") || "";
  const type = searchParams.get("type") || "video";
  const episodeTitle = searchParams.get("episodeTitle");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queryClient = useQueryClient();
  
  const upsertHistory = useUpsertHistory({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      }
    }
  });

  const lastSavedProgress = useRef<number>(0);

  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);
    handleMouseMove();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!src) {
      setLocation("/");
    }
  }, [src, setLocation]);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    
    const currentTime = videoRef.current.currentTime;
    const duration = videoRef.current.duration;
    
    if (duration > 0) {
      const progress = (currentTime / duration) * 100;
      
      // Save progress every 5% or 30 seconds, whichever is smaller, to avoid spamming the DB
      const saveInterval = Math.min(5, (30 / duration) * 100);
      
      if (Math.abs(progress - lastSavedProgress.current) >= saveInterval || progress > 95) {
        lastSavedProgress.current = progress;
        
        upsertHistory.mutate({
          data: {
            title,
            poster,
            link,
            provider: extId || "unknown", // Using extId as provider ID here
            type,
            progress,
            duration,
            episodeTitle: episodeTitle || undefined
          }
        });
      }
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  if (!src) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white w-screen h-screen overflow-hidden flex flex-col">
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        controls
        autoPlay
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Custom Overlay for back button */}
      <div 
        className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 pointer-events-none ${showControls ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex items-center gap-4 pointer-events-auto w-full">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20 rounded-full h-12 w-12"
            onClick={() => window.history.back()}
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-serif">{title}</h1>
            {episodeTitle && <p className="text-sm text-white/70">{episodeTitle}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 rounded-full h-12 w-12"
            onClick={toggleFullScreen}
          >
            {document.fullscreenElement ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
