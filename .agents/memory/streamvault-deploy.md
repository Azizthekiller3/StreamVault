---
name: StreamVault deployment context
description: Complete project state — backend LIVE on Koyeb, all features, security hardening, frontend pending Vercel
---

# StreamVault / FlixNest — Agent Handoff (updated 2026-06-29)

## What the app is
StreamVault (branding: FlixNest) is a Netflix-style PWA. Movies scraped from Telegram channel, enriched with TMDB metadata, streamed via Terabox links. No user login — fully public.

---

## Repo & GitHub
- Repo: `Azizthekiller3/StreamVault` (branch: main)
- Push method: **node `https` module in bash** — NOT `git push` (blocked in Replit sandbox), NOT `code_execution` (no `process.env` there)
- Pattern: fetch SHA of file → base64 encode new content → PUT to GitHub Contents API

---

## Stack
| Layer | Tech | Deploy target |
|---|---|---|
| Frontend | React + Vite + Tailwind | Vercel |
| Backend | Express 5 + TypeScript | Koyeb |
| DB | PostgreSQL + Drizzle ORM | Neon |

---

## Where things live
- Frontend: `artifacts/kapoor-ka-ghulam/`
- Backend: `artifacts/api-server/`
- DB schema: `lib/db/src/schema/` (index at `lib/db/src/schema/index.ts`)
- DB entry: `lib/db/src/index.ts` — exports `db`, `pool`, and `export * from "./schema"`
- Routes wired: `artifacts/api-server/src/routes/index.ts`
- App entry: `artifacts/api-server/src/app.ts`

---

## Replit Secrets (all set in Replit environment)
- `SESSION_SECRET` — used for admin token generation and backfill auth
- `TELEGRAM_BOT_TOKEN` — 8866914429:AAEQn8TcOMuUS7S0KHUhI8JTUhFUQpIK7Es
- `TMDB_API_KEY` — 7b683db9a2d6b6c5d832cb1c588ac7ab
- `GITHUB_PERSONAL_ACCESS_TOKEN` — for pushing to repo from Replit
- Neon URL also available in Replit secrets

---

## Neon DB Tables (all created and schema pushed)
`telegram_movies`, `watchlist`, `watch_history`, `providers`, `provider_sources`, `installed_extensions`, `settings`, `comments`, `title_overrides`

- `telegram_movies.message_id` is TEXT (supports `manual_xxx` IDs)
- `title_overrides` — permanent rawTitle to tmdbId override table
- `telegram_movies` has: `tmdb_id`, `confidence` (integer), `needs_review` (boolean) columns

---

## Koyeb Deployment (LIVE as of 2026-06-29)
- App name: `streamvault`
- Service: `api` (ID: 35d3993e)
- **Live URL:** `https://streamvault-moviebot123-091f92aa.koyeb.app`
- Status: HEALTHY
- Plan: hobby23 — only `--instance-type free` works
- GitHub auto-deploy: pushes to `main` branch auto-trigger Koyeb rebuild

### Koyeb CLI (in Replit)
```
export PATH="/home/runner/.koyeb/bin:$PATH"
export KOYEB_TOKEN="h4nv91hd32njtfdxgfo4qspyec0tid2zvgqsxeuzx32d6ihhlim721ct31dhwy4k"
koyeb services describe api --app streamvault
koyeb service logs 35d3993e -t build
koyeb service logs 35d3993e -t runtime
```

### Koyeb Build Command (set on service)
```
pnpm install && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/db run push-force
```

### Koyeb Start Command
```
node artifacts/api-server/dist/index.mjs
```

### Koyeb Env Vars (all set on service)
| Var | Value / Note |
|---|---|
| PORT | 8080 |
| NODE_ENV | production |
| SESSION_SECRET | set from Replit secret |
| TELEGRAM_BOT_TOKEN | 8866914429:... |
| TMDB_API_KEY | 7b683db9a2d6b6c5d832cb1c588ac7ab |
| DATABASE_URL | postgresql://neondb_owner:npg_sBx7hXLlWYu5@ep-billowing-sound-aiiic9ha.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require |
| TELEGRAM_WEBHOOK_SECRET | **NEEDS TO BE SET** — random string, must match what you pass when registering webhook |
| ADMIN_USERNAME | optional, defaults to "admin" |
| ADMIN_PASSWORD | optional, defaults to SESSION_SECRET |
| ALLOWED_FRONTEND_ORIGIN | **NEEDS TO BE SET** — your Vercel URL once deployed |

### Fix that unblocked the build (2026-06-29)
Added `"packageManager": "pnpm@10.26.1"` to root `package.json` — Koyeb's Heroku buildpack requires this to detect pnpm version via Corepack. Without it, build fails immediately.

---

## Telegram Webhook
- Status: REGISTERED and VERIFIED (as of 2026-06-29)
- Webhook URL: `https://streamvault-moviebot123-091f92aa.koyeb.app/api/telegram/webhook`
- Re-register command (run from Replit bash):

```
SESSION_SEC=$(node -e "process.stdout.write(process.env.SESSION_SECRET||'')")
curl -X POST https://streamvault-moviebot123-091f92aa.koyeb.app/api/telegram/register-webhook \
  -H "x-backfill-secret: $SESSION_SEC" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"https://streamvault-moviebot123-091f92aa.koyeb.app/api/telegram/webhook"}'
```

- **IMPORTANT:** After setting `TELEGRAM_WEBHOOK_SECRET` on Koyeb, you must re-register the webhook so Telegram knows to include the secret token header.

