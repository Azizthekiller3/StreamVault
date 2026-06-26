import * as cheerio from "cheerio";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const CACHE_TTL = 5 * 60 * 1000;

// ── Persistent data directory ──────────────────────────────────────────────
const DATA_DIR = join(process.cwd(), "data");
const SEEDS_FILE = join(DATA_DIR, "seeded-movies.json");
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
    return { channel: parsed.channel || "backupchannek" };
  } catch {
    return { channel: "backupchannek" };
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
  // Bust cache so next request fetches from new channel
  cache.clear();
}

// ── Persistent seed store ──────────────────────────────────────────────────
function loadSeeds(): TelegramMovie[] {
  try {
    ensureDir();
    const raw = readFileSync(SEEDS_FILE, "utf8");
    return JSON.parse(raw) as TelegramMovie[];
  } catch {
    return [];
  }
}

function saveSeeds() {
  try {
    ensureDir();
    writeFileSync(SEEDS_FILE, JSON.stringify(seedMovies, null, 2), "utf8");
  } catch {}
}

export const seedMovies: TelegramMovie[] = loadSeeds();

// ── Cache ──────────────────────────────────────────────────────────────────
interface CacheEntry {
  data: { movies: TelegramMovie[]; hasMore: boolean };
  ts: number;
}
const cache = new Map<string, CacheEntry>();

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

const URL_CHARS = /https?:\/\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=%\-]+/;

function parseQualities(lines: string[]): TeraboxQuality[] {
  const qualities: TeraboxQuality[] = [];
  const patterns = [
    { label: "480p",  re: /480p/i },
    { label: "720p",  re: /720p/i },
    { label: "1080p", re: /1080p/i },
    { label: "4K",    re: /\b(4[Kk]|2160p)\b/ },
  ];
  for (const line of lines) {
    for (const { label, re } of patterns) {
      if (!re.test(line)) continue;
      const urlMatch = line.match(URL_CHARS);
      if (urlMatch && urlMatch[0].toLowerCase().includes("terabox")) {
        if (!qualities.find((q) => q.quality === label)) {
          qualities.push({ quality: label, url: urlMatch[0] });
        }
      }
    }
  }
  return qualities;
}

function parseTitle(lines: string[]): string {
  for (const line of lines) {
    // Match "Title: ...", "Movie: ...", "Movie :- ...", "Movie Name: ..." etc.
    const titleMatch = line.match(/(?:title|movie\s*(?:name)?)\s*[:\-–]+\s*(.+)/i);
    if (titleMatch) {
      return titleMatch[1].replace(/^[\s\-–:]+/, "").replace(/[^\p{L}\p{N}\s\-:'.!?()]/gu, "").trim();
    }
  }
  for (const line of lines) {
    if (line.match(/terabox/i) || line.match(/^\s*\d{3,4}p/i) || line.match(/^https?:/i)) continue;
    if (line.match(/backup|t\.me|subscribe|audio|quality|genre|join|request|group|channel|forward/i)) continue;
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
function htmlToLines($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): string[] {
  $el.find("br").replaceWith("\n");
  return $el.text().split("\n").map((l) => l.trim()).filter(Boolean);
}

/** Parse a raw Telegram post (plain text) into a TelegramMovie. */
export function parseRawPost(text: string, id: string, poster = ""): TelegramMovie | null {
  const lines = text.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  const qualities = parseQualities(lines);
  if (qualities.length === 0) return null;
  return { id, title: parseTitle(lines), poster, audio: parseAudio(lines), qualities, messageId: 0 };
}

/** Add or replace a movie in the persistent seed store. */
export function addSeedMovie(movie: TelegramMovie): void {
  const idx = seedMovies.findIndex((m) => m.id === movie.id);
  if (idx >= 0) seedMovies.splice(idx, 1, movie);
  else seedMovies.unshift(movie);
  saveSeeds();
}

/** Remove a movie from the persistent seed store. */
export function removeSeedMovie(id: string): boolean {
  const idx = seedMovies.findIndex((m) => m.id === id);
  if (idx < 0) return false;
  seedMovies.splice(idx, 1);
  saveSeeds();
  return true;
}

// ── Channel scraper ────────────────────────────────────────────────────────
export async function fetchChannelMovies(before?: number): Promise<{ movies: TelegramMovie[]; hasMore: boolean }> {
  const channel = getChannel();
  const cacheKey = before ? `${channel}-before-${before}` : `${channel}-latest`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { movies: mergeSeed(cached.data.movies), hasMore: cached.data.hasMore || seedMovies.length > 0 };
  }

  const url = before ? `https://t.me/s/${channel}?before=${before}` : `https://t.me/s/${channel}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch channel: ${response.status}`);

  const html = await response.text();
  const $ = cheerio.load(html);
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

    const style =
      $(el).find(".tgme_widget_message_photo_wrap").attr("style") ||
      $(el).find("[style*='background-image']").first().attr("style") || "";
    let posterUrl = "";
    const bgMatch = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
    if (bgMatch) posterUrl = bgMatch[1];
    if (!posterUrl) {
      const imgSrc = $(el).find("img").first().attr("src");
      if (imgSrc) posterUrl = imgSrc;
    }

    movies.push({ id: String(messageId), title: parseTitle(lines), poster: posterUrl, audio: parseAudio(lines), qualities, messageId });
  });

  const result = { movies: movies.reverse(), hasMore: movies.length > 0 };
  cache.set(cacheKey, { data: result, ts: Date.now() });
  return { movies: mergeSeed(result.movies), hasMore: result.hasMore || seedMovies.length > 0 };
}

function mergeSeed(scraped: TelegramMovie[]): TelegramMovie[] {
  if (seedMovies.length === 0) return scraped;
  const scrapedIds = new Set(scraped.map((m) => m.id));
  // Seeds come first (most recently added), then scraped, deduped by id
  const merged = [...seedMovies.filter((m) => !scrapedIds.has(m.id)), ...scraped];
  // Final dedup pass — keep first occurrence of each id
  const seen = new Set<string>();
  return merged.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
}

export async function fetchMovieById(id: string): Promise<TelegramMovie | null> {
  const fromSeed = seedMovies.find((m) => m.id === id);
  if (fromSeed) return fromSeed;
  const msgId = parseInt(id, 10);
  if (!isNaN(msgId)) {
    const { movies } = await fetchChannelMovies(msgId + 2);
    return movies.find((m) => m.id === id) ?? null;
  }
  const { movies } = await fetchChannelMovies();
  return movies.find((m) => m.id === id) ?? null;
}
