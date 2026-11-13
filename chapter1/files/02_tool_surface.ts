// 1.2 — the tool surface: what is allowed in, and what comes back out.
//
// Three ways a model can get a tool call wrong, and what the loop does with
// each: an unknown name, a wrong type, a value the tool refuses. None of them
// throws, none of them reaches `run` when the schema says no, and each one
// gives the model something it can act on.

import { Agent, ReplayModel, toolCall } from "./agent.ts";
import type { ToolSpec } from "./agent.ts";

const customers = new Map([
  ["ada@example.com", { id: "cus_1041", name: "Ada", plan: "pro" }],
]);

const lookupCustomer: ToolSpec = {
  name: "lookup_customer",
  description: "Find a customer by email address. Returns id, name and plan.",
  params: {
    email: { type: "string", required: true, description: "exact address, lowercase" },
  },
  run({ email }) {
    const found = customers.get(String(email).toLowerCase());
    if (!found) throw new Error(`no customer with email ${String(email)}`);
    return JSON.stringify(found);
  },
};

const openTicket: ToolSpec = {
  name: "open_ticket",
  description: "Open a support ticket. Priority is 1 (urgent) to 3 (low).",
  params: {
    subject: { type: "string", required: true },
    priority: { type: "number", required: true },
  },
  run({ subject, priority }) {
    const p = Number(priority);
    // The schema said "number"; only the tool knows what numbers are legal.
    if (!Number.isInteger(p) || p < 1 || p > 3) {
      throw new Error(`priority must be an integer from 1 to 3, got ${p}`);
    }
    return JSON.stringify({ ticket: "T-8801", subject, priority: p });
  },
};

const model = new ReplayModel([
  // 1. a tool that does not exist
  { toolCalls: [toolCall("close_ticket", { id: "T-8801" }, "c1")] },
  // 2. a string where a number was declared
  { toolCalls: [toolCall("open_ticket", { subject: "Refund", priority: "high" }, "c2")] },
  // 3. a number the schema accepts and the tool refuses
  { toolCalls: [toolCall("open_ticket", { subject: "Refund", priority: 9 }, "c3")] },
  // 4. a correct call
  { toolCalls: [toolCall("open_ticket", { subject: "Refund", priority: 2 }, "c4")] },
  { text: "Opened T-8801 at priority 2." },
]);

const agent = new Agent(model, [lookupCustomer, openTicket]);
const run = await agent.run("Open a refund ticket for Ada.");

console.log("# what the loop wrote back");
for (const step of run.steps) {
  console.log(`${step.call.id}  ${step.call.name}(${JSON.stringify(step.call.args)})`);
  console.log(`      -> ${step.result}`);
}

console.log("\n# the run");
console.log("stop reason:", run.stopReason);
console.log("answer     :", run.answer);
