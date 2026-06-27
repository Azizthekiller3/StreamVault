const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";
const CACHE_TTL = 30 * 60 * 1000; // 30 min
const MAX_YEAR_DRIFT = 5; // reject TMDB result if its year is >5 years from title's year

interface CacheEntry {
  data: TmdbEnrichment | null;
  ts: number;
}
const cache = new Map<string, CacheEntry>();

export interface TmdbCastMember {
  name: string;
  character: string;
  photo: string;
}

export interface TmdbEnrichment {
  tmdbId: number;
  imdbId: string | null;
  overview: string;
  poster: string;
  backdrop: string;
  rating: number;
  voteCount: number;
  year: string;
  runtime: number;
  genres: string[];
  cast: TmdbCastMember[];
  tagline: string;
}

/** Decode common HTML entities that end up in Telegram-scraped titles. */
function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/(\w)39(\w)/g, "$1'$2")
    .replace(/(\w)38(\w)/g, "$1&$2");
}

function cleanTitle(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/\b(480p|720p|1080p|4[Kk]|HDR|BluRay|WEB.?DL|WEBRip|HDCAM|CAM|HEVC|x264|x265)\b/gi, "")
    .replace(/\b(Hindi|English|Tamil|Telugu|Malayalam|Korean|Japanese|Dubbed|Subtitle|Audio)\b/gi, "")
    .replace(/\b(S\d{2}E?\d*|E\d{2}|Season\s*\d+|Episode\s*\d+|Part\s*\d+)\b/gi, "")
    .replace(/\(\d{4}\)/g, "")
    .replace(/\[\d{4}\]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract a 4-digit year from the raw title, e.g. "(2021)" → "2021". */
function extractYear(raw: string): string | null {
  const m = raw.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  return m ? m[1] : null;
}

/** True when the raw title looks like a TV series. */
function looksLikeSeries(raw: string): boolean {
  return /\b(Season|Series|Web.?Series|S\d{2})\b/i.test(raw);
}

/**
 * Pick the candidate whose release year is closest to yearHint.
 * Returns null if yearHint is present and even the closest result is >MAX_YEAR_DRIFT years away
 * — indicating the entire result set is the wrong content.
 */
function pickByYear<T extends { id: number; releaseYear: string; title: string }>(
  items: T[],
  yearHint: string | null,
  searchTitle: string
): T | null {
  if (!items.length) return null;

  // Filter by title word overlap — at least one significant word must match
  const sigWords = searchTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const overlapping = sigWords.length > 0
    ? items.filter((r) => {
        const rTitle = r.title.toLowerCase();
        return sigWords.some((w) => rTitle.includes(w));
      })
    : items;

  const pool = overlapping.length > 0 ? overlapping : items;

  if (!yearHint) return pool[0];

  const target = parseInt(yearHint, 10);
  const best = pool.reduce((b, c) => {
    const cYear = parseInt(c.releaseYear || "0", 10);
    const bYear = parseInt(b.releaseYear || "0", 10);
    return Math.abs(cYear - target) < Math.abs(bYear - target) ? c : b;
  });

  // Reject if even the best result is too far from the target year
  const bestYear = parseInt(best.releaseYear || "0", 10);
  if (bestYear > 0 && Math.abs(bestYear - target) > MAX_YEAR_DRIFT) return null;

  return best;
}

async function fetchMovieDetail(id: number, apiKey: string): Promise<TmdbEnrichment> {
  const url = `${TMDB_BASE}/movie/${id}?api_key=${apiKey}&language=en-US&append_to_response=credits,external_ids`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB movie detail failed: ${res.status}`);
  const d = await res.json() as {
    id: number;
    overview?: string;
    poster_path?: string;
    backdrop_path?: string;
    vote_average?: number;
    vote_count?: number;
    release_date?: string;
    runtime?: number;
    tagline?: string;
    genres?: { id: number; name: string }[];
    credits?: { cast?: { name: string; character: string; profile_path?: string }[] };
    external_ids?: { imdb_id?: string };
  };
  return {
    tmdbId: d.id,
    imdbId: d.external_ids?.imdb_id ?? null,
    overview: d.overview ?? "",
    poster: d.poster_path ? `${IMG_BASE}/w500${d.poster_path}` : "",
    backdrop: d.backdrop_path ? `${IMG_BASE}/w1280${d.backdrop_path}` : "",
    rating: Math.round((d.vote_average ?? 0) * 10) / 10,
    voteCount: d.vote_count ?? 0,
    year: (d.release_date ?? "").split("-")[0] ?? "",
    runtime: d.runtime ?? 0,
    tagline: d.tagline ?? "",
    genres: (d.genres ?? []).map((g) => g.name).slice(0, 4),
    cast: (d.credits?.cast ?? []).slice(0, 8).map((c) => ({
      name: c.name,
      character: c.character,
      photo: c.profile_path ? `${IMG_BASE}/w185${c.profile_path}` : "",
    })),
  };
}

async function fetchTvDetail(id: number, apiKey: string): Promise<TmdbEnrichment> {
  const url = `${TMDB_BASE}/tv/${id}?api_key=${apiKey}&language=en-US&append_to_response=credits,external_ids`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB tv detail failed: ${res.status}`);
  const tv = await res.json() as {
    id: number;
    overview?: string;
    poster_path?: string;
    backdrop_path?: string;
    vote_average?: number;
    vote_count?: number;
    first_air_date?: string;
    episode_run_time?: number[];
    tagline?: string;
    genres?: { id: number; name: string }[];
    credits?: { cast?: { name: string; character: string; profile_path?: string }[] };
    external_ids?: { imdb_id?: string };
  };
  return {
    tmdbId: tv.id,
    imdbId: tv.external_ids?.imdb_id ?? null,
    overview: tv.overview ?? "",
    poster: tv.poster_path ? `${IMG_BASE}/w500${tv.poster_path}` : "",
    backdrop: tv.backdrop_path ? `${IMG_BASE}/w1280${tv.backdrop_path}` : "",
    rating: Math.round((tv.vote_average ?? 0) * 10) / 10,
    voteCount: tv.vote_count ?? 0,
    year: (tv.first_air_date ?? "").split("-")[0] ?? "",
    runtime: tv.episode_run_time?.[0] ?? 0,
    tagline: tv.tagline ?? "",
    genres: (tv.genres ?? []).map((g) => g.name).slice(0, 4),
    cast: (tv.credits?.cast ?? []).slice(0, 8).map((c) => ({
      name: c.name,
      character: c.character,
      photo: c.profile_path ? `${IMG_BASE}/w185${c.profile_path}` : "",
    })),
  };
}

