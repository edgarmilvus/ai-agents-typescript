// Chapter 2 — a schema validator small enough to read, strict enough to trust.
//
// The point is not to reimplement JSON Schema. The point is that a validator
// is the only thing standing between a model's guess and your business rules,
// so it has to be small enough that you can argue about every line, and it has
// to report errors in a form a model can act on.

export type Schema =
  | { type: "string"; minLength?: number; maxLength?: number; pattern?: string; enum?: string[]; description?: string }
  | { type: "number"; minimum?: number; maximum?: number; integer?: boolean; description?: string }
  | { type: "boolean"; description?: string }
  | { type: "array"; items: Schema; minItems?: number; maxItems?: number; description?: string }
  | {
      type: "object";
      properties: Record<string, Schema>;
      required?: string[];
      additionalProperties?: boolean;
      description?: string;
    };

export interface Issue {
  /** JSON-Pointer-ish path, so a nested failure is locatable. */
  path: string;
  message: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

/**
 * Validate `value` against `schema` and return every issue found.
 *
 * Two rules make this usable in a loop:
 *  - it never throws, and it never stops at the first error;
 *  - every message names the path *and* what was expected, because a model
 *    repairs a call from the message, not from the fact that it failed.
 */
export function validate(schema: Schema, value: unknown, path = "#"): Issue[] {
  switch (schema.type) {
    case "string":
      return validateString(schema, value, path);
    case "number":
      return validateNumber(schema, value, path);
    case "boolean":
      return typeof value === "boolean" ? [] : [{ path, message: `expected boolean, got ${kind(value)}` }];
    case "array":
      return validateArray(schema, value, path);
    case "object":
      return validateObject(schema, value, path);
  }
}

function validateString(
  schema: Extract<Schema, { type: "string" }>,
  value: unknown,
  path: string,
): Issue[] {
  if (typeof value !== "string") return [{ path, message: `expected string, got ${kind(value)}` }];
  const issues: Issue[] = [];
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    issues.push({ path, message: `expected at least ${schema.minLength} ${plural(schema.minLength, "character")}, got ${value.length}` });
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    issues.push({ path, message: `expected at most ${schema.maxLength} ${plural(schema.maxLength, "character")}, got ${value.length}` });
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
    issues.push({ path, message: `expected to match ${schema.pattern}, got ${JSON.stringify(value)}` });
  }
  if (schema.enum && !schema.enum.includes(value)) {
    issues.push({ path, message: `expected one of ${schema.enum.join(" | ")}, got ${JSON.stringify(value)}` });
  }
  return issues;
}

function validateNumber(
  schema: Extract<Schema, { type: "number" }>,
  value: unknown,
  path: string,
): Issue[] {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return [{ path, message: `expected number, got ${kind(value)}` }];
  }
  const issues: Issue[] = [];
  if (schema.integer && !Number.isInteger(value)) {
    issues.push({ path, message: `expected an integer, got ${value}` });
  }
  if (schema.minimum !== undefined && value < schema.minimum) {
    issues.push({ path, message: `expected >= ${schema.minimum}, got ${value}` });
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    issues.push({ path, message: `expected <= ${schema.maximum}, got ${value}` });
  }
  return issues;
}

function validateArray(
  schema: Extract<Schema, { type: "array" }>,
  value: unknown,
  path: string,
): Issue[] {
  if (!Array.isArray(value)) return [{ path, message: `expected array, got ${kind(value)}` }];
  const issues: Issue[] = [];
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    issues.push({ path, message: `expected at least ${schema.minItems} ${plural(schema.minItems, "item")}, got ${value.length}` });
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    issues.push({ path, message: `expected at most ${schema.maxItems} ${plural(schema.maxItems, "item")}, got ${value.length}` });
  }
  value.forEach((item, i) => issues.push(...validate(schema.items, item, `${path}/${i}`)));
  return issues;
}

function validateObject(
  schema: Extract<Schema, { type: "object" }>,
  value: unknown,
  path: string,
): Issue[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [{ path, message: `expected object, got ${kind(value)}` }];
  }
  const given = value as Record<string, unknown>;
  const issues: Issue[] = [];

  for (const key of schema.required ?? []) {
    if (!Object.hasOwn(given, key) || given[key] === undefined) {
      issues.push({ path: `${path}/${key}`, message: "required property is missing" });
    }
  }

  for (const [key, sub] of Object.entries(schema.properties)) {
    if (Object.hasOwn(given, key) && given[key] !== undefined) {
      issues.push(...validate(sub, given[key], `${path}/${key}`));
    }
  }

  if (schema.additionalProperties === false) {
    for (const key of Object.keys(given)) {
      if (!Object.hasOwn(schema.properties, key)) {
        issues.push({ path: `${path}/${key}`, message: `unexpected property; allowed: ${Object.keys(schema.properties).join(", ")}` });
      }
    }
  }
  return issues;
}

/** The name a model needs to hear: the JSON type it actually sent. */
export function kind(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Coerce the three cases where a model's transport, not its intent, is wrong:
 * "42" for a number, "true" for a boolean, and a JSON string for an object.
 *
 * Deliberately narrow. This is not a second chance for a wrong answer — it is
 * for a serializer that quoted a number. Anything else must be repaired by the
 * model, because guessing intent is how a tool ends up refunding 428 instead
 * of 42.8.
 */
export function coerce(schema: Schema, value: unknown): unknown {
  if (schema.type === "number" && typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  if (schema.type === "boolean" && (value === "true" || value === "false")) {
    return value === "true";
  }
  if (schema.type === "object" && typeof value === "string" && value.trim().startsWith("{")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (schema.type === "array" && typeof value === "string" && value.trim().startsWith("[")) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * A compact signature of a schema, for the model's prompt and for a trace.
 *
 * Written from the schema rather than by hand so the two cannot drift: the
 * description a model reads is generated from the same object the validator
 * enforces.
 */
export function signature(schema: Schema, indent = 0): string {
  const pad = "  ".repeat(indent);
  switch (schema.type) {
    case "object": {
      const lines = Object.entries(schema.properties).map(([key, sub]) => {
        const required = (schema.required ?? []).includes(key) ? "" : "?";
        const note = sub.description ? `  // ${sub.description}` : "";
        return `${pad}  ${key}${required}: ${signature(sub, indent + 2).trim()}${note}`;
      });
      return `{${lines.length ? "\n" + lines.join("\n") + "\n" + pad : ""}}`;
    }
    case "array":
      return `${signature(schema.items, indent)}[]`;
    case "string":
      return schema.enum ? `"${schema.enum.join('" | "')}"` : "string";
    case "number":
      return schema.integer ? "int" : "number";
    case "boolean":
      return "boolean";
  }
}

/** Every ISO date a schema claims to require should be a real date. */
export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
