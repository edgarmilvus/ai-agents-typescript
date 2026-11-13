// Exercise 2 — coercion is a policy, not a kindness.
//
// "2" for a quantity is a serializer quoting a number. "2.5" for a quantity is
// a different intent, and must not be rounded into acceptance. This file draws
// the line and shows both sides of it.

import { coerce, validate } from "../schema.ts";
import type { Schema } from "../schema.ts";

const quantity: Schema = { type: "number", integer: true, minimum: 1 };

export function attempt(raw: unknown): { accepted: boolean; value: unknown; note: string } {
  const coerced = coerce(quantity, raw);
  const issues = validate(quantity, coerced);
  return {
    accepted: issues.length === 0,
    value: coerced,
    note: issues.length ? issues[0].message : "accepted",
  };
}

export function demo() {
  return {
    quotedInteger: attempt("2"),
    quotedFraction: attempt("2.5"),
    negative: attempt(-1),
    booleanForNumber: attempt(true),
  };
}

if (import.meta.main) {
  for (const [label, r] of Object.entries(demo())) {
    console.log(`${label.padEnd(18)} ${String(r.accepted).padEnd(9)} ${JSON.stringify(r.value)}  ${r.note}`);
  }
}
