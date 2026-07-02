import { useState } from "react";
import { cn } from "@/lib/utils";
import { Film } from "lucide-react";

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackText?: string;
}

export function ImageWithFallback({ className, alt, fallbackText, src, ...props }: ImageWithFallbackProps) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center bg-muted text-muted-foreground p-4 text-center h-full w-full",
          className
        )}
      >
        <Film className="h-8 w-8 mb-2 opacity-50" />
        <span className="text-sm font-medium line-clamp-2">{fallbackText || alt || "No Image"}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
}
