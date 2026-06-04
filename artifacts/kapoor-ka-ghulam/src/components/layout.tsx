import { Nav } from "./nav";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full bg-background flex-col md:flex-row">
      <Nav />
      <main className="flex-1 overflow-x-hidden pt-16 md:pt-0 pb-20 md:pb-0 relative md:ml-64">
        <div className="mx-auto w-full h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
