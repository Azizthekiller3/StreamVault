import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";

const router = Router();

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db.insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

router.get("/settings", async (req, res) => {
  try {
    const [activeExtId, theme] = await Promise.all([
      getSetting("activeExtId"),
      getSetting("theme"),
    ]);
    res.json({
      activeExtId: activeExtId ? parseInt(activeExtId, 10) : null,
      theme: theme ?? "dark",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "Failed to get settings" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const data = parsed.data;
    await Promise.all([
      data.activeExtId !== undefined ? setSetting("activeExtId", String(data.activeExtId)) : Promise.resolve(),
      data.theme !== undefined ? setSetting("theme", data.theme) : Promise.resolve(),
    ]);
    const [activeExtId, theme] = await Promise.all([
      getSetting("activeExtId"),
      getSetting("theme"),
    ]);
    res.json({
      activeExtId: activeExtId ? parseInt(activeExtId, 10) : null,
      theme: theme ?? "dark",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
