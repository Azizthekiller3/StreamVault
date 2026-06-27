---
name: StreamVault deployment context
description: Complete project understanding, all bugs fixed, deployment steps for FlixNest (Telegram → Netflix-style PWA)
---

# StreamVault / FlixNest — Complete Agent Handoff (2026-06-27)

## What the app is
StreamVault (branding: FlixNest) is a Netflix-style PWA. Movies come from Telegram channel `backupchannek`, enriched with TMDB metadata. Users stream/download via Terabox links. No login required — fully public-facing.

---

## Repo & GitHub
- Repo: `Azizthekiller3/StreamVault` (branch: main)
- Push method: **node `https` module in bash** — NOT `git push` (blocked in Replit), NOT `code_execution` (no `process.env` there)
- Pattern: fetch SHA → base64 encode → PUT to GitHub API. Always use atomic fetch-then-push (get SHA, push immediately) to avoid SHA drift from concurrent commits.

---

## Stack
| Layer | Tech | Deploy |
|---|---|---|
| Frontend | React + Vite + Tailwind | Vercel (static) |
| Backend | Express 5 + TypeScript | Koyeb (Node) |
| DB | PostgreSQL + Drizzle ORM | Neon free tier |
| Bot | Telegram Bot API + Cheerio scraper | — |

---

## Where things live
- Frontend: `artifacts/kapoor-ka-ghulam/`
- Backend: `artifacts/api-server/`
- DB schema: `lib/db/src/schema/`
- API contract: `lib/api-spec/openapi.yaml`
- Generated React Query hooks: `lib/api-client-react/src/generated/api.ts`

---

## Replit Secrets (all set)
| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | Admin auth + telegram webhook secret |
| `TELEGRAM_BOT_TOKEN` | Bot for webhook |
| `TMDB_API_KEY` | Movie enrichment |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub API pushes |

> DATABASE_URL: Replit blocks this as a secret (it manages it internally). Neon URL was shared in chat. Set it as env var on Koyeb manually.

---

## Neon Production DB
- All tables created ✅ (2026-06-27)
- Tables: `telegram_movies`, `watchlist`, `watch_history`, `providers`, `provider_sources`, `installed_extensions`, `settings`, `comments`
- `telegram_movies.message_id` is **TEXT** (not integer) — supports both numeric IDs and `manual_xxx` prefixed IDs
- Neon URL: `postgresql://neondb_owner:...@ep-billowing-sound-aiiic9ha.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require`

---

## ALL BUGS FOUND & FIXED (2026-06-27 deep dry-run)

### Bug 1 — CRITICAL: Missing route registrations (FIXED ✅)
**File:** `artifacts/api-server/src/routes/index.ts`
**Problem:** `settings`, `stats`, `search`, `extensions`, `providers`, `sources` routes were imported but NEVER registered on the router. All those endpoints returned 404.
**Fix:** Added `router.use(settingsRouter)`, `router.use(statsRouter)`, `router.use(searchRouter)`, `router.use(extensionsRouter)`, `router.use(providersRouter)`, `router.use(sourcesRouter)` to the router.

### Bug 2 — CRITICAL: File-based comment storage (FIXED ✅)
**File:** `artifacts/api-server/src/services/commentService.ts`
**Problem:** Comments stored in `../../data/comments.json` — Koyeb has ephemeral filesystem, all comments lost on every restart/deploy.
**Fix:** Rewrote to use PostgreSQL via `commentsTable` from `@workspace/db`. `getComments()` and `addComment()` are now async.

### Bug 3 — CRITICAL: Comment routes not awaiting async functions (FIXED ✅)
**File:** `artifacts/api-server/src/routes/telegram.ts`
**Problem:** `/comments/:movieId` GET and POST handlers were sync (`(req, res) => {}`) but called `getComments()` and `addComment()` which became async. Would silently fail or return empty.
**Fix:** Made both handlers `async (req, res) => {}` and added `await` before the calls.

### Bug 4 — PREVIOUS SESSION: messageId type mismatch (FIXED ✅)
**File:** `lib/db/src/schema/movies.ts`
**Problem:** `messageId` was `integer` but manual movies use `manual_xxx` string IDs.
**Fix:** Changed to `text`.

### Bug 5 — PREVIOUS SESSION: File-based movie storage (FIXED ✅)
**File:** `artifacts/api-server/src/services/telegramService.ts`
**Problem:** Movies stored in JSON file — lost on restart.
**Fix:** DB-backed with lazy load (ensureDbLoaded on first request), upsert on add, delete on remove.

---

## New Files Created
| File | Purpose |
|---|---|
| `lib/db/src/schema/comments.ts` | PostgreSQL table for movie comments |

---

## Koyeb Backend Setup — NOT YET DEPLOYED

**Build command:**
```
pnpm install && pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/db run push-force
```

**Run command:**
```
node --enable-source-maps artifacts/api-server/dist/index.mjs
```

**Port:** `8080`

