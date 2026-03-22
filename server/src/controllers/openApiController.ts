import { fileURLToPath } from "node:url";
import type { RequestHandler } from "express";

const openApiFilePath = fileURLToPath(new URL("../../../openapi/openapi.json", import.meta.url));

/** Serves the checked-in OpenAPI document for local tooling and future client generation. */
export const getOpenApiDocumentController: RequestHandler = (_request, response) => {
  response.sendFile(openApiFilePath);
};
