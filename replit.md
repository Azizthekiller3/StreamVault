# FlixNest

A Netflix-style Telegram movie streaming PWA. Auto-indexes movies posted to a Telegram channel, enriches them with TMDB metadata, and serves them with streaming/download links (Terabox). Free forever: Vercel + Koyeb + Neon.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port assigned by workflow)
- `pnpm --filter @workspace/kapoor-ka-ghulam run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only, requires DATABASE_URL)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS + Framer Motion + wouter + TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (Neon free tier)
- Scraper: Cheerio (parses t.me/s/channel public web preview)
- Metadata: TMDB API
- Deploy: Vercel (frontend `artifacts/kapoor-ka-ghulam`) + Koyeb (backend `artifacts/api-server`)

## Where things live

- `artifacts/kapoor-ka-ghulam/` — React/Vite frontend PWA
  - `src/pages/` — all pages (home, search, info, watch, watchlist, history, admin, etc.)
  - `src/components/` — shared components
  - `src/lib/` — api-base, flixnest-store, genres, collections
- `artifacts/api-server/` — Express backend
  - `src/routes/telegram.ts` — main movie routes + CDN proxy + webhook
  - `src/routes/admin.ts` — admin endpoints
  - `src/services/telegramService.ts` — Telegram scraper + parser (source of truth for title/quality parsing)
  - `src/services/tmdbService.ts` — TMDB enrichment (30 min cache)
  - `src/services/commentService.ts` — comment storage
- `lib/db/src/schema/` — Drizzle schema (movies, comments, watchlist, history, providers, extensions, settings, title_overrides)

## Architecture decisions

- Telegram scraper reads public `t.me/s/<channel>` HTML (no bot required for scraping)
- TMDB enrichment runs in background on startup + self-heals on detail page fetch
- `telegram_movies.qualities` stored as JSONB — cast as `unknown as string` on insert
- CDN proxy for Telegram poster URLs (CORS fix): backend proxies `cdn*.telesco.pe` images
- In-memory seedMovies array is the hot path; DB is source of truth on startup

## Product

FlixNest lets users browse, stream, and download movies posted to a private Telegram channel. Features: home grid, search, movie detail, Terabox streaming by quality (480p/720p/1080p), watchlist, watch history, comments, star ratings, series/collections grouping, genre+language filters, Movie of the Day, Recently Viewed, PWA (installable), dark/light mode, admin panel.

## User preferences

- GitHub: Azizthekiller3 / repo: StreamVault
- Deployment: Vercel (frontend) + Koyeb (backend, app name "streamvault" — NOT "available-eada" which is an unrelated project)
- Database: Neon PostgreSQL

## Gotchas

- **Never use `console.log` in server code** — use `req.log` in route handlers, `logger` singleton elsewhere
- `telegram_movies.qualities` is JSONB — always cast as `unknown as string` when inserting with Drizzle
- Do NOT touch Koyeb app "available-eada" (ID: 7f50045f) — unrelated project
- `parseTitle` has a year-priority pass (lines with `(20XX)` returned first) — don't break this
- `parseQualities` checks the 2 previous lines for quality label — some posts put the label above the URL
- Do NOT run `pnpm dev` at workspace root — use `--filter` or WorkflowsRestart tool
- Push to GitHub via git CLI with token; do not use code_execution (no process.env)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.agents/memory/flixnest-overview.md` for full architecture reference
- See `.agents/memory/streamvault-deploy.md` for deployment procedures
