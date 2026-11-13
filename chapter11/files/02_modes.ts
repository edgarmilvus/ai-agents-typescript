// 11.2 — eight tasks, three fidelities.
//
// The matrix is the chapter's evidence. A task completes when every step
// completed, and a step completes when the child had the facts its role
// declared. Nothing here depends on a model: the parent's packets are built
// from the task, and the children follow the policy.

import { TASKS } from "../corpus.ts";
import { supervise } from "../supervisor.ts";
import type { Mode } from "../contract.ts";

const modes: Mode[] = ["goal", "relay", "full"];

console.log("# completion by fidelity\n");
console.log(`  ${"task".padEnd(20)} ${modes.map((m) => m.padStart(16)).join("")}`);
const totals: Record<Mode, { done: number; tokens: number; calls: number }> = {
  goal: { done: 0, tokens: 0, calls: 0 },
  relay: { done: 0, tokens: 0, calls: 0 },
  full: { done: 0, tokens: 0, calls: 0 },
};

for (const task of TASKS) {
  const cells = modes.map((mode) => {
    const run = supervise(task, mode);
    totals[mode].tokens += run.tokens;
    totals[mode].calls += run.calls;
    if (run.ok) totals[mode].done += 1;
    return (run.ok ? "complete" : `blocked@${run.blockedAt}`).padStart(16);
  });
  console.log(`  ${task.id.padEnd(20)}${cells.join("")}`);
}

console.log("");
for (const mode of modes) {
  const t = totals[mode];
  console.log(
    `  ${mode.padEnd(6)} ${String(t.done).padStart(2)}/${TASKS.length} complete   ` +
      `${String(t.calls).padStart(3)} child calls   ${String(t.tokens).padStart(5)} packet tokens`,
  );
}

console.log("\n  relay loses three tasks, and the reason is the same in two of them: the");
console.log("  packet carried what the parent volunteered, and the next step needed");
console.log("  something else. The third is a parent that volunteered nothing at all.");
console.log("");
console.log("  full completes everything and is not minimal by accident: each step gets");
console.log("  its declared needs and nothing more, so a child cannot act on a fact it");
console.log("  was never given and cannot be blamed for one it was.");
