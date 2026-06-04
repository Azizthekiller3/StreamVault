---
name: Vega-compatible extension system
description: Architecture of the provider extension system — how sources, manifests, and JS modules work
---

## Source URL parsing
- GitHub author shorthand `vega-org` → `https://raw.githubusercontent.com/vega-org/vega-providers/refs/heads/main`
- GitHub repo URL → converted to raw.githubusercontent.com URL
- Source URL in DB is always the raw base URL

## Manifest
- `{sourceUrl}/manifest.json` → array of `{ value, display_name|displayName|name, type, version, icon, disabled }`

## Module URLs
- `{sourceUrl}/dist/{value}/catalog.js` — exports `{ catalog: [{title, filter}], genres: [{title, filter}] }`
- `{sourceUrl}/dist/{value}/posts.js` — exports `{ getPosts({filter, page, providerValue, providerContext}), getSearchPosts(...) }`
- `{sourceUrl}/dist/{value}/meta.js` — exports `{ getMeta({link, provider, providerContext}) }`
- `{sourceUrl}/dist/{value}/stream.js` — exports `{ getStream({link, type, providerContext}) }`
- `{sourceUrl}/dist/{value}/episodes.js` — exports `{ getEpisodes({url, providerContext}) }`

## Execution
- Modules run via Node.js `vm.Script` in a sandbox
- `providerContext` provides: axios, fetch, getBaseUrl(), commonHeaders
- Module code uses CommonJS `module.exports = ...` pattern
- Timeout: 10 seconds per module execution

## DB storage
- JS module code is stored as text columns in `installed_extensions` table
- Extension execution happens at request time (no caching beyond DB)
