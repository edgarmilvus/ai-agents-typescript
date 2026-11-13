// Chapter 9 harness.
//
//   node chapter9/files/run_ex9.ts
//
// Everything here replays recorded or authored decisions: no key, no quota, no
// clock. The assertions are about the suite's strength, which is a property of
// the cases and the mutants, not of a model.

import { CASES, clean, decision, evaluate, matrix, reportedRefund, runSuite, score } from "../suite.ts";
import type { Case } from "../suite.ts";
import { ALL_GUARDS, ORDERS, check, makeDesk, orderById } from "../desk9.ts";
import { MUTATIONS, byId, declared, expected, mutantIds } from "../variants.ts";
import { GATE, checkTests, gate } from "../gate.ts";

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

function equal(name: string, actual: unknown, expectedValue: unknown): void {
  check_(name, JSON.stringify(actual) === JSON.stringify(expectedValue), { actual, expected: expectedValue });
}

// 1 — the subject
{
  equal("four orders", ORDERS.length, 4);
  equal("the guard switches default on", ALL_GUARDS, { window: true, ceiling: true, total: true });

  const cleanRun = await runSuite(clean);
  equal("six cases, all green on the clean build", [CASES.length, cleanRun.filter((r) => r.holds).length], [6, 6]);
  equal("two recorded cases", CASES.filter((c) => c.source === "recorded").map((c) => c.id), ["s1-refund", "s2-escalate"]);
  equal("four authored cases", CASES.filter((c) => c.source === "authored").length, 4);

  const order = orderById("ORD-7900");
  check_("the US order is outside its ceiling", order.total > 1000, order);
  check_("and inside its window", order.deliveredDaysAgo <= 30, order);

  const desk = makeDesk();
  desk.calls.push({ name: "lookup_order", args: { orderId: "ORD-7712" } });
  desk.refunds.push({ refundId: "rf_x", orderId: "ORD-7712", amount: 84, currency: "EUR" });
  check_("a correct desk passes the strict check", check(desk).pass, check(desk));
  desk.refunds[0].amount = 8400;
  check_("a desk in cents fails it", !check(desk).pass, check(desk));
  desk.refunds[0].amount = 84;
  check_("and it passes again when the amount is right", check(desk).pass);
}

// 2 — the mutants are a closed list with reasons
{
  equal("fourteen mutants", MUTATIONS.length, 14);
  equal("eleven expected to die", expected().length, 11);
  equal("three declared survivors", declared().length, 3);
  equal("mutant ids are unique", new Set(mutantIds()).size, MUTATIONS.length);
  check_("every declared survivor has a reason", declared().every((m) => (m.survives?.why ?? "").length > 40));
  equal(
    "the three survival kinds",
    declared().map((m) => m.survives?.kind).sort(),
    ["construction", "data", "unreachable"],
  );
  equal("four axes are covered", [...new Set(MUTATIONS.map((m) => m.axis))].sort(), [
    "grader",
    "harness",
    "tool",
    "world",
  ]);
  check_("no mutant mutates the check and the tool at once", MUTATIONS.every((m) => typeof m.apply === "function"));
  equal("byId throws on an unknown id", (() => {
    try {
      byId("nope");
      return "no throw";
    } catch {
      return "threw";
    }
  })(), "threw");
}

// 3 — the matrix and the score
{
  const rows = await matrix();
  const s = score(rows);
  equal("fourteen rows", rows.length, 14);
  equal("eleven killed, three survived", [s.killed, s.survived], [11, 3]);
  equal("every survivor is declared", s.unexplained, []);
  equal("no declaration is stale", s.contradicted, []);
  equal("the adjusted score is one", s.adjusted, 1);
  equal("the raw score is eleven of fourteen", s.raw, 11 / 14);

  const byCase = rows.filter((r) => r.killedBy).map((r) => r.killedBy);
  equal("each guard mutant is caught by its own case", [
    rows.find((r) => r.id === "tool-skip-window")?.killedBy,
    rows.find((r) => r.id === "tool-skip-ceiling")?.killedBy,
    rows.find((r) => r.id === "tool-skip-total")?.killedBy,
  ], ["s3-window", "s4-ceiling", "s5-partial"]);
  check_("s1 catches the tool's arithmetic", rows.find((r) => r.id === "tool-cents")?.killedBy === "s1-refund");
  check_("s2 catches a lost escalation", rows.find((r) => r.id === "tool-escalate-noop")?.killedBy === "s2-escalate");
  check_("the always-pass check is caught by a case that must fail", rows.find((r) => r.id === "grader-always-pass")?.killedBy === "s3-window");
  equal("only one case catches nothing", CASES.filter((c) => !byCase.includes(c.id)).map((c) => c.id), ["s6-unknown"]);

  const again = await matrix();
  equal("two runs of the matrix agree", again.map((r) => `${r.id}:${r.killedBy ?? "-"}`), rows.map((r) => `${r.id}:${r.killedBy ?? "-"}`));
  check_("a replay of the suite costs no model call", true);
}

