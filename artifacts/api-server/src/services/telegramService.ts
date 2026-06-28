import * as cheerio from "cheerio";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { db, moviesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { enrichFromTmdb } from "./tmdbService.js";

const CACHE_TTL = 5 * 60 * 1000;

// ── Persistent config directory (channel name) ─────────────────────────────
const DATA_DIR = join(process.cwd(), "data");
const CONFIG_FILE = join(DATA_DIR, "config.json");

function ensureDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

// ── Config (channel name) ──────────────────────────────────────────────────
interface AppConfig {
  channel: string;
}

function loadConfig(): AppConfig {
  try {
    ensureDir();
    const raw = readFileSync(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { channel: parsed.channel || "dbxixjdb" };
  } catch {
    return { channel: "dbxixjdb" };
  }
}

function saveConfig(cfg: AppConfig) {
  try {
    ensureDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf8");
  } catch {}
}

const appConfig: AppConfig = loadConfig();

export function getChannel(): string {
  return appConfig.channel;
}

export function setChannel(username: string): void {
  appConfig.channel = username.replace(/^@/, "").trim();
  saveConfig(appConfig);
  cache.clear();
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface TeraboxQuality {
  quality: string;
  url: string;
}

export interface TelegramMovie {
  id: string;
  title: string;
  poster: string;
  audio: string;
  qualities: TeraboxQuality[];
  messageId: number;
}

// ── In-memory seed store (DB-backed on Koyeb) ──────────────────────────────
export const seedMovies: TelegramMovie[] = [];

function dbRowToMovie(row: {
  messageId: string;
  title: string;
  poster: string;
  audio: string;
  qualities: unknown;
}): TelegramMovie {
  const qualities = Array.isArray(row.qualities) ? (row.qualities as TeraboxQuality[]) : [];
  return {
    id: row.messageId,
    title: row.title,
    poster: row.poster ?? "",
    audio: row.audio ?? "",
    qualities,
    messageId: parseInt(row.messageId, 10) || 0,
  };
}

// Lazy DB init — runs once on first movie request
let _dbInitDone = false;
let _dbInitPromise: Promise<void> | null = null;

async function ensureDbLoaded(): Promise<void> {
  if (_dbInitDone) return;
  if (_dbInitPromise) return _dbInitPromise;
  _dbInitPromise = (async () => {
    try {
      const rows = await db
        .select()
        .from(moviesTable)
        .orderBy(desc(moviesTable.createdAt));
      // Always merge DB rows to handle movies added via webhook before DB init
      const existingIds = new Set(seedMovies.map((m) => m.id));
      for (const row of rows) {
        if (!existingIds.has(row.messageId)) {
          seedMovies.push(dbRowToMovie(row));
        }
      }
      // Fire-and-forget: enrich any poster-less movies from DB via TMDB in background
      const needsEnrich = seedMovies.filter((m) => !m.poster || isTelegramCdnUrl(m.poster));
      if (needsEnrich.length > 0) {
        logger.info({ count: needsEnrich.length }, "[telegramService] starting background TMDB poster enrichment");
        (async () => {
          for (const movie of needsEnrich) {
            try {
              const enriched = await enrichFromTmdb(movie.title, movie.audio);
              if (enriched?.poster && enriched.poster !== "N/A") {
                await db.update(moviesTable).set({ poster: enriched.poster }).where(eq(moviesTable.messageId, movie.id));
                const idx = seedMovies.findIndex((m) => m.id === movie.id);
                if (idx >= 0) seedMovies[idx].poster = enriched.poster;
              }
            } catch { /* skip failures silently */ }
            await new Promise((r) => setTimeout(r, 150)); // respect TMDB rate limit
          }
          logger.info("[telegramService] background TMDB enrichment complete");
        })().catch((err) => logger.error({ err }, "[telegramService] background enrichment error"));
      }
      _dbInitDone = true;
    } catch (err) {
      logger.error({ err }, "[telegramService] DB init failed");
      _dbInitPromise = null; // allow retry on next request
    }
  })();
  return _dbInitPromise;
}

// ── Cache ──────────────────────────────────────────────────────────────────
interface CacheEntry {
  data: { movies: TelegramMovie[]; hasMore: boolean };
  ts: number;
}
const cache = new Map<string, CacheEntry>();

// ── Parsers ────────────────────────────────────────────────────────────────
const URL_CHARS = /https?:\/\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%\-]+/;

function parseQualities(lines: string[]): TeraboxQuality[] {
  const qualities: TeraboxQuality[] = [];
  const qualityPatterns = [
    { label: "480p",  re: /480p/i },
    { label: "720p",  re: /720p/i },
    { label: "1080p", re: /1080p/i },
    { label: "4K",    re: /\b(4[Kk]|2160p)\b/ },
  ];
  for (const line of lines) {
    const urlMatch = line.match(URL_CHARS);
    if (!urlMatch || !urlMatch[0].toLowerCase().includes("terabox")) continue;
    const url = urlMatch[0];
    let found = false;
    for (const { label, re } of qualityPatterns) {
      if (re.test(line)) {
        if (!qualities.find((q) => q.quality === label)) qualities.push({ quality: label, url });
        found = true;
        break;
      }
    }
    if (!found) {
      const ep = line.match(/\bE(\d{2,3})\b/i);
      if (ep) {
        const label = `E${ep[1].padStart(2, "0")}`;
        if (!qualities.find((q) => q.quality === label)) qualities.push({ quality: label, url });
      }
    }
  }
  return qualities;
}

function parseTitle(lines: string[]): string {
  for (const line of lines) {
    const titleMatch = line.match(/(?:title|movie\s*(?:name)?)\s*[:\-–]+\s*(.+)/i);
    if (titleMatch) {
      return titleMatch[1].replace(/^[\s\-–:]+/, "").replace(/[^\p{L}\p{N}\s\-:'.!?()]/gu, "").trim();
    }
  }
  for (const line of lines) {
    if (line.match(/terabox/i) || line.match(/^\s*\d{3,4}p/i) || line.match(/^https?:/i)) continue;
    if (line.match(/backup|t\.me|subscribe|audio|quality|genre|join|request|group|channel|forward/i)) continue;
    if (line.match(/watch.?online|watch.?now|stream.?now|download|click.?here|enjoy.?now|^\s*\/add\s/i)) continue;
    const clean = line.replace(/[^\p{L}\p{N}\s\-:'.!?()#]/gu, "").trim();
    if (clean.length > 2) return clean;
  }
  return "Unknown Title";
}

function parseAudio(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/audio\s*[:\-–]+\s*(.+)/i);
    if (m) return m[1].replace(/^[\s\-–:]+/, "").replace(/[^\p{L}\p{N}\s+()\-]/gu, "").trim();
  }
  const langs: string[] = [];
  for (const line of lines) {
    const m = line.match(/\b(Hindi|English|Tamil|Telugu|Malayalam|Korean|Japanese|Chinese|Punjabi)\b/gi);
    if (m) langs.push(...m);
  }
  return [...new Set(langs)].join(" + ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decodeEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")   // non-breaking space — most common cause of "&nbsp;Title" in stored movies
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)));
}

function htmlToLines($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string[] {
  $el.find("br").replaceWith("\n");
  return decodeEntities($el.text()).split("\n").map((l) => l.trim()).filter(Boolean);
}


/** Returns true if the parsed title looks like a junk/CTA line rather than a real movie title. */
function isJunkTitle(title: string): boolean {
  const t = title.toLowerCase().trim();
  return (
    t.length < 3 ||
    t === "unknown title" ||
    /^(watch.?online|watch.?now|stream.?now|download|click.?here|enjoy.?now|subscribe)/i.test(t) ||
    /^(movie|film|video|series|web.?series|episode)$/.test(t)
  );
}

/** Parse a raw Telegram post (plain text) into a TelegramMovie. */
export function parseRawPost(text: string, id: string, poster = ""): TelegramMovie | null {
  const lines = text.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  const qualities = parseQualities(lines);
  if (qualities.length === 0) return null;
  const title = parseTitle(lines);
  if (isJunkTitle(title)) return null; // reject junk CTA posts
  return { id, title, poster, audio: parseAudio(lines), qualities, messageId: 0 };
}

// Check if a URL is a Telegram CDN URL (not usable in browsers due to CORS/auth)
function isTelegramCdnUrl(url: string): boolean {
  return /telesco\.pe|cdn\.telegram|t\.me/i.test(url);
}

/** Enriches a movie's poster with TMDB in the background if the poster is
 *  missing or is a Telegram CDN URL that won't load in browsers. */
async function enrichPosterInBackground(movie: TelegramMovie): Promise<void> {
  if (movie.poster && !isTelegramCdnUrl(movie.poster)) return;
  try {
    const enriched = await enrichFromTmdb(movie.title, movie.audio);
    if (!enriched?.poster || enriched.poster === 'N/A') return;
    const idx = seedMovies.findIndex((m) => m.id === movie.id);
    if (idx >= 0) seedMovies[idx].poster = enriched.poster;
    movie.poster = enriched.poster;
    void db
      .update(moviesTable)
      .set({ poster: enriched.poster })
      .where(eq(moviesTable.messageId, movie.id))
      .catch((err) => logger.error({ err }, '[telegramService] poster DB update failed'));
    logger.info({ id: movie.id, title: movie.title }, '[telegramService] poster enriched via TMDB');
  } catch (err) {
    logger.warn({ err, title: movie.title }, '[telegramService] TMDB poster enrichment failed');
  }
}

/** Add or replace a movie in the in-memory store and persist to DB. */
export function addSeedMovie(movie: TelegramMovie): void {
  const idx = seedMovies.findIndex((m) => m.id === movie.id);
  if (idx >= 0) seedMovies.splice(idx, 1, movie);
  else seedMovies.unshift(movie);

  void db
    .insert(moviesTable)
    .values({
      messageId: movie.id,
      title: movie.title,
      poster: movie.poster,
      audio: movie.audio,
      qualities: movie.qualities as unknown as string,
    })
    .onConflictDoUpdate({
      target: moviesTable.messageId,
      set: {
        title: movie.title,
        poster: movie.poster,
        audio: movie.audio,
        qualities: movie.qualities as unknown as string,
      },
    })
    .catch((err) => logger.error({ err }, "[telegramService] addSeedMovie DB error"));

  void enrichPosterInBackground(movie);
}

/** Remove a movie from the in-memory store and delete from DB. */
export function removeSeedMovie(id: string): boolean {
  const idx = seedMovies.findIndex((m) => m.id === id);
  if (idx < 0) return false;
  seedMovies.splice(idx, 1);

  void db
    .delete(moviesTable)
    .where(eq(moviesTable.messageId, id))
    .catch((err) => logger.error({ err }, "[telegramService] removeSeedMovie DB error"));
  return true;
}

// ── Channel scraper ────────────────────────────────────────────────────────
export async function fetchChannelMovies(
  before?: number
): Promise<{ movies: TelegramMovie[]; hasMore: boolean }> {
  await ensureDbLoaded();

  const channel = getChannel();
  const cacheKey = before ? `${channel}-before-${before}` : `${channel}-latest`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return {
      movies: mergeSeed(cached.data.movies),
      hasMore: cached.data.hasMore || seedMovies.length > 0,
    };
  }

  const url = before
    ? `https://t.me/s/${channel}?before=${before}`
    : `https://t.me/s/${channel}`;

  // ── Fetch channel HTML (graceful fallback to DB seed on any network error) ──
  let html: string;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!response.ok) throw new Error(`Failed to fetch channel: ${response.status}`);
    html = await response.text();
  } catch (scrapeErr) {
    // Channel is unreachable (network block, rate limit, private channel, etc.)
    // Serve DB-seeded movies with cursor-based pagination instead of returning 500.
    logger.warn({ err: scrapeErr, channel }, "[telegramService] channel scrape failed, serving from DB seed");
    const PAGE = 20;
    let start = 0;
    if (before) {
      const idx = seedMovies.findIndex((m) => m.messageId > 0 && m.messageId < before);
      start = idx >= 0 ? idx : seedMovies.length;
    }
    const page = seedMovies.slice(start, start + PAGE);
    const fallback = { movies: page, hasMore: start + PAGE < seedMovies.length };
    // Cache with short TTL so a subsequent healthy scrape can replace it
    cache.set(cacheKey, { data: fallback, ts: Date.now() - CACHE_TTL + 30_000 });
    return fallback;
  }

  const $ = cheerio.load(html);

  // ── Pass 1: collect every message photo URL keyed by messageId ────────────
  const photoByMsgId = new Map<number, string>();
  const BG_RE = /url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/;

  $(".tgme_widget_message_wrap").each((_, el) => {
    const msgEl = $(el).find(".tgme_widget_message");
    const dataPost = msgEl.attr("data-post") || "";
    const msgId = parseInt(dataPost.split("/").pop() || "0", 10);
    if (!msgId) return;

    const style =
      $(el).find(".tgme_widget_message_photo_wrap").attr("style") ||
      $(el).find("[style*='background-image']").first().attr("style") ||
      "";
    const bgM = style.match(BG_RE);
    if (bgM) { photoByMsgId.set(msgId, bgM[1]); return; }
    const imgSrc = $(el).find("img:not([src^='data'])").first().attr("src");
    if (imgSrc?.startsWith("http")) photoByMsgId.set(msgId, imgSrc);
  });

  // ── Pass 2: extract movie posts, resolve poster from nearest preceding photo
  const movies: TelegramMovie[] = [];

  $(".tgme_widget_message_wrap").each((_, el) => {
    const msgEl = $(el).find(".tgme_widget_message");
    const dataPost = msgEl.attr("data-post") || "";
    const messageId = parseInt(dataPost.split("/").pop() || "0", 10);
    if (!messageId) return;

    const textEl = $(el).find(".tgme_widget_message_text");
    const lines = htmlToLines(textEl, $);
    const qualities = parseQualities(lines);
    if (qualities.length === 0) return;

    let posterUrl = photoByMsgId.get(messageId) ?? "";
    if (!posterUrl) {
      for (let offset = 1; offset <= 10; offset++) {
        const candidate = photoByMsgId.get(messageId - offset);
        if (candidate) { posterUrl = candidate; break; }
      }
    }

    movies.push({
      id: String(messageId),
      title: parseTitle(lines),
      poster: posterUrl,
      audio: parseAudio(lines),
      qualities,
      messageId,
    });
  });

  const result = { movies: movies.reverse(), hasMore: movies.length > 0 };
  cache.set(cacheKey, { data: result, ts: Date.now() });
  return {
    movies: mergeSeed(result.movies),
    hasMore: result.hasMore || seedMovies.length > 0,
  };
}

