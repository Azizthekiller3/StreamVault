---
name: StreamVault deployment context
description: Complete project state — backend LIVE on Koyeb, all features, security hardening, frontend pending Vercel
---

# StreamVault / FlixNest — Agent Handoff (updated 2026-06-29)

## What the app is
StreamVault (branding: FlixNest) is a Netflix-style PWA. Movies scraped from Telegram channel, enriched with TMDB metadata, streamed via Terabox links. No user login — fully public.

## Repo & GitHub
- Repo: `Azizthekiller3/StreamVault` (branch: main)
- Push method: **node `https` module in bash** — NOT `git push` (blocked in Replit sandbox), NOT `code_execution` (no `process.env` there)
- Pattern: fetch SHA of file → base64 encode new content → PUT to GitHub Contents API

## Stack
| Layer | Tech | Deploy target |
|---|---|---|
| Frontend | React + Vite + Tailwind | Vercel |
| Backend | Express 5 + TypeScript | Koyeb |
| DB | PostgreSQL + Drizzle ORM | Neon |

## Where things live
- Frontend: `artifacts/kapoor-ka-ghulam/`
- Backend: `artifacts/api-server/`
- DB schema: `lib/db/src/schema/index.ts`
- DB entry: `lib/db/src/index.ts` — exports `db`, `pool`, all schema tables
- Routes: `artifacts/api-server/src/routes/index.ts`
- App: `artifacts/api-server/src/app.ts`

## Replit Secrets (all set)
- `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TMDB_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN`
- Neon URL also in Replit secrets

## Neon DB Tables (all created and schema pushed)
`telegram_movies`, `watchlist`, `watch_history`, `providers`, `provider_sources`, `installed_extensions`, `settings`, `comments`, `title_overrides`

- `telegram_movies.message_id` is TEXT (supports `manual_xxx` IDs)
- `telegram_movies` also has: `tmdb_id`, `confidence` (int), `needs_review` (bool)
- `title_overrides` — permanent rawTitle to tmdbId override table

## Koyeb Deployment (LIVE as of 2026-06-29)
- App: `streamvault`, Service: `api` (ID: 35d3993e)
- **Live URL:** `https://streamvault-moviebot123-091f92aa.koyeb.app`
- Plan: hobby23 — only `--instance-type free` works
- GitHub auto-deploy: pushes to `main` trigger rebuild

### Koyeb CLI
```
export PATH="/home/runner/.koyeb/bin:$PATH"
export KOYEB_TOKEN="h4nv91hd32njtfdxgfo4qspyec0tid2zvgqsxeuzx32d6ihhlim721ct31dhwy4k"
koyeb services describe api --app streamvault
koyeb service logs 35d3993e -t build
koyeb service logs 35d3993e -t runtime
```

### Koyeb Build Command (already set on service)
```
pnpm install && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/db run push-force
```

### Koyeb Env Vars (all set except flagged ones)
| Var | Value / Note |
|---|---|
| PORT | 8080 |
| NODE_ENV | production |
| SESSION_SECRET | set |
| TELEGRAM_BOT_TOKEN | 8866914429:... |
| TMDB_API_KEY | 7b683db9a2d6b6c5d832cb1c588ac7ab |
| DATABASE_URL | postgresql://neondb_owner:npg_sBx7hXLlWYu5@ep-billowing-sound-aiiic9ha.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require |
| TELEGRAM_WEBHOOK_SECRET | **NOT SET YET** — set a random string, re-register webhook after |
| ALLOWED_FRONTEND_ORIGIN | **NOT SET YET** — set to Vercel URL after frontend deploy |

### Key build fix (2026-06-29)
Added `"packageManager": "pnpm@10.26.1"` to root `package.json` — Koyeb Heroku buildpack requires this for Corepack pnpm detection. Without it, build fails immediately with "Corepack Requirement Error".

## Telegram Webhook
- Status: REGISTERED (2026-06-29)
- URL: `https://streamvault-moviebot123-091f92aa.koyeb.app/api/telegram/webhook`
- Re-register:
```
SESSION_SEC=$(node -e "process.stdout.write(process.env.SESSION_SECRET||'')")
curl -X POST https://streamvault-moviebot123-091f92aa.koyeb.app/api/telegram/register-webhook \
  -H "x-backfill-secret: $SESSION_SEC" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"https://streamvault-moviebot123-091f92aa.koyeb.app/api/telegram/webhook"}'
```

