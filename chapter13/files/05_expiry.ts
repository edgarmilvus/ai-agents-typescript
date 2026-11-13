// 13.5 — two clocks, and the difference between them.
//
// A proposal has a deadline and a token has a lifetime, and they are not the
// same clock. The proposal says "this request is worth answering for an hour";
// the token says "this answer is good for ten minutes". Re-approving after a
// token expires is allowed. Re-approving after the proposal expires is not,
// because there is nothing left to approve.

import { approve, createStore, execute, propose, resume } from "../machine.ts";
import { createWorld } from "../world.ts";

const KEY = "approver-side-key";
const APPROVERS = ["ada", "grace"];
const TTL = 10;
const REFUND = { tool: "issue_refund", args: { orderId: "ORD-7902", amount: 300 } };

const store = createStore();
const world = createWorld();
propose(store, {
  id: "r1",
  requester: "agent",
  proposal: { action: REFUND, reason: "damaged", evidence: ["ORD-7902"], expiresAt: 100 },
});

console.log("# the proposal\n");
console.log(`  expires at tick 100; the first approval is asked for at tick 1`);

console.log("\n# a token that expires before it is used\n");
const first = approve(store, "r1", "ada", 1, TTL, KEY, APPROVERS);
console.log(`  approve at  1 : ok=${first.ok}, token expires at ${store.runs.get("r1")?.approval?.expiresAt}`);
const late = resume(store, "r1", store.runs.get("r1")!.approval!, 12, KEY);
console.log(`  resume at  12 : ok=${late.ok} — ${late.ok ? "" : late.reason}`);

console.log("\n# a fresh approval in the same window\n");
const second = approve(store, "r1", "grace", 12, TTL, KEY, APPROVERS);
console.log(`  approve at 12 : ok=${second.ok}, token expires at ${store.runs.get("r1")?.approval?.expiresAt}`);
const resumed = resume(store, "r1", store.runs.get("r1")!.approval!, 13, KEY);
console.log(`  resume at  13 : ok=${resumed.ok}`);
const executed = execute(store, "r1", world, 14);
console.log(`  execute at 14 : ok=${executed.ok}, effects=${world.effects.length}`);

console.log("\n# a proposal nobody answered\n");
const store2 = createStore();
propose(store2, {
  id: "r2",
  requester: "agent",
  proposal: { action: REFUND, reason: "damaged", evidence: ["ORD-7902"], expiresAt: 100 },
});
const stale = approve(store2, "r2", "ada", 101, TTL, KEY, APPROVERS);
console.log(`  approve at 101: ok=${stale.ok} — ${stale.ok ? "" : stale.reason}`);

console.log("\n  the two clocks exist because the questions are different. A token's");
console.log("  lifetime is about how long an approval stays true; a proposal's deadline");
console.log("  is about how long the request is worth answering. Neither can be extended");
console.log("  by the party that benefits from the answer.");
