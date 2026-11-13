// Exercise 3 — translate a schema you have never seen.
//
// Servers emit JSON Schema in whatever dialect their SDK produces. Two cases
// matter: a union with exactly one real branch (common in generated schemas)
// and a union with several (refuse, do not guess).

import { fromJsonSchema, UnsupportedSchema } from "../../mcp/schema.ts";
import { validate } from "../../../chapter2/files/schema.ts";
import type { Schema } from "../../../chapter2/files/schema.ts";

/** Collapse a single-branch union anywhere in the tree, then translate. */
function collapse(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(collapse);
  if (!node || typeof node !== "object") return node;
  const obj = node as Record<string, unknown>;
  const union = (obj.anyOf ?? obj.oneOf) as unknown[] | undefined;
  if (Array.isArray(union)) {
    if (union.length !== 1) {
      throw new UnsupportedSchema(`union of ${union.length} branches cannot be collapsed`);
    }
    const { anyOf, oneOf, ...rest } = obj;
    return collapse({ ...rest, ...(union[0] as object) });
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) out[key] = collapse(value);
  return out;
}

export function translate(input: unknown): Schema {
  return fromJsonSchema(collapse(input));
}

export const SEEN = [
  { name: "generated", schema: { type: "object", properties: { note: { anyOf: [{ type: "string", maxLength: 5 }] } } } },
  { name: "true-union", schema: { type: "object", properties: { x: { anyOf: [{ type: "string" }, { type: "number" }] } } } },
];

export function demo() {
  const results: { name: string; ok: boolean; detail: string }[] = [];
  for (const s of SEEN) {
    try {
      const schema = translate(s.schema);
      const issues = validate(schema, { note: "hello" });
      results.push({ name: s.name, ok: issues.length === 0, detail: `${issues.length} issues` });
    } catch (error) {
      results.push({ name: s.name, ok: false, detail: (error as Error).message });
    }
  }
  return results;
}

if (import.meta.main) {
  for (const r of demo()) console.log(`${r.name.padEnd(12)} ${r.ok ? "translated" : "refused"}  ${r.detail}`);
}
