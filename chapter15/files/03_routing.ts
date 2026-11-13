// 15.3 — twenty tasks, three policies.
//
// The cheap model solves the easy tasks and fails the hard ones. Three policies
// buy different combinations of quality and money, and the interesting column
// is tokens per *solved* task, because a cheap failure is not a saving.

import { MODELS, micro } from "../price.ts";
import { breakEven, run } from "../routing.ts";
import type { Policy, Tier } from "../routing.ts";
import { TASKS } from "../loop.ts";
import type { Task } from "../loop.ts";

/** Twenty tasks: sixteen easy, four hard. */
export const CORPUS: Task[] = Array.from({ length: 20 }, (_, i) => {
  const hard = i % 5 === 0;
  return {
    id: `r${String(i + 1).padStart(2, "0")}`,
    label: hard ? "a multi-step audit" : "a two-step lookup",
    steps: hard ? 5 : 2,
    difficulty: hard ? "hard" : "easy",
  };
});

const policies: Policy[] = ["cheap", "strong", "cheap-first"];

console.log("# twenty tasks, three policies\n");
console.log("  policy       solved  attempts   cost      per solved   vs strong");
const strong = run(CORPUS, "strong").usd;
for (const policy of policies) {
  const result = run(CORPUS, policy);
  console.log(
    `  ${policy.padEnd(12)} ${String(result.solved).padStart(4)}/${CORPUS.length} ${String(result.calls).padStart(8)}  ${String(micro(result.usd)).padStart(7)} µ$  ${String(Math.round(micro(result.perSolved))).padStart(9)} µ$   ${(result.usd / strong).toFixed(2)}×`,
  );
}

const mixed = run(CORPUS, "cheap-first");
const failed = mixed.rows.filter((row) => row.attempts.length > 1).length;
console.log(`\n  cheap-first escalated on ${failed} of ${CORPUS.length} tasks, paying twice on each.`);
console.log(`  break-even: the cheap tier has to solve more than ${(breakEven(CORPUS) * 100).toFixed(0)}% of the`);
console.log("  corpus for the retries to pay for themselves. It solves 80%.");

const cheapOnly = run(CORPUS, "cheap");
console.log(`\n  the always-cheap row is the trap. It is twelve times cheaper than always-strong`);
console.log(`  and answers ${cheapOnly.solved} of 20 — and the ${CORPUS.length - cheapOnly.solved} it misses are the audits, which are`);
console.log("  the tasks a desk actually needs done. Nothing in the row says the work is");
console.log("  unfinished; the solved column does, and it is the column a cost review");
console.log("  that only reads the bill will skip.");

void (MODELS as Record<Tier, unknown>);
