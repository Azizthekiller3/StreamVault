import { Router } from "express";
import { SearchContentQueryParams, GetContentInfoQueryParams } from "@workspace/api-zod";

const OMDB_API_KEY = process.env.OMDB_API_KEY ?? "";
const OMDB_BASE_URL = "https://www.omdbapi.com";

const router = Router();

router.get("/search", async (req, res) => {
  if (!OMDB_API_KEY) { res.json({ results: [], totalResults: 0 }); return; }
  try {
    const parsed = SearchContentQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }
    const { q, type } = parsed.data;

    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set("apikey", OMDB_API_KEY);
    url.searchParams.set("s", q);
    if (type) url.searchParams.set("type", type);

    const response = await fetch(url.toString());
    const data = await response.json() as any;

    if (data.Response === "False") {
      res.json({ results: [], totalResults: 0 });
      return;
    }

    const results = (data.Search ?? []).map((item: any) => ({
      imdbId: item.imdbID,
      title: item.Title,
      year: item.Year,
      type: item.Type,
      poster: item.Poster !== "N/A" ? item.Poster : "",
    }));

    res.json({
      results,
      totalResults: parseInt(data.totalResults ?? "0", 10),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to search content");
    res.status(500).json({ error: "Failed to search content" });
  }
});

router.get("/info", async (req, res) => {
  if (!OMDB_API_KEY) { res.status(503).json({ error: "OMDB_API_KEY not configured" }); return; }
  try {
    const parsed = GetContentInfoQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid query params" });
      return;
    }
    const { imdbId } = parsed.data;

    const url = new URL(OMDB_BASE_URL);
    url.searchParams.set("apikey", OMDB_API_KEY);
    url.searchParams.set("i", imdbId);
    url.searchParams.set("plot", "full");

    const response = await fetch(url.toString());
    const data = await response.json() as any;

    if (data.Response === "False") {
      res.status(404).json({ error: "Content not found" });
      return;
    }

    res.json({
      imdbId: data.imdbID,
      title: data.Title,
      year: data.Year,
      type: data.Type,
      poster: data.Poster !== "N/A" ? data.Poster : "",
      plot: data.Plot,
      rating: data.imdbRating,
      genre: data.Genre,
      director: data.Director !== "N/A" ? data.Director : null,
      actors: data.Actors,
      runtime: data.Runtime,
      totalSeasons: data.totalSeasons ?? null,
      language: data.Language,
      country: data.Country,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get content info");
    res.status(500).json({ error: "Failed to get content info" });
  }
});

export default router;
