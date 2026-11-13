// The harness for the chapter 1 exercises.
//
//   node chapter1/files/exercises/run_exercises.ts

import { solve as solve1 } from "./ex1_solution.ts";
import { solve as solve2 } from "./ex2_solution.ts";
import { solve as solve3 } from "./ex3_solution.ts";
import { demo as projectionDemo, project, ORDER } from "./ex4_projection.ts";
import { action, classify, demo as refusalsDemo, SAMPLES } from "./ex5_refusals.ts";

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

// Exercise 1 — recovery from a refused lookup.
{
  const run = await solve1();
  check("ex1 the failed lookup did not stop the run", run.stopReason === "answered", run.stopReason);
  check("ex1 the refusal is in the transcript", run.steps[0].result.startsWith("Error: unknown SKU"));
  check("ex1 the agent searched instead", run.steps[1].call.name === "search_products");
  check("ex1 the right SKU was read afterwards", run.steps[2].result.includes('"units":12'), run.steps[2].result);
  check("ex1 the answer carries the number", run.answer.includes("12"));
}

// Exercise 2 — the refund is bound to the ticket's order.
{
  const { desk, run } = await solve2();
  check("ex2 the wrong order was refused", run.steps[0].result.includes("refusing to act on ORD-7801"));
  check("ex2 exactly one refund was issued", desk.refunds.length === 1, desk.refunds.length);
  check("ex2 and it was for the ticket's order", desk.refunds[0].orderId === "ORD-7712", desk.refunds[0]);
}

// Exercise 3 — idempotency.
{
  const { desk, run, memory } = await solve3();
  check("ex3 two calls produced two steps", run.steps.length === 2, run.steps.length);
  check("ex3 but only one refund", desk.refunds.length === 1, desk.refunds.length);
  check("ex3 the retry is marked as replayed", run.steps[1].result.includes('"replayed":true'), run.steps[1].result);
  check("ex3 both results name the same refund", JSON.parse(run.steps[0].result).refundId === JSON.parse(run.steps[1].result).refundId);
  check("ex3 the memory holds the refund", memory.size === 1);
}

// Exercise 4 — projection
{
  const r = projectionDemo();
  check("ex4 the full record is large", r.full > 500, r.full);
  check("ex4 the projection is small", r.narrow < 120, r.narrow);
  check("ex4 it keeps the five fields the desk needs", r.fields.length === 5);
  check("ex4 and saves most of the bytes", r.narrow / r.full < 0.15);
  check("ex4 projection keeps values, not references", project(ORDER, ["id"]).id === "ORD-7712");
}

// Exercise 5 — refusals
{
  const rows = refusalsDemo();
  check("ex5 seven samples classified", rows.length === SAMPLES.length);
  check("ex5 a missing tool is a repair", action(classify(rows[0].message)) === "repair");
  check("ex5 a state failure escalates", rows[4].action === "escalate", rows[4]);
  check("ex5 a transport failure reconciles", rows[5].action === "reconcile", rows[5]);
  check("ex5 the unknown escalates rather than guessing", rows[6].action === "escalate", rows[6]);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
