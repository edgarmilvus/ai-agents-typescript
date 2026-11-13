// Chapter 12 — where a value came from.
//
// A string is a string, and that is the problem. "84" read from the order table
// and "84" written by a customer in an email are the same three characters and
// different facts, and an agent that cannot tell them apart will move money on
// the second one.
//
// Provenance is the missing type. A tainted value carries the set of sources it
// was derived from, and derivation unions them, so a number computed from a
// tool result stays marked however many additions it goes through.

export type Source = "principal" | "system" | "tool" | "document";

export interface Tainted<T> {
  value: T;
  /** Every source this value was derived from, in insertion order. */
  from: Source[];
}

/** A value the system produced: the order table, a policy constant, a clock. */
export function clean<T>(value: T): Tainted<T> {
  return { value, from: ["system"] };
}

/** A value the principal supplied: the task, an approval, a form field. */
export function principal<T>(value: T): Tainted<T> {
  return { value, from: ["principal"] };
}

/** A value that arrived in data: a tool result, a document, an email body. */
export function untrusted<T>(value: T, source: Source = "document"): Tainted<T> {
  return { value, from: [source] };
}

/** A value computed from others: the union of their sources. */
export function derived<T>(value: T, ...parts: Tainted<unknown>[]): Tainted<T> {
  const from: Source[] = [];
  for (const part of parts) {
    for (const source of part.from) {
      if (!from.includes(source)) from.push(source);
    }
  }
  return { value, from };
}

/** True when any part of the value came from data rather than from the system. */
export function tainted(value: Tainted<unknown>): boolean {
  return value.from.includes("tool") || value.from.includes("document");
}

/** The sources as a string, for reports and refusals. */
export function provenance(value: Tainted<unknown>): string {
  return value.from.join("+");
}
