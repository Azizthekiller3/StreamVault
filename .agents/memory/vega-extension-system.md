---
name: Vega Extension System
description: How vega-org provider extensions work — VM sandbox requirements, module API, URL registry design
---

## What the extension JS expects in `providerContext`

- `axios` — HTTP client (always provided)
- `cheerio` — HTML parser (`cheerio` npm package, already installed in api-server)
- `fetch` — must also be a **global** in the VM sandbox (not just in providerContext), some modules use bare `fetch` directly
- `getBaseUrl(providerName: string): Promise<string>` — async function returning the provider's current site URL
- `commonHeaders` — browser-like headers object

## `getBaseUrl` design

The vega-org repo has NO `urls.json` or URL registry file. `getBaseUrl` is implemented by the host app:
- We store `baseUrl` per installed extension in the DB (`installed_extensions.base_url` column)
- Users configure it via the Marketplace UI (link icon → URL input per extension)  
- `buildContext(sourceUrl, extensionBaseUrl?)` uses stored `baseUrl` if set, otherwise tries `${sourceUrl}/base_urls.json`
- Called with provider name like `getBaseUrl("Vega")`, `getBaseUrl("4khdhub")` — we ignore the arg and return the stored URL

## Module function signatures

- `catalog.js` — exports `catalog` and `genres` arrays directly (no async, no getBaseUrl)
- `posts.js` — exports `getPosts({ filter, page, providerValue, signal, providerContext })` and `getSearchPosts({ filter, searchQuery, page, providerValue, signal, providerContext })`
  - Note: pass BOTH `filter` and `searchQuery` for cross-provider compat
- `meta.js` — exports `getMeta({ link, providerContext })` — uses `link` as the full URL directly
- `stream.js` — exports `getStream({ link, type, signal, providerContext })`
- `episodes.js` — exports `getEpisodes({ url, providerContext })`

## VM sandbox globals required

```js
{ fetch: globalThis.fetch, atob, btoa, URL, URLSearchParams, Promise, Buffer, console, setTimeout/clearTimeout/setInterval/clearInterval, process: {env: {}}, require(axios|cheerio) }
```

## vega-org manifest format

`manifest.json` is an array with `display_name`, `value`, `version`, `icon`, `type`, `disabled`.
Extension JS lives at `${sourceUrl}/dist/${value}/{catalog,posts,meta,stream,episodes}.js`.
`vega-org` shorthand → `vega-org/vega-providers` → `https://raw.githubusercontent.com/vega-org/vega-providers/refs/heads/main`

**Why:** Without cheerio+fetch+getBaseUrl, the extension JS crashes immediately when trying to parse HTML or make HTTP calls.
**How to apply:** Any time an extension fails with "cheerio is not defined", "fetch is not defined", or returns wrong URLs — check these three context items and the stored baseUrl.
