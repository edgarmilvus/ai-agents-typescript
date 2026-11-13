// 13.0 — record the approval request a model writes.
//
// The agent cannot approve, so the interesting artefact is not the approval but
// the request for one: what the model says it wants to do, for how much, on
// what evidence. The refund tool refuses anything above 200 and tells the model
// to ask, which is the only way the rest of the chapter is reachable.
//
// Live when a key is present; printed from disk otherwise. The request is
// whatever the model wrote.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Agent } from "../../chapter1/files/agent.ts";
import type { ToolSpec } from "../../chapter1/files/agent.ts";
import { makeModel, modelKey } from "../../lib/model.ts";
import { newBudget } from "../../lib/budget.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const RUNS = join(HERE, "..", "runs");

const ORDER = { id: "ORD-7902", total: 300, currency: "EUR", deliveredDaysAgo: 5, region: "EU" };
const CEILING = 500;
const APPROVAL_ABOVE = 200;

export interface Request {
  tool: string;
  orderId: string;
  amount: number;
  reason: string;
  evidence: string;
}

export interface Saved {
  task: string;
  model: string;
  answer: string;
  request?: Request;
  refused?: string;
  calls: number;
  usage: { calls: number; promptTokens: number; outputTokens: number };
  recordedAt: string;
}

/** The desk for this recording: one order, one threshold, one approval path. */
export function toolsFor(state: { requests: Request[]; refunds: number; refusals: string[] }): ToolSpec[] {
  return [
    {
      name: "lookup_order",
      description: "Read an order: total, currency, days since delivery, region.",
      params: { orderId: { type: "string", required: true } },
      run() {
        return JSON.stringify(ORDER);
      },
    },
    {
      name: "issue_refund",
      description: "Refund an order in full. Above 200 EUR the tool refuses and asks for an approval.",
      params: {
        orderId: { type: "string", required: true },
        amount: { type: "number", required: true },
        reason: { type: "string", required: true },
      },
      run({ amount }) {
        const n = Number(amount);
        if (n > APPROVAL_ABOVE) {
          const why = `${n} is above the ${APPROVAL_ABOVE} EUR automatic limit: call request_approval first`;
          state.refusals.push(why);
          throw new Error(why);
        }
        if (n > CEILING) throw new Error(`${n} is over the ceiling of ${CEILING}`);
        state.refunds += 1;
        return JSON.stringify({ refundId: `rf_${ORDER.id.toLowerCase()}`, amount: n, currency: ORDER.currency });
      },
    },
    {
      name: "request_approval",
      description: "Ask a human to approve an action above the automatic limit. Returns a pending run id.",
      params: {
        tool: { type: "string", required: true },
        orderId: { type: "string", required: true },
        amount: { type: "number", required: true },
        reason: { type: "string", required: true },
        evidence: { type: "string", required: true },
      },
      run({ tool, orderId, amount, reason, evidence }) {
        const request: Request = {
          tool: String(tool),
          orderId: String(orderId),
          amount: Number(amount),
          reason: String(reason),
          evidence: String(evidence),
        };
        state.requests.push(request);
        return JSON.stringify({ status: "pending", runId: "run-1", request });
      },
    },
    {
      name: "escalate",
      description: "Hand the ticket to a human without acting.",
      params: { orderId: { type: "string", required: true }, reason: { type: "string", required: true } },
      run({ reason }) {
        return JSON.stringify({ escalationId: `esc_${ORDER.id.toLowerCase()}`, reason: String(reason) });
      },
    },
  ];
}

const TASK =
  "A customer says the espresso machine from order ORD-7902 arrived damaged and wants a refund. " +
  "Handle it according to policy and the tools available.";

const replaying = process.argv.includes("--replay") || process.env.AGENTLAB_REPLAY === "1";
const live = Boolean(modelKey()) && !replaying;

if (live) {
  const state = { requests: [] as Request[], refunds: 0, refusals: [] as string[] };
  const budget = newBudget(8);
  const model = makeModel(budget);
  const agent = new Agent(model, toolsFor(state), { maxSteps: 8 });
  const run = await agent.run(TASK);

  const saved: Saved = {
    task: TASK,
    model: model.name,
    answer: run.answer,
    request: state.requests[0],
    refused: state.refusals[0],
    calls: budget.calls,
    usage: { calls: budget.calls, promptTokens: budget.promptTokens, outputTokens: budget.outputTokens },
    recordedAt: new Date().toISOString(),
  };
  mkdirSync(RUNS, { recursive: true });
  writeFileSync(join(RUNS, "a1.json"), JSON.stringify(saved, null, 2) + "\n");

  console.log(`  recorded: ${saved.calls} calls, ${saved.usage.promptTokens} prompt tokens`);
  console.log(`  refusal : ${saved.refused ?? "none"}`);
  console.log(`  request : ${JSON.stringify(saved.request ?? null).slice(0, 180)}`);
} else {
  console.log("  replaying the recorded request (no key, or --replay)\n");
}

console.log("\n# the request on disk");
const path = join(RUNS, "a1.json");
if (existsSync(path)) {
  const saved = JSON.parse(readFileSync(path, "utf8")) as Saved;
  console.log(`  model   : ${saved.model}`);
  console.log(`  refusal : ${saved.refused ?? "none"}`);
  if (saved.request) {
    console.log(`  tool    : ${saved.request.tool}`);
    console.log(`  amount  : ${saved.request.amount}`);
    console.log(`  reason  : ${saved.request.reason.slice(0, 100)}`);
    console.log(`  evidence: ${saved.request.evidence.slice(0, 100)}`);
  } else {
    console.log("  request : none");
  }
  console.log(`  answer  : ${saved.answer.slice(0, 140)}`);
} else {
  console.log("  missing");
}
