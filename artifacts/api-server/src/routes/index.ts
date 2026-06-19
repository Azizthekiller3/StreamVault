import { Router, type IRouter } from "express";
import healthRouter from "./health";
import watchlistRouter from "./watchlist";
import historyRouter from "./history";
import searchRouter from "./search";
import statsRouter from "./stats";
import sourcesRouter from "./sources";
import extensionsRouter from "./extensions";
import settingsRouter from "./settingsRoute";
import telegramRouter from "./telegram";

const router: IRouter = Router();

router.use(healthRouter);
router.use(watchlistRouter);
router.use(historyRouter);
router.use(searchRouter);
router.use(statsRouter);
router.use(sourcesRouter);
router.use(extensionsRouter);
router.use(settingsRouter);
router.use(telegramRouter);

export default router;
