import * as cheerio from "cheerio";

const CHANNEL = "dbxixjdb";
const CACHE_TTL = 5 * 60 * 1000;

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
  // First non-link, non-quality line
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
  // Replace <br> with newline marker before getting text
  $el.find("br").replaceWith("\n");
  const raw = $el.text();
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function fetchChannelMovies(before?: number): Promise<{ movies: TelegramMovie[]; hasMore: boolean }> {
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

    // Poster: background-image style on the photo wrap
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
  const msgId = parseInt(id, 10);
  const { movies } = await fetchChannelMovies(msgId + 2);
  return movies.find((m) => m.id === id) ?? null;
}
