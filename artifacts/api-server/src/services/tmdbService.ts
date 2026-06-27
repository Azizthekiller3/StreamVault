const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";
const CACHE_TTL = 30 * 60 * 1000; // 30 min

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
    // Handle bare numeric codes without semicolons (e.g. "Man39s" → "Man's")
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

async function searchTmdb(title: string, apiKey: string): Promise<TmdbEnrichment | null> {
  // Try movie search first
  const movieUrl = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&api_key=${apiKey}&language=en-US&include_adult=false`;
  const movieRes = await fetch(movieUrl);
  if (!movieRes.ok) throw new Error(`TMDB movie search failed: ${movieRes.status}`);
  const movieData = await movieRes.json() as { results?: { id: number }[] };

  if (movieData.results && movieData.results.length > 0) {
    const firstResult = movieData.results[0];
    const detailUrl = `${TMDB_BASE}/movie/${firstResult.id}?api_key=${apiKey}&language=en-US&append_to_response=credits,external_ids`;
    const detailRes = await fetch(detailUrl);
    if (!detailRes.ok) throw new Error(`TMDB movie detail failed: ${detailRes.status}`);
    const d = await detailRes.json() as {
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
    const cast: TmdbCastMember[] = (d.credits?.cast ?? []).slice(0, 8).map((c) => ({
      name: c.name,
      character: c.character,
      photo: c.profile_path ? `${IMG_BASE}/w185${c.profile_path}` : "",
    }));
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
      cast,
    };
  }

  // Fallback: try TV show search (handles series, seasons, episodes)
  const tvUrl = `${TMDB_BASE}/search/tv?query=${encodeURIComponent(title)}&api_key=${apiKey}&language=en-US&include_adult=false`;
  const tvRes = await fetch(tvUrl);
  if (!tvRes.ok) return null;
  const tvData = await tvRes.json() as { results?: { id: number }[] };

  if (!tvData.results || tvData.results.length === 0) return null;

  const tvId = tvData.results[0].id;
  const tvDetailUrl = `${TMDB_BASE}/tv/${tvId}?api_key=${apiKey}&language=en-US&append_to_response=credits,external_ids`;
  const tvDetailRes = await fetch(tvDetailUrl);
  if (!tvDetailRes.ok) return null;

  const tv = await tvDetailRes.json() as {
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

  const tvCast: TmdbCastMember[] = (tv.credits?.cast ?? []).slice(0, 8).map((c) => ({
    name: c.name,
    character: c.character,
    photo: c.profile_path ? `${IMG_BASE}/w185${c.profile_path}` : "",
  }));

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
    cast: tvCast,
  };
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
    const title = cleanTitle(rawTitle);
    if (!title || title.length < 2) {
      cache.set(key, { data: null, ts: Date.now() });
      return null;
    }

    const result = await searchTmdb(title, apiKey);
    cache.set(key, { data: result, ts: Date.now() });
    return result;
  } catch {
    cache.set(key, { data: null, ts: Date.now() });
    return null;
  }
}
