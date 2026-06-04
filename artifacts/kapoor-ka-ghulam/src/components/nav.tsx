import { Link, useLocation } from "wouter";
import { Film, Home, Search, History as HistoryIcon, Bookmark, Settings, Blocks, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/marketplace", label: "Extensions", icon: Blocks },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const [location] = useLocation();

  return (
    <>
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-border z-50 flex items-center px-4 justify-between">
        <Link href="/" className="flex items-center gap-2 text-primary font-serif font-bold text-xl">
          <Film className="w-6 h-6" />
          <span>KKG</span>
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 bg-sidebar border-sidebar-border p-0">
            <div className="p-6 flex flex-col gap-6">
              <Link href="/" className="flex items-center gap-2 text-primary font-serif font-bold text-2xl">
                <Film className="w-8 h-8" />
                <span>Kapoor Ka Ghulam</span>
              </Link>
              <nav className="flex flex-col gap-2">
                {NAV_ITEMS.map((item) => {
                  const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-md transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <aside className="hidden md:flex flex-col w-64 h-[100dvh] fixed top-0 left-0 bg-sidebar border-r border-sidebar-border z-40">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-3 text-primary font-serif font-bold text-2xl hover:opacity-80 transition-opacity">
            <Film className="w-8 h-8" />
            <span className="leading-tight">Kapoor Ka<br/>Ghulam</span>
          </Link>
        </div>
        <div className="px-4 py-2 flex-1">
          <nav className="flex flex-col gap-1">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-4 mt-4">Menu</div>
            {NAV_ITEMS.map((item) => {
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-md transition-colors text-sm",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
