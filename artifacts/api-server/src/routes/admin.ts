import { Router, type Request, type Response } from "express";
import { verifyAdminCredentials, verifyAdminToken, generateAdminToken } from "../lib/adminAuth.js";
import { verifySecret } from "../lib/auth.js";
import { parseRawPost, addSeedMovie, removeSeedMovie, seedMovies, getChannel, setChannel } from "../services/telegramService.js";
import { enrichFromTmdb, clearTmdbCache, searchTmdbForAdmin, saveTitleOverride, deleteTitleOverride } from "../services/tmdbService.js";
import { db, moviesTable, titleOverridesTable } from "@workspace/db";
import { isNull, eq, or, like } from "drizzle-orm";

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

// POST /api/admin/bulk-parse  { posts: string[] }
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

// POST /api/admin/bulk-save  { posts: string[] }
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
router.post("/admin/bulk-enrich", async (req, res) => {
  if (!requireToken(req, res)) return;
  try {
    const rows = await db
      .select()
      .from(moviesTable)
      .where(or(
      isNull(moviesTable.poster),
      eq(moviesTable.poster, ""),
      like(moviesTable.poster, "%telesco.pe%"),
      like(moviesTable.poster, "%cdn.telegram%"),
      like(moviesTable.poster, "%t.me/%")
    ));

    const total = rows.length;
    let enriched = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const result = await enrichFromTmdb(row.title, row.audio);
        if (result?.poster && result.poster !== "N/A") {
          await db
            .update(moviesTable)
            .set({ poster: result.poster })
            .where(eq(moviesTable.messageId, row.messageId));
          const idx = seedMovies.findIndex((m) => m.id === row.messageId);
          if (idx >= 0) seedMovies[idx].poster = result.poster;
          enriched++;
        } else {
          skipped++;
        }
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    req.log.info({ enriched, skipped, failed, total }, "Admin bulk-enrich complete");
    res.json({ ok: true, enriched, skipped, failed, total });
  } catch (err) {
    req.log.error({ err }, "Bulk-enrich failed");
    res.status(500).json({ error: "Bulk-enrich failed" });
  }
});

// POST /api/admin/backfill
router.post("/admin/backfill", async (req, res) => {
  if (!verifySecret(req.headers["x-backfill-secret"] as string | undefined)) {
    res.status(401).json({ error: "Unauthorized — wrong admin key" });
    return;
  }
  clearTmdbCache();
  try {
    const rows = await db.select().from(moviesTable);
    const total = rows.length;
    let enriched = 0;
    let unchanged = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const result = await enrichFromTmdb(row.title, row.audio);
        const newPoster = result?.poster && result.poster !== "N/A" ? result.poster : null;
        if (newPoster && newPoster !== row.poster) {
          await db
            .update(moviesTable)
            .set({ poster: newPoster })
            .where(eq(moviesTable.messageId, row.messageId));
          const idx = seedMovies.findIndex((m) => m.id === row.messageId);
          if (idx >= 0) seedMovies[idx].poster = newPoster;
          enriched++;
        } else {
          unchanged++;
        }
      } catch {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    req.log.info({ enriched, unchanged, failed, total }, "Admin backfill complete");
    res.json({ ok: true, enriched, unchanged, failed, total });
  } catch (err) {
    req.log.error({ err }, "Admin backfill failed");
    res.status(500).json({ error: "Backfill failed" });
  }
});

// ── TMDB Override endpoints ────────────────────────────────────────────────

// GET /api/admin/tmdb-search?q=...&year=...&type=...
router.get("/admin/tmdb-search", async (req, res) => {
  if (!requireToken(req, res)) return;
  const q = (req.query["q"] as string | undefined)?.trim() ?? "";
  if (q.length < 2) {
    res.status(400).json({ error: "q must be at least 2 characters" });
    return;
  }
  const year = (req.query["year"] as string | undefined)?.trim() || undefined;
  const typeRaw = req.query["type"] as string | undefined;
  const type = typeRaw === "movie" || typeRaw === "tv" ? typeRaw : undefined;

  try {
    const results = await searchTmdbForAdmin(q, year, type);
    res.json({ results });
  } catch (err) {
    req.log.error({ err }, "Admin TMDB search failed");
    res.status(500).json({ error: "TMDB search failed" });
  }
});

// GET /api/admin/tmdb-overrides
router.get("/admin/tmdb-overrides", async (req, res) => {
  if (!requireToken(req, res)) return;
  try {
    const overrides = await db.select().from(titleOverridesTable).orderBy(titleOverridesTable.createdAt);
    res.json(overrides.map((o) => ({
      id: o.id,
      rawTitle: o.rawTitle,
      tmdbId: o.tmdbId,
      mediaType: o.mediaType,
      tmdbTitle: o.tmdbTitle,
      tmdbPoster: o.tmdbPoster,
      createdAt: o.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get TMDB overrides");
    res.status(500).json({ error: "Failed to get overrides" });
  }
});

// POST /api/admin/tmdb-override  { rawTitle, tmdbId, mediaType }
router.post("/admin/tmdb-override", async (req, res) => {
  if (!requireToken(req, res)) return;
  const { rawTitle, tmdbId, mediaType } = req.body as {
    rawTitle?: unknown;
    tmdbId?: unknown;
    mediaType?: unknown;
  };
  if (typeof rawTitle !== "string" || !rawTitle.trim()) {
    res.status(400).json({ error: "rawTitle is required" });
    return;
  }
  if (typeof tmdbId !== "number" || !Number.isInteger(tmdbId) || tmdbId <= 0) {
    res.status(400).json({ error: "tmdbId must be a positive integer" });
    return;
  }
  if (mediaType !== "movie" && mediaType !== "tv") {
    res.status(400).json({ error: "mediaType must be 'movie' or 'tv'" });
    return;
  }
  try {
    await saveTitleOverride(rawTitle.trim(), tmdbId, mediaType);
    req.log.info({ rawTitle, tmdbId, mediaType }, "Admin saved TMDB override");
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save TMDB override");
    res.status(500).json({ error: "Failed to save override" });
  }
});

// DELETE /api/admin/tmdb-overrides/:id
router.delete("/admin/tmdb-overrides/:id", async (req, res) => {
  if (!requireToken(req, res)) return;
  const id = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    await deleteTitleOverride(id);
    req.log.info({ id }, "Admin deleted TMDB override");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete TMDB override");
    res.status(500).json({ error: "Failed to delete override" });
  }
});

export default router;