## Frontend Vercel Deployment (PENDING)
1. vercel.com/new → Import `Azizthekiller3/StreamVault`
2. Build Command: `pnpm install && pnpm --filter @workspace/kapoor-ka-ghulam run build`
3. Output Directory: `artifacts/kapoor-ka-ghulam/dist/public`
4. Install Command: leave blank
5. Env var: `VITE_API_BASE_URL=https://streamvault-moviebot123-091f92aa.koyeb.app`
6. After deploy: set `ALLOWED_FRONTEND_ORIGIN` on Koyeb to the Vercel URL

## Security Hardening (done 2026-06-28)
1. Webhook checks `X-Telegram-Bot-Api-Secret-Token` vs `TELEGRAM_WEBHOOK_SECRET` env var
2. CORS: only specific origins (Vercel URLs, localhost, `.replit.app`, `.koyeb.app`)
3. Rate limits on `/api/admin/login`, `/api/telegram/backfill`
4. Admin token (`x-admin-token`) required for source/extension/provider mutations
5. Crawlers blocked via `/robots.txt`
6. No hardcoded fallback in `adminAuth.ts` — throws if SESSION_SECRET missing

## Admin Auth
- `POST /api/admin/login` body `{ username, password }` → `{ token }`
- Token: HMAC-SHA256("flixnest-admin-v1", SESSION_SECRET) — deterministic
- Use `x-admin-token: <token>` header for mutations
- Defaults: username=`ADMIN_USERNAME||"admin"`, password=`ADMIN_PASSWORD||SESSION_SECRET`

## TMDB Override System
- `title_overrides` table: permanent rawTitle → tmdbId mapping
- `tmdbService.ts` checks overrides first, then `/search/multi` with confidence scoring
- Confidence max 100: title overlap (40) + year (30) + language (20) + type (5) + votes (5)
- MIN_CONFIDENCE = 35
- Admin endpoints: tmdb-search, tmdb-overrides CRUD, re-enrich/:id, needs-review, reset-poster/:id

## Data Management Endpoints
- `POST /api/admin/fix-titles` — decode HTML entities, reset poster
- `POST /api/admin/purge-junk` — remove junk/CTA posts
- `POST /api/admin/sync-deletions` — remove deleted channel movies
- `POST /api/telegram/backfill` — scrape channel (requires `x-backfill-secret`)

## Features (as of 2026-06-29)
- Home grid: 20/page, numbered pagination, EonMovies-style cards
- Movie detail + Terabox streaming quality selector
- Search (`GET /api/telegram/search?q=`)
- Watchlist, watch history, comments (all DB-backed)
- Settings, stats
- Admin panel: parse/add/bulk, TMDB fix tab, review queue, channel config
- Telegram webhook auto-adds new posts
- TMDB enrichment: background on startup + self-heal on detail fetch
- CDN proxy for Telegram poster URLs (CORS fix)
- Provider/source/extension plugin system
- parseQualities: checks 2 previous lines for quality label (Link:-URL format)
- Strip filler words from TMDB search ("Movie", "Film", "Full", "Official")
- HTML entity decoding in titles

## Do NOT touch
- Koyeb app "available-eada" (ID: 7f50045f) — user's separate unrelated project

## TODO
- [ ] Set `TELEGRAM_WEBHOOK_SECRET` on Koyeb, re-register webhook
- [ ] Deploy frontend to Vercel
- [ ] Set `ALLOWED_FRONTEND_ORIGIN` on Koyeb after Vercel deploy
- [ ] End-to-end test: home → detail → stream → watchlist → comments

## Bug Fixes Log
### 2026-06-29 — "Blast" title parsing (parseTitle + parseQualities)
**Symptom:** Movie showing as "720hevc" on home grid instead of "Blast"
**Root cause (title):** Line "Blast (2026) HDRip... [Dual Audio]..." matched the `|audio|` skip filter in parseTitle's fallback loop → was skipped. Next non-skipped line "720hevc" (doesn't match `^\d{3,4}p`) was returned as title.
**Root cause (quality):** "720hevc" had no matching pattern in qualityPatterns → quality was lost.
**Fixes in `telegramService.ts`:**
1. `parseTitle`: Added year-priority pass — lines matching `(20XX)` are returned as title BEFORE any skip filters. This handles all `[Dual Audio]`, `[Hindi or Tamil]` style titles.
2. `parseTitle`: Changed `|audio|` filter to `^\s*audio\s*[:-]` — only skips dedicated "Audio: Hindi" label lines, not bracketed "[Dual Audio]" text within a title.
3. `parseTitle`: Added skip for quality-label-only lines (`720hevc`, `hevc`, `Link:-`).
4. `parseQualities`: Added `{ label: "720hevc", re: /720\s*(?:hevc|h\.?265|x\.?265)/i }` before "720p" pattern.
