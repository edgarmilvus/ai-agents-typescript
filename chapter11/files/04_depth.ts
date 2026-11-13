// 11.4 — a child that delegates, and the arithmetic of a tree.
//
// Depth is not a theoretical concern: a child with the delegate tool can hand
// its work to another child, and a child that does that in a loop is an
// unbounded bill. The guard is one integer, and it belongs at the tool, not in
// a prompt, because the tool is the thing that spends the money.
//
// Fan-out is the other half. Splitting a task across children is only free if
// the budget is split with it; otherwise a tree of agents is one task's worth
// of work repeated at every level.

import { makeDesk } from "../../chapter1/files/03_support_triage.ts";
import { delegateTool, split, tree } from "../supervisor.ts";
import type { Packet, Report } from "../contract.ts";

const desk = makeDesk();
const log: Packet[] = [];
const reports: Report[] = [];

const supervisorTool = delegateTool({ desk, log, reports, depth: 0 });
const childTool = delegateTool({ desk, log, reports, depth: 1 });

console.log("# a child that delegates\n");
const first = supervisorTool.run({ role: "clerk", goal: "read ORD-7712", orderId: "ORD-7712" }) as string;
const second = childTool.run({ role: "cashier", goal: "refund it", orderId: "ORD-7712", amount: 84, verdict: "refund" }) as string;
console.log(`  depth 0 (supervisor) → clerk   : ${JSON.parse(first).status}`);
console.log(`  depth 1 (clerk)      → cashier : ${JSON.parse(second).status} — ${JSON.parse(second).reason}`);
console.log(`  packets that crossed the seam  : ${log.length}`);

console.log("\n# fan-out, with the budget split with it\n");
console.log("  fan-out  depth  nodes  leaves  budget 8 split");
for (const [f, d] of [
  [2, 1],
  [2, 2],
  [3, 2],
  [3, 3],
] as const) {
  const t = tree(f, d);
  console.log(
    `  ${String(f).padStart(7)}  ${String(d).padStart(5)}  ${String(t.nodes).padStart(5)}  ${String(t.leaves).padStart(6)}  ${split(8, f).join(" + ")}`,
  );
}

console.log("\n  the third row is the useful one. Three children of depth two is thirteen");
console.log("  agents for one task, each of which believed it had the whole budget.");
console.log("  splitting the budget is not an optimisation; it is what makes the tree");
console.log("  cost what the tree was supposed to cost.");
