// VITE_API_BASE_URL is set in the Vercel project environment to the Koyeb backend URL.
// Fallback ensures the app still works even when the env var is missing (e.g. old PWA cache).
const KOYEB_FALLBACK = "https://streamvault-moviebot123-091f92aa.koyeb.app";
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
export const API_BASE = raw.replace(/\/$/, "") || KOYEB_FALLBACK;
