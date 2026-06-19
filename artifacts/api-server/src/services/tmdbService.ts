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

function cleanTitle(raw: string): string {
  return raw
    .replace(/\b(480p|720p|1080p|4[Kk]|HDR|BluRay|WEB.?DL|WEBRip|HDCAM|CAM|HEVC|x264|x265)\b/gi, "")
    .replace(/\b(Hindi|English|Tamil|Telugu|Malayalam|Korean|Japanese|Dubbed|Subtitle|Audio)\b/gi, "")
    .replace(/\b(S\d{2}E?\d*|E\d{2}|Season\s*\d+|Episode\s*\d+|Part\s*\d+)\b/gi, "")
    .replace(/\(\d{4}\)/g, "")
    .replace(/\[\d{4}\]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

    // Search for the movie
    const searchUrl = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&api_key=${apiKey}&language=en-US&include_adult=false`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) throw new Error(`TMDB search failed: ${searchRes.status}`);
    const searchData = await searchRes.json() as { results?: { id: number }[] };

    const firstResult = searchData.results?.[0];
    if (!firstResult) {
      cache.set(key, { data: null, ts: Date.now() });
      return null;
    }

    // Get full details with credits and external IDs
    const detailUrl = `${TMDB_BASE}/movie/${firstResult.id}?api_key=${apiKey}&language=en-US&append_to_response=credits,external_ids`;
    const detailRes = await fetch(detailUrl);
    if (!detailRes.ok) throw new Error(`TMDB detail failed: ${detailRes.status}`);

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

    const enrichment: TmdbEnrichment = {
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

    cache.set(key, { data: enrichment, ts: Date.now() });
    return enrichment;
  } catch {
    cache.set(key, { data: null, ts: Date.now() });
    return null;
  }
}
