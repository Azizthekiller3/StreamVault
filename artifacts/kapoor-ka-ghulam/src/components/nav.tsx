import { Link, useLocation } from "wouter";
import { Home, Search, Clock, Download, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/history", label: "History", icon: Clock },
  { href: "/downloads", label: "Downloads", icon: Download },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-t border-white/10 safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/"
              ? location === "/"
              : location.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                isActive ? "text-primary" : "text-white/40 hover:text-white/70"
              )}
              data-testid={`tab-${tab.label.toLowerCase()}`}
            >
              <Icon
                className={cn("w-5 h-5", isActive && "fill-primary stroke-primary")}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span className="text-[9px] font-medium tracking-wide">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
