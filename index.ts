import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import contentRouter from "./content.js";
import webhookRouter from "./webhook.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/content", contentRouter);
router.use(webhookRouter);

export default router;
