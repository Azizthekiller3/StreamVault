import vm from "vm";
import * as cheerio from "cheerio";

// Cache for base URLs fetched from source repos
const baseUrlCache = new Map<string, { urls: Record<string, string>; fetchedAt: number }>();
const BASE_URL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchBaseUrls(sourceUrl: string): Promise<Record<string, string>> {
  const cached = baseUrlCache.get(sourceUrl);
  if (cached && Date.now() - cached.fetchedAt < BASE_URL_CACHE_TTL) {
    return cached.urls;
  }
  for (const filename of ["base_urls.json", "urls.json", "config.json"]) {
    try {
      const r = await fetch(`${sourceUrl}/${filename}`, {
        headers: { "User-Agent": "KapoorKaGhulam/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const data = await r.json() as Record<string, string>;
        baseUrlCache.set(sourceUrl, { urls: data, fetchedAt: Date.now() });
        return data;
      }
    } catch {
      // try next
    }
  }
  baseUrlCache.set(sourceUrl, { urls: {}, fetchedAt: Date.now() });
  return {};
}

type ProviderContext = {
  axios: typeof import("axios").default;
  fetch: typeof globalThis.fetch;
  cheerio: typeof cheerio;
  getBaseUrl: (providerName: string) => Promise<string>;
  commonHeaders: Record<string, string>;
};

function buildContext(sourceUrl: string, extensionBaseUrl?: string | null): ProviderContext {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axios = require("axios").default;
  return {
    axios,
    fetch: globalThis.fetch,
    cheerio,
    getBaseUrl: async (providerName: string) => {
      // If the extension has a configured base URL, return it directly
      if (extensionBaseUrl) return extensionBaseUrl;
      // Otherwise try to fetch a URL registry from the source repo
      const urls = await fetchBaseUrls(sourceUrl);
      return urls[providerName] ?? urls[providerName.toLowerCase()] ?? "";
    },
    commonHeaders: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  };
}

function runModule(code: string, providerContext: ProviderContext): any {
  const moduleObj = { exports: {} as any };
  const sandbox = {
    module: moduleObj,
    exports: moduleObj.exports,
    providerContext,
    console,
    fetch: globalThis.fetch,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Buffer,
    atob: (str: string) => Buffer.from(str, "base64").toString("binary"),
    btoa: (str: string) => Buffer.from(str, "binary").toString("base64"),
    process: { env: {} },
    URL,
    URLSearchParams,
    require: (mod: string) => {
      if (mod === "axios") return providerContext.axios;
      if (mod === "cheerio") return cheerio;
      throw new Error(`require('${mod}') is not allowed in provider modules`);
    },
  };
  try {
    const script = new vm.Script(`(function(module, exports, providerContext, require, console) { ${code} })`);
    const fn = script.runInNewContext(sandbox, { timeout: 10000 });
    fn(moduleObj, moduleObj.exports, providerContext, sandbox.require, console);
    return moduleObj.exports;
  } catch (err) {
    throw new Error(`Module execution failed: ${(err as Error).message}`);
  }
}

export async function execCatalog(catalogModule: string, sourceUrl: string, baseUrl?: string | null): Promise<{ catalog: { title: string; filter: string }[]; genres: { title: string; filter: string }[] }> {
  const ctx = buildContext(sourceUrl, baseUrl);
  const mod = runModule(catalogModule, ctx);
  return {
    catalog: mod.catalog ?? [],
    genres: mod.genres ?? [],
  };
}

export async function execPosts(postsModule: string, sourceUrl: string, baseUrl: string | null | undefined, opts: { filter: string; page: number; providerValue: string; signal?: AbortSignal }): Promise<Array<{ title: string; link: string; image: string; provider?: string | null }>> {
  const ctx = buildContext(sourceUrl, baseUrl);
  const mod = runModule(postsModule, ctx);
  const results = await mod.getPosts({
    filter: opts.filter,
    page: opts.page,
    providerValue: opts.providerValue,
    providerContext: ctx,
    signal: opts.signal,
  });
  return Array.isArray(results) ? results : [];
}

export async function execSearchPosts(postsModule: string, sourceUrl: string, baseUrl: string | null | undefined, opts: { query: string; page: number; providerValue: string }): Promise<Array<{ title: string; link: string; image: string; provider?: string | null }>> {
  const ctx = buildContext(sourceUrl, baseUrl);
  const mod = runModule(postsModule, ctx);
  // Pass both searchQuery and filter for compatibility across provider implementations
  const results = await mod.getSearchPosts({
    filter: opts.query,
    searchQuery: opts.query,
    page: opts.page,
    providerValue: opts.providerValue,
    providerContext: ctx,
  });
  return Array.isArray(results) ? results : [];
}

export async function execMeta(metaModule: string, sourceUrl: string, baseUrl: string | null | undefined, opts: { link: string; provider: string }): Promise<any> {
  const ctx = buildContext(sourceUrl, baseUrl);
  const mod = runModule(metaModule, ctx);
  return mod.getMeta({ link: opts.link, provider: opts.provider, providerContext: ctx });
}

export async function execStream(streamModule: string, sourceUrl: string, baseUrl: string | null | undefined, opts: { link: string; type?: string }): Promise<Array<{ server: string; link: string; type: string; quality?: string | null; headers?: Record<string, string> | null }>> {
  const ctx = buildContext(sourceUrl, baseUrl);
  const mod = runModule(streamModule, ctx);
  const results = await mod.getStream({ link: opts.link, type: opts.type, providerContext: ctx });
  return Array.isArray(results) ? results : [];
}

export async function execEpisodes(episodesModule: string, sourceUrl: string, baseUrl: string | null | undefined, opts: { url: string }): Promise<Array<{ title: string; link: string }>> {
  const ctx = buildContext(sourceUrl, baseUrl);
  const mod = runModule(episodesModule, ctx);
  const results = await mod.getEpisodes({ url: opts.url, providerContext: ctx });
  return Array.isArray(results) ? results : [];
}
