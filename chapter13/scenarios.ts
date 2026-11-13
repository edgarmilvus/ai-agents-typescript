// Chapter 13 — ten ways an approval goes wrong, and one that goes right.
//
// Each scenario is a short script against the same machine: propose, approve,
// resume, execute, with one thing changed. The expected column is the number of
// effects and the status, because those are the two things a reviewer cares
// about — did it happen, and does the record say so.
//
// The scenarios are the chapter's test suite in prose form. A machine that
// passes all ten is not proven correct; it is proven to refuse the ten ways
// somebody thought of.

import type { Action } from "./token.ts";
import { actionHash, mint } from "./token.ts";
import type { Status, Store } from "./machine.ts";
import { approve, createStore, execute, propose, resume, revoke } from "./machine.ts";
import type { World } from "./world.ts";
import { apply, createWorld } from "./world.ts";

export const KEY = "approver-side-key";
export const TTL = 10;
export const APPROVERS = ["ada", "grace"];

export const REFUND: Action = {
  tool: "issue_refund",
  args: { orderId: "ORD-7902", amount: 300, reason: "damaged on arrival" },
};

export interface State {
  store: Store;
  world: World;
  runId: string;
}

export function fresh(id = "r1", action: Action = REFUND, expiresAt = 100, requester = "agent"): State {
  const store = createStore();
  const world = createWorld();
  propose(store, {
    id,
    requester,
    proposal: { action, reason: "the customer asked for a refund above the automatic limit", evidence: ["ORD-7902", "EU policy"], expiresAt },
  });
  return { store, world, runId: id };
}

export interface Scenario {
  id: string;
  note: string;
  expect: { effects: number; status: Status; refused?: RegExp };
  run(): { effects: number; status: Status; reason?: string };
}

