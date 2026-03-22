import { Router } from "express";

import { getOpenApiDocumentController } from "../controllers/openApiController.js";

/** OpenAPI routes expose the checked-in API contract only. */
const openApiRoutes = Router();

openApiRoutes.get("/openapi.json", getOpenApiDocumentController);

export { openApiRoutes };
