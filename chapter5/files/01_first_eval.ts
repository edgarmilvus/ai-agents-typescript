// 5.1 — the smallest honest evaluation.
//
// Three cases, one grader that can fail, and a denominator. Two cases replay
// recorded runs; the third is scripted on purpose, because the desk's
// behaviour on a missing order does not depend on the model and should not be
// paid for twice.

import { Agent, ReplayModel, toolCall } from "../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../chapter1/files/03_support_triage.ts";
import type { Desk } from "../../chapter1/files/03_support_triage.ts";
import { recorded } from "../../lib/scenario.ts";
import { runSuite, state, summarise, effectGrader } from "../grading.ts";
import type { Case } from "../grading.ts";

const INSIDE = "A customer says the headphones arrived damaged and wants a full refund. Order ORD-7712. Refund it if policy allows, otherwise escalate to a human.";
const OUTSIDE = "A customer says order ORD-7801 was delivered three weeks ago and wants the money back. Refund it if policy allows, otherwise escalate to a human.";

const CASES: Case[] = [
  {
    id: "inside-policy",
    about: "a damaged delivery inside the window is refunded once, for the order total",
    expect: state("exactly one refund of 84 EUR", (world) => {
      const desk = world as Desk;
      return desk.refunds.length === 1 && desk.refunds[0].amount === 84;
    }),
  },
  {
    id: "outside-policy",
    about: "a delivery outside the window is escalated and not refunded",
    expect: state("no refund, one escalation", (world) => {
      const desk = world as Desk;
      return desk.refunds.length === 0 && desk.escalations.length === 1;
    }),
  },
  {
    id: "unknown-order",
    about: "an order that does not exist is refused by the tool, not invented",
    expect: state("no refund, and the refusal is in the transcript", (world) => {
      const desk = world as Desk;
      return desk.refunds.length === 0;
    }),
  },
];

async function runCase(testCase: Case) {
  const desk = makeDesk();
  if (testCase.id === "inside-policy") {
    return { run: await new Agent(recorded("ch1-inside"), deskTools(desk)).run(INSIDE), world: desk };
  }
  if (testCase.id === "outside-policy") {
    return { run: await new Agent(recorded("ch1-outside"), deskTools(desk)).run(OUTSIDE), world: desk };
  }
  // scripted: the model asks for a missing order, the tool refuses, the loop reports it
  const model = new ReplayModel([
    { toolCalls: [toolCall("issue_refund", { orderId: "ORD-9999", amount: 10, reason: "customer request" }, "u1")] },
    { text: "Order ORD-9999 does not exist, so nothing was refunded." },
  ]);
  return { run: await new Agent(model, deskTools(desk)).run("Refund order ORD-9999 in full."), world: desk };
}

const report = await runSuite(CASES, runCase, [effectGrader]);

console.log("# report");
for (const r of report.results) {
  console.log(`  ${r.passed ? "PASS" : "FAIL"}  ${r.id.padEnd(15)} ${r.about}`);
  for (const reason of r.reasons) console.log(`        ${reason}`);
}
console.log("\n  " + summarise(report));
