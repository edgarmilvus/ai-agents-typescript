// 5.3 — triage: why did the suite fail?
//
// A rate without a reason is a number nobody can act on. This groups failures
// by the fact that explains them, and the grouping is mechanical.

import { Agent, ReplayModel, toolCall } from "../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../chapter1/files/03_support_triage.ts";
import { recorded } from "../../lib/scenario.ts";
import { runSuite, state, triage, summarise, effectGrader } from "../grading.ts";
import type { Case } from "../grading.ts";

const TASK = "Refund order ORD-7712 in full.";

const cases: Case[] = [
  {
    id: "ok",
    about: "the recorded run",
    expect: state("one refund", (w) => (w as { refunds: unknown[] }).refunds.length === 1),
  },
  {
    id: "no-tools",
    about: "a model that only talks",
    expect: state("one refund", (w) => (w as { refunds: unknown[] }).refunds.length === 1),
  },
  {
    id: "wrong-amount",
    about: "a model that refunds the wrong figure",
    expect: state("one refund of 84", (w) => {
      const desk = w as { refunds: { amount: number }[] };
      return desk.refunds.length === 1 && desk.refunds[0].amount === 84;
    }),
  },
  {
    id: "too-many-steps",
    about: "a model that loops before answering",
    expect: state("one refund of 84", (w) => {
      const desk = w as { refunds: { amount: number }[] };
      return desk.refunds.length === 1 && desk.refunds[0].amount === 84;
    }),
  },
];

async function runCase(c: Case) {
  const desk = makeDesk();
  if (c.id === "ok") return { run: await new Agent(recorded("ch1-inside"), deskTools(desk)).run(TASK), world: desk };
  if (c.id === "no-tools") {
    return { run: await new Agent(new ReplayModel([{ text: "Done — the refund has been issued." }]), deskTools(desk)).run(TASK), world: desk };
  }
  if (c.id === "wrong-amount") {
    const model = new ReplayModel([
      { toolCalls: [toolCall("issue_refund", { orderId: "ORD-7712", amount: 48, reason: "partial" }, "w1")] },
      { text: "Refunded." },
    ]);
    return { run: await new Agent(model, deskTools(desk)).run(TASK), world: desk };
  }
  const loop = Array.from({ length: 8 }, (_, i) => ({ toolCalls: [toolCall("refund_policy", { region: "EU" }, `l${i}`)] }));
  return { run: await new Agent(new ReplayModel([...loop, { text: "Done." }]), deskTools(desk)).run(TASK), world: desk };
}

const report = await runSuite(cases, runCase, [effectGrader]);
console.log("# " + summarise(report));
for (const r of report.results) console.log(`  ${r.passed ? "pass" : "FAIL"}  ${r.id.padEnd(15)} steps ${String(r.steps).padEnd(2)} ${r.stopReason.padEnd(9)} ${r.reasons[0] ?? ""}`);
console.log("\n# triage");
for (const [kind, ids] of Object.entries(triage(report, 6))) {
  if (ids.length) console.log(`  ${kind.padEnd(16)} ${ids.join(", ")}`);
}
