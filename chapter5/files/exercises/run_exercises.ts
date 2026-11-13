// Chapter 5 exercise harness.
//
//   node chapter5/files/exercises/run_exercises.ts

import { demo as failingDemo, gradeRefund } from "./ex1_failing_grader.ts";
import { demo as weightsDemo, weighted } from "./ex2_weights.ts";
import { classify, demo as orderDemo } from "./ex3_order.ts";
import { demo as thinDemo, report, MIN_CASES } from "./ex4_thin.ts";
import { build, demo as stabilityDemo, same } from "./ex5_stability.ts";

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

// 1 — a grader that fails
{
  const r = failingDemo();
  check("ex1 a good run passes", r.good.passed);
  check("ex1 a wrong amount fails", !r.wrongAmount.passed);
  check("ex1 and says both numbers", r.wrongAmount.reasons[0].includes("48") && r.wrongAmount.reasons[0].includes("84"));
  check("ex1 refunding without reading the policy fails", !r.noPolicy.passed);
  check("ex1 nothing refunded fails", !r.nothing.passed);
  const verdict = gradeRefund({ stopReason: "step_limit", steps: [], answer: "" } as never, { refunds: [] }, 84);
  check("ex1 a step limit is a failure too", !verdict.passed && verdict.reasons[0].includes("step_limit"));
}

// 2 — weights
{
  const r = weightsDemo();
  equal("ex2 all good is 1.00", r.allGood, 1);
  equal("ex2 one light dimension missing is 0.75", r.oneMissing, 0.75);
  equal("ex2 a heavy dimension missing is 0.25", r.heavyMissing, 0.25);
  equal("ex2 scores are clamped", r.clamped, 0.5);
  equal("ex2 no weights means no score", r.empty, 0);
  equal("ex2 weights normalise", weighted([{ name: "a", weight: 1, score: 1 }, { name: "b", weight: 3, score: 0 }]), 0.25);
}

// 3 — the diagnosis order
{
  const rows = orderDemo();
  equal("ex3 a silent run is no-action", rows[0].kind, "no-action");
  equal("ex3 a step limit outranks everything", rows[1].kind, "too-many-steps");
  equal("ex3 a crash is no-answer", rows[2].kind, "no-answer");
  equal("ex3 a wrong effect is the residual", rows[3].kind, "wrong-effect");
  equal("ex3 classify uses the run, not the prose", classify({ steps: 1, stopReason: "step_limit", reasons: ["expected: x"] }), "too-many-steps");
}

// 4 — the thin sample
{
  const rows = thinDemo();
  equal("ex4 no cases is not a rate", rows[0].text, "no cases: nothing was measured");
  check("ex4 three cases refuse to quote a rate", rows[1].text.includes("too small"));
  equal("ex4 five cases quote one", rows[2].text, "4/5 passed (80%)");
  equal("ex4 twenty cases quote one", rows[3].text, "19/20 passed (95%)");
  equal("ex4 the threshold is a constant", MIN_CASES, 5);
  check("ex4 the message says the minimum", report({ total: 2, passed: 2 }).includes(String(MIN_CASES)));
}

// 5 — stability
{
  const r = stabilityDemo();
  check("ex5 the same suite gives the same report", r.identical);
  check("ex5 a different outcome does not", !r.different);
  equal("ex5 duplicate ids are counted once", build(["a", "a", "b"], ["a"]).total, 2);
  equal("ex5 an empty suite is stable", same(build([], []), build([], [])), true);
  equal("ex5 the rate is derived, not stored", build(["a", "b"], ["a"]).rate, 0.5);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
