// 14.5 — the cliff, as the budget shrinks.
//
// A budget chart is usually drawn as "tokens saved", which is the wrong axis.
// The axis that matters is how many tasks the agent can still answer, because
// the tokens it saved by dropping the wrong note were not saved at all — the
// task comes back, larger, with a human on it.

import { createStore } from "../memory.ts";
import { solve } from "../context.ts";
import type { Strategy } from "../context.ts";
import { DISTRACTORS, OLD, TASKS } from "../tasks.ts";

const store = createStore([...OLD, ...DISTRACTORS]);
const strategies: Strategy[] = ["transcript", "retrieval", "summary"];
const budgets = [20, 40, 60, 80, 100, 120, 140, 160];

console.log("# answered as the memory budget shrinks\n");
console.log(`  ${"budget".padEnd(7)} ${strategies.map((s) => s.padStart(11)).join("")}`);
for (const budget of budgets) {
  const cells = strategies.map((strategy) => {
    const ok = TASKS.filter((task) => solve(task, store, strategy, 30, budget).ok).length;
    return `${ok}/${TASKS.length}`.padStart(11);
  });
  console.log(`  ${String(budget).padEnd(7)}${cells.join("")}`);
}

console.log("\n  retrieval holds thirteen answers from a budget of forty up to a hundred and");
console.log("  sixty, and loses three of them when the budget drops to twenty — the");
console.log("  cliff is where the note it ranked first no longer fits. A retriever that");
console.log("  cannot include its best hit has no second plan.");
console.log("");
console.log("  the summary degrades with the budget, which looks better behaved and is");
console.log("  not: it loses facts earlier than it loses decisions, so the answers it");
console.log("  gives are the ones that do not need evidence.");
