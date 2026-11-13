// Chapter 11 harness.
//
//   node chapter11/files/run_ex11.ts
//
// Offline: the children are deterministic, the corpus is data, and the three
// live handoffs are read from disk. The assertions are about the seam.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TASKS } from "../corpus.ts";
import type { Packet, Report, Step } from "../contract.ts";
import { blocked, done, incomplete, missing, packetFor, validate } from "../contract.ts";
import { NEEDS, runRole, tokensIn, toolsFor } from "../roles.ts";
import { carried, delegateTool, split, supervise, tree } from "../supervisor.ts";
import { RECORDED, RUNS } from "../runs.ts";
import type { Saved } from "../runs.ts";
import { makeDesk } from "../../chapter1/files/03_support_triage.ts";

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

// 1 — the seam as a type
{
  const task = TASKS[0];
  const clerk = task.steps[0];
  const goal = packetFor(clerk, task, "goal");
  const relay = packetFor(clerk, task, "relay");
  const full = packetFor(clerk, task, "full");

  equal("a goal packet carries no facts", goal.facts, {});
  equal("a relay packet carries what the parent volunteers", carried(relay), ["amount", "orderId", "verdict"]);
  equal("a full packet carries exactly the step's needs", carried(full), ["orderId"]);
  equal("only full carries the constraints", [goal.constraints.length, relay.constraints.length, full.constraints.length], [0, 0, 1]);
  equal("the return schema belongs to the role", full.returnSchema, ["verdict", "region"]);

  equal("missing names the absent fact", missing(clerk, goal), ["orderId"]);
  equal("and nothing is missing from full", missing(clerk, full), []);

  const okReport = done({ verdict: "refund", region: "EU" }, 2, 40);
  equal("a complete report validates", validate(full, okReport).ok, true);
  const short = done({ verdict: "refund" }, 2, 40);
  equal("a report without a promised field is incomplete", validate(full, short).kind, "incomplete");
  const extra = done({ verdict: "refund", region: "EU", note: "hi" }, 2, 40);
  equal("a report with a field nobody asked for is refused", validate(full, extra).kind, "extra");
  const stopped = blocked("missing orderId");
  equal("a blocked report is information, not an error", validate(full, stopped).kind, "blocked");
  equal("incomplete lists every absent field", incomplete(done({}, 0, 0), ["a", "b"]), ["a", "b"]);
}

// 2 — two roles, disjoint tools
{
  const desk = makeDesk();
  const clerk = toolsFor("clerk", desk).map((t) => t.name).sort();
  const cashier = toolsFor("cashier", desk).map((t) => t.name).sort();
  equal("the clerk reads", clerk, ["lookup_order", "refund_policy"]);
  equal("the cashier writes", cashier, ["escalate", "issue_refund"]);
  equal("no tool is in both scopes", clerk.filter((t) => cashier.includes(t)), []);
  equal("the clerk needs one fact", NEEDS.clerk, ["orderId"]);
  equal("the cashier needs three", NEEDS.cashier, ["orderId", "amount", "verdict"]);

  const refund = runRole(
    { role: "cashier", goal: "refund", facts: { orderId: "ORD-7712", amount: 84, verdict: "refund" }, constraints: [], returnSchema: ["action", "reference"] },
    desk,
  );
  equal("the cashier refunds and reports a reference", [refund.status, refund.result.action], ["ok", "refunded"]);
  equal("the desk holds one refund", desk.refunds.length, 1);

  const escalate = runRole(
    { role: "cashier", goal: "escalate", facts: { orderId: "ORD-7801", amount: 640, verdict: "escalate" }, constraints: [], returnSchema: ["action", "reference"] },
    makeDesk(),
  );
  equal("an escalate verdict escalates instead", escalate.result.action, "escalated");

  const thin = runRole({ role: "cashier", goal: "refund", facts: { orderId: "ORD-7712" }, constraints: [], returnSchema: ["action", "reference"] }, makeDesk());
  equal("a thin packet is refused, not guessed", thin.status, "blocked");
  check("and the refusal names both facts", /missing amount, verdict/.test(thin.reason), thin.reason);
  check("the packet's tokens are counted even when it is refused", thin.tokens > 0, thin.tokens);
  equal("a token is four characters, quotes included", tokensIn("abcdefghijklmn"), 4);

  const wrong = runRole(
    { role: "clerk", goal: "check", facts: { orderId: "ORD-7712", verdict: "escalate" }, constraints: [], returnSchema: ["verdict", "region"] },
    makeDesk(),
  );
  equal("the clerk refuses a verdict the policy contradicts", wrong.status, "blocked");
}

