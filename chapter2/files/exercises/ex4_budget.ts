// Exercise 4 — a repair budget that actually stops.
//
// A model can be persistently wrong. The loop must spend a bounded amount of
// the context on refusals and then escalate, rather than rephrasing the same
// error until the step ceiling.

import { ReplayModel, toolCall } from "../../../chapter1/files/agent.ts";
import type { ModelReply } from "../../../chapter1/files/agent.ts";
import { SchemaAgent } from "../agent2.ts";
import { deskTools, makeDesk } from "../tools.ts";

export async function demo(maxRepairs = 1) {
  const desk = makeDesk();
  const stuck: ModelReply[] = Array.from({ length: 8 }, (_, i) => ({
    toolCalls: [toolCall("create_invoice", { vendorId: "Helio", number: "1" }, `s${i}`)],
  }));
  const agent = new SchemaAgent(new ReplayModel(stuck), deskTools(desk), { maxRepairs, maxSteps: 8 });
  const run = await agent.run("Book this invoice.");
  return { run, desk };
}

if (import.meta.main) {
  const { run, desk } = await demo(1);
  console.log("stop reason :", run.stopReason);
  console.log("attempts    :", run.attempts.length, "| refused:", run.attempts.filter((a) => a.repaired).length);
  console.log("repair chars:", run.repairChars);
  console.log("invoices    :", desk.invoices.length);
  console.log("answer      :", run.answer);
}