**Environment variables to set on Koyeb:**
| Key | Value |
|---|---|
| `PORT` | `8080` |
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | any strong random string |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TMDB_API_KEY` | from themoviedb.org |
| `DATABASE_URL` | Neon connection string |

> Optional: `ADMIN_USERNAME` + `ADMIN_PASSWORD` for the admin panel at `/admin`

---

## Vercel Frontend Setup — NOT YET DEPLOYED

`vercel.json` is already correct at repo root.

**Build settings in Vercel:**
- Framework: Vite
- Build command: `pnpm install && pnpm --filter @workspace/kapoor-ka-ghulam run build`
- Output directory: `artifacts/kapoor-ka-ghulam/dist/public`

**Environment variable to set:**
- `VITE_API_BASE_URL` = `https://YOUR-KOYEB-URL` (set after Koyeb deploys)

---

## Post-deploy steps (after both Koyeb + Vercel are live)

### 1. Register Telegram webhook
```bash
curl -X POST https://YOUR-KOYEB-URL/api/telegram/register-webhook \
  -H "x-backfill-secret: YOUR_SESSION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"https://YOUR-KOYEB-URL/api/telegram/webhook"}'
```

### 2. Add bot as channel admin
Go to Telegram → `@backupchannek` channel → Add Admin → search `@FlixNest_bot`
Grant: Post messages, Edit messages, Delete messages

### 3. Test health
```bash
curl https://YOUR-KOYEB-URL/api/healthz
# expect: {"ok":true}
```

### 4. Backfill movies from channel
```bash
curl -X POST "https://YOUR-KOYEB-URL/api/telegram/backfill?pages=10" \
  -H "x-backfill-secret: YOUR_SESSION_SECRET"
```

---

## All API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/healthz` | — | Health check |
| GET | `/api/telegram/movies` | — | List movies (paginated, ?before=N) |
| GET | `/api/telegram/movies/:id` | — | Single movie |
| GET | `/api/tmdb/enrich?title=X` | — | TMDB metadata for a title |
| GET | `/api/comments/:movieId` | — | Get comments |
| POST | `/api/comments/:movieId` | — | Add comment `{username,text}` |
| GET | `/api/watchlist` | session | Get watchlist |
| POST | `/api/watchlist` | session | Add to watchlist |
| DELETE | `/api/watchlist/:id` | session | Remove from watchlist |
| GET | `/api/history` | session | Watch history |
| POST | `/api/history` | session | Upsert history entry |
| DELETE | `/api/history` | session | Clear all history |
| DELETE | `/api/history/:id` | session | Delete one history item |
| GET | `/api/settings` | session | Get app settings |
| PUT | `/api/settings` | session | Update settings |
| GET | `/api/stats` | session | Counts for stats panel |
| GET | `/api/search?q=X` | — | OMDB search |
| GET | `/api/info?imdbId=X` | — | OMDB movie info |
| GET | `/api/sources` | — | List extension sources |
| POST | `/api/sources` | — | Add extension source |
| GET | `/api/extensions` | — | List installed extensions |
| POST | `/api/extensions` | — | Install extension |
| DELETE | `/api/extensions/:id` | — | Uninstall extension |
| POST | `/api/telegram/parse-and-add` | x-backfill-secret | Manually add movie from raw text |
| POST | `/api/telegram/register-webhook` | x-backfill-secret | Register Telegram webhook |
| POST | `/api/telegram/webhook` | — | Telegram update receiver |
| POST | `/api/admin/login` | — | Admin login `{username,password}` → token |
| GET | `/api/admin/config` | x-admin-token | Get channel config |
| PUT | `/api/admin/config` | x-admin-token | Set Telegram channel |

---

## Key Architecture Decisions
1. **Telegram channel scraping**: Uses `t.me/s/{channel}` public web view + Cheerio — no Telegram API key needed for reading. Falls back to DB-seeded movies when channel is private/unreachable.
2. **Session-based auth**: Express sessions for watchlist/history — user data is tied to browser session, not user accounts. No login needed.
3. **Admin auth**: HMAC-derived token from `SESSION_SECRET` — `/api/admin/login` with `ADMIN_USERNAME`+`ADMIN_PASSWORD` returns a token used as `x-admin-token` header.
4. **Movie ID format**: Numeric string for real Telegram messages, `manual_NNN` for manually added movies. Both stored as TEXT in DB.
5. **JSONB qualities**: `telegram_movies.qualities` column is JSONB — cast as `unknown as string` in TypeScript for drizzle-orm insert.

---

## Telegram Post Format (how the bot parses movies)
```
Movie :- Interstellar (2014)
720p:- https://terabox.com/...
1080p:- https://terabox.com/...
Audio :- Hindi + English
```
Parser looks for: `720p`, `1080p`, `4K`/`2160p` keywords + Terabox URLs in same line.

---

## Frontend Pages (React Router via Wouter)
| Path | Component | Description |
|---|---|---|
| `/` | Home | Movie grid, hero banner |
| `/info` | Info | Movie detail page (TMDB + download links + comments) |
| `/search` | Search | OMDB search |
| `/browse` | Browse | Browse all Telegram movies |
| `/watchlist` | Watchlist | Saved movies |
| `/history` | History | Watch history |
| `/watch` | Watch | Video player (for extension streams) |
| `/settings` | Settings | Stats, active extension, clear history, manual movie add |
| `/marketplace` | Marketplace | Install extensions/sources |
| `/downloads` | DownloadHistory | Download history (localStorage) |
| `/telegram-info` | TelegramInfo | Full Telegram movie info page |
| `/admin` | Admin | Admin panel (channel config, movie management) |
