// Exercise 3, file 3 of 3 — the wiring, and the two tables.
//
// The first table is the decision for each action: which rule fired, and which
// others would have. The second is the count per rule, because a rule that
// never decides anything is a rule nobody can evaluate.

import { ACTIONS, RULES } from "./ex3_rules.ts";
import { contested, evaluate, firstRule, run } from "./ex3_engine.ts";

const evaluations = run(RULES, ACTIONS);

export function demo() {
  return { evaluations, counts: firstRule(evaluations), contested: contested(evaluations) };
}

export function report(d: ReturnType<typeof demo>): void {
  console.log("# seven actions through three rules\n");
  console.log("  action               decision   first rule   also fired");
  for (const row of d.evaluations) {
    const also = row.candidates.slice(1).join(", ") || "-";
    console.log(`  ${row.action.padEnd(20)} ${row.decision.kind.padEnd(10)} ${row.decision.rule.padEnd(12)} ${also}`);
  }

  console.log("\n# which rule decided\n");
  for (const [rule, n] of Object.entries(d.counts)) console.log(`  ${rule.padEnd(12)} ${n}`);

  console.log(`\n# ${d.contested.length} action(s) had more than one rule apply`);
  for (const row of d.contested) console.log(`  ${row.action.padEnd(20)} ${row.candidates.join(" > ")}`);

  const single = evaluate([], ACTIONS[0]);
  console.log(`\n  the engine with no rules allows everything: ${single.decision.kind}.`);
  console.log("  That is not a bug in the engine; it is the seam that lets a test replace the");
  console.log("  policy without touching the evaluator.");
}

if (import.meta.main) report(demo());
