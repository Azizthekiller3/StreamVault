# StreamVault / FlixNest

Netflix-style PWA that pulls movies from a Telegram channel, enriches them with TMDB metadata, and lets users stream/download via Terabox links.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` or `NEON_DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (Neon)
- TMDB enrichment: custom tmdbService with confidence scoring + permanent overrides
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind (Vercel)
- Backend: Express 5 (Koyeb)

## Where things live

- Frontend: `artifacts/kapoor-ka-ghulam/` — React + Vite PWA
- Backend: `artifacts/api-server/` — Express 5 API
- DB schema: `lib/db/src/schema/` — all Drizzle tables
- TMDB service: `artifacts/api-server/src/services/tmdbService.ts`
- Admin routes: `artifacts/api-server/src/routes/admin.ts`

## Architecture decisions

- Movies are sourced from Telegram channel `@backupchannek` via bot webhooks
- TMDB enrichment uses `/search/multi` with confidence scoring (title overlap + year + language) and permanent admin-controlled overrides stored in `title_overrides` table
- Telegram titles are preprocessed (strip quality tags, language names, episode markers) before TMDB search
- Admin "Fix TMDB" panel lets admins pick the correct TMDB match and save a permanent override that survives re-deploys
- `TELEGRAM_BOT_TOKEN` is the correct env var name (not `BOT_API_TOKEN`)

## Product

- Public Netflix-style movie browsing (no login required)
- Admin panel at `/admin` — add movies, bulk import, channel config, Fix TMDB misidentification
- Each movie has multiple quality links (480p/720p/1080p) via Terabox

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- GitHub pushes: use `node https` module in bash, NOT `git push` (blocked) and NOT `code_execution` (no `process.env`)
- Pattern: GET file SHA → base64 encode content → PUT to GitHub API
- `telegram_movies.message_id` is TEXT (supports both numeric and `manual_xxx` IDs)
- `DATABASE_URL` env var on Koyeb must be set to Neon connection string
- Koyeb env: `PORT=8080`, `NODE_ENV=production`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TMDB_API_KEY`, `DATABASE_URL`

## Pointers

- See `.agents/memory/streamvault-deploy.md` for full deployment context
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
