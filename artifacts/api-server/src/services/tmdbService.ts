import { db } from "@workspace/db";
import { titleOverridesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p";
const CACHE_TTL = 30 * 60 * 1000;
const OVERRIDE_CACHE_TTL = 60 * 60 * 1000;
const MIN_CONFIDENCE = 35;
const MAX_YEAR_DRIFT = 5;

// ── Language maps ──────────────────────────────────────────────────────────
const LANG_MAP: Record<string, string> = {
  hindi: "hi", english: "en", tamil: "ta", telugu: "te",
  malayalam: "ml", kannada: "kn", korean: "ko", japanese: "ja",
  chinese: "zh", punjabi: "pa", bengali: "bn", gujarati: "gu", marathi: "mr",
  french: "fr", spanish: "es", portuguese: "pt", italian: "it",
  german: "de", turkish: "tr", russian: "ru", arabic: "ar",
};

// Abbreviations used in Telegram audio fields
const LANG_ABBREV: Record<string, string> = {
  hin: "hi", eng: "en", tam: "ta", tel: "te", mal: "ml",
  kan: "kn", kor: "ko", jpn: "ja", chi: "zh", pun: "pa",
  ben: "bn", rus: "ru", ara: "ar",
};

// Languages that are Indian / South Asian
const INDIAN_LANGS = new Set(["hi", "ta", "te", "ml", "kn", "pa", "bn", "gu", "mr"]);

/**
 * v2: Extract the ORIGINAL language of the content from the audio field.
 *
 * Key insight: "Hindi + Korean (Esub)" means a Korean film dubbed in Hindi.
 * TMDB will report original_language=ko — so we must boost Korean results.
 *
 * Rules (in priority order):
 * 1. Explicit "[lang] ORG" or "[lang] ORIGINAL" → that language is original
 * 2. "FAN DUB" or "FAN VOICE" near Hindi → Hindi is a fan dub; use other lang
 * 3. An unambiguous foreign (non-Indian, non-English) language present → it's original
 * 4. Fallback: return first language found (Hindi for most Indian uploads)
 */
function extractOriginalLanguage(audio?: string): string | null {
  if (!audio) return null;
  const lower = audio.toLowerCase();

  const allLangs = { ...LANG_MAP, ...LANG_ABBREV };

  // Rule 1: "[lang] ORG" or "[lang] ORIGINAL" — explicit original marker
  for (const [name, code] of Object.entries(allLangs)) {
    if (new RegExp(`\\b${name}\\s+(?:original|orig\\b|org\\b)`, "i").test(lower)) {
      return code;
    }
  }

  // Rule 2: "FAN DUB" / "FAN VOICE" → Hindi is a fan dub; return first non-Hindi lang
  if (/fan\s*(?:dub|voice)/i.test(lower)) {
    for (const [name, code] of Object.entries(allLangs)) {
      if (code !== "hi" && lower.includes(name)) return code;
    }
  }

  // Rule 3: Unambiguous foreign language present (Korean, Japanese, Chinese, French, etc.)
  // English is excluded here — "Hindi + English" is ambiguous (could be either original)
  for (const [name, code] of Object.entries(allLangs)) {
    if (!INDIAN_LANGS.has(code) && code !== "en" && lower.includes(name)) {
      return code;
    }
  }

  // Rule 4: Return first language found (usually Hindi for Indian uploads)
  for (const [name, code] of Object.entries(allLangs)) {
    if (lower.includes(name)) return code;
  }

  return null;
}

// ── In-memory caches ───────────────────────────────────────────────────────
interface CacheEntry { data: TmdbEnrichment | null; ts: number }
const cache = new Map<string, CacheEntry>();

interface OverrideCacheEntry { tmdbId: number; mediaType: string; ts: number }
const overrideCache = new Map<string, OverrideCacheEntry>();
let overrideCacheLoadedAt = 0;

// ── Types ──────────────────────────────────────────────────────────────────
export interface TmdbCastMember { name: string; character: string; photo: string }

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
  mediaType: "movie" | "tv";
  confidence?: number;
}

export interface TmdbSearchResult {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string;
  poster: string;
  overview: string;
  rating: number;
  voteCount: number;
  originalLanguage: string;
}

// ── Title utilities ────────────────────────────────────────────────────────
function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/(\w)39(\w)/g, "$1'$2").replace(/(\w)38(\w)/g, "$1&$2");
}

