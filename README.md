# 🎬 FlixNest

> Stream & download movies from your Telegram channel — free, self-hosted, PWA-ready, zero subscriptions.

FlixNest automatically indexes movies posted to your Telegram channel and serves them in a Netflix-style mobile web app. Users stream or download in 480p / 720p / 1080p via Terabox links.

**Live stack:** Vercel (frontend) + Koyeb (backend) + Neon (PostgreSQL) — all **free forever**.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎬 Telegram Sync | Movies scraped from channel every 5 min, or indexed instantly via webhook |
| 🎭 TMDB Integration | Official poster, plot, cast, IMDB rating, backdrop images |
| 🏷️ Genre + Language Filter | Auto-detected from title, filter by audio language |
| ⭐ Movie of the Day | Daily featured movie (changes at midnight) |
| 🕐 Recently Viewed | Tracks last 20 movies you opened |
| 📚 Series / Collections | Auto-groups franchises (KGF 1&2, Avengers, etc.) |
| 💬 Public Comments | Users leave comments on movies (stored on server) |
| 🔖 Watchlist | Save movies to watch later (localStorage) |
| ⭐ Star Ratings | Rate 1–5 stars per device |
| 📢 Refer a Friend | Personalised share link via WhatsApp / Telegram |
| 📱 PWA | Installable as a mobile app (Add to Home Screen) |
| 🌙 Dark / Light Mode | Theme toggle, persisted |
| 🔗 Share | Web Share API + WhatsApp & Telegram share buttons |
| ✈️ Telegram Join Button | Quick-join channel button everywhere |

---

## 🏗️ Architecture

```
GitHub Repo (Azizthekiller3/StreamVault)
        │
        ├── Push to main
        │       │
        │       ├──▶ Vercel auto-deploys frontend
        │       └──▶ Koyeb auto-deploys backend
        │
┌───────────────┐      ┌──────────────────┐      ┌─────────────┐
│    Vercel     │      │     Koyeb        │      │    Neon     │
│  (Frontend)   │─────▶│   (Backend API)  │─────▶│ (PostgreSQL)│
│  React + Vite │      │  Express 5 + TS  │      │  Free tier  │
└───────────────┘      └──────────────────┘      └─────────────┘
                               │
                        ┌──────┴──────┐
                        │   TMDB API  │
                        │  Telegram   │
                        └─────────────┘
```

**File layout:**
```
artifacts/
├── kapoor-ka-ghulam/src/
│   ├── pages/home.tsx            ← movie grid, filters, collections
│   ├── pages/telegram-info.tsx  ← detail: stream/download/comments/cast
│   └── lib/
│       ├── api-base.ts          ← VITE_API_BASE_URL
│       ├── flixnest-store.ts    ← localStorage (watchlist, ratings, recent)
│       ├── genres.ts            ← keyword → genre detection
│       └── collections.ts       ← series auto-grouping
└── api-server/src/
    ├── routes/telegram.ts       ← all /api/* endpoints
    └── services/
        ├── telegramService.ts   ← scraper + cheerio
        ├── tmdbService.ts       ← TMDB enrichment (cached 30 min)
        └── commentService.ts    ← file-based comment store
```

---

## 🚀 Deploy in 15 Minutes (Free)

