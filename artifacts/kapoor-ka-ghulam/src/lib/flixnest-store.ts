// Unified localStorage store for FlixNest (ratings + recently viewed)

export interface RecentlyViewedItem {
  id: string;
  title: string;
  poster: string;
  viewedAt: number;
}

const RT_KEY  = "flixnest_ratings";
const RV_KEY  = "flixnest_recently_viewed";
const MAX_RECENT = 20;

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