function cleanTitle(raw: string): string {
  return decodeHtmlEntities(raw)
    .replace(/\b(480p|720p|1080p|4[Kk]|HDR|BluRay|WEB.?DL|WEBRip|HDCAM|CAM|HEVC|x264|x265|HIN|ENG|TAM|TEL|MAL|KAN|KOR)\b/gi, "")
    .replace(/\b(Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Japanese|Dubbed|Subtitles?|Audio|Multi|Dual)\b/gi, "")
    .replace(/\b(Movie|Film|Full|Official|Trailer|Video|Song|Songs|OST)\b/gi, "")
    .replace(/\b(S\d{2}E?\d*|E\d{2}|Season\s*\d+|Episode\s*\d+|Part\s*\d+)\b/gi, "")
    .replace(/\(\d{4}\)/g, "").replace(/\[\d{4}\]/g, "")
    .replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
}

function extractYear(raw: string): string | null {
  const m = raw.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  return m ? m[1] : null;
}

function looksLikeSeries(raw: string): boolean {
  return /\b(Season|Series|Web.?Series|S\d{2})\b/i.test(raw);
}

// ── Confidence scoring ─────────────────────────────────────────────────────
interface ScoredCandidate {
  id: number; mediaType: "movie" | "tv"; title: string;
  releaseYear: string; originalLanguage: string; voteCount: number; score: number;
}

function scoreCandidate(
  c: Omit<ScoredCandidate, "score">,
  cleanedTitle: string,
  yearHint: string | null,
  originalLangHint: string | null,
  preferSeries: boolean
): number {
  let score = 0;

  // Title word overlap (0-40 pts)
  const sigWords = cleanedTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (sigWords.length > 0) {
    const rTitle = c.title.toLowerCase();
    const overlap = sigWords.filter((w) => rTitle.includes(w)).length;
    score += Math.round((overlap / sigWords.length) * 40);
  } else {
    score += 20;
  }

  // Year proximity (0-30 pts)
  if (yearHint && c.releaseYear) {
    const diff = Math.abs(parseInt(yearHint, 10) - parseInt(c.releaseYear, 10));
    if (diff === 0) score += 30;
    else if (diff <= 1) score += 22;
    else if (diff <= 2) score += 14;
    else if (diff <= MAX_YEAR_DRIFT) score += 6;
    else score -= 10;
  }

  // Language match — uses ORIGINAL language (not dubbed language) (0-20 pts)
  // E.g., "Hindi + Korean" audio → originalLangHint="ko" → Korean TMDB results get +20
  if (originalLangHint) {
    if (c.originalLanguage === originalLangHint) {
      score += 20;
    } else if (INDIAN_LANGS.has(originalLangHint) && c.originalLanguage === "en") {
      // Indian original film, but TMDB categorizes as en (happens for some Bollywood)
      score += 8;
    } else if (originalLangHint === "hi" && c.originalLanguage === "en") {
      // Hindi content often has English original on TMDB
      score += 8;
    }
  }

  // Media type preference (0-5 pts)
  if (preferSeries && c.mediaType === "tv") score += 5;
  else if (!preferSeries && c.mediaType === "movie") score += 5;

  // Popularity / vote count (0-5 pts)
  if (c.voteCount > 2000) score += 5;
  else if (c.voteCount > 500) score += 3;
  else if (c.voteCount > 50) score += 1;

  return score;
}

