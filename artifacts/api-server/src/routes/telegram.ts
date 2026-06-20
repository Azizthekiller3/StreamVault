import { Router, type Request, type Response } from "express";
import { fetchChannelMovies, fetchMovieById, seedMovies, type TelegramMovie } from "../services/telegramService.js";
import { enrichFromTmdb } from "../services/tmdbService.js";
import { getComments, addComment } from "../services/commentService.js";
import { verifySecret } from "../lib/auth.js";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────

/** Only allow alphanumeric IDs to prevent path/key injection */
function isValidId(id: string | undefined): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

/** Safely parse an integer — returns undefined on NaN/invalid */
function safeInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) || n < 0 ? undefined : n;
}

/** Reject admin requests with bad or missing secret */
function requireSecret(req: Request, res: Response): boolean {
  const provided = req.headers["x-backfill-secret"] as string | undefined;
  if (!verifySecret(provided)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ── Movies ─────────────────────────────────────────────────────────────────

router.get("/telegram/movies", async (req, res) => {
  try {
    const before = safeInt(req.query["before"] as string | undefined);
    const result = await fetchChannelMovies(before);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch telegram movies");
    res.status(500).json({ error: "Failed to fetch movies from channel" });
  }
});

router.get("/telegram/movies/:id", async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    res.status(400).json({ error: "Invalid movie ID" });
    return;
  }
  try {
    const movie = await fetchMovieById(id);
    if (!movie) return res.status(404).json({ error: "Movie not found" });
    res.json(movie);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch telegram movie");
    res.status(500).json({ error: "Failed to fetch movie" });
  }
});

// ── TMDB ───────────────────────────────────────────────────────────────────

router.get("/tmdb/enrich", async (req, res) => {
  const title = req.query["title"] as string | undefined;
  if (!title?.trim()) {
    res.status(400).json({ error: "title query param required" });
    return;
  }
  if (title.trim().length > 200) {
    res.status(400).json({ error: "title too long" });
    return;
  }
  try {
    const data = await enrichFromTmdb(title.trim());
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "TMDB enrich failed");
    res.status(500).json({ error: "TMDB lookup failed" });
  }
});

// ── Comments ───────────────────────────────────────────────────────────────

// GET /api/comments/:movieId
router.get("/comments/:movieId", (req, res) => {
  const { movieId } = req.params;
  if (!isValidId(movieId)) {
    res.status(400).json({ error: "Invalid movie ID" });
    return;
  }
  try {
    const comments = getComments(movieId);
    res.json(comments);
  } catch (err) {
    req.log.error({ err }, "Failed to get comments");
    res.json([]);
  }
});

// POST /api/comments/:movieId  { username, text }
router.post("/comments/:movieId", (req, res) => {
  const { movieId } = req.params;
  if (!isValidId(movieId)) {
    res.status(400).json({ error: "Invalid movie ID" });
    return;
  }
  try {
    const { username, text } = req.body as { username?: unknown; text?: unknown };
    if (typeof username !== "string" || typeof text !== "string") {
      res.status(400).json({ error: "username and text must be strings" });
      return;
    }
    if (!username.trim() || !text.trim()) {
      res.status(400).json({ error: "username and text are required" });
      return;
    }
    const comment = addComment(movieId, username, text);
    if (!comment) {
      res.status(400).json({ error: "Invalid comment" });
      return;
    }
    res.status(201).json(comment);
  } catch (err) {
    req.log.error({ err }, "Failed to add comment");
    res.status(500).json({ error: "Failed to save comment" });
  }
});

// ── Admin — Seed movie for testing ─────────────────────────────────────────
// POST /api/telegram/seed  { id, title, poster, audio, qualities }
// Requires x-backfill-secret header.
router.post("/telegram/seed", (req, res) => {
  if (!requireSecret(req, res)) return;

  const body = req.body as Partial<TelegramMovie>;
  const { id, title, audio, qualities, poster } = body;

  if (!id || !title || !Array.isArray(qualities) || qualities.length === 0) {
    res.status(400).json({ error: "id, title and at least one quality are required" });
    return;
  }

  const movie: TelegramMovie = {
    id: String(id).slice(0, 64),
    title: String(title).slice(0, 200),
    poster: typeof poster === "string" ? poster : "",
    audio: typeof audio === "string" ? audio : "",
    qualities: qualities
      .filter((q) => q && typeof q.quality === "string" && typeof q.url === "string")
      .map((q) => ({ quality: String(q.quality), url: String(q.url) }))
      .slice(0, 10),
    messageId: 0,
  };

  // Replace if same id already seeded
  const idx = seedMovies.findIndex((m) => m.id === movie.id);
  if (idx >= 0) seedMovies.splice(idx, 1, movie);
  else seedMovies.unshift(movie);

  req.log.info({ id: movie.id, title: movie.title }, "Movie seeded");
  res.status(201).json({ ok: true, movie });
});

// ── Admin — Remove seed movie ──────────────────────────────────────────────
router.delete("/telegram/seed/:id", (req, res) => {
  if (!requireSecret(req, res)) return;
  const { id } = req.params;
  const idx = seedMovies.findIndex((m) => m.id === id);
  if (idx < 0) {
    res.status(404).json({ error: "Seed movie not found" });
    return;
  }
  seedMovies.splice(idx, 1);
  res.json({ ok: true });
});

// ── Admin — Telegram Backfill ──────────────────────────────────────────────

router.post("/telegram/backfill", async (req, res) => {
  if (!requireSecret(req, res)) return;
  const pages = Math.min(safeInt(req.query["pages"] as string | undefined) ?? 5, 50);
  try {
    let total = 0;
    let before: number | undefined;
    for (let i = 0; i < pages; i++) {
      const result = await fetchChannelMovies(before);
      total += result.movies.length;
      if (!result.hasMore || result.movies.length === 0) break;
      const minId = Math.min(...result.movies.map((m) => m.messageId));
      before = minId;
    }
    res.json({ ok: true, moviesIndexed: total, pagesScraped: pages });
  } catch (err) {
    req.log.error({ err }, "Backfill failed");
    res.status(500).json({ error: "Backfill failed" });
  }
});

// ── Admin — Register Webhook ───────────────────────────────────────────────

router.post("/telegram/register-webhook", async (req, res) => {
  if (!requireSecret(req, res)) return;
  const { webhookUrl } = req.body as { webhookUrl?: unknown };
  if (typeof webhookUrl !== "string" || !webhookUrl.startsWith("https://")) {
    res.status(400).json({ error: "webhookUrl must be a valid https URL" });
    return;
  }
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      res.status(500).json({ error: "TELEGRAM_BOT_TOKEN not configured" });
      return;
    }
    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      },
    );
    const data = await tgRes.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Register webhook failed");
    res.status(500).json({ error: "Failed to register webhook" });
  }
});

// ── Webhook receiver ───────────────────────────────────────────────────────

router.post("/telegram/webhook", async (req, res) => {
  res.json({ ok: true });
  try {
    const update = req.body as {
      channel_post?: { message_id: number; text?: string; photo?: unknown[] };
    };
    if (!update?.channel_post?.text) return;
    // Cache invalidation handled by natural TTL expiry
  } catch (err) {
    req.log.error({ err }, "Webhook processing error");
  }
});

export default router;
