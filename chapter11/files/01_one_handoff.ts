// 11.1 — one task, three packets.
//
// The same request, handed over three ways: the goal alone, the goal plus the
// facts a parent volunteers, and the goal plus exactly what the child declared
// it needs. The child is the same code in all three, which is the point: when
// the packet is thin, the child refuses, and the refusal is the measurement.

import { TASKS } from "../corpus.ts";
import { supervise } from "../supervisor.ts";
import type { Mode } from "../contract.ts";

const task = TASKS[0];
const modes: Mode[] = ["goal", "relay", "full"];

console.log(`# ${task.id}`);
console.log(`  ${task.request}\n`);

for (const mode of modes) {
  const run = supervise(task, mode);
  console.log(`## ${mode}`);
  for (const step of run.steps) {
    const facts = Object.keys(step.packet.facts);
    console.log(`  step ${step.step} ${step.role.padEnd(8)} facts: ${(facts.join(", ") || "none").padEnd(30)} ${step.report.status.padEnd(8)} ${step.detail}`);
  }
  console.log(`  outcome: ${run.ok ? "complete" : "stopped"}  calls: ${run.calls}  packet tokens: ${run.tokens}\n`);
}

console.log("  three differences worth naming.");
console.log("  goal   — the clerk refuses at step 1: no order id crossed the seam.");
console.log("  relay  — every step completes, and the clerk is handed a verdict and an");
console.log("           amount it has no use for. Complete is not the same as minimal.");
console.log("  full   — the clerk gets orderId, the cashier gets orderId+amount+verdict,");
console.log("           and the cashier is the only step that receives the constraints.");