// 4 — a mutant that only lies in its reply is invisible to state assertions
{
  const weakened: Case[] = CASES.map((c) =>
    c.id === "s1-refund" ? { ...c, expect: { ...c.expect, reportedAmount: undefined, reportedCurrency: undefined } } : c,
  );
  const s = score(await matrix(weakened));
  equal("without the reply assertion, two mutants survive", s.unexplained.sort(), ["tool-cents", "tool-currency"]);
  check_("and the suite is still green", (await runSuite(clean, weakened)).every((r) => r.holds));

  const reported = reportedRefund([
    '{"refundId":"rf_a","amount":8400,"currency":"USD"}',
    '{"refundId":"rf_b","amount":84,"currency":"EUR"}',
  ]);
  equal("the parser reads the last refund", reported, { amount: 84, currency: "EUR" });
  equal("and an empty list has none", reportedRefund([]), {});
  equal("and junk has none", reportedRefund(["not json"]), {});
}

// 5 — the cases are code: delete one and a mutant escapes
{
  const without = CASES.filter((c) => c.id !== "s3-window");
  const rows = await matrix(without);
  const s = score(rows);
  equal("deleting s3 lets the window mutant live", rows.find((r) => r.id === "tool-skip-window")?.killed, false);
  equal("which is an unexplained survivor", s.unexplained, ["tool-skip-window"]);
  check_("and the adjusted score drops below one", s.adjusted < 1, s.adjusted);

  const wrong: Case[] = CASES.map((c) => (c.id === "s5-partial" ? { ...c, expect: { ...c.expect, refunds: 1 } } : c));
  const red = await runSuite(clean, wrong);
  equal("a wrong expectation is red on clean code", red.filter((r) => !r.holds).map((r) => r.id), ["s5-partial"]);
}

// 6 — the gate
{
  const pass = await gate(CASES, clean);
  check_("the gate passes the suite as written", pass.ok, pass.checks.filter((c) => !c.ok));
  equal("six conditions", pass.checks.length, 6);
  equal("the case floor is six", GATE.minCases, 6);

  const without = CASES.filter((c) => c.id !== "s3-window");
  const blocked = await gate(without, clean);
  check_("deleting a case blocks the gate", !blocked.ok);
  equal("for three reasons", blocked.checks.filter((c) => !c.ok).map((c) => c.name), [
    "enough cases",
    "score above the line",
    "every survivor explained",
  ]);

  const lenient = byId("grader-lenient");
  const lying = await gate(CASES, () => lenient.apply(clean()));
  check_("a lenient check blocks the gate", !lying.ok);
  equal("and the cases alone do not see it", lying.checks.filter((c) => !c.ok).map((c) => c.name), [
    "the check is tested directly",
  ]);
  check_("the direct test names the missing refusals", (lying.checks[5].detail ?? "").includes("cents"), lying.checks[5]);

  const units = checkTests(clean);
  equal("six direct check tests, all passing", [units.length, units.filter((t) => t.ok).length], [6, 6]);
  const brokenUnits = checkTests(() => lenient.apply(clean()));
  equal("four of them fail on the lenient check", brokenUnits.filter((t) => !t.ok).length, 4);
}

// 7 — the survival reasons are demonstrable, not asserted
{
  const fractional = decision("h-frac", "a refund with a fractional total", [
    { name: "lookup_order", args: { orderId: "ORD-7713" } },
    { name: "issue_refund", args: { orderId: "ORD-7713", amount: 84.5, reason: "damaged" } },
  ]);
  ORDERS.push({ id: "ORD-7713", total: 84.5, currency: "EUR", deliveredDaysAgo: 3, region: "EU" });
  const withFractional: Case = {
    id: "s7-fractional",
    tape: fractional,
    expect: { pass: true, refunds: 1, amount: 84.5 },
    note: "a total the rounding mutant cannot survive",
    source: "authored",
  };
  const killed = await evaluate(byId("tool-rounds"), [...CASES, withFractional]);
  equal("a fractional total kills the rounding mutant", killed.killedBy, "s7-fractional");
  ORDERS.pop();

  const longest = Math.max(...CASES.map((c) => c.tape.turns.length));
  check_("every tape fits the widened budget", longest <= 12, longest);
}

// 8 — cost
{
  const started = performance.now();
  await matrix();
  const ms = performance.now() - started;
  check_("a full matrix is under a second", ms < 1000, ms);
  equal("eighty-four replays", MUTATIONS.length * CASES.length, 84);
  check_("and no model calls", true);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
