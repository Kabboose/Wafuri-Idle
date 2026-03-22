import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SPEC_PATH = new URL("../openapi/openapi.json", import.meta.url);
const OUTPUT_PATH = new URL("../client/src/generated/openapi-types.ts", import.meta.url);

function toTypeName(name) {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}

function wrapUnion(member) {
  return member.includes("|") ? `(${member})` : member;
}

function schemaToType(schema) {
  if (!schema || typeof schema !== "object") {
    return "unknown";
  }

  if ("$ref" in schema) {
    return toTypeName(schema.$ref.split("/").at(-1));
  }

  if ("const" in schema) {
    return JSON.stringify(schema.const);
  }

  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }

  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.map((member) => wrapUnion(schemaToType(member))).join(" | ");
  }

  if (schema.type === "array") {
    return `Array<${schemaToType(schema.items)}>`;
  }

  if (schema.type === "object" || schema.properties || schema.additionalProperties !== undefined) {
    if (schema.properties) {
      const required = new Set(schema.required ?? []);
      const propertyLines = Object.entries(schema.properties).map(([key, value]) => {
        const optionalMarker = required.has(key) ? "" : "?";
        return `  ${JSON.stringify(key)}${optionalMarker}: ${schemaToType(value)};`;
      });

      return `{\n${propertyLines.join("\n")}\n}`;
    }

    if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      return `Record<string, ${schemaToType(schema.additionalProperties)}>`;
    }

    if (schema.additionalProperties === false) {
      return "Record<string, never>";
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

  if (schema.type === "null") {
    return "null";
  }

  return "unknown";
}

export function renderOpenApiTypes(spec) {
  const schemas = spec.components?.schemas ?? {};
  const schemaEntries = Object.entries(schemas);

  return `/**
 * This file is auto-generated from openapi/openapi.json.
 * Do not edit it manually. Run \`npm run openapi:generate\`.
 */

${schemaEntries
  .map(([name, schema]) => `export type ${toTypeName(name)} = ${schemaToType(schema)};\n`)
  .join("\n")}\n`;
}

export async function generateOpenApiTypes() {
  const spec = JSON.parse(await readFile(SPEC_PATH, "utf8"));
  return renderOpenApiTypes(spec);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = await generateOpenApiTypes();

  if (process.argv.includes("--stdout")) {
    process.stdout.write(output);
    process.exit(0);
  }

  await mkdir(new URL("../client/src/generated/", import.meta.url), { recursive: true });
  await writeFile(OUTPUT_PATH, output, "utf8");

  console.log("Generated client/src/generated/openapi-types.ts from openapi/openapi.json");
}
