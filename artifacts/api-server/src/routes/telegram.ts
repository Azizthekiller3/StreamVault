import { Router } from "express";
import { fetchChannelMovies, fetchMovieById } from "../services/telegramService.js";
import { enrichFromTmdb } from "../services/tmdbService.js";
import { getComments, addComment } from "../services/commentService.js";

const router = Router();

// ── Movies ────────────────────────────────────────────────────────────────────

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

router.get("/telegram/movies/:id", async (req, res) => {
  try {
    const movie = await fetchMovieById(req.params["id"]!);
    if (!movie) return res.status(404).json({ error: "Movie not found" });
    res.json(movie);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch telegram movie");
    res.status(500).json({ error: "Failed to fetch movie" });
  }
});

// ── TMDB ──────────────────────────────────────────────────────────────────────

router.get("/tmdb/enrich", async (req, res) => {
  const title = req.query["title"] as string | undefined;
  if (!title?.trim()) { res.status(400).json({ error: "title query param required" }); return; }
  try {
    const data = await enrichFromTmdb(title.trim());
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "TMDB enrich failed");
    res.status(500).json({ error: "TMDB lookup failed" });
  }
});

// ── Comments ──────────────────────────────────────────────────────────────────

// GET /api/comments/:movieId
router.get("/comments/:movieId", (req, res) => {
  try {
    const comments = getComments(req.params["movieId"]!);
    res.json(comments);
  } catch (err) {
    req.log.error({ err }, "Failed to get comments");
    res.json([]);
  }
});

// POST /api/comments/:movieId  { username, text }
router.post("/comments/:movieId", (req, res) => {
  try {
    const { username, text } = req.body as { username?: string; text?: string };
    if (!username?.trim() || !text?.trim()) {
      res.status(400).json({ error: "username and text are required" });
      return;
    }
    const comment = addComment(req.params["movieId"]!, username, text);
    if (!comment) { res.status(400).json({ error: "Invalid comment" }); return; }
    res.status(201).json(comment);
  } catch (err) {
    req.log.error({ err }, "Failed to add comment");
    res.status(500).json({ error: "Failed to save comment" });
  }
});

export default router;
