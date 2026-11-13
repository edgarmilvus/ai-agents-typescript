// Exercise 5 — the limits that live in the array, not in the tool.
//
// "At least one line" and "at most forty" are schema facts, and they must be
// refused before any code runs, with the path pointing at the array.

import { validate } from "../schema.ts";
import { lineSchema } from "../tools.ts";
import type { Schema } from "../schema.ts";

export const lines: Schema = { type: "array", items: lineSchema, minItems: 1, maxItems: 40 };

function line(n: number) {
  return { sku: `OPT-${1000 + n}`, description: `Lens ${n}`, quantity: 1, unitPrice: 10 };
}

export function demo() {
  return {
    one: validate(lines, [line(1)]),
    forty: validate(lines, Array.from({ length: 40 }, (_, i) => line(i))),
    fortyOne: validate(lines, Array.from({ length: 41 }, (_, i) => line(i))),
    none: validate(lines, []),
    badLine: validate(lines, [line(1), { sku: "nope", description: "x", quantity: 0, unitPrice: 0 }]),
  };
}

if (import.meta.main) {
  const r = demo();
  console.log("one line    :", r.one.length, "issues");
  console.log("forty       :", r.forty.length, "issues");
  console.log("forty-one   :", r.fortyOne.map((i) => `${i.path}: ${i.message}`).join(" | "));
  console.log("none        :", r.none.map((i) => `${i.path}: ${i.message}`).join(" | "));
  console.log("bad line    :", r.badLine.length, "issues:", r.badLine.map((i) => i.path).join(", "));
}
