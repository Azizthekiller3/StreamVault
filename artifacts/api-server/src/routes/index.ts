import { Router, type IRouter } from "express";
import healthRouter from "./health";
import telegramRouter from "./telegram";
import adminRouter from "./admin";
import watchlistRouter from "./watchlist";
import historyRouter from "./history";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(telegramRouter);
router.use(watchlistRouter);
router.use(historyRouter);

export default router;
