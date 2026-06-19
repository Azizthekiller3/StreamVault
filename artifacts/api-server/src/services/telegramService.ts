import * as cheerio from "cheerio";
import { db } from "@workspace/db";
import { moviesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const CHANNEL = "dbxixjdb";
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || "-1001499616642";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry {
  data: { movies: TelegramMovie[]; hasMore: boolean };
  ts: number;
}
const cache = new Map<string, CacheEntry>();
const imageUrlCache = new Map<string, { url: string; ts: number }>();

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
    { label: "480p", re: /480p/i },
    { label: "720p", re: /720p/i },
    { label: "1080p", re: /1080p/i },
    { label: "4K", re: /4[Kk]/i },
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
    const titleMatch = line.match(/title\s*[:\-–]\s*(.+)/i);
    if (titleMatch) {
      return titleMatch[1]
        .replace(/[^\p{L}\p{N}\s\-:'.!?()]/gu, "")
        .trim();
    }
  }
  for (const line of lines) {
    if (line.match(/terabox/i) || line.match(/^\s*\d{3,4}p/i) || line.match(/^https?:/i)) continue;
    if (line.match(/backup|t\.me|subscribe/i)) continue;
    const clean = line.replace(/[^\p{L}\p{N}\s\-:'.!?()#]/gu, "").trim();
    if (clean.length > 2) return clean;
  }
  return "Unknown Title";
}

function parseAudio(lines: string[]): string {
  for (const line of lines) {
    const m = line.match(/audio\s*[:\-–]\s*(.+)/i);
    if (m) {
      return m[1].replace(/[^\p{L}\p{N}\s+]/gu, "").trim();
    }
  }
  const langs: string[] = [];
  for (const line of lines) {
    const m = line.match(/\b(Hindi|English|Tamil|Telugu|Malayalam|Korean|Japanese|Chinese|Punjabi)\b/gi);
    if (m) langs.push(...m);
  }
  return [...new Set(langs)].join(" + ");
}

function htmlToLines($el: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI): string[] {
  $el.find("br").replaceWith("\n");
  const raw = $el.text();
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function rowToMovie(row: typeof moviesTable.$inferSelect): TelegramMovie {
  return {
    id: String(row.messageId),
    title: row.title,
    poster: row.poster || (row.posterFileId ? `/api/telegram/image/${row.posterFileId}` : ""),
    audio: row.audio,
    qualities: (row.qualities as TeraboxQuality[]) || [],
    messageId: row.messageId,
  };
}

export async function getMoviesFromDB(limit = 200): Promise<TelegramMovie[]> {
  try {
    const rows = await db
      .select()
      .from(moviesTable)
      .orderBy(desc(moviesTable.messageId))
      .limit(limit);
    return rows.map(rowToMovie);
  } catch {
    return [];
  }
}

export async function saveMovieToDB(movie: TelegramMovie, posterFileId = ""): Promise<void> {
  try {
    await db
      .insert(moviesTable)
      .values({
        messageId: movie.messageId,
        title: movie.title,
        poster: movie.poster,
        posterFileId,
        audio: movie.audio,
        qualities: movie.qualities as unknown as string,
      })
      .onConflictDoUpdate({
        target: moviesTable.messageId,
        set: {
          title: movie.title,
          poster: movie.poster,
          posterFileId,
          audio: movie.audio,
          qualities: movie.qualities as unknown as string,
        },
      });
  } catch {
    // Ignore DB errors silently
  }
}

export async function getFileUrl(fileId: string): Promise<string> {
  const cached = imageUrlCache.get(fileId);
  if (cached && Date.now() - cached.ts < 50 * 60 * 1000) return cached.url;

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const data = await res.json() as { ok: boolean; result?: { file_path?: string } };
  if (!data.ok || !data.result?.file_path) return "";

  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
  imageUrlCache.set(fileId, { url, ts: Date.now() });
  return url;
}

interface TgPhoto {
  file_id: string;
  file_size: number;
  width: number;
  height: number;
}

interface TgChannelPost {
  message_id: number;
  text?: string;
  caption?: string;
  photo?: TgPhoto[];
}

export function parseWebhookPost(post: TgChannelPost): { movie: TelegramMovie; posterFileId: string } | null {
  const rawText = post.caption || post.text || "";
  if (!rawText) return null;

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const qualities = parseQualities(lines);
  if (qualities.length === 0) return null;

  let posterFileId = "";
  if (post.photo && post.photo.length > 0) {
    const largest = post.photo.sort((a, b) => (b.file_size || 0) - (a.file_size || 0))[0];
    posterFileId = largest.file_id;
  }

  return {
    movie: {
      id: String(post.message_id),
      title: parseTitle(lines),
      poster: posterFileId ? `/api/telegram/image/${posterFileId}` : "",
      audio: parseAudio(lines),
      qualities,
      messageId: post.message_id,
    },
    posterFileId,
  };
}

export async function fetchChannelMovies(before?: number): Promise<{ movies: TelegramMovie[]; hasMore: boolean }> {
  // Try DB first
  if (!before) {
    const dbMovies = await getMoviesFromDB();
    if (dbMovies.length > 0) {
      return { movies: dbMovies, hasMore: true };
    }
  }

  const cacheKey = before ? `before-${before}` : "latest";
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const url = before ? `https://t.me/s/${CHANNEL}?before=${before}` : `https://t.me/s/${CHANNEL}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
      $(el).find("[style*='background-image']").first().attr("style") ||
      "";
    let posterUrl = "";
    const bgMatch = style.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
    if (bgMatch) posterUrl = bgMatch[1];
    if (!posterUrl) {
      const imgSrc = $(el).find("img").first().attr("src");
      if (imgSrc) posterUrl = imgSrc;
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
  return result;
}

export async function fetchMovieById(id: string): Promise<TelegramMovie | null> {
  // Try DB first
  try {
    const msgId = parseInt(id, 10);
    const rows = await db.select().from(moviesTable).where(eq(moviesTable.messageId, msgId)).limit(1);
    if (rows.length > 0) return rowToMovie(rows[0]!);
  } catch {
    // Fall through to scraper
  }

  const msgId = parseInt(id, 10);
  const { movies } = await fetchChannelMovies(msgId + 2);
  return movies.find((m) => m.id === id) ?? null;
}

export async function backfillFromScraper(pages = 5): Promise<number> {
  let saved = 0;
  let before: number | undefined;

  for (let i = 0; i < pages; i++) {
    try {
      const url = before
        ? `https://t.me/s/${CHANNEL}?before=${before}`
        : `https://t.me/s/${CHANNEL}`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!response.ok) break;

      const html = await response.text();
      const $ = cheerio.load(html);
      let minMsgId = Infinity;
      let foundAny = false;

      const tasks: Promise<void>[] = [];
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

        const movie: TelegramMovie = {
          id: String(messageId),
          title: parseTitle(lines),
          poster: posterUrl,
          audio: parseAudio(lines),
          qualities,
          messageId,
        };

        foundAny = true;
        if (messageId < minMsgId) minMsgId = messageId;
        tasks.push(saveMovieToDB(movie).then(() => { saved++; }));
      });

      await Promise.all(tasks);
      if (!foundAny || minMsgId === Infinity) break;
      before = minMsgId;

      await new Promise((r) => setTimeout(r, 500));
    } catch {
      break;
    }
  }

  return saved;
}
