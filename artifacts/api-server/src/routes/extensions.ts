import { Router } from "express";
import { db } from "@workspace/db";
import { installedExtensionsTable, providerSourcesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  FetchManifestQueryParams,
  InstallExtensionBody,
  UninstallExtensionParams,
  GetCatalogQueryParams,
  GetPostsQueryParams,
  SearchPostsQueryParams,
  GetMetaQueryParams,
  GetStreamsQueryParams,
  GetEpisodesQueryParams,
} from "@workspace/api-zod";
import {
  execCatalog,
  execPosts,
  execSearchPosts,
  execMeta,
  execStream,
  execEpisodes,
} from "../services/extensionExecutor";

const router = Router();

// ── Manifest ──────────────────────────────────────────────────────
router.get("/manifest", async (req, res) => {
  try {
    const parsed = FetchManifestQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }
    const [source] = await db.select().from(providerSourcesTable)
      .where(eq(providerSourcesTable.id, parsed.data.sourceId)).limit(1);
    if (!source) {
      res.status(404).json({ error: "Source not found" });
      return;
    }
    const manifestUrl = `${source.url}/manifest.json`;
    const response = await fetch(manifestUrl, {
      headers: { "User-Agent": "KapoorKaGhulam/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      res.status(502).json({ error: `Failed to fetch manifest: ${response.status}` });
      return;
    }
    const manifest = await response.json() as any[];
    const entries = (Array.isArray(manifest) ? manifest : []).map((e: any) => ({
      value: e.value ?? e.id ?? "",
      displayName: e.display_name ?? e.displayName ?? e.name ?? e.value ?? "",
      type: e.type ?? "global",
      version: e.version ?? "0.0.1",
      icon: e.icon ?? null,
      disabled: e.disabled ?? false,
    }));
    res.json(entries);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch manifest");
    res.status(500).json({ error: "Failed to fetch manifest" });
  }
});

// ── Extensions List ───────────────────────────────────────────────
router.get("/extensions", async (req, res) => {
  try {
    const exts = await db.select().from(installedExtensionsTable).orderBy(installedExtensionsTable.installedAt);
    res.json(exts.map(e => ({
      id: e.id,
      sourceAuthor: e.sourceAuthor,
      value: e.value,
      displayName: e.displayName,
      type: e.type,
      icon: e.icon,
      version: e.version,
      enabled: e.enabled,
      installedAt: e.installedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get extensions");
    res.status(500).json({ error: "Failed to get extensions" });
  }
});

// ── Install ───────────────────────────────────────────────────────
router.post("/extensions/install", async (req, res) => {
  try {
    const parsed = InstallExtensionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const data = parsed.data;

    const [source] = await db.select().from(providerSourcesTable)
      .where(eq(providerSourcesTable.id, data.sourceId)).limit(1);
    if (!source) {
      res.status(404).json({ error: "Source not found" });
      return;
    }

    // Check if already installed
    const existing = await db.select().from(installedExtensionsTable)
      .where(eq(installedExtensionsTable.value, data.value)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Extension already installed" });
      return;
    }

    const baseUrl = `${source.url}/dist/${data.value}`;
    const modules = ["catalog", "posts", "meta", "stream", "episodes"];

    async function fetchModule(name: string): Promise<string | null> {
      try {
        const r = await fetch(`${baseUrl}/${name}.js`, {
          headers: { "User-Agent": "KapoorKaGhulam/1.0" },
          signal: AbortSignal.timeout(15000),
        });
        if (!r.ok) return null;
        return await r.text();
      } catch {
        return null;
      }
    }

    const [catalogModule, postsModule, metaModule, streamModule, episodesModule] = await Promise.all(
      modules.map(fetchModule)
    );

    // Extract author from source URL
    const urlParts = source.url.replace("https://raw.githubusercontent.com/", "").split("/");
    const sourceAuthor = urlParts[0] ?? source.name;

    const [ext] = await db.insert(installedExtensionsTable).values({
      sourceAuthor,
      sourceUrl: source.url,
      value: data.value,
      displayName: data.displayName,
      type: data.type,
      icon: data.icon ?? null,
      version: data.version,
      enabled: true,
      catalogModule,
      postsModule,
      metaModule,
      streamModule,
      episodesModule,
    }).returning();

    res.status(201).json({
      id: ext.id,
      sourceAuthor: ext.sourceAuthor,
      value: ext.value,
      displayName: ext.displayName,
      type: ext.type,
      icon: ext.icon,
      version: ext.version,
      enabled: ext.enabled,
      installedAt: ext.installedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to install extension");
    res.status(500).json({ error: "Failed to install extension" });
  }
});

// ── Uninstall ─────────────────────────────────────────────────────
router.delete("/extensions/:id", async (req, res) => {
  try {
    const parsed = UninstallExtensionParams.safeParse({ id: Number(req.params.id) });
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await db.delete(installedExtensionsTable).where(eq(installedExtensionsTable.id, parsed.data.id));
    res.json({ success: true, message: "Extension uninstalled" });
  } catch (err) {
    req.log.error({ err }, "Failed to uninstall extension");
    res.status(500).json({ error: "Failed to uninstall extension" });
  }
});

// ── Helper: load extension ────────────────────────────────────────
async function loadExt(id: number) {
  const [ext] = await db.select().from(installedExtensionsTable)
    .where(eq(installedExtensionsTable.id, id)).limit(1);
  return ext ?? null;
}

// ── Catalog ───────────────────────────────────────────────────────
router.get("/catalog", async (req, res) => {
  try {
    const parsed = GetCatalogQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }
    const ext = await loadExt(parsed.data.extId);
    if (!ext) { res.status(404).json({ error: "Extension not found" }); return; }
    if (!ext.catalogModule) { res.json({ catalog: [], genres: [] }); return; }
    const result = await execCatalog(ext.catalogModule, ext.sourceUrl);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get catalog");
    res.status(500).json({ error: "Failed to get catalog" });
  }
});

// ── Posts ─────────────────────────────────────────────────────────
router.get("/posts", async (req, res) => {
  try {
    const parsed = GetPostsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }
    const ext = await loadExt(parsed.data.extId);
    if (!ext) { res.status(404).json({ error: "Extension not found" }); return; }
    if (!ext.postsModule) { res.json([]); return; }
    const posts = await execPosts(ext.postsModule, ext.sourceUrl, {
      filter: parsed.data.filter,
      page: parsed.data.page ?? 1,
      providerValue: ext.value,
    });
    res.json(posts);
  } catch (err) {
    req.log.error({ err }, "Failed to get posts");
    res.status(500).json({ error: "Failed to get posts" });
  }
});

// ── Search Posts ──────────────────────────────────────────────────
router.get("/posts/search", async (req, res) => {
  try {
    const parsed = SearchPostsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }
    const ext = await loadExt(parsed.data.extId);
    if (!ext) { res.status(404).json({ error: "Extension not found" }); return; }
    if (!ext.postsModule) { res.json([]); return; }
    const posts = await execSearchPosts(ext.postsModule, ext.sourceUrl, {
      query: parsed.data.q,
      page: parsed.data.page ?? 1,
      providerValue: ext.value,
    });
    res.json(posts);
  } catch (err) {
    req.log.error({ err }, "Failed to search posts");
    res.status(500).json({ error: "Failed to search posts" });
  }
});

// ── Meta ──────────────────────────────────────────────────────────
router.get("/meta", async (req, res) => {
  try {
    const parsed = GetMetaQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }
    const ext = await loadExt(parsed.data.extId);
    if (!ext) { res.status(404).json({ error: "Extension not found" }); return; }
    if (!ext.metaModule) {
      res.status(404).json({ error: "Extension has no meta module" });
      return;
    }
    const meta = await execMeta(ext.metaModule, ext.sourceUrl, {
      link: parsed.data.link,
      provider: ext.value,
    });
    res.json(meta);
  } catch (err) {
    req.log.error({ err }, "Failed to get meta");
    res.status(500).json({ error: "Failed to get meta" });
  }
});

// ── Streams ───────────────────────────────────────────────────────
router.get("/streams", async (req, res) => {
  try {
    const parsed = GetStreamsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }
    const ext = await loadExt(parsed.data.extId);
    if (!ext) { res.status(404).json({ error: "Extension not found" }); return; }
    if (!ext.streamModule) { res.json([]); return; }
    const streams = await execStream(ext.streamModule, ext.sourceUrl, {
      link: parsed.data.link,
      type: parsed.data.type ?? undefined,
    });
    res.json(streams);
  } catch (err) {
    req.log.error({ err }, "Failed to get streams");
    res.status(500).json({ error: "Failed to get streams" });
  }
});

// ── Episodes ──────────────────────────────────────────────────────
router.get("/episodes", async (req, res) => {
  try {
    const parsed = GetEpisodesQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }
    const ext = await loadExt(parsed.data.extId);
    if (!ext) { res.status(404).json({ error: "Extension not found" }); return; }
    if (!ext.episodesModule) { res.json([]); return; }
    const episodes = await execEpisodes(ext.episodesModule, ext.sourceUrl, {
      url: parsed.data.url,
    });
    res.json(episodes);
  } catch (err) {
    req.log.error({ err }, "Failed to get episodes");
    res.status(500).json({ error: "Failed to get episodes" });
  }
});

export default router;
