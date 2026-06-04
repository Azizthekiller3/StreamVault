import { Router } from "express";
import { db } from "@workspace/db";
import { watchlistTable, historyTable, installedExtensionsTable, providerSourcesTable } from "@workspace/db";
import { count } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const [[watchlistCount], [historyCount], [extensionsCount], [sourcesCount]] = await Promise.all([
      db.select({ count: count() }).from(watchlistTable),
      db.select({ count: count() }).from(historyTable),
      db.select({ count: count() }).from(installedExtensionsTable),
      db.select({ count: count() }).from(providerSourcesTable),
    ]);

    res.json({
      watchlistCount: watchlistCount.count,
      historyCount: historyCount.count,
      extensionsCount: extensionsCount.count,
      sourcesCount: sourcesCount.count,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
