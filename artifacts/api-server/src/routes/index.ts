import { Router, type IRouter } from "express";
import healthRouter from "./health";
import watchlistRouter from "./watchlist";
import historyRouter from "./history";
import providersRouter from "./providers";
import searchRouter from "./search";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(watchlistRouter);
router.use(historyRouter);
router.use(providersRouter);
router.use(searchRouter);
router.use(statsRouter);

export default router;
