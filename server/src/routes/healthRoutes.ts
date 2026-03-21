import { Router } from "express";

import { getHealthController } from "../controllers/healthController.js";

/** Health routes expose application readiness and dependency status only. */
const healthRoutes = Router();

healthRoutes.get("/health", getHealthController);

export { healthRoutes };
