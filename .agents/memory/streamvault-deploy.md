---
name: StreamVault deployment context
description: Full project understanding, secrets, deployment progress, exact next steps, and all technical decisions for StreamVault (Telegram → Netflix-style PWA)
---

# StreamVault — Complete Agent Handoff (updated 2026-06-27)

## What the app is
StreamVault (internally "FlixNest" in code) is a Netflix-style movie streaming PWA. Movies come from a private Telegram channel (`t.me/backupchannek`), enriched with TMDB poster/cast/rating, displayed in an **EonMovies-style** dark UI. Users browse, stream, and download via Terabox links.

---

## GitHub
- Repo: `Azizthekiller3/StreamVault` (branch: `main`)
- Push method: **GitHub REST API via curl** — NOT `git push` (blocked in sandbox), NOT `@octokit/rest` (not installed)
- Latest commit: `fix: register watchlist+history routes; EonMovies redesign; dedup fix`

---

## Environment Secrets (all set in Replit)
| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | Admin endpoint auth: `x-backfill-secret` header |
| `TELEGRAM_BOT_TOKEN` | @FlixNest_bot — receives channel posts via webhook |
| `TMDB_API_KEY` | TMDB poster/metadata enrichment |
| `DATABASE_URL` | Replit PostgreSQL (watchlist, history tables) |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Push files to GitHub via REST API |

---

## Stack & File Map
```
Frontend (React+Vite+Tailwind)  → artifacts/kapoor-ka-ghulam/   → deploy: Vercel (static)
Backend  (Express 5)            → artifacts/api-server/          → deploy: Koyeb (Node)
DB       (PostgreSQL+Drizzle)   → lib/db/                        → deploy: Neon free tier
```

### Key frontend files
| File | Purpose |
|---|---|
| `artifacts/kapoor-ka-ghulam/src/pages/home.tsx` | EonMovies home: logo+hamburger, search, category pills, 2-col grid |
| `artifacts/kapoor-ka-ghulam/src/pages/telegram-info.tsx` | Detail page: backdrop, poster+info, download card, You May Also Like |
| `artifacts/kapoor-ka-ghulam/src/lib/api-base.ts` | Reads `VITE_API_BASE_URL` env var |
| `artifacts/kapoor-ka-ghulam/src/pages/settings.tsx` | Has "Add Movie" admin panel |

### Key backend files
| File | Purpose |
|---|---|
| `artifacts/api-server/src/routes/index.ts` | Registers all routers (health, admin, telegram, watchlist, history) |
| `artifacts/api-server/src/routes/telegram.ts` | `/api/telegram/*`, `/api/tmdb/*`, `/api/comments/*` |
| `artifacts/api-server/src/routes/watchlist.ts` | `/api/watchlist` GET/POST/DELETE |
| `artifacts/api-server/src/routes/history.ts` | `/api/history` GET/POST/DELETE |
| `artifacts/api-server/src/services/telegramService.ts` | Movie parser + in-memory seedMovies store |
| `artifacts/api-server/src/services/tmdbService.ts` | TMDB enrichment (30-min in-memory cache) |
| `artifacts/api-server/src/services/commentService.ts` | File-based comments store |

---

## Telegram Bot
- Bot username: **@FlixNest_bot**
- Channel: `t.me/backupchannek` — **18+ restricted, public scraping does NOT work**
- Webhook URL (Replit dev): `https://bab4fd00-d43a-45db-9e20-3adb109d242c-00-ftm2nlxs6nso.sisko.replit.dev/api/telegram/webhook`
- Webhook status: ✅ **Active, no errors, listening for `channel_post`**

### ⚠️ CRITICAL: Bot is NOT yet added as channel admin
User must still do: Telegram → `backupchannek` channel → Administrators → Add Admin → search **@FlixNest_bot**. Until this is done, no new movies auto-appear from the channel.

### Movie post format the parser expects
```
Movie :- Title (Year)
720p:- https://1024terabox.com/s/...
1080p:- https://1024terabox.com/s/...
```
Parser is in `telegramService.ts → parseRawPost()`.

---

## All API Endpoints (all verified ✅ 2026-06-27)
| Endpoint | Auth | Status |
|---|---|---|
| `GET /api/healthz` | None | ✅ |
| `GET /api/telegram/movies` | None | ✅ 13 movies |
| `GET /api/telegram/movies/:id` | None | ✅ |
| `GET /api/tmdb/enrich?title=` | None | ✅ |
| `GET /api/comments/:movieId` | None | ✅ |
| `POST /api/comments/:movieId` | None | ✅ |
| `GET /api/watchlist` | None | ✅ (was broken — fixed) |
| `POST /api/watchlist` | None | ✅ |
| `DELETE /api/watchlist/:id` | None | ✅ |
| `GET /api/history` | None | ✅ (was broken — fixed) |
| `POST /api/history` | None | ✅ |
| `POST /api/telegram/parse-and-add` | `x-backfill-secret` | ✅ |
| `DELETE /api/telegram/seed/:id` | `x-backfill-secret` | ✅ |
| `POST /api/telegram/webhook` | Telegram only | ✅ |
| `POST /api/telegram/register-webhook` | `x-backfill-secret` | ✅ |

---

## Admin CLI Recipes

### Add a movie manually
```bash
SECRET=$(node -e "console.log(process.env.SESSION_SECRET)")
curl -X POST "http://localhost:80/api/telegram/parse-and-add" \
  -H "Content-Type: application/json" \
  -H "x-backfill-secret: $SECRET" \
  -d '{"text":"Movie :- Title (2024)\n1080p:- https://terabox-link\n720p:- https://terabox-link"}'
```

