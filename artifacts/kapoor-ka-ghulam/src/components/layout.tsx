import { Nav } from "./nav";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <Nav />
      <main className="flex-1 md:ml-64 w-full pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
}
