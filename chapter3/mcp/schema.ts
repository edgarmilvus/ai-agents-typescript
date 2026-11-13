// Chapter 3 — JSON Schema in, our Schema out.
//
// A server you do not own sends the schema it likes: `type` as an array,
// `anyOf`, `format`, `$ref`. The agent needs one shape it can validate and
// render, so this translator accepts what it can prove and refuses the rest —
// it never guesses.

import type { Schema } from "../../chapter2/files/schema.ts";

export class UnsupportedSchema extends Error {}

/** Convert a server's JSON Schema into the subset this book validates. */
export function fromJsonSchema(input: unknown, path = "#"): Schema {
  if (!input || typeof input !== "object") {
    throw new UnsupportedSchema(`${path}: schema is not an object`);
  }
  const node = input as Record<string, unknown>;
  const type = node.type;

  if (Array.isArray(type)) {
    throw new UnsupportedSchema(`${path}: union type ${JSON.stringify(type)} — the chapter's validator has no anyOf`);
  }
  if (node.anyOf || node.oneOf || node.allOf) {
    throw new UnsupportedSchema(`${path}: anyOf/oneOf/allOf are not supported`);
  }
  if (node.$ref) {
    throw new UnsupportedSchema(`${path}: $ref ${String(node.$ref)} — resolve it before translating`);
  }

  switch (type) {
    case "string": {
      const out: Schema = { type: "string" };
      if (typeof node.minLength === "number") out.minLength = node.minLength;
      if (typeof node.maxLength === "number") out.maxLength = node.maxLength;
      if (typeof node.pattern === "string") out.pattern = node.pattern;
      if (Array.isArray(node.enum)) out.enum = node.enum.map(String);
      if (typeof node.description === "string") out.description = node.description;
      return out;
    }
    case "number":
    case "integer": {
      const out: Schema = { type: "number" };
      if (type === "integer") out.integer = true;
      if (typeof node.minimum === "number") out.minimum = node.minimum;
      if (typeof node.maximum === "number") out.maximum = node.maximum;
      if (typeof node.description === "string") out.description = node.description;
      return out;
    }
    case "boolean":
      return { type: "boolean", ...(typeof node.description === "string" ? { description: node.description } : {}) };
    case "array": {
      const out: Schema = {
        type: "array",
        items: fromJsonSchema(node.items ?? {}, `${path}[]`),
      };
      if (typeof node.minItems === "number") out.minItems = node.minItems;
      if (typeof node.maxItems === "number") out.maxItems = node.maxItems;
      if (typeof node.description === "string") out.description = node.description;
      return out;
    }
    case "object": {
      const properties: Record<string, Schema> = {};
      for (const [key, value] of Object.entries((node.properties as Record<string, unknown>) ?? {})) {
        properties[key] = fromJsonSchema(value, `${path}/${key}`);
      }
      const out: Schema = { type: "object", properties };
      const required = Array.isArray(node.required) ? node.required.map(String) : [];
      if (required.length) out.required = required;
      if (node.additionalProperties === false) out.additionalProperties = false;
      if (typeof node.description === "string") out.description = node.description;
      return out;
    }
    default:
      throw new UnsupportedSchema(`${path}: type ${JSON.stringify(type)} is not supported`);
  }
}

/** What a translator can and cannot take, for the trace. */
export function summarise(schemas: { name: string; inputSchema: unknown }[]): { ok: string[]; refused: string[] } {
  const ok: string[] = [];
  const refused: string[] = [];
  for (const s of schemas) {
    try {
      fromJsonSchema(s.inputSchema);
      ok.push(s.name);
    } catch (error) {
      refused.push(`${s.name}: ${(error as Error).message}`);
    }
  }
  return { ok, refused };
}