// ── TMDB fetch helpers ─────────────────────────────────────────────────────
async function fetchMovieDetail(id: number, apiKey: string): Promise<TmdbEnrichment> {
  const url = `${TMDB_BASE}/movie/${id}?api_key=${apiKey}&language=en-US&append_to_response=credits,external_ids`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB movie detail ${id} failed: ${res.status}`);
  const d = await res.json() as {
    id: number; overview?: string; poster_path?: string; backdrop_path?: string;
    vote_average?: number; vote_count?: number; release_date?: string;
    runtime?: number; tagline?: string; genres?: { name: string }[];
    credits?: { cast?: { name: string; character: string; profile_path?: string }[] };
    external_ids?: { imdb_id?: string };
  };
  return {
    tmdbId: d.id, imdbId: d.external_ids?.imdb_id ?? null,
    overview: d.overview ?? "",
    poster: d.poster_path ? `${IMG_BASE}/w342${d.poster_path}` : "",
    backdrop: d.backdrop_path ? `${IMG_BASE}/w780${d.backdrop_path}` : "",
    rating: Math.round((d.vote_average ?? 0) * 10) / 10,
    voteCount: d.vote_count ?? 0,
    year: (d.release_date ?? "").split("-")[0] ?? "",
    runtime: d.runtime ?? 0, tagline: d.tagline ?? "",
    genres: (d.genres ?? []).map((g) => g.name).slice(0, 4),
    cast: (d.credits?.cast ?? []).slice(0, 8).map((c) => ({
      name: c.name, character: c.character,
      photo: c.profile_path ? `${IMG_BASE}/w185${c.profile_path}` : "",
    })),
    mediaType: "movie",
  };
}

async function fetchTvDetail(id: number, apiKey: string): Promise<TmdbEnrichment> {
  const url = `${TMDB_BASE}/tv/${id}?api_key=${apiKey}&language=en-US&append_to_response=credits,external_ids`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB tv detail ${id} failed: ${res.status}`);
  const tv = await res.json() as {
    id: number; overview?: string; poster_path?: string; backdrop_path?: string;
    vote_average?: number; vote_count?: number; first_air_date?: string;
    episode_run_time?: number[]; tagline?: string; genres?: { name: string }[];
    credits?: { cast?: { name: string; character: string; profile_path?: string }[] };
    external_ids?: { imdb_id?: string };
  };
  return {
    tmdbId: tv.id, imdbId: tv.external_ids?.imdb_id ?? null,
    overview: tv.overview ?? "",
    poster: tv.poster_path ? `${IMG_BASE}/w342${tv.poster_path}` : "",
    backdrop: tv.backdrop_path ? `${IMG_BASE}/w780${tv.backdrop_path}` : "",
    rating: Math.round((tv.vote_average ?? 0) * 10) / 10,
    voteCount: tv.vote_count ?? 0,
    year: (tv.first_air_date ?? "").split("-")[0] ?? "",
    runtime: tv.episode_run_time?.[0] ?? 0, tagline: tv.tagline ?? "",
    genres: (tv.genres ?? []).map((g) => g.name).slice(0, 4),
    cast: (tv.credits?.cast ?? []).slice(0, 8).map((c) => ({
      name: c.name, character: c.character,
      photo: c.profile_path ? `${IMG_BASE}/w185${c.profile_path}` : "",
    })),
    mediaType: "tv",
  };
}

