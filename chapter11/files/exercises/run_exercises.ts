// Chapter 11 exercise harness.
//
//   node chapter11/files/exercises/run_exercises.ts
//
// Offline: the corpus is data, the children are deterministic, and the cost
// exercise only prices calls it never makes.

process.env.AGENTLAB_REPLAY = "1";

import { CASES, SCHEMA, check, demo as reports } from "./ex1_report.ts";
import { demo as required, omitted, required as needs } from "./ex2_required.ts";
import { TASKS } from "../../corpus.ts";
import { build, gaps, sortedKeys, workable } from "./ex3_packet.ts";
import { run as runChild } from "./ex3_child.ts";
import { demo as packetTable } from "./ex3_run.ts";
import { fits, demo as trees, shape, split } from "./ex4_tree.ts";
import { CHILD, SUPERVISOR, demo as costs, delegated, ratio, single } from "./ex5_cost.ts";
import { makeDesk } from "../../../chapter1/files/03_support_triage.ts";
import { deskTools } from "../../../chapter1/files/03_support_triage.ts";

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

// 1 — the validation table
{
  const rows = reports();
  equal("ex1 five reports", rows.length, 5);
  equal("ex1 one accepted", rows.filter((r) => r.verdict.ok).length, 1);
  equal("ex1 four refused for four reasons", rows.filter((r) => !r.verdict.ok).length, 4);
  equal("ex1 a blocked report is blocked", rows[1].verdict.ok ? "ok" : rows[1].verdict.kind, "blocked");
  equal("ex1 a missing field is incomplete", rows[2].verdict.ok ? "ok" : rows[2].verdict.kind, "incomplete");
  equal("ex1 an extra field is refused", rows[3].verdict.ok ? "ok" : rows[3].verdict.kind, "extra");
  equal("ex1 a string amount is a type error", rows[4].verdict.ok ? "ok" : rows[4].verdict.kind, "wrongType");
  equal("ex1 the schema is two fields", Object.keys(SCHEMA), ["verdict", "amount"]);
  check_("ex1 a blocked report keeps its reason", check({ report: CASES[1].report, schema: SCHEMA }).ok === false);
}

// 2 — what the packet has to carry
{
  const rows = required();
  equal("ex2 eight tasks", rows.length, 8);
  equal("ex2 three tasks lose a fact", rows.filter((r) => r.missing.length > 0).length, 3);
  equal("ex2 the amount is the usual omission", rows.filter((r) => r.missing.includes("amount")).map((r) => r.id).sort(), [
    "t4-amount-missing",
    "t8-region-omitted",
  ]);
  equal("ex2 one task loses the order", rows.find((r) => r.id === "t6-region")?.missing, ["orderId"]);
  equal("ex2 the refund task needs three facts", needs(TASKS[0]), ["amount", "orderId", "verdict"]);
  equal("ex2 the audit task needs one", needs(TASKS[2]), ["orderId"]);
  equal("ex2 omissions are required minus relayed", omitted(TASKS[3]), ["amount"]);
}

// 3 — three files
{
  const groups = packetTable();
  equal("ex3 three modes", groups.map((g) => g.mode), ["goal", "relay", "full"]);
  equal("ex3 completions", groups.map((g) => g.rows.filter((r) => r.ok).length), [0, 5, 8]);

  const task = TASKS[0];
  const full = build(task, task.steps[1], "full");
  equal("ex3 a full packet carries exactly the needs", sortedKeys(full), ["amount", "orderId", "verdict"]);
  equal("ex3 a goal packet carries none", sortedKeys(build(task, task.steps[1], "goal")), []);
  equal("ex3 gaps name the absent needs", gaps(build(task, task.steps[1], "goal"), task.steps[1].needs).sort(), [
    "amount",
    "orderId",
    "verdict",
  ]);
  check_("ex3 a full packet is workable", workable(full, task.steps[1].needs));

  // The child takes the tools as an argument, so it can be tested with a table.
  const fake = (name: string) =>
    name === "lookup_order"
      ? JSON.stringify({ id: "ORD-7712", total: 84, currency: "EUR", deliveredDaysAgo: 6, region: "EU" })
      : JSON.stringify({ windowDays: 14, maxAutoRefund: 500 });
  const clerk = runChild({ role: "clerk", goal: "check", facts: { orderId: "ORD-7712" }, constraints: [] }, fake);
  equal("ex3 the child works against a fake", [clerk.status, clerk.result.verdict], ["ok", "refund"]);
  const thin = runChild({ role: "cashier", goal: "pay", facts: { orderId: "ORD-7712" }, constraints: [] }, fake);
  equal("ex3 and refuses a thin packet", [thin.status, /amount/.test(thin.reason)], ["blocked", true]);

  const desk = makeDesk();
  const real = (name: string, args: Record<string, unknown>) => {
    const tool = deskTools(desk).find((t) => t.name === name);
    if (!tool) throw new Error(`no ${name}`);
    const value = tool.run(args);
    return typeof value === "string" ? value : "";
  };
  const paid = runChild(
    { role: "cashier", goal: "pay", facts: { orderId: "ORD-7712", amount: 84, verdict: "refund" }, constraints: [] },
    real,
  );
  equal("ex3 the wiring reaches the real desk", [paid.status, desk.refunds.length], ["ok", 1]);
}

// 4 — trees and budgets
{
  equal("ex4 two by one", shape(2, 1).nodes, 3);
  equal("ex4 three by two", shape(3, 2).nodes, 13);
  equal("ex4 four by three", shape(4, 3).nodes, 85);
  equal("ex4 leaves are the last level", shape(4, 3).leaves, 64);
  equal("ex4 a split keeps the total", split(20, 3).reduce((a, b) => a + b, 0), 20);
  equal("ex4 three children of twenty", split(20, 3), [8, 6, 6]);
  equal("ex4 a tree of three nodes fits twenty", fits(20, shape(2, 1)), true);
  equal("ex4 a tree of eighty-five does not", fits(20, shape(4, 3)), false);
  equal("ex4 the demo has five rows", trees().length, 5);
  check_("ex4 the rows are ordered by cost", trees().every((r, i, all) => i === 0 || r.nodes >= all[i - 1].nodes));
}

// 5 — the seam, priced
{
  equal("ex5 the supervisor is measured", [SUPERVISOR.calls, SUPERVISOR.prompt], [3, 1086]);
  equal("ex5 two steps cost seven calls", delegated(2).calls, 7);
  equal("ex5 and 1,926 prompt tokens", delegated(2).prompt, 1926);
  check_("ex5 delegation loses at two steps", ratio(2) > 1, ratio(2));
  check_("ex5 delegation wins at eight", ratio(8) < 1, ratio(8));
  equal("ex5 the single path grows with history", single(4).prompt > single(2).prompt, true);
  equal("ex5 two steps of single agent", single(2).prompt, 1060);
  equal("ex5 the child estimate is used per step", delegated(4).prompt - delegated(2).prompt, CHILD.prompt * 2);
  equal("ex5 the demo prices three sizes", costs().length, 3);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
