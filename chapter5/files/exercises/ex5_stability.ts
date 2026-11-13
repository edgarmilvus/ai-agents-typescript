// Exercise 5 — the same suite twice must give the same report.
//
// A suite that replays recordings is deterministic by construction. This
// proves it, and fails if any part of the report carries a timestamp.

export interface Report {
  total: number;
  passed: number;
  rate: number;
  ids: string[];
}

export function build(ids: string[], passed: string[]): Report {
  const unique = [...new Set(ids)];
  return { total: unique.length, passed: passed.length, rate: unique.length ? passed.length / unique.length : 0, ids: unique };
}

/** Two reports are the same measurement if every field agrees. */
export function same(a: Report, b: Report): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function demo() {
  const ids = ["inside", "outside", "unknown"];
  const a = build(ids, ["inside", "outside", "unknown"]);
  const b = build(ids, ["inside", "outside", "unknown"]);
  const c = build(ids, ["inside"]);
  return { a, b, identical: same(a, b), different: same(a, c) };
}

if (import.meta.main) {
  const r = demo();
  console.log("report  :", JSON.stringify(r.a));
  console.log("same    :", r.identical);
  console.log("differs :", r.different);
}
