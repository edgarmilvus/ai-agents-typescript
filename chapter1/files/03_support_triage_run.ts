// The two tickets, against the real model.
//
//   node chapter1/files/03_support_triage_run.ts            # live if a key exists
//   node chapter1/files/03_support_triage_run.ts --replay   # from the recordings

import { Agent } from "./agent.ts";
import { CASES, deskTools, makeDesk } from "./03_support_triage.ts";
import { open } from "../../lib/scenario.ts";

let failures = 0;

for (const testCase of CASES) {
  const desk = makeDesk();
  const session = open(testCase.fixture, 8);
  const agent = new Agent(session.model, deskTools(desk), { maxSteps: 7 });

  const started = performance.now();
  const run = await agent.run(testCase.task);
  const wall = performance.now() - started;

  console.log(`\n# ${testCase.label} — ${session.live ? "live" : "recorded"}`);
  for (const m of run.transcript) {
    if (m.role === "assistant" && m.toolCalls?.length) {
      for (const c of m.toolCalls) console.log(`  assistant  ${c.name}(${JSON.stringify(c.args).slice(0, 104)})`);
    } else if (m.role === "tool") {
      console.log(`  tool       ${m.content.slice(0, 112)}`);
    }
  }
  console.log(`  refunds    : ${desk.refunds.length} | escalations: ${desk.escalations.length}`);
  console.log(`  answer     : ${run.answer.slice(0, 130)}`);
  if (session.live) {
    console.log(`  calls      : ${session.budget.calls} | ${session.budget.tokens ?? ""} ${session.budget.promptTokens} in / ${session.budget.outputTokens} out | ${(wall / 1000).toFixed(1)}s`);
  }

  const ok = desk.refunds.length === testCase.expect.refunds && desk.escalations.length === testCase.expect.escalations;
  if (!ok) { console.log("  RESULT     : unexpected"); failures += 1; }
  session.close();
}

console.log(`\n${CASES.length - failures}/${CASES.length} tickets landed where the policy says`);
if (failures) process.exit(1);
