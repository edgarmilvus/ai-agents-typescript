// Exercise 3, file 3 of 3 — the wiring and the table.
//
// Two policies over one schedule. The table is the exercise's output: which
// week converted, which recurred, and what each policy left open.

import { run } from "./ex3_cycle.ts";
import type { Policy } from "./ex3_cycle.ts";

const policies: Policy[] = ["money-only", "every-incident"];

export function demo() {
  return policies.map((policy) => run(policy));
}

export function report(cycles: ReturnType<typeof demo>): void {
  console.log("# six weeks, two policies\n");
  console.log("  week  kind            money-only        every-incident");
  const rows = Math.max(...cycles.map((c) => c.weeks.length));
  for (let i = 0; i < rows; i += 1) {
    const cells = cycles.map((cycle) => {
      const w = cycle.weeks[i];
      return (w.recurrence ? "RECURS" : w.converted ? "fixture" : "nothing").padEnd(17);
    });
    console.log(`  ${String(cycles[0].weeks[i].week).padStart(4)}  ${cycles[0].weeks[i].kind.padEnd(15)} ${cells.join(" ")}`);
  }

  console.log("");
  for (const cycle of cycles) {
    console.log(
      `  ${cycle.policy.padEnd(15)} converted ${cycle.converted}/6  complete ${cycle.complete}  escapes ${cycle.escapes.join(",") || "none"}`,
    );
  }
  console.log("\n  money-only converts the wrong-amount rows and leaves the injection and the");
  console.log("  false-green alone. Both recur, and the escapes column is the only place");
  console.log("  that says so: a dashboard would show 33 percent coverage, which is a");
  console.log("  number that looks like progress.");
}

if (import.meta.main) report(demo());
