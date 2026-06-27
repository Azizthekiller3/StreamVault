---
name: StreamVault deployment context
description: Full project understanding, deployment progress, and next steps for StreamVault (Telegram → Netflix-style PWA)
---

# StreamVault — Agent Handoff (updated 2026-06-27)

## What the app is
StreamVault (internally FlixNest in code) is a Netflix-style movie PWA. Movies come from Telegram channel `backupchannek`, enriched with TMDB metadata, users stream/download via Terabox links.

---

## GitHub
- Repo: `Azizthekiller3/StreamVault` (branch: main)
- Push method: GitHub REST API via node https — NOT git push (blocked), NOT code_execution (no process.env)

---

## Stack
- Frontend (React+Vite+Tailwind) → artifacts/kapoor-ka-ghulam/ → deploy: Vercel (static)
- Backend (Express 5) → artifacts/api-server/ → deploy: Koyeb (Node)
- DB (PostgreSQL+Drizzle) → lib/db/ → Neon free tier ✅ SCHEMA PUSHED

---

## Secrets in Replit
- SESSION_SECRET ✅
- TELEGRAM_BOT_TOKEN ✅
- TMDB_API_KEY ✅
- DATABASE_URL (Replit managed — points to Replit PostgreSQL)
- GITHUB_PERSONAL_ACCESS_TOKEN ✅

## Neon Production DB
- Schema pushed ✅ (2026-06-27) — all tables created: telegram_movies, watchlist, history, providers, provider_sources, installed_extensions, settings
- telegram_movies.message_id is TEXT (not integer) to support both numeric and manual_ prefixed IDs
- Neon URL must be set as DATABASE_URL env var on Koyeb

---

## Key changes made (2026-06-27)
1. lib/db/src/schema/movies.ts — messageId changed from integer to text (handles manual_ IDs)
2. artifacts/api-server/src/services/telegramService.ts — DB-backed storage replacing JSON file
   - Lazy init: loads movies from DB on first request (ensureDbLoaded)
   - addSeedMovie: upserts to DB (fire-and-forget)
   - removeSeedMovie: deletes from DB (fire-and-forget)
   - seedMovies array = in-memory cache loaded from DB

---

## Koyeb Backend Setup (NOT YET DEPLOYED)
Build command: pnpm install && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/db run push-force
Run command: node --enable-source-maps artifacts/api-server/dist/index.mjs
Port: 8080
Env vars to set on Koyeb:
  PORT=8080
  NODE_ENV=production
  SESSION_SECRET=<from Replit secrets>
  TELEGRAM_BOT_TOKEN=<from Replit secrets>
  TMDB_API_KEY=<from Replit secrets>
  DATABASE_URL=<Neon connection string>

After Koyeb deploys → register Telegram webhook:
  curl -X POST https://YOUR-KOYEB-URL/api/telegram/register-webhook     -H x-backfill-secret: SESSION_SECRET_VALUE     -H Content-Type: application/json     -d {webhookUrl:https://YOUR-KOYEB-URL/api/telegram/webhook}

---

## Vercel Frontend Setup (NOT YET DEPLOYED)
vercel.json already configured at repo root.
Build: pnpm install && pnpm --filter @workspace/kapoor-ka-ghulam run build
Output: artifacts/kapoor-ka-ghulam/dist/public
Env var: VITE_API_BASE_URL=https://YOUR-KOYEB-URL

---

## Telegram Bot
- Bot: @FlixNest_bot
- Channel: backupchannek (18+ restricted — public scraping may fail)
- Bot must be added as channel admin for webhook to work
- Movie post format: Movie :- Title (Year) / 720p:- https://terabox / 1080p:- https://terabox

---

## All API Endpoints (verified working)
GET /api/healthz, GET/POST/DELETE /api/watchlist, GET/POST/DELETE /api/history
GET /api/telegram/movies, GET /api/telegram/movies/:id, GET /api/tmdb/enrich
GET/POST /api/comments/:movieId, POST /api/telegram/parse-and-add
POST /api/telegram/webhook, POST /api/telegram/register-webhook
