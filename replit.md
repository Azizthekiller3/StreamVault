# Kapoor Ka Ghulam

A dark, cinematic media streaming web app — clone of Vega App. Users browse movies & TV shows, search via OMDB, save to watchlist, track watch history, and manage streaming providers.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/kapoor-ka-ghulam run dev` — run the frontend (port 20411)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `OMDB_API_KEY` — OMDB API key (defaults to "trilogy" free tier key)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite, Tailwind CSS, Framer Motion, Wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Search/Metadata: OMDB API

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for API contracts
- `lib/db/src/schema/` — DB tables: watchlist.ts, history.ts, providers.ts
- `artifacts/api-server/src/routes/` — route handlers: watchlist, history, providers, search, stats
- `artifacts/kapoor-ka-ghulam/src/pages/` — frontend pages: home, search, info, watchlist, history, providers, settings
- `artifacts/kapoor-ka-ghulam/src/components/` — poster-card, layout, nav

## Architecture decisions

- OMDB API used as metadata source for movie/TV info and search
- Streaming providers are user-managed external URLs (bring your own source)
- Watch history uses upsert on `link` field to avoid duplicates
- All API routes under `/api` prefix; frontend at `/`
- Dark mode forced via `class="dark"` on html element

## Product

- Home with hero banner (last-watched item) + Continue Watching + Watchlist rows
- Real-time OMDB search with debounce
- Content info page with add-to-watchlist and watch history tracking
- Provider management (install/remove streaming sources by URL)
- Stats dashboard (counts for watchlist, history, providers)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/db/src/schema/`, run `pnpm run typecheck:libs` before checking artifact packages
- After OpenAPI spec changes, run codegen before using updated types
- OMDB API key defaults to "trilogy" — may hit rate limits; set `OMDB_API_KEY` env var for production

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
