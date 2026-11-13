// Chapter 13 exercise harness.
//
//   node chapter13/files/exercises/run_exercises.ts
//
// Offline: every clock is a parameter, every key is a literal, and the live
// request is read by the chapter harness rather than here.

process.env.AGENTLAB_REPLAY = "1";

import { ACTION, KEY, MUTATIONS, check, demo as tokenDemo, fingerprint, issue, stable } from "./ex1_token.ts";
import { TABLE, demo as stateDemo, step } from "./ex2_states.ts";
import { demo as runsDemo } from "./ex3_run.ts";
import { crashAt, demo as crashDemo } from "./ex4_crash.ts";
import { REQUESTS, accepted, demo as requestDemo, score } from "./ex5_request.ts";

let checks = 0;
let failures = 0;

function check_(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check_(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// 1 — the binding
{
  const rows = tokenDemo();
  equal("ex1 five mutations", rows.length, 5);
  equal("ex1 the fresh token is accepted", rows[0].got.ok, true);
  equal("ex1 an edited amount is refused on the action", rows[1].got.ok ? "ok" : rows[1].got.why, "action");
  equal("ex1 another run is refused on the run", rows[2].got.ok ? "ok" : rows[2].got.why, "run");
  equal("ex1 a later clock is refused as expired", rows[3].got.ok ? "ok" : rows[3].got.why, "expired");
  equal("ex1 an earlier clock is refused as future", rows[4].got.ok ? "ok" : rows[4].got.why, "future");
  equal("ex1 the fingerprint ignores key order", fingerprint({ tool: "t", args: { a: 1, b: 2 } }), fingerprint({ tool: "t", args: { b: 2, a: 1 } }));
  equal("ex1 stable sorts keys", stable({ b: 1, a: 2 }), '{"a":2,"b":1}');
  const token = issue({ runId: "r1", actionHash: fingerprint(ACTION), approver: "ada", issuedAt: 1, expiresAt: 10 }, KEY);
  equal("ex1 a token signed with another key fails", check(token, { runId: "r1", action: ACTION, now: 5 }, "other").ok, false);
  equal("ex1 every mutation has a note", MUTATIONS.every((m) => m.note.length > 5), true);
}

// 2 — the states
{
  equal("ex2 the table has twenty rows", TABLE.length, 20);
  equal("ex2 four states and five events", [new Set(TABLE.map((t) => t.from)).size, new Set(TABLE.map((t) => t.event)).size], [4, 5]);
  equal("ex2 approve does not move a pending run", step("pending", "approve").state, "pending");
  equal("ex2 resume approves", step("pending", "resume").state, "approved");
  equal("ex2 execute lands the effect", step("approved", "execute").state, "executed");
  equal("ex2 execute without approval is refused", step("pending", "execute").ok, false);
  equal("ex2 revoking after the effect is refused", step("executed", "revoke").ok, false);
  equal("ex2 a closed run stays closed", step("refused", "resume").ok, false);
  check_("ex2 the demo shows eight walks", stateDemo().length === 8);
  check_("ex2 four walks succeed", stateDemo().filter((r) => r.out.ok).length === 4, stateDemo().filter((r) => r.out.ok).map((r) => `${r.from}/${r.event}`));
}

// 3 — three files
{
  const rows = runsDemo();
  equal("ex3 five scenarios", rows.length, 5);
  equal("ex3 the happy path executes once", [rows[0].status, rows[0].effects], ["executed", 1]);
  equal("ex3 an expired token leaves the run pending", [rows[1].status, rows[1].effects], ["pending", 0]);
  equal("ex3 an edited action is refused", [rows[2].status, rows[2].effects], ["refused", 0]);
  equal("ex3 self approval is refused", rows[3].status, "refused");
  equal("ex3 a revoked approval is refused", rows[4].status, "refused");
  check_("ex3 every refusal has a reason", rows.slice(1).every((r) => (r.reason ?? "").length > 10));
  equal("ex3 no scenario moves money twice", Math.max(...rows.map((r) => r.effects)), 1);
}

// 4 — the crash points
{
  const rows = crashDemo();
  equal("ex4 six crash points", rows.length, 6);
  equal("ex4 every crash ends with one effect", rows.map((r) => r.effects), [1, 1, 1, 1, 1, 1]);
  equal("ex4 every crash ends executed", rows.map((r) => r.status), ["executed", "executed", "executed", "executed", "executed", "executed"]);
  equal("ex4 the effect-after crash reconciles", crashAt(4).note.startsWith("reconciled"), true);
  equal("ex4 the record-after crash refuses the replay", crashAt(5).note.startsWith("replay refused"), true);
  equal("ex4 the earliest crash still executes", crashAt(0).effects, 1);
}

// 5 — the request rubric
{
  const rows = requestDemo();
  equal("ex5 five requests", rows.length, 5);
  equal("ex5 one is accepted", rows.filter((r) => r.accepted).length, 1);
  equal("ex5 the complete one is it", rows[0].accepted, true);
  equal("ex5 a request with no evidence is refused", rows[1].accepted, false);
  equal("ex5 a vague reason is refused", rows[2].accepted, false);
  equal("ex5 an unknown tool is refused", rows[3].accepted, false);
  equal("ex5 prose in a field is refused", rows[4].accepted, false);
  equal("ex5 the rubric has five fields", score(REQUESTS[0].request).length, 5);
  equal("ex5 the failing field is named", rows[2].fields.find((f) => !f.ok)?.name, "reason");
  equal("ex5 acceptance is all five", REQUESTS.every((q) => accepted(q.request) === score(q.request).every((f) => f.ok)), true);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
