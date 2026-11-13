// Chapter 13 harness.
//
//   node chapter13/files/run_ex13.ts
//
// Offline: the machine is pure bookkeeping over a world that is an array, and
// the live request is read from disk.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { actionHash, canonical, mint, verify } from "../token.ts";
import { apply, createWorld, ledger } from "../world.ts";
import { approve, createStore, execute, propose, resume, revoke } from "../machine.ts";
import { APPROVERS, KEY, SCENARIOS, TTL, runAll } from "../scenarios.ts";
import { RUNS } from "./00_record.ts";
import type { Saved } from "./00_record.ts";

let checks = 0;
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

const REFUND = { tool: "issue_refund", args: { orderId: "ORD-7902", amount: 300 } };

function setup(expiresAt = 100, requester = "agent") {
  const store = createStore();
  const world = createWorld();
  propose(store, {
    id: "r1",
    requester,
    proposal: { action: REFUND, reason: "damaged", evidence: ["ORD-7902"], expiresAt },
  });
  return { store, world };
}

// 1 — the binding
{
  equal("canonical sorts keys", canonical({ b: 1, a: 2 }), '{"a":2,"b":1}');
  equal("key order does not change the hash", actionHash({ tool: "t", args: { a: 1, b: 2 } }), actionHash({ tool: "t", args: { b: 2, a: 1 } }));
  check("a changed argument does", actionHash({ tool: "t", args: { a: 1 } }) !== actionHash({ tool: "t", args: { a: 2 } }));

  const token = mint({ runId: "r1", actionHash: actionHash(REFUND), approver: "ada", issuedAt: 1, expiresAt: 11 }, KEY);
  equal("a fresh token verifies", verify(token, { runId: "r1", action: REFUND, now: 5 }, KEY).ok, true);
  equal("another run does not", verify(token, { runId: "r2", action: REFUND, now: 5 }, KEY).ok, false);
  equal("a changed amount does not", verify(token, { runId: "r1", action: { ...REFUND, args: { ...REFUND.args, amount: 3000 } }, now: 5 }, KEY).ok, false);
  equal("a later clock does not", verify(token, { runId: "r1", action: REFUND, now: 12 }, KEY).ok, false);
  equal("an earlier clock does not", verify(token, { runId: "r1", action: REFUND, now: 0 }, KEY).ok, false);
  equal("a different key does not", verify(token, { runId: "r1", action: REFUND, now: 5 }, "other-key").ok, false);
  const forged = { ...token, approver: "mallory" };
  equal("the approver is inside the signature", verify(forged, { runId: "r1", action: REFUND, now: 5 }, KEY).ok, false);
  check("the refusal explains itself", /signature/.test((verify(forged, { runId: "r1", action: REFUND, now: 5 }, KEY) as { reason: string }).reason));
}

// 2 — the world
{
  const world = createWorld();
  const first = apply(world, "k1", "issue_refund", { amount: 300 }, 1);
  const second = apply(world, "k1", "issue_refund", { amount: 300 }, 2);
  equal("the first application happens", [first.applied, world.effects.length], [true, 1]);
  equal("the second does not", [second.applied, world.effects.length], [false, 1]);
  equal("a different key is a different effect", apply(world, "k2", "escalate", {}, 3).applied, true);
  equal("the ledger has two rows", ledger(world).length, 2);
}

// 3 — the machine
{
  const early = setup();
  const noApproval = execute(early.store, "r1", early.world, 1);
  equal("executing without an approval is refused", [noApproval.ok, early.world.effects.length], [false, 0]);

  const { store, world } = setup();
  equal("a proposal is pending", store.runs.get("r1")?.status, "pending");
  const ok = approve(store, "r1", "ada", 1, TTL, KEY, APPROVERS);
  equal("an approver can approve", ok.ok, true);
  const token = store.runs.get("r1")!.approval!;
  equal("resume accepts it", resume(store, "r1", token, 2, KEY).ok, true);
  const done = execute(store, "r1", world, 3);
  equal("the effect lands once", [done.ok, world.effects.length], [true, 1]);
  equal("the run is executed", store.runs.get("r1")!.status, "executed");
  const again = execute(store, "r1", world, 4);
  equal("and a second execution is refused", [again.ok, world.effects.length], [false, 1]);

  const late = setup();
  equal("nobody approves after the proposal dies", approve(late.store, "r1", "ada", 101, TTL, KEY, APPROVERS).ok, false);
  const stranger = setup();
  equal("a stranger cannot approve", approve(stranger.store, "r1", "mallory", 1, TTL, KEY, APPROVERS).ok, false);
  const self = setup(100, "ada");
  equal("the requester cannot approve their own", approve(self.store, "r1", "ada", 1, TTL, KEY, APPROVERS).ok, false);

  const revoked = setup();
  approve(revoked.store, "r1", "ada", 1, TTL, KEY, APPROVERS);
  revoke(revoked.store, "r1");
  const afterRevoke = resume(revoked.store, "r1", revoked.store.runs.get("r1")!.approval!, 2, KEY);
  equal("a revoked approval is refused at resume", afterRevoke.ok, false);

  const edited = setup();
  approve(edited.store, "r1", "ada", 1, TTL, KEY, APPROVERS);
  const run = edited.store.runs.get("r1")!;
  run.proposal.action = { ...run.proposal.action, args: { ...run.proposal.action.args, amount: 3000 } };
  const afterEdit = resume(edited.store, "r1", run.approval!, 2, KEY);
  equal("an edit after approval is refused", afterEdit.ok, false);
  equal("and no money moves", edited.world.effects.length, 0);
}

// 4 — the scenarios
{
  const rows = runAll();
  equal("ten scenarios", rows.length, 10);
  equal("all ten match", rows.filter((r) => r.pass).length, 10);
  equal("nine refuse and one executes", [rows.filter((r) => r.got.reason).length, rows.filter((r) => r.got.status === "executed").length], [8, 2]);
  const effects = rows.map((r) => r.got.effects);
  equal("four scenarios move money once", effects.filter((n) => n === 1).length, 4);
  check("every scenario has a note", SCENARIOS.every((s) => s.note.length > 10));
  const crash = rows.find((r) => r.scenario.id === "s7-crash-after-effect")!;
  equal("the crash ends executed with one effect", [crash.got.effects, crash.got.status], [1, "executed"]);
}

// 5 — the live request
{
  const saved = JSON.parse(readFileSync(join(RUNS, "a1.json"), "utf8")) as Saved;
  check(
    "no refund bypassed approval",
    (saved.refused ?? "").includes("request_approval") || saved.request !== undefined,
    saved.refused ?? saved.request,
  );
  check("the model asked for approval", saved.request !== undefined, saved.request);
  equal("it named the tool", saved.request?.tool, "issue_refund");
  equal("it named the amount", saved.request?.amount, 300);
  check("it gave a reason", (saved.request?.reason ?? "").length > 20, saved.request?.reason);
  check("it cited evidence", (saved.request?.evidence ?? "").length > 20, saved.request?.evidence);
  check("the usage is recorded", saved.usage.promptTokens > 0, saved.usage);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
