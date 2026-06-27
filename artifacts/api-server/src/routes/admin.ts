import { Router, type Request, type Response } from "express";
import { verifyAdminCredentials, verifyAdminToken, generateAdminToken } from "../lib/adminAuth.js";
import { parseRawPost, addSeedMovie, removeSeedMovie, seedMovies, getChannel, setChannel } from "../services/telegramService.js";
import { enrichFromTmdb } from "../services/tmdbService.js";
import { db, moviesTable } from "@workspace/db";
import { isNull, eq, or } from "drizzle-orm";

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

// GET /api/admin/config
router.get("/admin/config", (req, res) => {
  if (!requireToken(req, res)) return;
  res.json({ ok: true, channel: getChannel() });
});

// PUT /api/admin/config  { channel }
router.put("/admin/config", (req, res) => {
  if (!requireToken(req, res)) return;
  const { channel } = req.body as { channel?: unknown };
  if (typeof channel !== "string" || !channel.trim()) {
    res.status(400).json({ error: "channel is required" });
    return;
  }
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
    res.status(422).json({ error: "Could not find any Terabox quality links. Make sure the post has lines like '480p: https://terabox.com/...'" });
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

// GET /api/admin/movies
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

// POST /api/admin/bulk-parse  { posts: string[] }  → parse all, return what succeeded
router.post("/admin/bulk-parse", (req, res) => {
  if (!requireToken(req, res)) return;
  const { posts } = req.body as { posts?: unknown };
  if (!Array.isArray(posts) || posts.length === 0) {
    res.status(400).json({ error: "posts array is required" });
    return;
  }
  if (posts.length > 100) {
    res.status(400).json({ error: "Maximum 100 posts per bulk import." });
    return;
  }
  const movies = [];
  let failed = 0;
  for (const post of posts) {
    if (typeof post !== "string" || !post.trim()) { failed++; continue; }
    const movie = parseRawPost(post.trim(), `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    if (movie) movies.push(movie);
    else failed++;
  }
  res.json({ ok: true, movies, failed, total: posts.length });
});

// POST /api/admin/bulk-save  { posts: string[] }  → parse + save all
router.post("/admin/bulk-save", (req, res) => {
  if (!requireToken(req, res)) return;
  const { posts } = req.body as { posts?: unknown };
  if (!Array.isArray(posts) || posts.length === 0) {
    res.status(400).json({ error: "posts array is required" });
    return;
  }
  if (posts.length > 100) {
    res.status(400).json({ error: "Maximum 100 posts per bulk import." });
    return;
  }
  let saved = 0;
  let failed = 0;
  for (const post of posts) {
    if (typeof post !== "string" || !post.trim()) { failed++; continue; }
    const id = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const movie = parseRawPost(post.trim(), id);
    if (movie) { addSeedMovie(movie); saved++; }
    else failed++;
  }
  req.log.info({ saved, failed }, "Admin bulk saved movies");
  res.json({ ok: true, saved, failed });
});


// POST /api/admin/bulk-enrich
// Enriches all DB movies that have no poster with TMDB poster lookups.
// Returns { enriched, skipped, failed, total } — runs synchronously so the
// caller gets a definitive result (may take up to ~1 s per movie).
router.post("/admin/bulk-enrich", async (req, res) => {
  if (!requireToken(req, res)) return;
  try {
    // Fetch all movies missing a poster from the DB
    const rows = await db
      .select()
      .from(moviesTable)
      .where(or(isNull(moviesTable.poster), eq(moviesTable.poster, "")));

    const total = rows.length;
    let enriched = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const result = await enrichFromTmdb(row.title);
        if (result?.poster && result.poster !== "N/A") {
          await db
            .update(moviesTable)
            .set({ poster: result.poster })
            .where(eq(moviesTable.messageId, row.messageId));
          // Sync in-memory store
          const idx = seedMovies.findIndex((m) => m.id === row.messageId);
          if (idx >= 0) seedMovies[idx].poster = result.poster;
          enriched++;
        } else {
          skipped++;
        }
      } catch {
        failed++;
      }
      // Brief pause to stay within TMDB rate limits (40 req / 10 s)
      await new Promise((r) => setTimeout(r, 150));
    }

    req.log.info({ enriched, skipped, failed, total }, "Admin bulk-enrich complete");
    res.json({ ok: true, enriched, skipped, failed, total });
  } catch (err) {
    req.log.error({ err }, "Bulk-enrich failed");
    res.status(500).json({ error: "Bulk-enrich failed" });
  }
});

export default router;
