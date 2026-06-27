---
name: StreamVault deployment context
description: Complete project understanding, all bugs fixed, TMDB override system implemented, deployment context for FlixNest
---

# StreamVault / FlixNest — Agent Handoff (updated 2026-06-27)

## What the app is
StreamVault (branding: FlixNest) is a Netflix-style PWA. Movies from Telegram channel `@backupchannek`, enriched with TMDB metadata, streamed via Terabox links. No login — fully public.

---

## Repo & GitHub
- Repo: `Azizthekiller3/StreamVault` (branch: main)
- Push method: **node `https` module in bash** — NOT `git push` (blocked in Replit), NOT `code_execution` (no `process.env` there)
- Pattern: fetch SHA → base64 encode → PUT to GitHub API

---

## Stack
| Layer | Tech | Deploy |
|---|---|---|
| Frontend | React + Vite + Tailwind | Vercel |
| Backend | Express 5 + TypeScript | Koyeb |
| DB | PostgreSQL + Drizzle ORM | Neon |

---

## Where things live
- Frontend: `artifacts/kapoor-ka-ghulam/`
- Backend: `artifacts/api-server/`
- DB schema: `lib/db/src/schema/`
- DB entry: `lib/db/src/index.ts` — exports `db`, `pool`, and `export * from "./schema"`

---

## Replit Secrets (all set)
- `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TMDB_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `NEON_DATABASE_URL`, `KOYEB_API_KEY`, `VERCEL_API_TOKEN`
- telegram.ts uses `process.env.TELEGRAM_BOT_TOKEN` (was BOT_API_TOKEN, now fixed)

---

## Neon DB Tables (all created)
`telegram_movies`, `watchlist`, `watch_history`, `providers`, `provider_sources`, `installed_extensions`, `settings`, `comments`, `title_overrides`

- `telegram_movies.message_id` is TEXT (supports `manual_xxx` IDs)
- `title_overrides` — permanent rawTitle → tmdbId override table (created 2026-06-27)

---

## TMDB Override System (implemented 2026-06-27)
**Problem:** Telegram titles are messy (e.g. "Maalik 2025 Hindi 1080p BluRay") and TMDB misidentifies them.

**Solution:**
1. `title_overrides` DB table — admins save permanent rawTitle → tmdbId mappings
2. `tmdbService.ts` checks overrides first, then falls back to `/search/multi` with confidence scoring
3. Admin "Fix TMDB" tab — search TMDB, pick correct result, save override

**Key tmdbService.ts design decisions:**
- `/search/multi` endpoint searches both movies and TV in one TMDB API call
- Confidence scoring: title word overlap (0-40) + year proximity (0-30) + language match (0-20) + type preference (0-5) + vote count (0-5) = max 100
- MIN_CONFIDENCE = 35 — skip result if below threshold (avoids bad matches)
- Language detection: audio field → ISO 639-1 code ("Hindi" → "hi", etc.)
- Override cache: in-memory Map, refreshed hourly from DB, busted on save
- `enrichFromTmdb(rawTitle, audio?)` — audio param is optional, backward compatible

**Admin endpoints added:**
- `GET /api/admin/tmdb-search?q=&year=&type=` — proxy TMDB search
- `GET /api/admin/tmdb-overrides` — list all overrides
- `POST /api/admin/tmdb-override` `{ rawTitle, tmdbId, mediaType }` — save override
- `DELETE /api/admin/tmdb-overrides/:id` — delete override

---

## Known Koyeb env vars needed
`PORT=8080`, `NODE_ENV=production`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TMDB_API_KEY`, `DATABASE_URL` (=Neon URL)

## Deployment status (as of 2026-06-27)
- NOT YET DEPLOYED to Koyeb/Vercel — still needs initial deployment
- All code is on GitHub main branch, ready to deploy
