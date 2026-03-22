import { readFile, writeFile } from "node:fs/promises";
import { mkdir, writeFile as writeGeneratedTypes } from "node:fs/promises";
import { generateOpenApiClient } from "./generate-openapi-client.mjs";
import { generateOpenApiTypes } from "./generate-openapi-types.mjs";

const SOURCE_PATH = new URL("../openapi/source.json", import.meta.url);
const OUTPUT_PATH = new URL("../openapi/openapi.json", import.meta.url);
const GENERATED_CLIENT_PATH = new URL("../client/src/generated/openapi-client.ts", import.meta.url);
const GENERATED_TYPES_PATH = new URL("../client/src/generated/openapi-types.ts", import.meta.url);

const sourceSpec = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
const serializedSpec = `${JSON.stringify(sourceSpec, null, 2)}\n`;

await writeFile(OUTPUT_PATH, serializedSpec, "utf8");

console.log("Generated openapi/openapi.json from openapi/source.json");
await mkdir(new URL("../client/src/generated/", import.meta.url), { recursive: true });
await writeGeneratedTypes(GENERATED_TYPES_PATH, await generateOpenApiTypes(), "utf8");
console.log("Generated client/src/generated/openapi-types.ts from openapi/openapi.json");
await writeGeneratedTypes(GENERATED_CLIENT_PATH, await generateOpenApiClient(), "utf8");
console.log("Generated client/src/generated/openapi-client.ts from openapi/openapi.json");