function result(state: State, reason?: string) {
  const run = state.store.runs.get(state.runId);
  return { effects: state.world.effects.length, status: run?.status ?? "refused", reason: reason ?? run?.refused };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "s1-valid",
    note: "propose, approve, resume, execute",
    expect: { effects: 1, status: "executed" },
    run() {
      const s = fresh();
      approve(s.store, s.runId, "ada", 1, TTL, KEY, APPROVERS);
      const run = s.store.runs.get(s.runId)!;
      resume(s.store, s.runId, run.approval!, 2, KEY);
      execute(s.store, s.runId, s.world, 3);
      return result(s);
    },
  },
  {
    id: "s2-expired-proposal",
    note: "nobody approves before the proposal dies",
    expect: { effects: 0, status: "refused", refused: /expired/ },
    run() {
      const s = fresh();
      const out = approve(s.store, s.runId, "ada", 101, TTL, KEY, APPROVERS);
      return result(s, out.ok ? undefined : out.reason);
    },
  },
  {
    id: "s3-replayed",
    note: "the same approval reaches the executor twice",
    expect: { effects: 1, status: "refused", refused: /already been used/ },
    run() {
      const s = fresh();
      approve(s.store, s.runId, "ada", 1, TTL, KEY, APPROVERS);
      const run = s.store.runs.get(s.runId)!;
      resume(s.store, s.runId, run.approval!, 2, KEY);
      execute(s.store, s.runId, s.world, 3);
      // The replay: a queue re-delivers the old approval after the record moved on.
      run.status = "approved";
      const again = execute(s.store, s.runId, s.world, 4);
      return result(s, again.ok ? undefined : again.reason);
    },
  },
  {
    id: "s4-changed-action",
    note: "the amount is edited after the approval",
    expect: { effects: 0, status: "refused", refused: /action changed/ },
    run() {
      const s = fresh();
      approve(s.store, s.runId, "ada", 1, TTL, KEY, APPROVERS);
      const run = s.store.runs.get(s.runId)!;
      run.proposal.action = { ...run.proposal.action, args: { ...run.proposal.action.args, amount: 3000 } };
      const out = resume(s.store, s.runId, run.approval!, 2, KEY);
      return result(s, out.ok ? undefined : out.reason);
    },
  },
  {
    id: "s5-wrong-approver",
    note: "somebody who is not on the list signs",
    expect: { effects: 0, status: "refused", refused: /not an approver/ },
    run() {
      const s = fresh();
      const out = approve(s.store, s.runId, "mallory", 1, TTL, KEY, APPROVERS);
      return result(s, out.ok ? undefined : out.reason);
    },
  },
  {
    id: "s6-self-approval",
    note: "the agent approves its own action",
    expect: { effects: 0, status: "refused", refused: /own action/ },
    run() {
      // The requester is also an approver, which is exactly the situation the
      // four-eyes rule exists for.
      const s = fresh("r1", REFUND, 100, "ada");
      const out = approve(s.store, s.runId, "ada", 1, TTL, KEY, APPROVERS);
      return result(s, out.ok ? undefined : out.reason);
    },
  },
  {
    id: "s7-crash-after-effect",
    note: "the refund lands and the process dies before the record",
    expect: { effects: 1, status: "executed" },
    run() {
      const s = fresh();
      approve(s.store, s.runId, "ada", 1, TTL, KEY, APPROVERS);
      const run = s.store.runs.get(s.runId)!;
      resume(s.store, s.runId, run.approval!, 2, KEY);
      // The effect happens, the record does not.
      apply(s.world, `${s.runId}/${actionHash(REFUND)}`, "issue_refund", REFUND.args, 3);
      const out = execute(s.store, s.runId, s.world, 4);
      return result(s, out.ok ? undefined : out.reason);
    },
  },
  {
    id: "s8-revoked",
    note: "the approval is taken back before it is used",
    expect: { effects: 0, status: "refused", refused: /revoked/ },
    run() {
      const s = fresh();
      approve(s.store, s.runId, "ada", 1, TTL, KEY, APPROVERS);
      revoke(s.store, s.runId);
      const run = s.store.runs.get(s.runId)!;
      const out = resume(s.store, s.runId, run.approval!, 2, KEY);
      return result(s, out.ok ? undefined : out.reason);
    },
  },
  {
    id: "s9-no-approval",
    note: "the effect is attempted on a pending run",
    expect: { effects: 0, status: "refused", refused: /not approved/ },
    run() {
      const s = fresh();
      const out = execute(s.store, s.runId, s.world, 1);
      return result(s, out.ok ? undefined : out.reason);
    },
  },
  {
    id: "s10-other-run",
    note: "an approval for one run is used on another",
    expect: { effects: 1, status: "refused", refused: /for run r1, not r2/ },
    run() {
      const a = fresh("r1");
      approve(a.store, a.runId, "ada", 1, TTL, KEY, APPROVERS);
      const first = a.store.runs.get(a.runId)!;
      resume(a.store, a.runId, first.approval!, 2, KEY);
      execute(a.store, a.runId, a.world, 3);

      // A second run, in the same store, with the same action.
      propose(a.store, {
        id: "r2",
        requester: "agent",
        proposal: { action: REFUND, reason: "same request, second run", evidence: ["ORD-7902"], expiresAt: 100 },
      });
      const stolen = mint(
        { runId: "r1", actionHash: actionHash(REFUND), approver: "ada", issuedAt: 1, expiresAt: 11 },
        KEY,
      );
      const out = resume(a.store, "r2", stolen, 4, KEY);
      const run = a.store.runs.get("r2")!;
      return { effects: a.world.effects.length, status: run.status, reason: out.ok ? undefined : out.reason };
    },
  },
];

export function runAll(): { scenario: Scenario; got: ReturnType<Scenario["run"]>; pass: boolean }[] {
  return SCENARIOS.map((scenario) => {
    const got = scenario.run();
    const expect = scenario.expect;
    const pass =
      got.effects === expect.effects &&
      got.status === expect.status &&
      (expect.refused === undefined || expect.refused.test(got.reason ?? ""));
    return { scenario, got, pass };
  });
}
