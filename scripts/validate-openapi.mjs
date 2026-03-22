import { readFile } from "node:fs/promises";
import { renderOpenApiClient } from "./generate-openapi-client.mjs";
import { renderOpenApiTypes } from "./generate-openapi-types.mjs";

const SPEC_PATH = new URL("../openapi/openapi.json", import.meta.url);
const SOURCE_PATH = new URL("../openapi/source.json", import.meta.url);
const GENERATED_CLIENT_PATH = new URL("../client/src/generated/openapi-client.ts", import.meta.url);
const GENERATED_TYPES_PATH = new URL("../client/src/generated/openapi-types.ts", import.meta.url);
const REQUIRED_PATHS = [
  "/openapi.json",
  "/health",
  "/auth/guest",
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/logout-all",
  "/auth/request-password-reset",
  "/auth/reset-password",
  "/auth/upgrade",
  "/state",
  "/tick",
  "/upgrade",
  "/run"
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const sourceSpec = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
const spec = JSON.parse(await readFile(SPEC_PATH, "utf8"));
const serializedSourceSpec = `${JSON.stringify(sourceSpec, null, 2)}\n`;
const serializedSpec = `${JSON.stringify(spec, null, 2)}\n`;

assert(serializedSpec === serializedSourceSpec, "openapi/openapi.json is out of date. Run npm run openapi:generate.");

assert(spec.openapi === "3.1.0", "OpenAPI spec must declare version 3.1.0");
assert(typeof spec.info?.title === "string" && spec.info.title.length > 0, "OpenAPI spec must include info.title");
assert(typeof spec.info?.version === "string" && spec.info.version.length > 0, "OpenAPI spec must include info.version");
assert(spec.paths && typeof spec.paths === "object", "OpenAPI spec must include paths");

for (const path of REQUIRED_PATHS) {
  assert(path in spec.paths, `OpenAPI spec is missing required path: ${path}`);
}

const generatedClient = await readFile(GENERATED_CLIENT_PATH, "utf8");
const generatedTypes = await readFile(GENERATED_TYPES_PATH, "utf8");
assert(
  generatedClient === renderOpenApiClient(spec),
  "client/src/generated/openapi-client.ts is out of date. Run npm run openapi:generate."
);
assert(
  generatedTypes === renderOpenApiTypes(spec),
  "client/src/generated/openapi-types.ts is out of date. Run npm run openapi:generate."
);

console.log("OpenAPI spec is structurally valid.");
