import { Router } from "express";
import { fetchChannelMovies, fetchMovieById } from "../services/telegramService.js";

const router = Router();

router.get("/telegram/movies", async (req, res) => {
  try {
    const before = req.query["before"] ? parseInt(req.query["before"] as string, 10) : undefined;
    const result = await fetchChannelMovies(before);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch telegram movies");
    res.status(500).json({ error: "Failed to fetch movies from channel" });
  }
});

router.get("/telegram/movies/:id", async (req, res) => {
  try {
    const movie = await fetchMovieById(req.params["id"]!);
    if (!movie) return res.status(404).json({ error: "Movie not found" });
    res.json(movie);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch telegram movie by id");
    res.status(500).json({ error: "Failed to fetch movie" });
  }
});

export default router;
