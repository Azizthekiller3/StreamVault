import { Router } from "express";
import { db } from "@workspace/db";
import { providerSourcesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { AddSourceBody, RemoveSourceParams, SetDefaultSourceParams } from "@workspace/api-zod";

const router = Router();

function parseSourceInput(input: string): { name: string; url: string } {
  const trimmed = input.trim();

  // Full raw GitHub URL
  if (trimmed.startsWith("https://raw.githubusercontent.com/")) {
    const parts = trimmed.split("/");
    const author = parts[3] ?? trimmed;
    const repo = parts[4] ?? "vega-providers";
    return { name: `${author}/${repo}`, url: trimmed };
  }

  // GitHub repo URL
  if (trimmed.startsWith("https://github.com/")) {
    const path = trimmed.replace("https://github.com/", "");
    const [author, repo = "vega-providers"] = path.split("/");
    const url = `https://raw.githubusercontent.com/${author}/${repo}/refs/heads/main`;
    return { name: `${author}/${repo}`, url };
  }

  // Author shorthand (e.g. "vega-org")
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    const url = `https://raw.githubusercontent.com/${trimmed}/vega-providers/refs/heads/main`;
    return { name: `${trimmed}/vega-providers`, url };
  }

  // Author/repo shorthand
  if (!trimmed.startsWith("http")) {
    const [author, repo = "vega-providers"] = trimmed.split("/");
    const url = `https://raw.githubusercontent.com/${author}/${repo}/refs/heads/main`;
    return { name: `${author}/${repo}`, url };
  }

  // Generic URL — guard against invalid URLs
  try {
    const urlObj = new URL(trimmed);
    return { name: urlObj.hostname, url: trimmed };
  } catch {
    throw new Error(`Invalid URL: ${trimmed}`);
  }
}

router.get("/sources", async (req, res) => {
  try {
    const sources = await db.select().from(providerSourcesTable).orderBy(providerSourcesTable.addedAt);
    res.json(sources.map(s => ({
      id: s.id,
      name: s.name,
      url: s.url,
      isDefault: s.isDefault,
      addedAt: s.addedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get sources");
    res.status(500).json({ error: "Failed to get sources" });
  }
});

router.post("/sources", async (req, res) => {
  try {
    const parsed = AddSourceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const { name, url } = parseSourceInput(parsed.data.input);
    const existing = await db.select().from(providerSourcesTable).where(eq(providerSourcesTable.url, url)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Source already exists" });
      return;
    }
    const allSources = await db.select().from(providerSourcesTable).limit(1);
    const isFirst = allSources.length === 0;
    const [source] = await db.insert(providerSourcesTable).values({ name, url, isDefault: isFirst }).returning();
    res.status(201).json({
      id: source.id,
      name: source.name,
      url: source.url,
      isDefault: source.isDefault,
      addedAt: source.addedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add source");
    res.status(500).json({ error: "Failed to add source" });
  }
});

router.delete("/sources/:id", async (req, res) => {
  try {
    const parsed = RemoveSourceParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(providerSourcesTable).where(eq(providerSourcesTable.id, parsed.data.id));
    res.json({ success: true, message: "Source removed" });
  } catch (err) {
    req.log.error({ err }, "Failed to remove source");
    res.status(500).json({ error: "Failed to remove source" });
  }
});

router.put("/sources/:id/default", async (req, res) => {
  try {
    const parsed = SetDefaultSourceParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.update(providerSourcesTable).set({ isDefault: false });
      await tx.update(providerSourcesTable)
        .set({ isDefault: true })
        .where(eq(providerSourcesTable.id, parsed.data.id));
    });
    res.json({ success: true, message: "Default source updated" });
  } catch (err) {
    req.log.error({ err }, "Failed to set default source");
    res.status(500).json({ error: "Failed to set default source" });
  }
});

export default router;
