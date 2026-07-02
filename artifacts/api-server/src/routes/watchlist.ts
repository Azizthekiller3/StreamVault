import { Router } from "express";
import { db } from "@workspace/db";
import { watchlistTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AddToWatchlistBody, RemoveFromWatchlistParams } from "@workspace/api-zod";

const router = Router();

router.get("/watchlist", async (req, res) => {
  try {
    const items = await db.select().from(watchlistTable).orderBy(watchlistTable.addedAt);
    res.json(items.map(item => ({
      id: item.id,
      title: item.title,
      poster: item.poster,
      link: item.link,
      provider: item.provider,
      type: item.type,
      imdbId: item.imdbId,
      rating: item.rating,
      year: item.year,
      addedAt: item.addedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get watchlist");
    res.status(500).json({ error: "Failed to get watchlist" });
  }
});

router.post("/watchlist", async (req, res) => {
  try {
    const parsed = AddToWatchlistBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const data = parsed.data;
    const [item] = await db.insert(watchlistTable).values({
      title: data.title,
      poster: data.poster,
      link: data.link,
      provider: data.provider,
      type: data.type,
      imdbId: data.imdbId,
      rating: data.rating,
      year: data.year,
    }).returning();
    res.status(201).json({
      id: item.id,
      title: item.title,
      poster: item.poster,
      link: item.link,
      provider: item.provider,
      type: item.type,
      imdbId: item.imdbId,
      rating: item.rating,
      year: item.year,
      addedAt: item.addedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add to watchlist");
    res.status(500).json({ error: "Failed to add to watchlist" });
  }
});

router.delete("/watchlist/:id", async (req, res) => {
  try {
    const parsed = RemoveFromWatchlistParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(watchlistTable).where(eq(watchlistTable.id, parsed.data.id));
    res.json({ success: true, message: "Removed from watchlist" });
  } catch (err) {
    req.log.error({ err }, "Failed to remove from watchlist");
    res.status(500).json({ error: "Failed to remove from watchlist" });
  }
});

export default router;
