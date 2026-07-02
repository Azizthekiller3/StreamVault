---
name: FlixNest project overview
description: Full architecture and feature map for the FlixNest Telegram movie streaming PWA
---

# FlixNest — Project Overview

**What it is:** A Netflix-style PWA that auto-indexes movies posted to a Telegram channel and serves them with streaming/download links.

## Stack
- **Frontend:** `artifacts/kapoor-ka-ghulam` — React 18 + Vite + Tailwind + Framer Motion + wouter + TanStack Query
- **Backend:** `artifacts/api-server` — Express 5 + Node 24 + TypeScript
- **Database:** Neon PostgreSQL + Drizzle ORM (`lib/db/`)
- **Scraper:** Cheerio — parses `t.me/s/<channel>` public web preview
- **Metadata:** TMDB API (poster, plot, cast, ratings, backdrop)
- **Deploy:** Vercel (frontend) + Koyeb (backend)

## DB Tables (`lib/db/src/schema/`)
- `telegram_movies` — scraped movies with JSONB qualities, TMDB enrichment fields
- `comments` — per-movie public comments
- `watchlist` — user saved movies
- `watch_history` — watch progress per movie
- `providers` / `provider_sources` / `installed_extensions` — extension plugin system
- `settings` — key-value config
- `title_overrides` — manual TMDB match overrides

## Frontend Pages (`artifacts/kapoor-ka-ghulam/src/pages/`)
- `/` — Home grid (20/page pagination, genre/language filters, collections)
- `/search` — Search page
- `/info` — Movie detail + stream/download + comments + cast
- `/telegram-info` — Telegram-specific movie info
- `/watch` — Video player
- `/watchlist` — Saved movies
- `/history` — Watch history
- `/download-history` — Download history
- `/browse` — Browse/catalog
- `/marketplace` — Extension marketplace
- `/settings` — Settings
- `/admin` — Admin panel (parse/add/bulk, TMDB fix, review queue, channel config)

## API Routes (`artifacts/api-server/src/routes/`)
- `telegram.ts` — `/api/telegram/*` — movies list, detail, search, CDN proxy, webhook, backfill, admin fixes
- `admin.ts` — `/api/admin/*` — re-parse, bulk ops, stats, TMDB review queue
- `watchlist.ts` — `/api/watchlist/*`
- `history.ts` — `/api/history/*`
- `settings.ts` — `/api/settings`
- `stats.ts` — `/api/stats`
- `search.ts` — `/api/search`
- `extensions.ts` — `/api/extensions/*`
- `providers.ts` — `/api/providers`
- `sources.ts` — `/api/sources`

## Services
- `telegramService.ts` — Scrapes channel, parses title/qualities/audio, DB-backed with in-memory cache, TMDB background enrichment
- `tmdbService.ts` — TMDB enrichment (30 min cache), title overrides, multi-search
- `commentService.ts` — File-based (or DB) comment storage
- `extensionExecutor.ts` — Sandboxed plugin runner

## Key Env Vars Needed
- `DATABASE_URL` — Neon PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN` — Telegram bot for webhook
- `TMDB_API_KEY` — TMDB metadata
- `BACKFILL_SECRET` — protects backfill/admin endpoints
- `TELEGRAM_CHANNEL` — channel username to scrape
- `ALLOWED_FRONTEND_ORIGIN` — Vercel URL for CORS

## Rules
- `telegram_movies.qualities` is JSONB — cast as `unknown as string` when inserting
- Never use `console.log` in server code — use `req.log` (route handlers) or `logger` (services)
- Do NOT touch Koyeb app "available-eada" (ID: 7f50045f) — unrelated project
- Push to GitHub via git CLI (not code_execution — no process.env there)
- parseQualities checks 2 previous lines for quality label (Link:-URL format posts)

**Why:** This project was built before this session. Rules were learned from hard bugs (title parsing, JSONB insert, CORS).
**How to apply:** Always respect JSONB cast rule when writing new DB inserts. Always re-read telegramService parseTitle/parseQualities before editing them.
