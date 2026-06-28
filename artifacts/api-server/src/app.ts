import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

// ── Security headers ───────────────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

// ── CORS ───────────────────────────────────────────────────────────────────
// Allow only the configured frontend origin plus known dev origins.
// Set ALLOWED_FRONTEND_ORIGIN on Koyeb to your exact Vercel URL.
const CONFIGURED_ORIGIN = process.env.ALLOWED_FRONTEND_ORIGIN ?? "";

const ALLOWED_ORIGINS = new Set([
  "https://streamvault.vercel.app",
  "https://flixnest.vercel.app",
  "https://streamvault-beta-silk.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:80",
  ...(CONFIGURED_ORIGIN ? [CONFIGURED_ORIGIN] : []),
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.endsWith(".replit.app") || origin.endsWith(".replit.dev")) {
        return callback(null, true);
      }
      if (origin.endsWith(".koyeb.app")) return callback(null, true);
      if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-backfill-secret", "x-admin-token"],
    credentials: false,
  }),
);

// ── Logging ────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));

// ── In-memory rate limiter ─────────────────────────────────────────────────
interface RateWindow { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateWindow>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > maxRequests) {
      res.status(429).json({ error: "Too many requests — slow down." });
      return;
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore) {
    if (now > val.resetAt) rateLimitStore.delete(key);
  }
}, 10 * 60 * 1000);

// 20 per IP per minute for comments
app.use("/api/comments", rateLimit(20, 60 * 1000));
// 10 per IP per minute for admin login (brute-force guard)
app.use("/api/admin/login", rateLimit(10, 60 * 1000));
// 5 per IP per 5 minutes for heavy admin ops
app.use("/api/admin/backfill", rateLimit(5, 5 * 60 * 1000));
app.use("/api/admin/enrich", rateLimit(5, 5 * 60 * 1000));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
