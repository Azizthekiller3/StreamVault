import { Router, type Request, type Response } from "express";
import { fetchChannelMovies, fetchMovieById, addSeedMovie, removeSeedMovie, seedMovies, parseRawPost, searchMovies, type TelegramMovie } from "../services/telegramService.js";
import { enrichFromTmdb } from "../services/tmdbService.js";
import { getComments, addComment } from "../services/commentService.js";
import { verifySecret } from "../lib/auth.js";

const router = Router();

const TELEGRAM_CDN_RE = /cdn\d*\.telesco\.pe/;

/** Replace Telegram-CDN poster URLs with a backend proxy URL so browsers load them without CORS issues. */
function withPosterProxy(movies: ReturnType<typeof Array.prototype.map>, req: import('express').Request) {
  const base = `${req.protocol}://${req.get('host')}`;
  return (movies as import('../services/telegramService.js').TelegramMovie[]).map((m) => ({
    ...m,
    poster: m.poster && TELEGRAM_CDN_RE.test(m.poster)
      ? `${base}/api/telegram/cdn-proxy?url=${encodeURIComponent(m.poster)}`
      : m.poster,
  }));
}


function isValidId(id: string | undefined): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}
function safeInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) || n < 0 ? undefined : n;
}
function requireSecret(req: Request, res: Response): boolean {
  const provided = req.headers["x-backfill-secret"] as string | undefined;
  if (!verifySecret(provided)) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

router.get("/telegram/movies", async (req, res) => {
  try {
    const before = safeInt(req.query["before"] as string | undefined);
    const result = await fetchChannelMovies(before);
    res.json({ movies: withPosterProxy(result.movies, req), hasMore: result.hasMore });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch telegram movies");
    res.status(500).json({ error: "Failed to fetch movies from channel" });
  }
});

router.get("/telegram/movies/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) { res.status(400).json({ error: "Invalid movie ID" }); return; }
  try {
    const movie = await fetchMovieById(id);
    if (!movie) { res.status(404).json({ error: "Movie not found" }); return; }
    res.json(withPosterProxy([movie], req)[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch telegram movie");
    res.status(500).json({ error: "Failed to fetch movie" });
  }
});

router.get("/telegram/search", async (req, res) => {
  const q = (req.query["q"] as string | undefined)?.trim() ?? "";
  if (q.length < 2) {
    res.json({ movies: [] });
    return;
  }
  try {
    const movies = await searchMovies(q);
    res.json({ movies: withPosterProxy(movies, req) });
  } catch (err) {
    req.log.error({ err }, "Telegram search failed");
    res.status(500).json({ error: "Search failed" });
  }
});

router.get("/tmdb/enrich", async (req, res) => {
  const title = req.query["title"] as string | undefined;
  if (!title?.trim()) { res.status(400).json({ error: "title query param required" }); return; }
  if (title.trim().length > 200) { res.status(400).json({ error: "title too long" }); return; }
  try {
    const data = await enrichFromTmdb(title.trim());
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "TMDB enrich failed");
    res.status(500).json({ error: "TMDB lookup failed" });
  }
});

router.get("/comments/:movieId", async (req, res) => {
  const { movieId } = req.params;
  if (!isValidId(movieId)) { res.status(400).json({ error: "Invalid movie ID" }); return; }
  try {
    const comments = await getComments(movieId);
    res.json(comments);
  } catch (err) {
    req.log.error({ err }, "Failed to get comments");
    res.json([]);
  }
});

router.post("/comments/:movieId", async (req, res) => {
  const { movieId } = req.params;
  if (!isValidId(movieId)) { res.status(400).json({ error: "Invalid movie ID" }); return; }
  try {
    const { username, text } = req.body as { username?: unknown; text?: unknown };
    if (typeof username !== "string" || typeof text !== "string") {
      res.status(400).json({ error: "username and text must be strings" }); return;
    }
    if (!username.trim() || !text.trim()) {
      res.status(400).json({ error: "username and text are required" }); return;
    }
    const comment = await addComment(movieId, username, text);
    if (!comment) { res.status(400).json({ error: "Invalid comment" }); return; }
    res.status(201).json(comment);
  } catch (err) {
    req.log.error({ err }, "Failed to add comment");
    res.status(500).json({ error: "Failed to save comment" });
  }
});

router.post("/telegram/seed", (req, res) => {
  if (!requireSecret(req, res)) return;
  const body = req.body as Partial<TelegramMovie>;
  const { id, title, audio, qualities, poster } = body;
  if (!id || !title || !Array.isArray(qualities) || qualities.length === 0) {
    res.status(400).json({ error: "id, title and at least one quality are required" }); return;
  }
  const movie: TelegramMovie = {
    id: String(id).slice(0, 64), title: String(title).slice(0, 200),
    poster: typeof poster === "string" ? poster : "",
    audio: typeof audio === "string" ? audio : "",
    qualities: qualities.filter((q) => q && typeof q.quality === "string" && typeof q.url === "string")
      .map((q) => ({ quality: String(q.quality), url: String(q.url) })).slice(0, 10),
    messageId: 0,
  };
  addSeedMovie(movie);
  req.log.info({ id: movie.id, title: movie.title }, "Movie seeded (legacy)");
  res.status(201).json({ ok: true, movie });
});

router.delete("/telegram/seed/:id", (req, res) => {
  if (!requireSecret(req, res)) return;
  const { id } = req.params;
  const removed = removeSeedMovie(id);
  if (!removed) { res.status(404).json({ error: "Seed movie not found" }); return; }
  res.json({ ok: true });
});

router.post("/telegram/backfill", async (req, res) => {
  if (!requireSecret(req, res)) return;
  const pages = Math.min(safeInt(req.query["pages"] as string | undefined) ?? 5, 50);
  try {
    let total = 0;
    let persisted = 0;
    let before: number | undefined;
    for (let i = 0; i < pages; i++) {
      const result = await fetchChannelMovies(before);
      total += result.movies.length;
      // Persist each scraped movie to the DB via addSeedMovie
      for (const movie of result.movies) {
        addSeedMovie(movie);
        persisted++;
      }
      if (!result.hasMore || result.movies.length === 0) break;
      const minId = Math.min(...result.movies.map((m) => m.messageId));
      before = minId;
    }
    res.json({ ok: true, moviesIndexed: total, moviesPersisted: persisted, pagesScraped: pages });
  } catch (err) {
    req.log.error({ err }, "Backfill failed");
    res.status(500).json({ error: "Backfill failed" });
  }
});

router.post("/telegram/register-webhook", async (req, res) => {
  if (!requireSecret(req, res)) return;
  const { webhookUrl } = req.body as { webhookUrl?: unknown };
  if (typeof webhookUrl !== "string" || !webhookUrl.startsWith("https://")) {
    res.status(400).json({ error: "webhookUrl must be a valid https URL" }); return;
  }
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) { res.status(500).json({ error: "BOT_API_TOKEN not configured" }); return; }
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = await tgRes.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Register webhook failed");
    res.status(500).json({ error: "Failed to register webhook" });
  }
});

