import { Router } from "express";
import { db } from "@workspace/db";
import { providersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AddProviderBody, RemoveProviderParams } from "@workspace/api-zod";

const router = Router();

router.get("/providers", async (req, res) => {
  try {
    const items = await db.select().from(providersTable).orderBy(providersTable.installedAt);
    res.json(items.map(item => ({
      id: item.id,
      name: item.name,
      url: item.url,
      type: item.type,
      icon: item.icon,
      enabled: item.enabled,
      installedAt: item.installedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get providers");
    res.status(500).json({ error: "Failed to get providers" });
  }
});

router.post("/providers", async (req, res) => {
  try {
    const parsed = AddProviderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const data = parsed.data;
    const [item] = await db.insert(providersTable).values({
      name: data.name,
      url: data.url,
      type: data.type,
      icon: data.icon,
      enabled: true,
    }).returning();
    res.status(201).json({
      id: item.id,
      name: item.name,
      url: item.url,
      type: item.type,
      icon: item.icon,
      enabled: item.enabled,
      installedAt: item.installedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add provider");
    res.status(500).json({ error: "Failed to add provider" });
  }
});

router.delete("/providers/:id", async (req, res) => {
  try {
    const parsed = RemoveProviderParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(providersTable).where(eq(providersTable.id, parsed.data.id));
    res.json({ success: true, message: "Provider removed" });
  } catch (err) {
    req.log.error({ err }, "Failed to remove provider");
    res.status(500).json({ error: "Failed to remove provider" });
  }
});

export default router;