// 3 — the corpus
{
  equal("eight tasks", TASKS.length, 8);
  const bad = TASKS.filter((t) => t.steps.some((s: Step) => s.needs.some((k) => NEEDS[s.role].includes(k) === false)));
  equal("every step's needs belong to its role", bad.map((t) => t.id), []);
  const unknown = TASKS.filter((t) => t.steps.some((s) => t.facts[s.needs[0]] === undefined));
  equal("every task owns the facts its first step needs", unknown.map((t) => t.id), []);
}

// 4 — the three fidelities
{
  const count = (mode: "goal" | "relay" | "full") => TASKS.filter((t) => supervise(t, mode).ok).length;
  equal("goal completes nothing", count("goal"), 0);
  equal("relay completes five", count("relay"), 5);
  equal("full completes everything", count("full"), 8);

  const t2 = supervise(TASKS[1], "full");
  equal("the escalation task escalates", t2.ok, true);
  equal("and no refund is written", t2.steps[1].report.result.action, "escalated");

  const t4 = supervise(TASKS[3], "relay");
  equal("the relay packet blocks at the cashier", [t4.ok, t4.blockedAt], [false, 2]);
  check("and the blocking detail names the amount", /amount/.test(t4.answer), t4.answer);

  const t4full = supervise(TASKS[3], "full");
  equal("the same task completes under a full packet", t4full.ok, true);
  equal("the desk is new per task", supervise(TASKS[0], "full").steps[0].report.status, "ok");

  const totals = TASKS.map((t) => supervise(t, "goal")).reduce((n, r) => n + r.calls, 0);
  equal("a goal packet makes no child calls", totals, 0);
}

// 5 — depth, fan-out, budget
{
  const desk = makeDesk();
  const log: Packet[] = [];
  const reports: Report[] = [];
  const parent = delegateTool({ desk, log, reports });
  const child = delegateTool({ desk, log, reports, depth: 1 });
  const ok = JSON.parse(parent.run({ role: "clerk", goal: "read ORD-7712", orderId: "ORD-7712" }) as string);
  equal("a supervisor may delegate", ok.status, "ok");
  const refused = JSON.parse(child.run({ role: "cashier", goal: "refund" }) as string);
  equal("a child may not", refused.status, "refused");
  equal("the refusal does not create a packet", log.length, 1);
  const unknown = JSON.parse(parent.run({ role: "judge", goal: "decide" }) as string);
  equal("an unknown role is refused", unknown.status, "refused");

  equal("two children, depth one", tree(2, 1).nodes, 3);
  equal("three children, depth two", tree(3, 2).nodes, 13);
  equal("and twenty-seven leaves", tree(3, 3).leaves, 27);
  equal("a budget of eight across three", split(8, 3), [4, 2, 2]);
  equal("and it adds up", split(8, 3).reduce((a, b) => a + b, 0), 8);
}

// 6 — the recorded handoffs
{
  equal("three recorded runs", RECORDED.length, 3);
  for (const id of RECORDED) {
    const saved = JSON.parse(readFileSync(join(RUNS, `${id}.json`), "utf8")) as Saved;
    check(`${id} carries a usage record`, saved.usage.calls > 0 && saved.usage.promptTokens > 0, saved.usage);
    check(`${id} wrote at least one packet`, saved.packets.length > 0);
    check(`${id} has an answer`, saved.answer.length > 0);
  }

  const t1 = JSON.parse(readFileSync(join(RUNS, "t1-refund.json"), "utf8")) as Saved;
  equal("the refund run delegated twice", t1.packets.map((p) => p.role), ["clerk", "cashier"]);
  equal("and passed the verdict to the cashier", t1.packets[1].facts.verdict, "refund");
  equal("and the amount", t1.packets[1].facts.amount, 84);

  const t4 = JSON.parse(readFileSync(join(RUNS, "t4-amount-missing.json"), "utf8")) as Saved;
  check("the vague run delegated at least once", t4.packets.length >= 1, t4.packets.length);
  equal("with no facts to pass", Object.keys(t4.packets[0].facts), []);
  const replay = runRole(t4.packets[0], makeDesk());
  equal("so the child refused", [replay.status, /orderId/.test(replay.reason)], ["blocked", true]);

  const complete = RECORDED.filter((id) => {
    const saved = JSON.parse(readFileSync(join(RUNS, `${id}.json`), "utf8")) as Saved;
    const desk = makeDesk();
    return saved.packets.every((p) => validate(p, runRole(p, desk)).ok);
  });
  equal("two of the three tasks were handed over completely", complete.length, 2);
}

// 7 — the seam, not the child
{
  const task = TASKS[3];
  const relay = supervise(task, "relay");
  const full = supervise(task, "full");
  equal("the same child fails under relay", relay.steps[1].report.status, "blocked");
  equal("and succeeds under full", full.steps[1].report.status, "ok");
  equal("the packet is the only difference", [carried(relay.steps[1].packet).includes("amount"), carried(full.steps[1].packet).includes("amount")], [false, true]);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
