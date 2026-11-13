// Chapter 5 harness — grading, rubrics, triage.
//
//   node chapter5/files/run_ex5.ts

import { Agent, ReplayModel, toolCall } from "../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../chapter1/files/03_support_triage.ts";
import { recorded } from "../../lib/scenario.ts";
import {
  runSuite, state, transcript, summarise, triage, classifyFailure,
  effectGrader, explanationGrader, stepGrader, rubricGrader, THIN_SAMPLE,
} from "../grading.ts";
import type { Case, Check, Report } from "../grading.ts";

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

const TASK = "A customer says the headphones arrived damaged and wants a full refund. Order ORD-7712. Refund it if policy allows.";

const oneRefund: Check = state("one refund of 84", (w) => {
  const desk = w as { refunds: { amount: number }[] };
  return desk.refunds.length === 1 && desk.refunds[0].amount === 84;
});

function recordings(list: { id: string; fixture: string }[]): Case[] {
  return list.map((c) => ({ id: c.id, about: c.fixture, expect: oneRefund }));
}

// ---------------------------------------------------------------- 5.1 a suite

{
  const cases: Case[] = [
    { id: "inside", about: "recorded run", expect: oneRefund },
    { id: "silent", about: "no tools", expect: oneRefund },
  ];
  const report = await runSuite(
    cases,
    async (c) => {
      const desk = makeDesk();
      if (c.id === "inside") return { run: await new Agent(recorded("ch1-inside"), deskTools(desk)).run(TASK), world: desk };
      return { run: await new Agent(new ReplayModel([{ text: "Done, refunded." }]), deskTools(desk)).run(TASK), world: desk };
    },
    [effectGrader],
  );

  equal("5.1 the report counts what it ran", report.total, 2);
  equal("5.1 the denominator is the sample", report.passed, 1);
  equal("5.1 the rate is a fraction", report.rate, 0.5);
  check("5.1 a small sample is flagged", report.thin);
  check("5.1 the summary says so", summarise(report).includes("thin sample"));
  equal("5.1 a failure carries its expected state", report.results[1].reasons[0].startsWith("expected:"), true);
  equal("5.1 and its steps", report.results[1].steps, 0);
}

// ------------------------------------------------------- 5.2 checks and truth

{
  const run = await new Agent(recorded("ch1-inside"), deskTools(makeDesk())).run(TASK);
  check("5.2 a state check sees the world", state("x", (w) => (w as { refunds: unknown[] }).refunds.length === 1).passed(run, { refunds: [{}] }));
  check("5.2 and can fail", !state("x", (w) => (w as { refunds: unknown[] }).refunds.length === 1).passed(run, { refunds: [] }));
  check("5.2 a transcript check sees the run", transcript("y", (r) => r.steps.length > 0).passed(run, null));
  check("5.2 an effect grader fails a step limit", effectGrader.score({ ...run, stopReason: "step_limit" }, null) === 0);
}

// ------------------------------------------------------------- 5.3 the rubric

{
  const rubrics = [
    { name: "amount", weight: 3, score: (_r: unknown, w: unknown) => ((w as { refunds: { amount: number }[] }).refunds[0]?.amount === 84 ? 1 : 0) },
    { name: "policy", weight: 1, score: (r: { steps: { call: { name: string } }[] }) => (r.steps.some((s) => s.call.name === "refund_policy") ? 1 : 0) },
  ];
  const grader = rubricGrader(rubrics as never);
  const good = await new Agent(recorded("ch1-inside"), deskTools(makeDesk())).run(TASK);
  equal("5.3 a full rubric scores 1", grader.score(good, { refunds: [{ amount: 84 }] }), 1);
  equal("5.3 a missing weight costs proportionally", grader.score(good, { refunds: [{ amount: 48 }] }), 0.25);
  check("5.3 weights are normalised", rubricGrader([{ name: "a", weight: 2, score: () => 1 }, { name: "b", weight: 2, score: () => 0 }] as never).score(good, null) === 0.5);
  equal("5.3 a step budget scores partial credit", stepGrader(2).score({ ...good, steps: [1, 2, 3, 4] as never }, null), 0);
  equal("5.3 an explanation grader accepts a sentence", explanationGrader.score(good, null), 1);
}

// ------------------------------------------------------------ 5.4 the triage

{
  const report: Report = {
    total: 3,
    passed: 0,
    rate: 0,
    thin: true,
    byGrader: {},
    results: [
      { id: "silent", about: "", passed: false, score: 0, detail: [], reasons: ["expected: one refund"], steps: 0, stopReason: "answered" },
      { id: "looped", about: "", passed: false, score: 0, detail: [], reasons: [], steps: 8, stopReason: "step_limit" },
      { id: "wrong", about: "", passed: false, score: 0, detail: [], reasons: ["expected: one refund of 84"], steps: 2, stopReason: "answered" },
    ],
  };
  const t = triage(report, 6);
  equal("5.4 a silent run is no-action", t["no-action"], ["silent"]);
  equal("5.4 a step limit is too-many-steps", t["too-many-steps"], ["looped"]);
  equal("5.4 the rest is wrong-effect", t["wrong-effect"], ["wrong"]);
  equal("5.4 classification uses the run", classifyFailure(report.results[1]), "too-many-steps");
  equal("5.4 the thin threshold is a constant", THIN_SAMPLE, 5);
}

// -------------------------------------------------- 5.5 a suite that can fail

{
  const alwaysPass = [effectGrader];
  const cases: Case[] = [{ id: "broken", about: "a model that never acts", expect: oneRefund }];
  const report = await runSuite(
    cases,
    async () => ({ run: await new Agent(new ReplayModel([{ text: "all done" }]), deskTools(makeDesk())).run(TASK), world: makeDesk() }),
    alwaysPass,
  );
  equal("5.5 a suite with a failing case is not green", report.passed, 0);
  equal("5.5 and the rate says zero", report.rate, 0);

  const empty = await runSuite([], async () => ({ run: {} as never, world: {} }), []);
  equal("5.5 an empty suite has no rate to quote", empty.total, 0);
  check("5.5 and is flagged thin", empty.thin);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
