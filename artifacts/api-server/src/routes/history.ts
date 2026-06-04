import { Router } from "express";
import { db } from "@workspace/db";
import { historyTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { UpsertHistoryBody, DeleteHistoryItemParams } from "@workspace/api-zod";

const router = Router();

router.get("/history", async (req, res) => {
  try {
    const items = await db.select().from(historyTable).orderBy(desc(historyTable.watchedAt));
    res.json(items.map(item => ({
      id: item.id,
      title: item.title,
      poster: item.poster,
      link: item.link,
      provider: item.provider,
      type: item.type,
      imdbId: item.imdbId,
      progress: item.progress,
      duration: item.duration,
      episodeTitle: item.episodeTitle,
      watchedAt: item.watchedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get history");
    res.status(500).json({ error: "Failed to get history" });
  }
});

router.post("/history", async (req, res) => {
  try {
    const parsed = UpsertHistoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const data = parsed.data;

    const existing = await db.select().from(historyTable)
      .where(eq(historyTable.link, data.link))
      .limit(1);

    let item;
    if (existing.length > 0) {
      const [updated] = await db.update(historyTable)
        .set({
          title: data.title,
          poster: data.poster,
          provider: data.provider,
          type: data.type,
          imdbId: data.imdbId,
          progress: data.progress,
          duration: data.duration,
          episodeTitle: data.episodeTitle,
          watchedAt: new Date(),
        })
        .where(eq(historyTable.id, existing[0].id))
        .returning();
      item = updated;
    } else {
      const [created] = await db.insert(historyTable).values({
        title: data.title,
        poster: data.poster,
        link: data.link,
        provider: data.provider,
        type: data.type,
        imdbId: data.imdbId,
        progress: data.progress,
        duration: data.duration,
        episodeTitle: data.episodeTitle,
      }).returning();
      item = created;
    }

    res.json({
      id: item.id,
      title: item.title,
      poster: item.poster,
      link: item.link,
      provider: item.provider,
      type: item.type,
      imdbId: item.imdbId,
      progress: item.progress,
      duration: item.duration,
      episodeTitle: item.episodeTitle,
      watchedAt: item.watchedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to upsert history");
    res.status(500).json({ error: "Failed to upsert history" });
  }
});

router.delete("/history", async (req, res) => {
  try {
    await db.delete(historyTable);
    res.json({ success: true, message: "History cleared" });
  } catch (err) {
    req.log.error({ err }, "Failed to clear history");
    res.status(500).json({ error: "Failed to clear history" });
  }
});

router.delete("/history/:id", async (req, res) => {
  try {
    const parsed = DeleteHistoryItemParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(historyTable).where(eq(historyTable.id, parsed.data.id));
    res.json({ success: true, message: "History item deleted" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete history item");
    res.status(500).json({ error: "Failed to delete history item" });
  }
});

export default router;
