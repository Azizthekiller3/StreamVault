// Unified localStorage store for FlixNest (watchlist + ratings + recently viewed + download history)

export interface WatchlistItem {
  id: string;
  title: string;
  poster: string;
}

export interface RecentlyViewedItem {
  id: string;
  title: string;
  poster: string;
  viewedAt: number;
}

export interface DownloadHistoryItem {
  id: string;          // unique record id
  movieId: string;
  title: string;
  poster: string;
  quality: string;
  url: string;
  downloadedAt: number;
}

const WL_KEY  = "flixnest_watchlist";
const RT_KEY  = "flixnest_ratings";
const RV_KEY  = "flixnest_recently_viewed";
const DL_KEY  = "flixnest_downloads";
const MAX_RECENT    = 20;
const MAX_DOWNLOADS = 100;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ── Watchlist ──────────────────────────────────────────────────────────────
export function getWatchlist(): WatchlistItem[] {
  return read<WatchlistItem[]>(WL_KEY, []);
}

export function isInWatchlist(id: string): boolean {
  return getWatchlist().some((m) => m.id === id);
}

export function toggleWatchlist(item: WatchlistItem): boolean {
  const list = getWatchlist();
  const idx = list.findIndex((m) => m.id === item.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    save(WL_KEY, list);
    return false;
  } else {
    list.unshift(item);
    save(WL_KEY, list);
    return true;
  }
}

// ── Ratings — stored as { [movieId]: 1-5 } ────────────────────────────────
export function getRatings(): Record<string, number> {
  return read<Record<string, number>>(RT_KEY, {});
}

export function getRating(id: string): number {
  return getRatings()[id] ?? 0;
}

export function setRating(id: string, stars: number) {
  const ratings = getRatings();
  ratings[id] = stars;
  save(RT_KEY, ratings);
}

// ── Recently Viewed ────────────────────────────────────────────────────────
export function getRecentlyViewed(): RecentlyViewedItem[] {
  return read<RecentlyViewedItem[]>(RV_KEY, []);
}

export function addRecentlyViewed(item: Omit<RecentlyViewedItem, "viewedAt">) {
  const list = getRecentlyViewed().filter((m) => m.id !== item.id);
  list.unshift({ ...item, viewedAt: Date.now() });
  save(RV_KEY, list.slice(0, MAX_RECENT));
}

export function clearRecentlyViewed() {
  save(RV_KEY, []);
}

// ── Download History ───────────────────────────────────────────────────────
export function getDownloadHistory(): DownloadHistoryItem[] {
  return read<DownloadHistoryItem[]>(DL_KEY, []);
}

export function addDownloadHistory(
  item: Omit<DownloadHistoryItem, "id" | "downloadedAt">
) {
  const list = getDownloadHistory();
  // Avoid exact duplicates (same movie + quality within 60 seconds)
  const recent = list.find(
    (d) =>
      d.movieId === item.movieId &&
      d.quality === item.quality &&
      Date.now() - d.downloadedAt < 60_000
  );
  if (recent) return;
  const entry: DownloadHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...item,
    downloadedAt: Date.now(),
  };
  list.unshift(entry);
  save(DL_KEY, list.slice(0, MAX_DOWNLOADS));
}

export function removeDownloadItem(id: string) {
  const list = getDownloadHistory().filter((d) => d.id !== id);
  save(DL_KEY, list);
}

export function clearDownloadHistory() {
  save(DL_KEY, []);
}
