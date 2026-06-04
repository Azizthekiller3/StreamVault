import vm from "vm";

type ProviderContext = {
  axios: typeof import("axios").default;
  fetch: typeof globalThis.fetch;
  getBaseUrl: () => string;
  commonHeaders: Record<string, string>;
};

function buildContext(sourceUrl: string): ProviderContext {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const axios = require("axios").default;
  return {
    axios,
    fetch: globalThis.fetch,
    getBaseUrl: () => sourceUrl,
    commonHeaders: {
      "User-Agent": "Mozilla/5.0 (compatible; KapoorKaGhulam/1.0)",
      Accept: "*/*",
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
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    Buffer,
    process: { env: {} },
    require: (mod: string) => {
      // Allow only safe requires
      if (mod === "axios") return providerContext.axios;
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

export async function execCatalog(catalogModule: string, sourceUrl: string): Promise<{ catalog: { title: string; filter: string }[]; genres: { title: string; filter: string }[] }> {
  const ctx = buildContext(sourceUrl);
  const mod = runModule(catalogModule, ctx);
  return {
    catalog: mod.catalog ?? [],
    genres: mod.genres ?? [],
  };
}

export async function execPosts(postsModule: string, sourceUrl: string, opts: { filter: string; page: number; providerValue: string; signal?: AbortSignal }): Promise<Array<{ title: string; link: string; image: string; provider?: string | null }>> {
  const ctx = buildContext(sourceUrl);
  const mod = runModule(postsModule, ctx);
  const results = await mod.getPosts({
    filter: opts.filter,
    page: opts.page,
    providerValue: opts.providerValue,
    providerContext: ctx,
  });
  return Array.isArray(results) ? results : [];
}

export async function execSearchPosts(postsModule: string, sourceUrl: string, opts: { query: string; page: number; providerValue: string }): Promise<Array<{ title: string; link: string; image: string; provider?: string | null }>> {
  const ctx = buildContext(sourceUrl);
  const mod = runModule(postsModule, ctx);
  const results = await mod.getSearchPosts({
    filter: opts.query,
    page: opts.page,
    providerValue: opts.providerValue,
    providerContext: ctx,
  });
  return Array.isArray(results) ? results : [];
}

export async function execMeta(metaModule: string, sourceUrl: string, opts: { link: string; provider: string }): Promise<any> {
  const ctx = buildContext(sourceUrl);
  const mod = runModule(metaModule, ctx);
  return mod.getMeta({ link: opts.link, provider: opts.provider, providerContext: ctx });
}

export async function execStream(streamModule: string, sourceUrl: string, opts: { link: string; type?: string }): Promise<Array<{ server: string; link: string; type: string; quality?: string | null; headers?: Record<string, string> | null }>> {
  const ctx = buildContext(sourceUrl);
  const mod = runModule(streamModule, ctx);
  const results = await mod.getStream({ link: opts.link, type: opts.type, providerContext: ctx });
  return Array.isArray(results) ? results : [];
}

export async function execEpisodes(episodesModule: string, sourceUrl: string, opts: { url: string }): Promise<Array<{ title: string; link: string }>> {
  const ctx = buildContext(sourceUrl);
  const mod = runModule(episodesModule, ctx);
  const results = await mod.getEpisodes({ url: opts.url, providerContext: ctx });
  return Array.isArray(results) ? results : [];
}
