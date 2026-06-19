// Unified localStorage store for FlixNest (watchlist + ratings)

export interface WatchlistItem {
  id: string;
  title: string;
  poster: string;
}

const WL_KEY = "flixnest_watchlist";
const RT_KEY = "flixnest_ratings";

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

// Watchlist
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

// Ratings — stored as { [movieId]: 1-5 }
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
