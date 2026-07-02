---
name: StreamVault deployment
description: Deployment architecture and procedures for Koyeb backend + Vercel frontend
---

# StreamVault — Deployment

## Architecture
- **Backend:** Koyeb (auto-deploys from GitHub `main` branch push)
- **Frontend:** Vercel (auto-deploys from GitHub `main` branch push)
- **Database:** Neon PostgreSQL (free tier)

## Required env vars on Koyeb
- `DATABASE_URL` — Neon connection string
- `TELEGRAM_BOT_TOKEN` — for webhook and bot photo proxy
- `TMDB_API_KEY` — movie metadata enrichment
- `SESSION_SECRET` — protects backfill/admin endpoints (use a long random string)
- `TELEGRAM_CHANNEL` — channel username to scrape (without @)
- `ALLOWED_FRONTEND_ORIGIN` — exact Vercel URL for CORS

## Required env vars on Vercel
- `VITE_API_BASE_URL` — the Koyeb backend URL (e.g. https://xxx.koyeb.app)

## Koyeb app to NOT touch
- App "available-eada" (ID: 7f50045f) is an unrelated project — never redeploy or modify it

**Why:** Koyeb hosts two apps. Only the StreamVault app should be touched.
**How to apply:** Always confirm app name before any Koyeb deploy action.

## GitHub
- Repo: Azizthekiller3/StreamVault
- Push to `main` triggers auto-deploy on both Koyeb and Vercel
