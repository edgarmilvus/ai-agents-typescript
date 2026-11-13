// Exercise 2 — precision is bought with runs, not with decimals.

import { wilson } from "../../stats.ts";

export function width(t: { runs: number; passed: number }): number {
  const w = wilson(t);
  return w.high - w.low;
}

export function demo() {
  const marks = [3, 10, 30, 100, 400];
  return marks.map((n) => ({ n, width: width({ runs: n, passed: Math.round(n * 0.7) }) }));
}

if (import.meta.main) for (const r of demo()) console.log(String(r.n).padStart(4), (r.width * 100).toFixed(0) + " points");
