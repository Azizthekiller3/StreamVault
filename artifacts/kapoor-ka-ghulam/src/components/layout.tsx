import { BottomNav } from "./nav";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col">
      <main className="flex-1 overflow-x-hidden pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