async function searchMovie(title: string, yearHint: string | null, apiKey: string): Promise<TmdbEnrichment | null> {
  const url = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&api_key=${apiKey}&language=en-US&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as { results?: { id: number; release_date?: string; title?: string; original_title?: string }[] };
  if (!data.results?.length) return null;

  const candidates = data.results.slice(0, 5).map((r) => ({
    id: r.id,
    releaseYear: (r.release_date ?? "").split("-")[0] ?? "",
    title: r.title ?? r.original_title ?? "",
  }));
  const best = pickByYear(candidates, yearHint, title);
  if (!best) return null;
  return fetchMovieDetail(best.id, apiKey);
}

async function searchTv(title: string, yearHint: string | null, apiKey: string): Promise<TmdbEnrichment | null> {
  const url = `${TMDB_BASE}/search/tv?query=${encodeURIComponent(title)}&api_key=${apiKey}&language=en-US&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json() as { results?: { id: number; first_air_date?: string; name?: string; original_name?: string }[] };
  if (!data.results?.length) return null;

  const candidates = data.results.slice(0, 5).map((r) => ({
    id: r.id,
    releaseYear: (r.first_air_date ?? "").split("-")[0] ?? "",
    title: r.name ?? r.original_name ?? "",
  }));
  const best = pickByYear(candidates, yearHint, title);
  if (!best) return null;
  return fetchTvDetail(best.id, apiKey);
}

export async function enrichFromTmdb(rawTitle: string): Promise<TmdbEnrichment | null> {
  const key = rawTitle.toLowerCase().trim();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    cache.set(key, { data: null, ts: Date.now() });
    return null;
  }

  try {
    const yearHint = extractYear(rawTitle);
    const seriesHint = looksLikeSeries(rawTitle);
    const title = cleanTitle(rawTitle);
    if (!title || title.length < 2) {
      cache.set(key, { data: null, ts: Date.now() });
      return null;
    }

    let result: TmdbEnrichment | null = null;
    if (seriesHint) {
      // Series: TV first → movie fallback
      result = await searchTv(title, yearHint, apiKey) ?? await searchMovie(title, yearHint, apiKey);
    } else {
      // Movie: movie first → TV fallback
      result = await searchMovie(title, yearHint, apiKey) ?? await searchTv(title, yearHint, apiKey);
    }

    cache.set(key, { data: result, ts: Date.now() });
    return result;
  } catch {
    cache.set(key, { data: null, ts: Date.now() });
    return null;
  }
}

/** Flush the in-memory TMDB cache so the next call re-fetches from TMDB. */
export function clearTmdbCache(): void {
  cache.clear();
}