### Delete a movie by ID
```bash
curl -X DELETE "http://localhost:80/api/telegram/seed/MOVIE_ID" \
  -H "x-backfill-secret: $SECRET"
```

### Re-register webhook (after deploying to Koyeb)
```bash
curl -X POST "http://localhost:80/api/telegram/register-webhook" \
  -H "Content-Type: application/json" \
  -H "x-backfill-secret: $SECRET" \
  -d '{"webhookUrl":"https://YOUR-KOYEB-DOMAIN/api/telegram/webhook"}'
```

### Push a file to GitHub
```bash
GITHUB_TOKEN=$(node -e "console.log(process.env.GITHUB_PERSONAL_ACCESS_TOKEN)")
REPO="Azizthekiller3/StreamVault"
FILE="path/to/file.ts"
CONTENT=$(base64 -w 0 "$FILE")
SHA=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO/contents/$FILE?ref=main" \
  | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).sha||'')")
curl -X PUT -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" \
  "https://api.github.com/repos/$REPO/contents/$FILE" \
  -d "$(node -e "process.stdout.write(JSON.stringify({message:'fix: description',content:process.argv[1],sha:process.argv[2],branch:'main'}))" "$CONTENT" "$SHA")"
```

---

## UI Design — EonMovies layout (completed 2026-06-27)

### Home page (`home.tsx`)
- Header: StreamVault logo (red circle + Clapperboard icon) + hamburger → Settings
- Search bar (dark `#1e1e1e` input + red `#dc2626` button)
- Category pills: All / Bollywood / Hollywood / South Indian / Web Series / Netflix / Join Telegram
  - Bollywood = Hindi audio; Hollywood = English only; South Indian = Tamil/Telugu/Malayalam/Kannada; Web Series = isSeries(); Netflix = "netflix" in title
- "🔥 Latest Releases" with `4px` red left border accent
- 2-column poster grid; MOVIE badge (red `#dc2626`) / SERIES badge (purple `#7c3aed`) in top-right corner
- `isSeries()` function **exported from home.tsx** — detects Season/S01/E01/Episode in title — imported by telegram-info.tsx

### Detail page (`telegram-info.tsx`)
- Same logo header + back arrow + hamburger
- Full-width backdrop (TMDB backdrop → TMDB poster → movie poster fallback)
- Poster thumbnail (left, 100px wide) + right col: title, year badge, Movie/Series badge, quality badge (red), audio badge (amber), English subtitle badge
- Genre chips (outlined border pills)
- TMDB overview text
- **Download card** (`#1a1a1a` rounded): red download icon + title + "X Links" badge → divider → quality rows each with `⬇ Download` red button linking to Terabox URL directly
- Cast horizontal scroll
- Comments (collapsible, file-backed)
- Telegram join banner
- "YOU MAY ALSO LIKE" 2-col grid (genre-similarity + title-word scoring)

---

## Bugs Fixed (all sessions combined)
1. ✅ `watchlistRouter` + `historyRouter` not registered in `routes/index.ts` → **fixed**
2. ✅ Duplicate Peddi (2026) movie → **deleted**
3. ✅ Null TMDB crash (`enriched?.poster`) → fixed (prior session)
4. ✅ `new URL()` crash in sources.ts → fixed (prior session)
5. ✅ Hero play button crash for Telegram-only movies → fixed (prior session)
6. ✅ Duplicate movies in `mergeSeed()` → fixed (prior session)

---

## Demo movies in DB (13 total, in-memory)
Peddi (2026), Pushpa 2 (2024), Jawan (2023), Animal (2023), Stree 2 (2024), Fighter (2024), Oppenheimer (2023), Deadpool & Wolverine (2024), Dune Part Two (2024), Kalki 2898 AD (2024), Leo (2023), The Family Man S2 (2021), Mirzapur S3 (2024)

⚠️ **In-memory only** — movies survive restarts only because they are re-seeded from the in-memory `seedMovies` array each time. Webhook-received movies are lost on restart. To fix: migrate movie storage to PostgreSQL.

---

## What to do NEXT (in priority order)

### 1. 🔴 User action — Add @FlixNest_bot as channel admin
Nothing from the channel auto-appears until this is done.

### 2. 🟡 Deploy to Vercel + Koyeb
**Frontend → Vercel:**
- Build: `pnpm --filter @workspace/kapoor-ka-ghulam run build`
- Deploy: `artifacts/kapoor-ka-ghulam/dist/` as static Vercel site
- Env var on Vercel: `VITE_API_BASE_URL=https://YOUR-KOYEB-DOMAIN`

**Backend → Koyeb:**
- Connect GitHub: `Azizthekiller3/StreamVault`
- Root dir: `artifacts/api-server`
- Build: `pnpm install && pnpm run build`
- Start: `node dist/index.cjs`
- Port: `8080`
- Env vars: `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TMDB_API_KEY`, `DATABASE_URL` (Neon prod URL)
- After deploy: re-register Telegram webhook pointing at Koyeb domain

**After deploying:**
- Update `VITE_API_BASE_URL` on Vercel with the Koyeb URL
- Re-register webhook: `POST /api/telegram/register-webhook` with new Koyeb domain

### 3. 🟡 Persist movies to PostgreSQL
Add a `telegram_movies` table, migrate `seedMovies` array to DB so webhook-received movies survive Koyeb restarts.

### 4. 🟢 In-app admin movie manager
Page to view, delete, reorder movies without curl.
