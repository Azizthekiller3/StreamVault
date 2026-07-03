import { Router } from "express";
import { db } from "@workspace/db";
import { installedExtensionsTable, providerSourcesTable } from "@workspace/db";
import { count } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  try {
    const [[extensionsCount], [sourcesCount]] = await Promise.all([
      db.select({ count: count() }).from(installedExtensionsTable),
      db.select({ count: count() }).from(providerSourcesTable),
    ]);

    res.json({
      extensionsCount: extensionsCount.count,
      sourcesCount: sourcesCount.count,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
