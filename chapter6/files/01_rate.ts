// 6.1 — a rate is a count, not a fact.
//
// Ten runs of the same case, replayed; the rate is 60 %, and the interval says
// what that number is worth.

import { rate, wilson } from "../stats.ts";

const runs = { runs: 10, passed: 6 };
console.log("# one case, ten runs");
console.log("  rate    :", (rate(runs) * 100).toFixed(0) + "%");
const ci = wilson(runs);
console.log("  interval:", `${(ci.low * 100).toFixed(0)}% – ${(ci.high * 100).toFixed(0)}%`);

console.log("\n# the two extremes, which is where suites live");
for (const t of [{ runs: 10, passed: 10 }, { runs: 10, passed: 0 }, { runs: 3, passed: 3 }]) {
  const w = wilson(t);
  console.log(`  ${t.passed}/${t.runs}: ${(w.low * 100).toFixed(0)}% – ${(w.high * 100).toFixed(0)}%`);
}