### Prerequisites
- GitHub account (repo already at `Azizthekiller3/StreamVault`)
- Telegram bot token (already created: `FlixNest_bot`)
- TMDB API key (free at [themoviedb.org](https://www.themoviedb.org/settings/api))

---

### Step 1 — Free Database (Neon)

1. Go to **[neon.tech](https://neon.tech)** → Sign up free
2. Click **New Project** → give it any name → **Create**
3. On the dashboard, click **Connection string** tab
4. Copy the string — it looks like:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Save it — you'll paste it into Koyeb next

---

### Step 2 — Backend (Koyeb)

1. Go to **[koyeb.com](https://koyeb.com)** → Sign up → **Create App**
2. Choose **GitHub** → select `Azizthekiller3/StreamVault`
3. Set these fields:

   | Field | Value |
   |---|---|
   | **Branch** | `main` |
   | **Build command** | `pnpm install && pnpm --filter @workspace/api-server run build` |
   | **Run command** | `node --enable-source-maps artifacts/api-server/dist/index.mjs` |
   | **Port** | `8080` |

4. Click **Environment Variables** → add all of these:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `postgresql://...` (from Neon Step 1) |
   | `TELEGRAM_BOT_TOKEN` | your bot token |
   | `SESSION_SECRET` | any random string e.g. `my-super-secret-123` |
   | `TMDB_API_KEY` | your TMDB API key |
   | `NODE_ENV` | `production` |

5. Click **Deploy** → wait ~3 minutes
6. Copy your Koyeb URL — looks like `https://flixnest-xxxx.koyeb.app`
7. Test it: open `https://your-koyeb-url.koyeb.app/api/healthz` → should return `{"status":"ok"}`

---

### Step 3 — Frontend (Vercel)

1. Go to **[vercel.com](https://vercel.com)** → **Add New Project**
2. Click **Import Git Repository** → select `Azizthekiller3/StreamVault`
3. Vercel auto-detects `vercel.json` — **don't change** Framework or Build settings
4. Before clicking Deploy, open **Environment Variables** → add:

   | Variable | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://your-koyeb-url.koyeb.app` |

5. Click **Deploy** → done in ~2 minutes
6. Your site is live at `https://streamvault.vercel.app` (or rename in Vercel settings)

---

### Step 4 — One-Time Setup (run once after deploy)

Run these from your terminal (or any curl client):

```bash
# Replace YOUR_KOYEB_URL and YOUR_SESSION_SECRET

# 1. Register Telegram webhook (so new movies appear instantly)
curl -X POST https://YOUR_KOYEB_URL/api/telegram/register-webhook \
  -H "x-backfill-secret: YOUR_SESSION_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"https://YOUR_KOYEB_URL/api/telegram/webhook"}'

# 2. Load all existing channel history into DB (run once)
curl -X POST "https://YOUR_KOYEB_URL/api/telegram/backfill?pages=30" \
  -H "x-backfill-secret: YOUR_SESSION_SECRET"
```

> After this, any new movie you post to `t.me/backupchannek` appears on the site in **under 1 second**.

---

### Step 5 — Verify Everything Works

Open your Vercel URL and check:
- ✅ Movies load on the home page
- ✅ Tap a movie → detail page shows poster + overview
- ✅ TMDB info appears (IMDB rating, cast, backdrop image)
- ✅ Stream/Download buttons open Terabox links
- ✅ Comments can be posted
- ✅ "Join" button links to Telegram channel

---

## 🔄 Auto-Deploy on Push

Both Vercel and Koyeb watch the `main` branch. Every `git push` to `main` triggers an automatic redeploy — **no manual steps needed**.

```
git add .
git commit -m "feat: new feature"
git push origin main
# → Vercel rebuilds frontend automatically
# → Koyeb rebuilds backend automatically
```

---

## 📡 API Reference

All endpoints are prefixed with `/api`.

### Movies
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/telegram/movies` | List all movies (paginated) |
| `GET` | `/api/telegram/movies/:id` | Single movie by ID |
| `GET` | `/api/tmdb/enrich?title=...` | TMDB metadata for a title |

### Comments
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/comments/:movieId` | Get all comments for a movie |
| `POST` | `/api/comments/:movieId` | Post a comment `{ username, text }` |

### Admin (requires `x-backfill-secret` header)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/telegram/backfill?pages=N` | Scrape and save N pages of channel history |
| `POST` | `/api/telegram/register-webhook` | Register Telegram webhook |
| `POST` | `/api/telegram/webhook` | Telegram webhook receiver (used by Telegram) |

### Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/healthz` | Returns `{"status":"ok"}` |

---

## 🔑 Environment Variables

| Variable | Where | Required | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Koyeb | ✅ | Bot token from [@BotFather](https://t.me/botfather) |
| `TMDB_API_KEY` | Koyeb | ✅ | Free key from [themoviedb.org](https://www.themoviedb.org/settings/api) |
| `SESSION_SECRET` | Koyeb | ✅ | Any random string — protects admin endpoints |
| `DATABASE_URL` | Koyeb | ⚪ Optional | Neon PostgreSQL URL — enables permanent movie storage |
| `NODE_ENV` | Koyeb | ✅ | Set to `production` |
| `VITE_API_BASE_URL` | Vercel | ✅ | Full URL of your Koyeb backend |

> **Without `DATABASE_URL`**: Movies load via live scraper, comments saved to file. Everything works.  
> **With `DATABASE_URL`**: Movies saved permanently to PostgreSQL — faster loads, no scraping lag.

---

## 📮 Telegram Bot Setup

Your bot `FlixNest_bot` is already created and is admin in `t.me/backupchannek`.

**Post format** (what you type in the channel):
```
Title: KGF Chapter 2
Audio: Hindi + English
480p: https://terabox.com/s/your-link-here
720p: https://terabox.com/s/your-link-here
1080p: https://terabox.com/s/your-link-here
```

The webhook picks it up in **< 1 second** and it appears on the site immediately.

---

## 🛠️ Local Development

```bash
# Clone the repo
git clone https://github.com/Azizthekiller3/StreamVault
cd StreamVault

# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env
# Edit .env with your values

# Run backend (port 8080)
pnpm --filter @workspace/api-server run dev

# Run frontend (separate terminal)
pnpm --filter @workspace/kapoor-ka-ghulam run dev
```

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, TanStack Query |
| Backend | Express 5, Node.js 24, TypeScript 5.9 |
| Database | PostgreSQL + Drizzle ORM (optional — Neon free tier) |
| Scraper | Cheerio (parses `t.me/s/channel` public web preview) |
| Metadata | TMDB API (poster, plot, cast, ratings) |
| Deployment | Vercel (frontend) + Koyeb (backend) |
| PWA | Web App Manifest + Service Worker |

---

## 🤖 For AI Agents

**Context**: This is FlixNest, a Telegram-based movie streaming PWA. All active code is in `/home/runner/workspace/Kapoor-Ka-Ghulam/`. The running API workflow is `artifacts/api-server: API Server` (workspace root, port 8080).

**Key rules**:
- Always edit `Kapoor-Ka-Ghulam/artifacts/...` for app changes — NOT workspace root artifacts
- Push to GitHub using Node.js GitHub API via bash (not `git push` — blocked; not `code_execution` — no `process.env` there)
- The running API is workspace root `artifacts/api-server` — copy new service files there too
- `telegram_movies.qualities` is JSONB — cast as `unknown as string` when inserting
- Do NOT run `pnpm dev` at workspace root — use `--filter` or `restart_workflow`

**Features built**: TMDB enrichment, comments (file-based), series/collections, language filter, movie-of-the-day, recently viewed, refer-a-friend, watchlist, ratings, PWA, dark/light mode, genre filter, Telegram join button, share buttons, similar movies, NEW badges

**Next ideas**: Push notifications, download history page, admin dashboard, search page, trailer integration
