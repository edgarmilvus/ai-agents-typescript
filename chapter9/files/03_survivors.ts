// 9.3 — three survivors, and three different reasons.
//
// "Survived" is not one fact. A mutant can survive because the data cannot
// reach it, because the change it makes cannot be observed by construction, or
// because the case that would catch it was never written. Each reason leads to
// a different repair, and only one of them is "write a better assertion".

import { ORDERS, check, makeDesk } from "../desk9.ts";
import { CASES, clean, decision, evaluate, runSuite } from "../suite.ts";
import type { Case } from "../suite.ts";
import { byId } from "../variants.ts";

// 1 — the data. Every total in the table is a whole number, so rounding is the
// identity. Add a fractional order and the mutant has something to break.
ORDERS.push({ id: "ORD-7713", total: 84.5, currency: "EUR", deliveredDaysAgo: 3, region: "EU" });
const fractional: Case = {
  id: "s7-fractional",
  tape: decision("h-fractional", "a refund of an order with a fractional total", [
    { name: "lookup_order", args: { orderId: "ORD-7713" } },
    { name: "issue_refund", args: { orderId: "ORD-7713", amount: 84.5, reason: "damaged" } },
  ]),
  expect: { pass: true, refunds: 1, amount: 84.5 },
  note: "a total the rounding mutant cannot survive",
  source: "authored",
};

console.log("# survivor 1 — tool-rounds, declared because of the data\n");
const rounds = byId("tool-rounds");
const before = await evaluate(rounds);
console.log(`  with the six cases      : ${before.killed ? `killed by ${before.killedBy}` : "survives"}`);
const after = await evaluate(rounds, [...CASES, fractional]);
console.log(`  with a fractional order : ${after.killed ? `killed by ${after.killedBy}` : "survives"}`);
console.log("  the mutant did not change. The corpus did.\n");

// 2 — the construction. A budget change is invisible to every tape that fits.
console.log("# survivor 2 — harness-budget-12, declared because of the construction\n");
const longest = Math.max(...CASES.map((c) => c.tape.turns.length));
const budget = byId("harness-budget-12");
const wide = await evaluate(budget);
console.log(`  longest tape : ${longest} turns`);
console.log(`  mutant budget: 12 turns`);
console.log(`  outcome      : ${wide.killed ? `killed by ${wide.killedBy}` : "survives — nothing can observe the difference"}`);
console.log("  a larger budget is not a bug a case can see; it is a bug a clock sees.\n");

// 3 — the missing case. A lenient check only fails something that happened, and
// every refusal leaves the desk empty, so the suite cannot tell it is broken.
console.log("# survivor 3 — grader-lenient, declared because it takes a second break\n");
const lenient = byId("grader-lenient");
const row = await evaluate(lenient);
console.log(`  suite verdict : ${row.killed ? `killed by ${row.killedBy}` : "survives"}`);

const wrong = makeDesk();
wrong.calls.push({ name: "lookup_order", args: { orderId: "ORD-7712" } });
wrong.refunds.push({ refundId: "rf_wrong", orderId: "ORD-7712", amount: 8400, currency: "EUR" });
const subject = lenient.apply(clean());
subject.desk.calls.push({ name: "lookup_order", args: { orderId: "ORD-7712" } });
subject.desk.refunds.push({ refundId: "rf_wrong", orderId: "ORD-7712", amount: 8400, currency: "EUR" });
console.log(`  strict check, wrong amount : pass=${check(wrong).pass}`);
console.log(`  mutant check, same desk    : pass=${subject.check().pass}`);

console.log("  the check is not wrong about a run; it is wrong about what a check is for.");
console.log("  the assertion that catches it is a unit test of check(), not another tape.\n");

const all = await runSuite(clean);
console.log(`  suite still green: ${all.filter((r) => r.holds).length}/${all.length}`);
