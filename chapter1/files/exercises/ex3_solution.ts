// Exercise 3 — refunds are idempotent.
//
// A retried model turn, a duplicated tool call, a user refreshing the page:
// all three arrive as "refund this order again". The desk must answer with the
// refund it already made, not with a second one.

import { Agent, ReplayModel, toolCall } from "../agent.ts";
import type { ToolSpec } from "../agent.ts";
import { deskTools, makeDesk } from "../03_support_triage.ts";
import type { Desk, Refund } from "../03_support_triage.ts";

/** Remember the refund per order, and replay it instead of issuing a new one. */
export function withIdempotency(tool: ToolSpec, memory: Map<string, Refund>): ToolSpec {
  if (tool.name !== "issue_refund") return tool;
  return {
    ...tool,
    run(input) {
      const key = String(input.orderId);
      const seen = memory.get(key);
      if (seen) return JSON.stringify({ ...seen, replayed: true });
      const result = tool.run(input);
      const refund = JSON.parse(String(result)) as Refund;
      memory.set(key, refund);
      return result;
    },
  };
}

export async function solve(): Promise<{ desk: Desk; run: Awaited<ReturnType<Agent["run"]>>; memory: Map<string, Refund> }> {
  const desk = makeDesk();
  const memory = new Map<string, Refund>();
  const tools = deskTools(desk).map((t) => withIdempotency(t, memory));

  const ask = { orderId: "ORD-7712", amount: 84, reason: "damaged on arrival" };
  const model = new ReplayModel([
    { toolCalls: [toolCall("issue_refund", ask, "e1")] },
    // The same call again — a retry, or a second thought.
    { toolCalls: [toolCall("issue_refund", ask, "e2")] },
    { text: "Refunded ORD-7712 once; the retry returned the same refund." },
  ]);

  const run = await new Agent(model, tools).run("Refund ORD-7712 in full.");
  return { desk, run, memory };
}

if (import.meta.main) {
  const { desk, run } = await solve();
  for (const s of run.steps) console.log(`${s.call.name} -> ${s.result}`);
  console.log("refunds recorded:", desk.refunds.length);
}
