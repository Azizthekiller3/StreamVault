# 🎬 FlixNest

> Stream & download movies from your private Telegram channel — free, self-hosted, PWA-ready.

FlixNest is a full-stack streaming platform that automatically indexes movies posted to your Telegram channel and presents them in a Netflix-style mobile web app. Users can stream or download in 480p / 720p / 1080p via Terabox links — no subscriptions, no ads.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎬 **Telegram Channel Sync** | Movies scraped from `t.me/dbxixjdb` every 5 min, or indexed instantly via webhook |
| 🗄️ **PostgreSQL Storage** | All movies stored permanently in DB — backfill all historical posts |
| 🔍 **Real-time Search** | Filter movies by title instantly |
| 🏷️ **Genre Tags** | Auto-detected from title (Action, Comedy, Horror, Sci-Fi…) with filter chips |
| 🔖 **Watchlist** | Save movies — stored in browser localStorage |
| ⭐ **Star Ratings** | Rate movies 1–5 stars per device |
| 🔔 **NEW Badge** | Green badge on the most recent movies |
| 📱 **PWA** | Installable as a mobile app (Add to Home Screen) |
| 🌙 **Dark / Light Mode** | Theme toggle, persisted in localStorage |
| 🔗 **Share** | Web Share API + direct WhatsApp & Telegram share buttons |
| 🌐 **Load More** | Paginated grid — 20 movies at a time |
| 🚀 **Vercel + Koyeb** | Free 24/7 deployment — frontend on Vercel, backend on Koyeb |

---

## 🏗️ Architecture

```
StreamVault/
├── artifacts/
│   ├── kapoor-ka-ghulam/     # React + Vite frontend (FlixNest UI)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── home.tsx          ← main page (search, genres, movies grid)
│   │   │   │   └── telegram-info.tsx ← movie detail (stream/download/rate/share)
│   │   │   └── lib/
│   │   │       ├── api-base.ts       ← VITE_API_BASE_URL env var
│   │   │       ├── flixnest-store.ts ← localStorage watchlist + ratings
│   │   │       └── genres.ts         ← keyword → genre detection
│   │   └── public/
│   │       ├── manifest.json         ← PWA manifest
│   │       └── sw.js                 ← service worker (offline shell)
│   └── api-server/            # Express 5 backend
│       └── src/
│           ├── routes/
│           │   └── telegram.ts       ← /api/telegram/* endpoints
│           └── services/
│               └── telegramService.ts ← scraper + DB + webhook parser
├── lib/
│   └── db/
│       └── src/schema/
│           └── movies.ts             ← telegram_movies DB table
└── vercel.json                        ← Vercel build config
```

---

## 🚀 Deployment (Free 24/7)

### Backend → Koyeb

