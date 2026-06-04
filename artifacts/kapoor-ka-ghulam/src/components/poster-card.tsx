import { Link } from "wouter";
import { Play, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { motion } from "framer-motion";

interface PosterCardProps {
  imdbId?: string | null;
  title: string;
  poster: string;
  year?: string | null;
  type?: string;
  progress?: number | null;
  onRemove?: () => void;
  actionIcon?: "remove" | "add";
}

export function PosterCard({ imdbId, title, poster, year, type, progress, onRemove, actionIcon }: PosterCardProps) {
  const content = (
    <div className="group relative rounded-md overflow-hidden bg-muted aspect-[2/3] ring-1 ring-white/10 hover:ring-primary/50 transition-all duration-300">
      {poster && poster !== "N/A" ? (
        <img
          src={poster}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 group-hover:opacity-60"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-muted-foreground p-4 text-center">
          {title}
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <h3 className="font-serif text-lg font-bold text-white leading-tight line-clamp-2 mb-1">{title}</h3>
        <div className="flex items-center gap-2 text-xs text-secondary/80 font-mono">
          {year && <span>{year}</span>}
          {type && <span className="uppercase tracking-wider px-1.5 py-0.5 bg-white/10 rounded">{type}</span>}
        </div>
        
        {progress !== undefined && progress !== null && (
          <div className="mt-3">
            <Progress value={progress} className="h-1 bg-white/20" />
            <div className="text-[10px] mt-1 text-right text-white/60 font-mono">{Math.round(progress)}%</div>
          </div>
        )}
      </div>

      {actionIcon === "remove" && onRemove && (
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white/70 hover:text-destructive hover:bg-black/80 transition-colors opacity-0 group-hover:opacity-100"
        >
          <BookmarkCheck className="w-4 h-4" />
        </button>
      )}
      
      {/* Play indicator */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-primary/90 text-white flex items-center justify-center pl-1 shadow-lg shadow-primary/20 backdrop-blur-sm">
          <Play className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  if (imdbId) {
    return (
      <Link href={`/info/${imdbId}`} className="block cursor-pointer">
        <motion.div className="block">
          {content}
        </motion.div>
      </Link>
    );
  }

  return <motion.div className="block">{content}</motion.div>;
}
