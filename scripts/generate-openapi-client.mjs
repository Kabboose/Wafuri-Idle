import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SPEC_PATH = new URL("../openapi/openapi.json", import.meta.url);
const OUTPUT_PATH = new URL("../client/src/generated/openapi-client.ts", import.meta.url);

function toTypeName(name) {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}

function toPathKey(operationId) {
  return operationId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

function resolveSchema(spec, schema) {
  if (!schema || typeof schema !== "object" || !("$ref" in schema)) {
    return schema;
  }

  const schemaName = schema.$ref.split("/").at(-1);
  return spec.components?.schemas?.[schemaName] ?? schema;
}

function schemaToType(spec, schema) {
  if (!schema || typeof schema !== "object") {
    return "unknown";
  }

  if ("$ref" in schema) {
    return toTypeName(schema.$ref.split("/").at(-1));
  }

  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.map((member) => schemaToType(spec, member)).join(" | ");
  }

  if (schema.type === "array") {
    return `Array<${schemaToType(spec, schema.items)}>`;
  }

  if (schema.type === "object" || schema.properties || schema.additionalProperties !== undefined) {
    if (schema.properties) {
      const required = new Set(schema.required ?? []);
      return `{\n${Object.entries(schema.properties)
        .map(([key, value]) => `  ${JSON.stringify(key)}${required.has(key) ? "" : "?"}: ${schemaToType(spec, value)};`)
        .join("\n")}\n}`;
    }

    if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      return `Record<string, ${schemaToType(spec, schema.additionalProperties)}>`;
    }

    return "Record<string, unknown>";
  }

  if (schema.type === "string") {
    return "string";
  }

  if (schema.type === "integer" || schema.type === "number") {
    return "number";
  }

  if (schema.type === "boolean") {
    return "boolean";
  }

  return "unknown";
}

function unwrapSuccessDataSchema(spec, schema) {
  const resolved = resolveSchema(spec, schema);

  if (resolved?.properties?.data) {
    return resolved.properties.data;
  }

  return schema;
}

function getResponseSchema(operation) {
  return operation.responses?.["200"]?.content?.["application/json"]?.schema;
}

function getRequestSchema(operation) {
  return operation.requestBody?.content?.["application/json"]?.schema;
}

function getRequestFunctionName(method, isAuthenticated) {
  if (method === "get") {
    return isAuthenticated ? "apiGet" : "publicApiGet";
  }

  return isAuthenticated ? "apiPost" : "publicApiPost";
}

export function renderOpenApiClient(spec) {
  const operations = [];

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of ["get", "post"]) {
      const operation = pathItem?.[method];

      if (!operation?.operationId) {
        continue;
      }

      const responseSchema = getResponseSchema(operation);
      const requestSchema = getRequestSchema(operation);
      const isAuthenticated = Array.isArray(operation.security) && operation.security.length > 0;
      const requestFunctionName = getRequestFunctionName(method, isAuthenticated);
      const responseType = schemaToType(spec, unwrapSuccessDataSchema(spec, responseSchema));
      const requestType = requestSchema ? schemaToType(spec, requestSchema) : null;
      const returnsEnvelope = Boolean(resolveSchema(spec, responseSchema)?.properties?.data);

      operations.push({
        operationId: operation.operationId,
        path,
        method: method.toUpperCase(),
        requestFunctionName,
        responseType,
        requestType,
        returnsEnvelope
      });
    }
  }

  const wrapperOperations = operations.filter((operation) => operation.returnsEnvelope);

  return `/**
 * This file is auto-generated from openapi/openapi.json.
 * Do not edit it manually. Run \`npm run openapi:generate\`.
 */

import { apiGet, apiPost, publicApiGet, publicApiPost } from "../api/client";
import type {
${[...new Set(
  wrapperOperations.flatMap((operation) => [
    operation.responseType,
    ...(operation.requestType ? [operation.requestType] : [])
  ])
)]
  .sort()
  .map((typeName) => `  ${typeName}`)
  .join(",\n")}
} from "./openapi-types";

export const API_PATHS = {
${operations.map((operation) => `  ${toPathKey(operation.operationId)}: ${JSON.stringify(operation.path)}`).join(",\n")}
} as const;

${wrapperOperations
  .map((operation) => {
    if (operation.requestType) {
      return `export async function ${operation.operationId}(body: ${operation.requestType}): Promise<${operation.responseType}> {
  return ${operation.requestFunctionName}<${operation.responseType}>(API_PATHS.${toPathKey(operation.operationId)}, body);
}`;
    }

    return `export async function ${operation.operationId}(): Promise<${operation.responseType}> {
  return ${operation.requestFunctionName}<${operation.responseType}>(API_PATHS.${toPathKey(operation.operationId)});
}`;
  })
  .join("\n\n")}
`;
}

export async function generateOpenApiClient() {
  const spec = JSON.parse(await readFile(SPEC_PATH, "utf8"));
  return renderOpenApiClient(spec);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = await generateOpenApiClient();

  if (process.argv.includes("--stdout")) {
    process.stdout.write(output);
    process.exit(0);
  }

  await mkdir(new URL("../client/src/generated/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_PATH, output, "utf8");

  console.log("Generated client/src/generated/openapi-client.ts from openapi/openapi.json");
}
