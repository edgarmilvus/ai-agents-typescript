// Exercise 1 — a rate without its interval is an opinion.

import { rate, wilson } from "../../stats.ts";

export function report(t: { runs: number; passed: number }, threshold = 0.8) {
  const r = rate(t);
  const w = wilson(t);
  return {
    text: `${t.passed}/${t.runs} (${Math.round(r * 100)}%), ${Math.round(w.low * 100)}–${Math.round(w.high * 100)}%`,
    /** Can the sample tell whether the agent clears the threshold? */
    claimsClear: w.low > threshold,
    claimsFail: w.high < threshold,
    undecided: w.low <= threshold && w.high >= threshold,
  };
}

export function demo() {
  return [ { runs: 10, passed: 9 }, { runs: 100, passed: 90 }, { runs: 10, passed: 10 }, { runs: 0, passed: 0 } ].map((t) => ({ t, ...report(t) }));
}

if (import.meta.main) for (const r of demo()) console.log(r.text.padEnd(28), r.claimsClear ? "clears" : r.claimsFail ? "fails" : "undecided");
