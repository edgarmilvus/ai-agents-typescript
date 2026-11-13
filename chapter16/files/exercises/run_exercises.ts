// Chapter 16 exercise harness.
//
//   node chapter16/files/exercises/run_exercises.ts
//
// Offline: incidents are data, ledgers are arithmetic, and the book's contracts
// in exercise 5 are a table rather than a parse.

process.env.AGENTLAB_REPLAY = "1";

import { INCIDENTS, demo as owesRows, stops } from "./ex1_owes.ts";
import { LEDGER, demo as coverageRows, coverage, escapes } from "./ex2_coverage.ts";
import { run } from "./ex3_cycle.ts";
import { demo as cycleRows } from "./ex3_run.ts";
import { FIXTURES, demo as staleRows, stale, triage } from "./ex4_stale.ts";
import { BOOK, audit, demo as auditRows, priority } from "./ex5_audit.ts";

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

// 1 — what an incident owes
{
  equal("ex1 four incidents", INCIDENTS.length, 4);
  check("ex1 every incident owes a fixture", INCIDENTS.every((i) => i.owes.includes("fixture")));
  equal("ex1 an injection owes a policy rule", stops("injection"), ["policy-rule", "fixture"]);
  equal("ex1 a double effect owes an approval", stops("double-effect"), ["fixture", "approval"]);
  equal("ex1 the demo keeps the rows", owesRows().length, 4);
  check("ex1 the owes are unique per kind", new Set(stops("wrong-amount")).size === stops("wrong-amount").length);
}

// 2 — coverage
{
  const cov = coverage(LEDGER);
  equal("ex2 six incidents", cov.incidents, 6);
  equal("ex2 three converted", cov.converted, 3);
  equal("ex2 two complete", cov.complete, 2);
  equal("ex2 three open", cov.open, ["b", "e", "f"]);
  equal("ex2 one kind escaped", escapes(LEDGER), ["injection"]);
  check("ex2 the rate is one half", Math.abs(cov.rate - 0.5) < 1e-9, cov.rate);
  equal("ex2 the demo agrees", coverageRows().escapes, ["injection"]);
}

// 3 — the cycle
{
  const rows = cycleRows();
  equal("ex3 two policies", rows.length, 2);
  equal("ex3 money-only converts two", rows[0].converted, 2);
  equal("ex3 and both kinds escape", rows[0].escapes.sort(), ["false-green", "injection"]);
  equal("ex3 every-incident converts six", rows[1].converted, 6);
  equal("ex3 and escapes nothing", rows[1].escapes, []);
  equal("ex3 six weeks", run("money-only").weeks.length, 6);
  equal("ex3 the recurrences are weeks four and five", run("money-only").weeks.filter((w) => w.recurrence).map((w) => w.week), [4, 5]);
}

// 4 — staleness
{
  equal("ex4 five fixtures", FIXTURES.length, 5);
  equal("ex4 two are stale", stale(FIXTURES).map((f) => f.id), ["f3", "f5"]);
  equal("ex4 stale fixtures are re-pointed, not deleted", triage(FIXTURES).filter((d) => d.verdict === "stale").every((d) => d.action.includes("re-point")), true);
  equal("ex4 live fixtures are kept", triage(FIXTURES).filter((d) => d.verdict === "live").every((d) => d.action === "keep"), true);
  equal("ex4 the demo counts them", staleRows().stale, 2);
}

// 5 — the audit
{
  const f = audit(BOOK);
  equal("ex5 six contracts", f.chapters, 6);
  equal("ex5 five harnesses", f.withHarness, 5);
  equal("ex5 four expected strings", f.withExpected, 4);
  equal("ex5 chapter one is legacy", f.legacy, [1]);
  equal("ex5 chapter six has no harness", f.missingHarness, [6]);
  equal("ex5 130 assertions named", f.assertions, 130);
  equal("ex5 nothing is unresolved here", f.unresolved, []);
  equal("ex5 the work order", priority(f), ["add a harness to chapter 6", "rename the legacy keys in chapter 1"]);
  equal("ex5 the demo returns both", Object.keys(auditRows()).sort(), ["findings", "order"]);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
