import { Router, type IRouter } from "express";
import healthRouter from "./health";
import telegramRouter from "./telegram";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(telegramRouter);

export default router;
