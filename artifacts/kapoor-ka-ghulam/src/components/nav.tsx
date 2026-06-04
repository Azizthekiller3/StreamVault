import { Link, useLocation } from "wouter";
import { Film, Search, Bookmark, Clock, Settings, Tv, Menu } from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Film },
  { href: "/search", label: "Search", icon: Search },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/history", label: "History", icon: Clock },
  { href: "/providers", label: "Providers", icon: Tv },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const [location] = useLocation();

  return (
    <>
      {/* Mobile Nav */}
      <div className="md:hidden flex items-center justify-between p-4 glass-panel fixed top-0 w-full z-50">
        <Link href="/">
          <span className="font-serif text-xl font-bold text-primary cursor-pointer tracking-tight">K.G.</span>
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="bg-background border-l-border/10">
            <nav className="flex flex-col gap-4 mt-8">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}>
                    <span
                      className={`flex items-center gap-3 px-4 py-3 rounded-md transition-all ${
                        isActive
                          ? "bg-primary/20 text-primary font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-border/10 bg-background/95 backdrop-blur-xl z-50">
        <div className="p-6">
          <Link href="/">
            <div className="cursor-pointer">
              <h1 className="font-serif text-3xl font-bold text-primary tracking-tighter leading-none mb-1">
                Kapoor Ka<br />Ghulam
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-secondary">Director's Cut</p>
            </div>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all cursor-pointer group ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 border-l-2 border-transparent"
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-primary" : ""}`} />
                  <span className="tracking-wide text-sm">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
