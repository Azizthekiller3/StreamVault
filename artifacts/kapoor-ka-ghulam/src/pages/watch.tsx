import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { ChevronLeft, Maximize, Minimize } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Watch() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);

  const src = searchParams.get("src") || "";
  const title = searchParams.get("title") || "Unknown";
  const episodeTitle = searchParams.get("episodeTitle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
    if (!src) setLocation("/");
  }, [src, setLocation]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
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
      />

      {/* Custom overlay for back + fullscreen */}
      <div
        className={`absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 pointer-events-none ${showControls ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex items-center gap-4 pointer-events-auto w-full">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 rounded-full h-12 w-12"
            onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
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
            {document.fullscreenElement ? (
              <Minimize className="w-6 h-6" />
            ) : (
              <Maximize className="w-6 h-6" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
