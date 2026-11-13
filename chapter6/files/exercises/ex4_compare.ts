// Exercise 4 — comparing two versions without a p-value.

import { compare } from "../../stats.ts";

export function demo() {
  return {
    clear: compare({ runs: 20, passed: 10 }, { runs: 20, passed: 19 }),
    crowded: compare({ runs: 20, passed: 14 }, { runs: 20, passed: 16 }),
    same: compare({ runs: 20, passed: 14 }, { runs: 20, passed: 14 }),
    small: compare({ runs: 5, passed: 2 }, { runs: 5, passed: 4 }),
  };
}

if (import.meta.main) for (const [k, v] of Object.entries(demo())) console.log(k.padEnd(9), v.verdict.padEnd(18), (v.delta >= 0 ? "+" : "") + (v.delta * 100).toFixed(0) + " points");
