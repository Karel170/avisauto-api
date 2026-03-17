import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import companiesRouter from "./companies.js";
import reviewsRouter from "./reviews.js";
import aiResponsesRouter from "./ai_responses.js";
import templatesRouter from "./templates.js";
import statsRouter from "./stats.js";
import subscriptionsRouter from "./subscriptions.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(reviewsRouter);
router.use(aiResponsesRouter);
router.use(templatesRouter);
router.use(statsRouter);
router.use(subscriptionsRouter);
router.use(adminRouter);

export default router;
