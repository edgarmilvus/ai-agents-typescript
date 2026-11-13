// 5.2 — partial credit, and why a binary pass hides the interesting case.
//
// A run can be right, nearly right, or right for the wrong reason. A rubric
// scores the parts; the suite still decides pass or fail on the effect, and
// reports the score beside it.

import { Agent, ReplayModel, toolCall } from "../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../chapter1/files/03_support_triage.ts";
import { recorded } from "../../lib/scenario.ts";
import { runSuite, state, rubricGrader, stepGrader, explanationGrader, summarise } from "../grading.ts";
import type { Case, Rubric } from "../grading.ts";

const TASK = "A customer says the headphones arrived damaged and wants a full refund. Order ORD-7712. Refund it if policy allows, otherwise escalate to a human.";

const rubrics: Rubric[] = [
  { name: "refunded the right amount", weight: 3, score: (_run, world) => ((world as { refunds: { amount: number }[] }).refunds[0]?.amount === 84 ? 1 : 0) },
  { name: "used the policy tool", weight: 1, score: (run) => (run.steps.some((s) => s.call.name === "refund_policy") ? 1 : 0) },
  { name: "explained itself", weight: 1, score: (run) => (run.answer.length > 40 ? 1 : 0.4) },
  { name: "did not wander", weight: 1, score: (run) => (run.steps.length <= 4 ? 1 : 0.5) },
];

const cases: Case[] = [
  {
    id: "recorded-run",
    about: "the real run: right effect, right route",
    expect: state("one refund of 84", (world) => (world as { refunds: unknown[] }).refunds.length === 1),
  },
  {
    id: "answer-only",
    about: "a model that answers without calling anything",
    expect: state("one refund of 84", (world) => (world as { refunds: unknown[] }).refunds.length === 1),
  },
];

async function runCase(testCase: Case) {
  const desk = makeDesk();
  if (testCase.id === "recorded-run") {
    return { run: await new Agent(recorded("ch1-inside"), deskTools(desk)).run(TASK), world: desk };
  }
  const model = new ReplayModel([{ text: "I have refunded the order in full. You should see it in three days." }]);
  return { run: await new Agent(model, deskTools(desk)).run(TASK), world: desk };
}

const report = await runSuite(cases, runCase, [rubricGrader(rubrics), stepGrader(5), explanationGrader]);

console.log("# scores");
for (const r of report.results) {
  console.log(`  ${r.id.padEnd(13)} ${r.passed ? "pass" : "fail"}  score ${r.score.toFixed(2)}  ${r.about}`);
  for (const d of r.detail) console.log(`      ${d.grader.padEnd(12)} ${d.score}`);
}
console.log("\n  " + summarise(report));
console.log("  by grader:", JSON.stringify(report.byGrader));