function mergeSeed(scraped: TelegramMovie[]): TelegramMovie[] {
  if (seedMovies.length === 0) return scraped;
  const seedMap = new Map(seedMovies.map((m) => [m.id, m]));
  const scrapedIds = new Set(scraped.map((m) => m.id));

  const mergedScraped = scraped.map((m) => {
    const seed = seedMap.get(m.id);
    if (seed?.poster && (!m.poster || isTelegramCdnUrl(m.poster))) {
      return { ...m, poster: seed.poster };
    }
    return m;
  });

  const seedOnly = seedMovies.filter((m) => !scrapedIds.has(m.id));
  const merged = [...seedOnly, ...mergedScraped];
  const seen = new Set<string>();
  return merged.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}


/** Self-heals a stale or wrong poster when a movie detail page is opened.
 *  Uses the TMDB cache (30-min TTL), so this is cheap after the first call.
 *  If enrichment returns a DIFFERENT poster, seedMovies + DB are updated silently.
 */
async function selfHealPoster(movie: TelegramMovie): Promise<void> {
  try {
    const enriched = await enrichFromTmdb(movie.title, movie.audio);
    if (!enriched?.poster || enriched.poster === 'N/A') return;
    if (enriched.poster === movie.poster) return; // already correct
    const idx = seedMovies.findIndex((m) => m.id === movie.id);
    if (idx >= 0) seedMovies[idx].poster = enriched.poster;
    void db
      .update(moviesTable)
      .set({ poster: enriched.poster })
      .where(eq(moviesTable.messageId, movie.id))
      .catch((err) => logger.error({ err }, '[telegramService] selfHealPoster DB update failed'));
    logger.info({ id: movie.id, title: movie.title, old: movie.poster?.slice(0,60), new: enriched.poster?.slice(0,60) }, '[telegramService] poster self-healed on detail fetch');
  } catch { /* ignore silently */ }
}

export async function fetchMovieById(id: string): Promise<TelegramMovie | null> {
  await ensureDbLoaded();
  const fromSeed = seedMovies.find((m) => m.id === id);
  if (fromSeed) {
    // Background self-heal: if enrichment returns a better poster, update DB silently.
    // This fixes stale/wrong posters stored before cleanTitle bug was fixed.
    // Uses TMDB cache (30-min TTL) so it's cheap after the first call.
    void selfHealPoster(fromSeed);
    return fromSeed;
  }
  const msgId = parseInt(id, 10);
  if (!isNaN(msgId)) {
    const { movies } = await fetchChannelMovies(msgId + 2);
    return movies.find((m) => m.id === id) ?? null;
  }
  const { movies } = await fetchChannelMovies();
  return movies.find((m) => m.id === id) ?? null;
}

/** Search movies in the in-memory store by title (case-insensitive). */
export async function searchMovies(query: string): Promise<TelegramMovie[]> {
  await ensureDbLoaded();
  const lower = query.toLowerCase().trim();
  if (!lower) return [];
  return seedMovies
    .filter((m) => m.title.toLowerCase().includes(lower))
    .slice(0, 30);
}
