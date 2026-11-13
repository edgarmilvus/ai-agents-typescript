// 13.1 — one approval, end to end.
//
// Four moves: the agent proposes, a human approves, the system resumes with the
// token, and the effect lands once. The demo prints the state after each move
// and the token that made the last two possible, because the token is the only
// thing in the chain the agent cannot produce.

import { createStore, approve, execute, propose, resume } from "../machine.ts";
import { createWorld } from "../world.ts";
import { actionHash } from "../token.ts";

const KEY = "approver-side-key";
const APPROVERS = ["ada", "grace"];
const TTL = 10;
const REFUND = { tool: "issue_refund", args: { orderId: "ORD-7902", amount: 300, reason: "damaged on arrival" } };

const store = createStore();
const world = createWorld();

console.log("# the moves\n");

const run = propose(store, {
  id: "r1",
  requester: "agent",
  proposal: {
    action: REFUND,
    reason: "the customer asked for a refund above the automatic limit",
    evidence: ["ORD-7902", "EU policy row", "damage photo note"],
    expiresAt: 100,
  },
});
console.log(`  1 propose  status=${run.status}  requester=${run.requester}`);
console.log(`             action=${REFUND.tool} amount=${REFUND.args.amount} hash=${actionHash(REFUND)}`);

const approved = approve(store, "r1", "ada", 1, TTL, KEY, APPROVERS);
console.log(`  2 approve  ok=${approved.ok}  approver=ada  expires=${store.runs.get("r1")?.approval?.expiresAt}`);

const token = store.runs.get("r1")!.approval!;
const resumed = resume(store, "r1", token, 2, KEY);
console.log(`  3 resume   ok=${resumed.ok}  status=${store.runs.get("r1")?.status}`);

const executed = execute(store, "r1", world, 3);
console.log(`  4 execute  ok=${executed.ok}  effects=${world.effects.length}  status=${store.runs.get("r1")?.status}`);

console.log("\n# the token\n");
console.log(`  run       ${token.runId}`);
console.log(`  action    ${token.actionHash}`);
console.log(`  approver  ${token.approver}`);
console.log(`  window    ${token.issuedAt} → ${token.expiresAt}`);
console.log(`  signature ${token.signature.slice(0, 24)}…`);

console.log("\n# the effect\n");
console.log(`  ${world.effects[0].tool} ${JSON.stringify(world.effects[0].args)}`);
console.log("\n  the agent wrote the first line. It could not write the second: the");
console.log("  signature needs a key it does not have. And the third only works because");
console.log("  the second produced something the agent cannot mint.");
