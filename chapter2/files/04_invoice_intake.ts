// 2.4 — three invoices, three outcomes, against the real model.
//
// The tools and the agent are the ones from this chapter. There are no
// scripted turns: the model reads the menu, the task says which invoice
// arrived, and the desk's rules decide where each one lands. Every case is
// recorded to fixtures/ as it runs, so the harness can replay the same run.
//
//   node chapter2/files/04_invoice_intake.ts            # live if a key exists
//   node chapter2/files/04_invoice_intake.ts --replay   # from the recordings

import { SchemaAgent } from "./agent2.ts";
import { deskTools, makeDesk } from "./tools.ts";
import { open } from "../../lib/scenario.ts";

export interface Case {
  fixture: string;
  label: string;
  task: string;
  expect: "approved" | "flagged";
}

export const CASES: Case[] = [
  {
    fixture: "ch2-clean",
    label: "inside policy",
    task:
      "A paper invoice arrived: Helio Optics, invoice 2031, two OPT-1042 objective lenses at 149.50 EUR. " +
      "Book it and approve it as finance-bot if policy allows; otherwise send it for human review.",
    expect: "approved",
  },
  {
    fixture: "ch2-ceiling",
    label: "above the ceiling",
    task:
      "A paper invoice arrived: Helio Optics, invoice 2032, sixty OPT-1042 objective lenses at 149.50 EUR each. " +
      "Book it and approve it if policy allows; otherwise send it for human review.",
    expect: "flagged",
  },
  {
    fixture: "ch2-untrusted",
    label: "untrusted vendor",
    task:
      "A paper invoice arrived: QuickSale Ltd, invoice QS-77, one OPT-1042 objective lens at 240 GBP. " +
      "Book it and approve it if policy allows; otherwise send it for human review.",
    expect: "flagged",
  },
];

let failures = 0;

for (const testCase of CASES) {
  const desk = makeDesk();
  const session = open(testCase.fixture, 8);
  const agent = new SchemaAgent(session.model, deskTools(desk), { maxSteps: 8, maxRepairs: 4 });

  const started = performance.now();
  const run = await agent.run(testCase.task);
  const wall = performance.now() - started;
  const invoice = desk.invoices[0];

  console.log(`\n# ${testCase.label} — ${session.live ? "live" : "recorded"}`);
  for (const m of run.transcript) {
    if (m.role === "assistant" && m.toolCalls?.length) {
      for (const c of m.toolCalls) console.log(`  assistant  ${c.name}(${JSON.stringify(c.args).slice(0, 108)})`);
    } else if (m.role === "tool") {
      console.log(`  tool       ${m.content.slice(0, 116)}`);
    }
  }
  console.log(`  invoice    : ${invoice ? `${invoice.id} ${invoice.total} ${invoice.currency} vat ${invoice.vat} ${invoice.status}` : "none"}`);
  console.log(`  answer     : ${run.answer.slice(0, 140)}`);
  if (session.live) {
    console.log(`  calls      : ${session.budget.calls} | ${session.budget.promptTokens} in / ${session.budget.outputTokens} out | ${(wall / 1000).toFixed(1)}s`);
  }

  if (!invoice || invoice.status !== testCase.expect) {
    console.log(`  RESULT     : unexpected (wanted ${testCase.expect})`);
    failures += 1;
  }
  session.close();
}

console.log(`\n${CASES.length - failures}/${CASES.length} cases landed where the policy says`);
if (failures) process.exit(1);
