import { Router } from "express";
import {
  fetchChannelMovies,
  fetchMovieById,
  parseWebhookPost,
  saveMovieToDB,
  getFileUrl,
  backfillFromScraper,
} from "../services/telegramService.js";
import { enrichFromTmdb } from "../services/tmdbService.js";

const router = Router();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

// GET /api/telegram/movies — serve from DB (or scraper fallback)
router.get("/telegram/movies", async (req, res) => {
  try {
    const before = req.query["before"] ? parseInt(req.query["before"] as string, 10) : undefined;
    const result = await fetchChannelMovies(before);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch telegram movies");
    res.status(500).json({ error: "Failed to fetch movies from channel" });
  }
});

// GET /api/telegram/movies/:id
router.get("/telegram/movies/:id", async (req, res) => {
  try {
    const movie = await fetchMovieById(req.params["id"]!);
    if (!movie) return res.status(404).json({ error: "Movie not found" });
    res.json(movie);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch telegram movie by id");
    res.status(500).json({ error: "Failed to fetch movie" });
  }
});

// GET /api/telegram/image/:fileId — proxy Telegram bot images
router.get("/telegram/image/:fileId", async (req, res) => {
  try {
    if (!BOT_TOKEN) return res.status(503).json({ error: "Bot token not configured" });
    const url = await getFileUrl(req.params["fileId"]!);
    if (!url) return res.status(404).json({ error: "Image not found" });
    // Redirect to actual Telegram CDN URL
    res.redirect(302, url);
  } catch (err) {
    req.log.error({ err }, "Failed to proxy telegram image");
    res.status(500).json({ error: "Failed to load image" });
  }
});

// POST /api/telegram/webhook — receive Telegram updates
router.post("/telegram/webhook", async (req, res) => {
  try {
    // Always respond 200 quickly so Telegram doesn't retry
    res.sendStatus(200);

    const update = req.body as {
      channel_post?: {
        message_id: number;
        text?: string;
        caption?: string;
        photo?: { file_id: string; file_size: number; width: number; height: number }[];
        chat?: { id: number | string };
      };
    };

    const post = update.channel_post;
    if (!post) return;

    const parsed = parseWebhookPost(post);
    if (!parsed) return;

    await saveMovieToDB(parsed.movie, parsed.posterFileId);
  } catch (err) {
    // Already sent 200, just log
    console.error("Webhook processing error:", err);
  }
});

// POST /api/telegram/backfill — scrape existing posts into DB
// Call once after deployment to populate the DB with all historical movies
router.post("/telegram/backfill", async (req, res) => {
  const secret = req.headers["x-backfill-secret"];
  if (!secret || secret !== process.env.SESSION_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const pages = Math.min(parseInt((req.query["pages"] as string) || "10", 10), 50);
    res.json({ message: `Backfill started for ${pages} pages...` });
    // Run async after response
    backfillFromScraper(pages).then((count) => {
      console.log(`Backfill complete: ${count} movies saved`);
    });
  } catch (err) {
    req.log.error({ err }, "Backfill failed");
  }
});

// POST /api/telegram/register-webhook — register the webhook with Telegram
router.post("/telegram/register-webhook", async (req, res) => {
  const secret = req.headers["x-backfill-secret"];
  if (!secret || secret !== process.env.SESSION_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!BOT_TOKEN) return res.status(503).json({ error: "TELEGRAM_BOT_TOKEN not set" });

  const { webhookUrl } = req.body as { webhookUrl?: string };
  if (!webhookUrl) return res.status(400).json({ error: "webhookUrl required in body" });

  try {
    const r = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["channel_post"],
          drop_pending_updates: false,
        }),
      }
    );
    const data = await r.json();
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to register webhook");
    res.status(500).json({ error: "Failed to register webhook" });
  }
});

// GET /api/tmdb/enrich?title=...
router.get("/tmdb/enrich", async (req, res) => {
  const title = req.query["title"] as string | undefined;
  if (!title?.trim()) {
    res.status(400).json({ error: "title query param required" });
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

export default router;
