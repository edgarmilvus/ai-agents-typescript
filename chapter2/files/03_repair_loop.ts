// 2.3 — repair, with a budget.
//
// A model that gets the shape wrong should be told precisely what is wrong,
// once or twice, and then the loop should stop. This is that conversation,
// with the cost of each refusal measured.

import { ReplayModel, toolCall } from "../../chapter1/files/agent.ts";
import { SchemaAgent } from "./agent2.ts";
import { deskTools, makeDesk } from "./tools.ts";

const desk = makeDesk();

const model = new ReplayModel([
  // 1. the invoice as the model imagined it: a name instead of an id, a date
  //    in the vendor's format, quantity as a string.
  {
    toolCalls: [
      toolCall(
        "create_invoice",
        {
          vendorId: "Helio Optics",
          number: "2031",
          issued: "12/03/2026",
          currency: "EUR",
          lines: [{ sku: "OPT-1042", description: "Objective lens", quantity: "2", unitPrice: 149.5 }],
        },
        "r1",
      ),
    ],
  },
  // 2. after the refusal: the id is looked up instead of guessed.
  { toolCalls: [toolCall("lookup_vendor", { name: "helio" }, "r2")] },
  // 3. and the invoice is retried with the right shape.
  {
    toolCalls: [
      toolCall(
        "create_invoice",
        {
          vendorId: "v_helio",
          number: "2031",
          issued: "2026-03-12",
          currency: "EUR",
          lines: [{ sku: "OPT-1042", description: "Objective lens", quantity: 2, unitPrice: 149.5 }],
        },
        "r3",
      ),
    ],
  },
  { text: "Invoice inv_1 created: 299 EUR plus 56.81 VAT." },
]);

const agent = new SchemaAgent(model, deskTools(desk), { maxRepairs: 2 });
const run = await agent.run("Book in Helio Optics invoice 2031 for two OPT-1042 lenses at 149.50.");

console.log("# the repair conversation");
for (const attempt of run.attempts) {
  const label = attempt.repaired ? "refused " : "ran     ";
  console.log(`${label} ${attempt.call.name}(${JSON.stringify(attempt.call.args).slice(0, 70)}…)`);
  if (attempt.issues.length) {
    for (const issue of attempt.issues) console.log(`          ${issue.path}: ${issue.message}`);
  } else {
    console.log(`          ${(attempt.result ?? "").slice(0, 90)}`);
  }
}

console.log("\n# the run");
console.log("stop reason   :", run.stopReason);
console.log("attempts      :", run.attempts.length, "| refused:", run.attempts.filter((a) => a.repaired).length);
console.log("repair chars  :", run.repairChars, "≈", Math.round(run.repairChars / 4), "tokens sent back");
console.log("invoices      :", desk.invoices.length, "| total:", desk.invoices[0]?.total, "| vat:", desk.invoices[0]?.vat);
console.log("answer        :", run.answer);