1. Create app from GitHub repo `Azizthekiller3/StreamVault`
2. **Build command:** `pnpm install && pnpm --filter @workspace/api-server run build`
3. **Run command:** `node --enable-source-maps artifacts/api-server/dist/index.mjs`
4. **Port:** `8080`
5. **Environment variables:**
   - `DATABASE_URL` — PostgreSQL connection string (free from [neon.tech](https://neon.tech))
   - `TELEGRAM_BOT_TOKEN` — FlixNest bot token
   - `SESSION_SECRET` — any random string (used to secure admin endpoints)

### Frontend → Vercel

1. Import `Azizthekiller3/StreamVault` — Vercel reads `vercel.json` automatically
2. **Environment variable:**
   - `VITE_API_BASE_URL` = `https://YOUR-KOYEB-APP.koyeb.app`
3. Deploy — live at `https://flixnest.vercel.app` (or your custom domain)

### One-time post-deploy setup

```bash
# 1. Run DB migration
pnpm --filter @workspace/db run push

# 2. Register Telegram webhook (replace URLs)
curl -X POST https://YOUR-KOYEB-URL.koyeb.app/api/telegram/register-webhook \
  -H "x-backfill-secret: YOUR_SESSION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://YOUR-KOYEB-URL.koyeb.app/api/telegram/webhook"}'

# 3. Backfill all historical movies from channel
curl -X POST "https://YOUR-KOYEB-URL.koyeb.app/api/telegram/backfill?pages=30" \
  -H "x-backfill-secret: YOUR_SESSION_SECRET"
```

---

## 🤖 Telegram Bot & Channel

| Item | Value |
|---|---|
| Channel | `t.me/dbxixjdb` (Channel ID: `4498616642`) |
| Bot | `FlixNest_bot` (admin in channel) |
| Bot token | Stored as `TELEGRAM_BOT_TOKEN` secret |

**How it works:**
- You post a movie to the Telegram channel with a **Terabox link** and a **quality label** (480p/720p/1080p)
- The bot webhook fires instantly → parses the post → saves to PostgreSQL
- FlixNest website shows the new movie within seconds

**Post format for best results:**
```
Title: Spider-Man No Way Home
Audio: Hindi + English
480p: https://teraboxlink.com/...
720p: https://teraboxlink.com/...
1080p: https://teraboxlink.com/...
```

---

## 🛠️ Local Development

```bash
# Install all dependencies
pnpm install

# Run API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Run frontend (port auto-assigned)
pnpm --filter @workspace/kapoor-ka-ghulam run dev

# Push DB schema changes
pnpm --filter @workspace/db run push

# Typecheck everything
pnpm run typecheck
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/telegram/movies` | List all movies (DB → scraper fallback) |
| GET | `/api/telegram/movies/:id` | Single movie by messageId |
| POST | `/api/telegram/webhook` | Telegram bot webhook (auto-called by Telegram) |
| GET | `/api/telegram/image/:fileId` | Proxy bot photo → Telegram CDN |
| POST | `/api/telegram/backfill?pages=N` | Scrape N pages of channel history into DB |
| POST | `/api/telegram/register-webhook` | Register bot webhook URL with Telegram |
| GET | `/api/healthz` | Health check |

All admin endpoints (`backfill`, `register-webhook`) require header `x-backfill-secret: SESSION_SECRET`.

---

## 🗺️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | Express 5 + Node.js 24 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 + drizzle-zod |
| Animation | Framer Motion |
| State | TanStack Query v5 |
| Routing | Wouter |
| Workspace | pnpm monorepo |

---

## 🔮 Planned Features

- [ ] TMDB integration (plot, cast, IMDB rating, official posters)
- [ ] Push notifications for new movies
- [ ] View count / trending section
- [ ] Comments section (per movie)
- [ ] Language filter (Hindi / English / Tamil…)
- [ ] Series / collection grouping (auto-detect multi-part movies)
- [ ] Google AdSense monetization
- [ ] Admin panel

---

## 📝 For AI Agents

> **Quick context for any AI agent picking up this project:**

This is **FlixNest** — a streaming webapp that reads movies from a private Telegram channel and serves them on a web UI with stream + download buttons.

**Key facts:**
- Telegram channel: `t.me/dbxixjdb` (public, scraped via cheerio from `t.me/s/dbxixjdb`)
- Bot: `FlixNest_bot` — admin in the channel, token in `TELEGRAM_BOT_TOKEN` secret
- DB table: `telegram_movies` (messageId, title, poster, posterFileId, audio, qualities JSON)
- Frontend calls backend via `VITE_API_BASE_URL` env var (empty = relative URL in dev)
- All frontend code is in `artifacts/kapoor-ka-ghulam/src/`
- All backend code is in `artifacts/api-server/src/`
- DB schema is in `lib/db/src/schema/`
- Push changes to GitHub via the GitHub API (bash with `$GITHUB_PERSONAL_ACCESS_TOKEN`)
- Repo: `Azizthekiller3/StreamVault`, branch: `main`
- Never use `pnpm dev` at workspace root — use workflows or `pnpm --filter` commands

**Next planned work:** TMDB API integration for movie enrichment (key is in `TMDB_API_KEY` secret).
