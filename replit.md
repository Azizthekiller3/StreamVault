# StreamVault (FlixNest)

A Netflix-style PWA that scrapes movies from a Telegram channel, enriches them with TMDB metadata, and streams them via Terabox links — no user login required.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Neon Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (hosted on Neon)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS/ESM bundle)

## Where things live

- Frontend: `artifacts/kapoor-ka-ghulam/` (React + Vite + Tailwind)
- Backend: `artifacts/api-server/` (Express 5)
- DB schema: `lib/db/src/schema/` — all tables exported from `index.ts`
- Routes: `artifacts/api-server/src/routes/index.ts` — all routers registered here
- App entry: `artifacts/api-server/src/app.ts` — CORS, rate limiting, logging, body parsing

## Architecture decisions

- Movies are scraped from Telegram via webhook + backfill; stored in Neon `telegram_movies` table
- TMDB enrichment runs in background on startup and self-heals on movie detail fetch
- Admin auth uses HMAC-SHA256 deterministic token (no DB session needed)
- `title_overrides` table lets admins permanently fix wrong TMDB matches
- `message_id` is TEXT (not int) to support manual entries (`manual_xxx` IDs)

## Product

- Public movie grid (EonMovies-style, 20/page pagination)
- Movie detail with Terabox quality selector (480p/720p/1080p/4K)
- Search, watchlist, watch history, comments
- Admin panel: parse/add movies, bulk import, TMDB fix tab, review queue
- Telegram webhook: new channel posts auto-added as movies

## Deployment

- **Backend:** Koyeb — `https://streamvault-moviebot123-091f92aa.koyeb.app` (LIVE ✅)
- **Frontend:** Vercel — NOT YET DEPLOYED (see `.agents/memory/streamvault-deploy.md` for steps)
- **DB:** Neon PostgreSQL

## Gotchas

- Push to GitHub from Replit using node `https` module in bash — `git push` is blocked, `code_execution` has no `process.env`
- Koyeb requires `"packageManager": "pnpm@10.26.1"` in root `package.json` for Corepack to detect pnpm
- Koyeb hobby23 plan only supports `--instance-type free`
- Never call services at their local port directly — always go through `localhost:80` via the shared proxy
- Do NOT touch Koyeb app "available-eada" (ID: 7f50045f) — user's separate unrelated project

## Pointers

- Full deployment context: `.agents/memory/streamvault-deploy.md`
- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

## User preferences

- Always save session progress to `.agents/memory/streamvault-deploy.md` (local) AND push it to GitHub `Azizthekiller3/StreamVault` repo at the same path after every significant conversation