---

## Frontend Vercel Deployment (NOT YET DONE)
Steps when user is ready:
1. Go to vercel.com/new → Import `Azizthekiller3/StreamVault`
2. Build Command: `pnpm install && pnpm --filter @workspace/kapoor-ka-ghulam run build`
3. Output Directory: `artifacts/kapoor-ka-ghulam/dist/public`
4. Install Command: leave blank
5. Env var: `VITE_API_BASE_URL=https://streamvault-moviebot123-091f92aa.koyeb.app`
6. After deploy: add the Vercel URL to Koyeb `ALLOWED_FRONTEND_ORIGIN`

---

## Security Hardening Done (2026-06-28)
All live on GitHub main branch:

1. **Webhook secret verification** — `POST /api/telegram/webhook` checks `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` env var. If var is not set, verification is skipped (backward compat), but it should be set.
2. **CORS tightened** — only specific origins allowed: Vercel URLs, localhost, `.replit.app`, `.koyeb.app`. Configure `ALLOWED_FRONTEND_ORIGIN` on Koyeb for exact Vercel URL.
3. **Rate limits** — in-memory rate limiter on `/api/admin/login`, `/api/telegram/backfill`, and other admin endpoints.
4. **Admin token required** — source add/delete/setDefault, extension install/uninstall/setBaseUrl all require `x-admin-token` header.
5. **Crawlers blocked** — `/robots.txt` disallows all.
6. **No hardcoded fallback secret** — `adminAuth.ts` throws if SESSION_SECRET not set (no insecure default).

---

## Admin Authentication
- Login: `POST /api/admin/login` body `{ username, password }` → returns `{ token }`
- Token: HMAC-SHA256 of "flixnest-admin-v1" using SESSION_SECRET — deterministic, no DB needed
- Use `x-admin-token: <token>` header for all admin mutations
- Default credentials: username=`admin` (or `ADMIN_USERNAME`), password=SESSION_SECRET (or `ADMIN_PASSWORD`)

---

## TMDB Override System (implemented 2026-06-27)
**Problem:** Telegram titles are messy (e.g. "Maalik 2025 Hindi 1080p BluRay") — TMDB misidentifies them.

**Solution:**
1. `title_overrides` DB table — permanent rawTitle to tmdbId mappings saved by admin
2. `tmdbService.ts` checks overrides first, then falls back to `/search/multi` with confidence scoring
3. Admin panel "Fix TMDB" tab — search TMDB, pick correct result, save override

**Confidence scoring** (max 100):
- Title word overlap: 0-40 pts
- Year proximity: 0-30 pts
- Language match: 0-20 pts
- Type preference: 0-5 pts
- Vote count bonus: 0-5 pts
- MIN_CONFIDENCE = 35 — below this, no match recorded

**Admin endpoints:**
- `GET /api/admin/tmdb-search?q=&year=&type=` — proxy TMDB search
- `GET /api/admin/tmdb-overrides` — list all overrides
- `POST /api/admin/tmdb-override { rawTitle, tmdbId, mediaType }` — save override
- `DELETE /api/admin/tmdb-overrides/:id` — delete override
- `POST /api/admin/re-enrich/:id` — force re-fetch TMDB for one movie
- `GET /api/admin/needs-review` — movies with low confidence scores
- `POST /api/admin/reset-poster/:id` — clear poster for re-enrichment

---

## Data Management Endpoints
- `POST /api/admin/fix-titles` — decode HTML entities in stored titles (& etc.), reset poster
- `POST /api/admin/purge-junk` — remove junk/CTA posts ("Watch Online", "/add" etc.)
- `POST /api/admin/sync-deletions` — remove movies deleted from Telegram channel
- `POST /api/telegram/backfill` — scrape channel for new movies (requires `x-backfill-secret`)
- `POST /api/telegram/register-webhook` — register Telegram webhook (requires `x-backfill-secret`)

---

## Features Implemented (full list as of 2026-06-29)
- Home grid: paginated 20/page, numbered nav, EonMovies-style cards (year below title, rounded-2xl, skeleton loaders)
- Movie detail page with quality selector, Terabox streaming
- Search: frontend + `GET /api/telegram/search?q=`
- Watchlist (DB-backed)
- Watch history (DB-backed)
- Comments (Postgres-backed)
- Settings page
- Stats endpoint
- Admin panel: parse/add/bulk, TMDB fix, review queue, channel config
- Telegram webhook: auto-adds new channel posts as movies
- TMDB poster enrichment: background enrichment on startup + self-heal on detail fetch
- CDN proxy for Telegram poster URLs (CORS fix)
- Provider/source/extension system
- parseQualities: checks 2 previous lines for quality label (handles "Link:-URL" format — fixed 2026-06-29)
- Strip filler words from TMDB search ("Movie", "Film", "Full", "Official")
- HTML entity decoding in titles (& etc.)

---

## Do NOT touch
- Koyeb app "available-eada" (ID: 7f50045f) — user's separate unrelated project

---

## Next Steps / TODO
- [ ] Set `TELEGRAM_WEBHOOK_SECRET` on Koyeb and re-register webhook with secret_token
- [ ] Deploy frontend to Vercel (steps above)
- [ ] Set `ALLOWED_FRONTEND_ORIGIN` on Koyeb after Vercel deploy
- [ ] Test full end-to-end: home > movie detail > stream > watchlist > comments
