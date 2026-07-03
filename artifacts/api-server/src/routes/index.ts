import { Router, type IRouter } from "express";
import healthRouter from "./health";
import telegramRouter from "./telegram";
import adminRouter from "./admin";
import settingsRouter from "./settingsRoute";
import statsRouter from "./stats";
import searchRouter from "./search";
import extensionsRouter from "./extensions";
import providersRouter from "./providers";
import sourcesRouter from "./sources";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(telegramRouter);
router.use(settingsRouter);
router.use(statsRouter);
router.use(searchRouter);
router.use(extensionsRouter);
router.use(providersRouter);
router.use(sourcesRouter);

export default router;
