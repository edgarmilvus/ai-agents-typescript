// 14.2 — fifteen tasks, four strategies.
//
// The corpus is the argument. Every task needs one old note, the new notes are
// about the same orders, and the request is written the way a colleague would
// write it. Two strategies answer most of it, one answers half, and one answers
// almost none — and the one that answers almost none is the one that costs the
// most tokens.

import { createStore } from "../memory.ts";
import { solve } from "../context.ts";
import type { Strategy } from "../context.ts";
import { DISTRACTORS, OLD, TASKS } from "../tasks.ts";

const store = createStore([...OLD, ...DISTRACTORS]);
const BUDGET = 130;
const strategies: Strategy[] = ["none", "transcript", "retrieval", "summary"];

console.log("# answered, by strategy\n");
console.log(`  ${"task".padEnd(5)} ${strategies.map((s) => s.padStart(11)).join("")}`);
for (const task of TASKS) {
  const cells = strategies.map((strategy) => (solve(task, store, strategy, 30, BUDGET).ok ? "yes" : "no").padStart(11));
  console.log(`  ${task.id.padEnd(5)}${cells.join("")}`);
}

console.log("");
for (const strategy of strategies) {
  const rows = TASKS.map((task) => solve(task, store, strategy, 30, BUDGET));
  const ok = rows.filter((r) => r.ok).length;
  const tokens = Math.round(rows.reduce((sum, r) => sum + r.tokens, 0) / rows.length);
  console.log(`  ${strategy.padEnd(11)} ${String(ok).padStart(2)}/${TASKS.length} answered   ${String(tokens).padStart(3)} tokens per task`);
}

console.log("\n  the summary column is the one to look at twice. It is the strategy that");
console.log("  fills the budget every time and answers half the corpus, because what it");
console.log("  keeps is decided by kind rather than by the question.");
console.log("");
console.log("  the transcript column is not zero by accident: the notes it keeps are the");
console.log("  newest ones that fit, and almost every task in the corpus is about");
console.log("  something older. The two it answers are the two whose notes happen to be");
console.log("  inside the window, which is exactly what recency is good at.");
