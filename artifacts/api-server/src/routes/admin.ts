import { Router, type Request, type Response } from "express";
import { verifyAdminCredentials, verifyAdminToken, generateAdminToken } from "../lib/adminAuth.js";
import { parseRawPost, addSeedMovie, removeSeedMovie, seedMovies, getChannel, setChannel } from "../services/telegramService.js";

const router = Router();

function requireToken(req: Request, res: Response): boolean {
  const token = req.headers["x-admin-token"] as string | undefined;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// POST /api/admin/login  { username, password }
router.post("/admin/login", (req, res) => {
  const { username, password } = req.body as { username?: unknown; password?: unknown };
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    res.status(400).json({ error: "username and password required" });
    return;
  }
  if (!verifyAdminCredentials(username, password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  res.json({ ok: true, token: generateAdminToken() });
});

// GET /api/admin/config  → get current channel and other config
router.get("/admin/config", (req, res) => {
  if (!requireToken(req, res)) return;
  res.json({ ok: true, channel: getChannel() });
});

// PUT /api/admin/config  { channel }  → update channel username
router.put("/admin/config", (req, res) => {
  if (!requireToken(req, res)) return;
  const { channel } = req.body as { channel?: unknown };
  if (typeof channel !== "string" || !channel.trim()) {
    res.status(400).json({ error: "channel is required" });
    return;
  }
  // Only allow valid Telegram usernames: letters, digits, underscores, 5-32 chars
  const clean = channel.replace(/^@/, "").trim();
  if (!/^[a-zA-Z0-9_]{3,64}$/.test(clean)) {
    res.status(400).json({ error: "Invalid channel username. Use only letters, numbers, underscores." });
    return;
  }
  setChannel(clean);
  req.log.info({ channel: clean }, "Admin updated channel");
  res.json({ ok: true, channel: clean });
});

// POST /api/admin/parse  { text, poster? }  → parse only, don't save
router.post("/admin/parse", (req, res) => {
  if (!requireToken(req, res)) return;
  const { text, poster } = req.body as { text?: unknown; poster?: unknown };
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const id = `admin-${Date.now()}`;
  const movie = parseRawPost(text.trim(), id, typeof poster === "string" ? poster.trim() : "");
  if (!movie) {
    res.status(422).json({ error: "Could not find any Terabox quality links in the text. Make sure the post contains lines like '480p: https://...' or '720p: https://...'." });
    return;
  }
  res.json({ ok: true, movie });
});

// POST /api/admin/movies  { text, poster?, id? }  → parse + save
router.post("/admin/movies", (req, res) => {
  if (!requireToken(req, res)) return;
  const { text, poster, id: customId } = req.body as { text?: unknown; poster?: unknown; id?: unknown };
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const id = typeof customId === "string" && customId.trim()
    ? customId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
    : `admin-${Date.now()}`;
  const movie = parseRawPost(text.trim(), id, typeof poster === "string" ? poster.trim() : "");
  if (!movie) {
    res.status(422).json({ error: "Could not parse any Terabox quality links." });
    return;
  }
  addSeedMovie(movie);
  req.log.info({ id: movie.id, title: movie.title }, "Admin saved movie");
  res.status(201).json({ ok: true, movie });
});

// GET /api/admin/movies  → list seeded movies
router.get("/admin/movies", (req, res) => {
  if (!requireToken(req, res)) return;
  res.json({ ok: true, movies: seedMovies });
});

// DELETE /api/admin/movies/:id
router.delete("/admin/movies/:id", (req, res) => {
  if (!requireToken(req, res)) return;
  const { id } = req.params;
  const removed = removeSeedMovie(id);
  if (!removed) {
    res.status(404).json({ error: "Movie not found" });
    return;
  }
  req.log.info({ id }, "Admin deleted movie");
  res.json({ ok: true });
});

export default router;