router.post("/telegram/parse-and-add", async (req, res) => {
  if (!requireSecret(req, res)) return;
  const { text, poster } = req.body as { text?: unknown; poster?: unknown };
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text (raw Telegram message) is required" }); return;
  }
  const id = `manual_${Date.now()}`;
  const movie = parseRawPost(text.trim(), id, typeof poster === "string" ? poster : "");
  if (!movie) {
    res.status(400).json({ error: "No Terabox links found — make sure 720p/1080p links are in the text" }); return;
  }
  try {
    const enriched = await enrichFromTmdb(movie.title);
    if (enriched?.poster && enriched.poster !== "N/A") movie.poster = enriched.poster;
  } catch (err) {
    req.log.warn({ err, title: movie.title }, "TMDB enrichment failed for parse-and-add (non-fatal)");
  }
  addSeedMovie(movie);
  req.log.info({ id: movie.id, title: movie.title }, "Movie added via parse-and-add");
  res.status(201).json({ ok: true, movie });
});

router.post("/telegram/webhook", async (req, res) => {
  res.json({ ok: true });
  try {
    const update = req.body as {
      channel_post?: {
        message_id: number;
        text?: string;
        caption?: string;
        photo?: { file_id: string; width: number; height: number }[];
      };
    };
    const post = update?.channel_post;
    if (!post) return;

    // Extract photo from Telegram post — use the largest resolution variant
    let telegramPoster = "";
    if (Array.isArray(post.photo) && post.photo.length > 0) {
      const bestPhoto = post.photo[post.photo.length - 1];
      const base = `${req.protocol}://${req.get('host')}`;
      telegramPoster = `${base}/api/telegram/photo/${bestPhoto.file_id}`;
    }

    const rawText = post.text || post.caption || "";
    if (!rawText.trim()) return;
    const movie = parseRawPost(rawText, String(post.message_id), telegramPoster);
    if (!movie) return;
    // If no Telegram photo, fall back to TMDB poster
    if (!movie.poster) {
      try {
        const enriched = await enrichFromTmdb(movie.title);
        if (enriched?.poster && enriched.poster !== "N/A") movie.poster = enriched.poster;
      } catch (err) {
        req.log.warn({ err, title: movie.title }, "TMDB enrichment failed for webhook (non-fatal)");
      }
    }
    movie.messageId = post.message_id;
    addSeedMovie(movie);
    req.log.info({ id: movie.id, title: movie.title, hasPoster: !!movie.poster }, "Movie added via webhook");
  } catch (err) {
    req.log.error({ err }, "Webhook processing error");
  }
});


// ── Telegram CDN image proxy ──────────────────────────────────────────────
// Proxies poster thumbnails from Telegram's public web-view CDN so the browser
// can load them without CORS issues. Only allows *.telesco.pe hostnames.
router.get("/telegram/cdn-proxy", async (req, res) => {
  const url = (req.query["url"] as string | undefined)?.trim();
  if (!url) { res.status(400).send(); return; }
  let parsed: URL;
  try { parsed = new URL(url); } catch { res.status(400).send(); return; }
  if (!parsed.hostname.endsWith("telesco.pe")) { res.status(403).send(); return; }
  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://t.me/",
      },
    });
    if (!upstream.ok) { res.status(upstream.status).send(); return; }
    res.set({
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=604800",
    });
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch { res.status(502).send(); }
});

// ── Telegram Bot API file proxy ───────────────────────────────────────────
// Proxies a photo attached to a channel post, identified by its file_id.
// The bot token never leaves the server.
router.get("/telegram/photo/:fileId", async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) { res.status(503).json({ error: "Bot not configured" }); return; }
  const { fileId } = req.params;
  if (!fileId || !/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) { res.status(400).send(); return; }
  try {
    const gf = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const gfData = await gf.json() as { ok: boolean; result?: { file_path: string } };
    if (!gfData.ok || !gfData.result?.file_path) { res.status(404).send(); return; }
    const upstream = await fetch(`https://api.telegram.org/file/bot${token}/${gfData.result.file_path}`);
    if (!upstream.ok) { res.status(upstream.status).send(); return; }
    res.set({
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=604800",
    });
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch { res.status(502).send(); }
});


export default router;