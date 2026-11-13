// Exercise 3, file 3 of 3 — the wiring and the table.
//
// Eight tasks, three policies, one break-even. The wiring knows the corpus and
// both halves of the split, and nothing else.

import { micro } from "./ex3_price.ts";
import { route, threshold } from "./ex3_router.ts";
import type { Policy, Task } from "./ex3_router.ts";

export const TASKS: Task[] = [
  { id: "w1", steps: 2 },
  { id: "w2", steps: 2 },
  { id: "w3", steps: 3 },
  { id: "w4", steps: 2 },
  { id: "w5", steps: 5 },
  { id: "w6", steps: 2 },
  { id: "w7", steps: 4 },
  { id: "w8", steps: 2 },
];

const policies: Policy[] = ["cheap", "strong", "cheap-first"];

export function demo() {
  return {
    rows: policies.map((policy) => ({ policy, ...route(TASKS, policy) })),
    threshold: threshold(TASKS),
  };
}

export function report(d: ReturnType<typeof demo>): void {
  console.log("# eight tasks, three policies\n");
  console.log("  policy       solved  attempts      cost  per solved");
  for (const row of d.rows) {
    const attempts = row.rows.reduce((n, r) => n + r.attempts.length, 0);
    console.log(
      `  ${row.policy.padEnd(12)} ${String(row.solved).padStart(4)}/8 ${String(attempts).padStart(8)} ${String(micro(row.usd)).padStart(9)} µ$ ${String(Math.round(micro(row.perSolved))).padStart(11)} µ$`,
    );
  }
  console.log(`\n  the cheap tier must solve more than ${(d.threshold * 100).toFixed(0)}% of this corpus for`);
  console.log(`  cheap-first to beat always-strong; it solves 62%.`);
  const mixed = d.rows[2];
  console.log(`\n  cheap-first answers every task for ${(mixed.usd / d.rows[1].usd).toFixed(2)}× the strong-only`);
  console.log("  cost, and always-cheap answers five of eight for a tenth of it. The");
  console.log("  review has to say which of those two failures it can live with.");
}

if (import.meta.main) report(demo());
