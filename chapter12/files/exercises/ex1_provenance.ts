// Exercise 1 — where a value came from, through an expression.
//
// Provenance is only useful if it survives arithmetic. The interesting case is
// not a number straight out of a document; it is a number computed from three
// inputs, one of which arrived in a filename.

export type Source = "system" | "principal" | "tool" | "document";

export interface Marked<T> {
  value: T;
  from: Source[];
}

export const fromSystem = <T>(value: T): Marked<T> => ({ value, from: ["system"] });
export const fromPrincipal = <T>(value: T): Marked<T> => ({ value, from: ["principal"] });
export const fromData = <T>(value: T, source: Source = "document"): Marked<T> => ({ value, from: [source] });

/** Combine values, keeping every source any of them came from. */
export function combine<T>(value: T, ...parts: Marked<unknown>[]): Marked<T> {
  const from: Source[] = [];
  for (const part of parts) for (const source of part.from) if (!from.includes(source)) from.push(source);
  return { value, from };
}

export function isData(value: Marked<unknown>): boolean {
  return value.from.includes("tool") || value.from.includes("document");
}

/** Apply a function and keep the provenance of everything it read. */
export function map<T, U>(value: Marked<T>, f: (value: T) => U): Marked<U> {
  return { value: f(value.value), from: [...value.from] };
}

export interface Case {
  id: string;
  note: string;
  value: Marked<number>;
  data: boolean;
}

const total = fromSystem(84);
const quantity = fromPrincipal(2);
const discount = fromData(10, "document");

export const CASES: Case[] = [
  { id: "c1-system", note: "a number from the order table", value: total, data: false },
  { id: "c2-principal", note: "a number the customer typed into a form", value: quantity, data: false },
  { id: "c3-document", note: "a number read from a policy PDF", value: discount, data: true },
  { id: "c4-sum", note: "the total plus a discount from the document", value: combine(total.value + discount.value, total, discount), data: true },
  { id: "c5-product", note: "a quantity times a clean total", value: combine(quantity.value * total.value, quantity, total), data: false },
  { id: "c6-mapped", note: "a clean number that was rounded by a function", value: map(total, (n) => Math.round(n * 1.1)), data: false },
];

export function demo() {
  return CASES.map((c) => ({ ...c, from: c.value.from.join("+") }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# provenance through an expression\n");
  console.log("  case         value  from            tainted  note");
  for (const row of rows) {
    console.log(`  ${row.id.padEnd(11)} ${String(row.value.value).padStart(5)}  ${row.from.padEnd(15)} ${(row.data ? "yes" : "no").padEnd(8)} ${row.note}`);
  }
  console.log("\n  c4 is the case the chapter is about: a value computed from a clean total");
  console.log("  and a document is still a document. c6 is the other direction: a function");
  console.log("  does not launder a number, and it does not contaminate one either.");
}

if (import.meta.main) report(demo());
