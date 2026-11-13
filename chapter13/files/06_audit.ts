// 13.6 — the chain, as a record.
//
// An approval is only useful if somebody can answer, six months later, who
// approved what, on what evidence, and what the desk did. That is four
// documents that already exist — the proposal, the token, the effect and the
// run — printed as one object per run.
//
// The second record is a refusal, because a chain that only exists for the
// happy path is a marketing document.

import { approve, createStore, execute, propose, resume } from "../machine.ts";
import { createWorld } from "../world.ts";
import type { Run } from "../machine.ts";
import type { World } from "../world.ts";

const KEY = "approver-side-key";
const APPROVERS = ["ada", "grace"];
const REFUND = { tool: "issue_refund", args: { orderId: "ORD-7902", amount: 300 } };

function record(run: Run, world: World) {
  return {
    run: run.id,
    status: run.status,
    requester: run.requester,
    proposal: {
      action: run.proposal.action,
      reason: run.proposal.reason,
      evidence: run.proposal.evidence,
      expiresAt: run.proposal.expiresAt,
    },
    approval: run.approval
      ? {
          approver: run.approval.approver,
          issuedAt: run.approval.issuedAt,
          expiresAt: run.approval.expiresAt,
          actionHash: run.approval.actionHash,
          signature: `${run.approval.signature.slice(0, 16)}…`,
        }
      : null,
    refused: run.refused ?? null,
    effect: world.effects.find((effect) => effect.key.startsWith(`${run.id}/`)) ?? null,
  };
}

// A run that goes through.
const store = createStore();
const world = createWorld();
propose(store, {
  id: "r1",
  requester: "agent",
  proposal: {
    action: REFUND,
    reason: "the customer asked for a refund above the automatic limit",
    evidence: ["ORD-7902", "EU policy row"],
    expiresAt: 100,
  },
});
approve(store, "r1", "ada", 1, 10, KEY, APPROVERS);
resume(store, "r1", store.runs.get("r1")!.approval!, 2, KEY);
execute(store, "r1", world, 3);

// A run that is refused because the action changed.
const bad = createStore();
const badWorld = createWorld();
propose(bad, {
  id: "r2",
  requester: "agent",
  proposal: { action: REFUND, reason: "same request", evidence: ["ORD-7902"], expiresAt: 100 },
});
approve(bad, "r2", "grace", 1, 10, KEY, APPROVERS);
const badRun = bad.runs.get("r2")!;
badRun.proposal.action = { ...badRun.proposal.action, args: { ...badRun.proposal.action.args, amount: 3000 } };
resume(bad, "r2", badRun.approval!, 2, KEY);

console.log("# the record of a run that happened\n");
console.log(JSON.stringify(record(store.runs.get("r1")!, world), null, 2));

console.log("\n# the record of a run that was stopped\n");
console.log(JSON.stringify(record(badRun, badWorld), null, 2));

console.log("\n  the two records have the same shape, which is the point. The refusal is");
console.log("  not an exception in the log; it is a run with a different status and a");
console.log("  sentence saying which check failed. A reviewer reads one format.");