// ── /search/multi ──────────────────────────────────────────────────────────
async function searchMulti(
  title: string, yearHint: string | null, langHint: string | null,
  preferSeries: boolean, apiKey: string
): Promise<{ enrichment: TmdbEnrichment; confidence: number } | null> {
  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(title)}&api_key=${apiKey}&language=en-US&include_adult=false`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json() as {
    results?: {
      id: number; media_type: "movie" | "tv" | "person";
      title?: string; name?: string; release_date?: string; first_air_date?: string;
      vote_count?: number; original_language?: string;
    }[];
  };
  if (!data.results?.length) return null;

  const candidates: ScoredCandidate[] = [];
  for (const r of data.results.slice(0, 10)) {
    if (r.media_type === "person") continue;
    const itemTitle = r.media_type === "tv" ? (r.name ?? "") : (r.title ?? "");
    const releaseYear = r.media_type === "tv"
      ? (r.first_air_date ?? "").split("-")[0] ?? ""
      : (r.release_date ?? "").split("-")[0] ?? "";
    const base = {
      id: r.id, mediaType: r.media_type,
      title: itemTitle, releaseYear,
      originalLanguage: r.original_language ?? "",
      voteCount: r.vote_count ?? 0,
    } satisfies Omit<ScoredCandidate, "score">;
    const score = scoreCandidate(base, title, yearHint, langHint, preferSeries);
    candidates.push({ ...base, score });
  }
  if (!candidates.length) return null;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  if (best.score < MIN_CONFIDENCE) {
    logger.warn({ title, score: best.score, best: best.title }, "[tmdb] Low confidence — skipping");
    return null;
  }

  logger.info({ title, score: best.score, matched: best.title, lang: best.originalLanguage, hint: langHint }, "[tmdb] matched");

  const enrichment = best.mediaType === "tv"
    ? await fetchTvDetail(best.id, apiKey)
    : await fetchMovieDetail(best.id, apiKey);

  return { enrichment, confidence: best.score };
}

// ── Override helpers ───────────────────────────────────────────────────────
async function loadOverrides(): Promise<void> {
  if (Date.now() - overrideCacheLoadedAt < OVERRIDE_CACHE_TTL) return;
  try {
    const rows = await db.select().from(titleOverridesTable);
    overrideCache.clear();
    for (const row of rows) {
      overrideCache.set(row.rawTitle.toLowerCase(), { tmdbId: row.tmdbId, mediaType: row.mediaType, ts: Date.now() });
    }
    overrideCacheLoadedAt = Date.now();
  } catch (err) { logger.error({ err }, "[tmdb] failed to load overrides"); }
}

async function checkOverride(rawTitle: string, apiKey: string): Promise<TmdbEnrichment | null> {
  await loadOverrides();
  const override = overrideCache.get(rawTitle.toLowerCase());
  if (!override) return null;
  try {
    const enrichment = override.mediaType === "tv"
      ? await fetchTvDetail(override.tmdbId, apiKey)
      : await fetchMovieDetail(override.tmdbId, apiKey);
    enrichment.confidence = 100;
    return enrichment;
  } catch (err) {
    logger.error({ err, rawTitle }, "[tmdb] override fetch failed");
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function enrichFromTmdb(rawTitle: string, audio?: string): Promise<TmdbEnrichment | null> {
  const key = rawTitle.toLowerCase().trim();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) { cache.set(key, { data: null, ts: Date.now() }); return null; }

  try {
    // 1. Permanent overrides win
    const override = await checkOverride(rawTitle, apiKey);
    if (override) { cache.set(key, { data: override, ts: Date.now() }); return override; }

    // 2. Clean title + extract hints using v2 ORIGINAL language detection
    const yearHint = extractYear(rawTitle);
    const preferSeries = looksLikeSeries(rawTitle);
    const originalLang = extractOriginalLanguage(audio); // v2: detects original, not dubbed
    const title = cleanTitle(rawTitle);

    if (!title || title.length < 2) { cache.set(key, { data: null, ts: Date.now() }); return null; }

    // 3. Smart multi-search with confidence scoring
    const match = await searchMulti(title, yearHint, originalLang, preferSeries, apiKey);
    if (!match) { cache.set(key, { data: null, ts: Date.now() }); return null; }

    match.enrichment.confidence = match.confidence;
    cache.set(key, { data: match.enrichment, ts: Date.now() });
    return match.enrichment;
  } catch (err) {
    logger.error({ err, rawTitle }, "[tmdb] enrichFromTmdb error");
    cache.set(key, { data: null, ts: Date.now() });
    return null;
  }
}

export async function searchTmdbForAdmin(
  query: string, year?: string, type?: "movie" | "tv"
): Promise<TmdbSearchResult[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];
  const yearParam = year ? `&year=${year}&first_air_date_year=${year}` : "";
  const url = `${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&api_key=${apiKey}&language=en-US&include_adult=false${yearParam}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as {
    results?: {
      id: number; media_type: "movie" | "tv" | "person"; title?: string; name?: string;
      release_date?: string; first_air_date?: string; vote_average?: number;
      vote_count?: number; original_language?: string; poster_path?: string; overview?: string;
    }[];
  };
  return (data.results ?? [])
    .filter((r) => r.media_type !== "person" && (!type || r.media_type === type))
    .slice(0, 12)
    .map((r) => ({
      tmdbId: r.id, mediaType: r.media_type as "movie" | "tv",
      title: r.media_type === "tv" ? (r.name ?? "") : (r.title ?? ""),
      year: r.media_type === "tv"
        ? (r.first_air_date ?? "").split("-")[0] ?? ""
        : (r.release_date ?? "").split("-")[0] ?? "",
      poster: r.poster_path ? `${IMG_BASE}/w185${r.poster_path}` : "",
      overview: (r.overview ?? "").slice(0, 200),
      rating: Math.round((r.vote_average ?? 0) * 10) / 10,
      voteCount: r.vote_count ?? 0,
      originalLanguage: r.original_language ?? "",
    }));
}

export async function saveTitleOverride(
  rawTitle: string, tmdbId: number, mediaType: "movie" | "tv"
): Promise<void> {
  const apiKey = process.env.TMDB_API_KEY ?? "";
  let tmdbTitle = ""; let tmdbPoster = "";
  try {
    const detail = mediaType === "tv" ? await fetchTvDetail(tmdbId, apiKey) : await fetchMovieDetail(tmdbId, apiKey);
    tmdbTitle = rawTitle;
    tmdbPoster = detail.poster;
  } catch {}
  await db.insert(titleOverridesTable).values({ rawTitle, tmdbId, mediaType, tmdbTitle, tmdbPoster })
    .onConflictDoUpdate({ target: titleOverridesTable.rawTitle, set: { tmdbId, mediaType, tmdbTitle, tmdbPoster } });
  overrideCacheLoadedAt = 0;
  cache.delete(rawTitle.toLowerCase());
  logger.info({ rawTitle, tmdbId, mediaType }, "[tmdb] override saved");
}

export async function deleteTitleOverride(id: number): Promise<void> {
  await db.delete(titleOverridesTable).where(eq(titleOverridesTable.id, id));
  overrideCacheLoadedAt = 0;
  logger.info({ id }, "[tmdb] override deleted");
}

export function clearTmdbCache(): void {
  cache.clear(); overrideCache.clear(); overrideCacheLoadedAt = 0;
}
