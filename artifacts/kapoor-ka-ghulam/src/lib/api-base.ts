const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
export const API_BASE = raw.replace(/\/$/, "");
