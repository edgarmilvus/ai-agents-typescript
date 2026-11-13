// 11.5 — where the parent's evidence stops.
//
// A delegated failure is not always a child's failure. The same child, the same
// code, the same task, completes under a full packet and refuses under a relay
// packet that omitted the amount. The variable is the seam, and the parent's
// record cannot tell the difference unless it kept the packet.

import { TASKS } from "../corpus.ts";
import { supervise } from "../supervisor.ts";

const task = TASKS.find((t) => t.id === "t4-amount-missing");
if (!task) throw new Error("no t4");

for (const mode of ["relay", "full"] as const) {
  const run = supervise(task, mode);
  const step = run.steps[run.steps.length - 1];
  console.log(`# ${mode}`);
  console.log(`  packet   : role ${step.packet.role}, facts ${Object.keys(step.packet.facts).join(", ") || "none"}`);
  console.log(`  report   : ${step.report.status} — ${step.detail}`);
  console.log(`  outcome  : ${run.ok ? "complete" : `stopped at step ${run.blockedAt}`}`);
  console.log(`  evidence : the parent holds a packet, a report and a sentence\n`);
}

console.log("  the child is identical in both runs. It read no order, moved no money");
console.log("  and refused for one reason: a fact its role declares it cannot work");
console.log("  without was not in the packet. Calling that a child failure is the");
console.log("  attribution mistake this chapter exists to prevent.");
console.log("");
console.log("  what the parent cannot see is the child's own history — the calls it");
console.log("  made, the policy it read, the total it saw. That is the price of the");
console.log("  seam: the parent gets a summary, and a summary is only as good as the");
console.log("  contract that produced it.");
