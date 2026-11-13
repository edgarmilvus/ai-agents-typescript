// Exercise 2 — a refund may only touch the order on the ticket.
//
// The policy tools are correct in isolation; the danger is the model picking
// the wrong order id, or a second order being swept into the same ticket. The
// fix is a wrapper that binds the tool to the ticket before the model can.

import { Agent, ReplayModel, toolCall } from "../agent.ts";
import type { ToolSpec } from "../agent.ts";
import { deskTools, makeDesk, ORDERS } from "../03_support_triage.ts";
import type { Desk } from "../03_support_triage.ts";

/**
 * Wrap a tool so its `orderId` argument must equal the ticket's order.
 * It reports the refusal the way every other tool does: as a result string.
 */
export function boundToTicket(tool: ToolSpec, ticketOrderId: string): ToolSpec {
  if (!("orderId" in tool.params)) return tool;
  return {
    ...tool,
    run(input) {
      if (String(input.orderId) !== ticketOrderId) {
        throw new Error(
          `this ticket is for ${ticketOrderId}, refusing to act on ${String(input.orderId)}`,
        );
      }
      return tool.run(input);
    },
  };
}

export async function solve(ticketOrderId = "ORD-7712"): Promise<{ desk: Desk; run: Awaited<ReturnType<Agent["run"]>> }> {
  const desk = makeDesk();
  const tools = deskTools(desk).map((t) => boundToTicket(t, ticketOrderId));

  const model = new ReplayModel([
    // The model has the wrong id in context and tries to refund the other order.
    { toolCalls: [toolCall("issue_refund", { orderId: "ORD-7801", amount: 640, reason: "customer request" }, "e1")] },
    // Same ticket, right order.
    { toolCalls: [toolCall("issue_refund", { orderId: ticketOrderId, amount: ORDERS[0].total, reason: "damaged" }, "e2")] },
    { text: "Refunded the ticket's order only." },
  ]);

  const run = await new Agent(model, tools).run("Refund both orders on this ticket.");
  return { desk, run };
}

if (import.meta.main) {
  const { desk, run } = await solve();
  for (const s of run.steps) console.log(`${s.call.name}(${JSON.stringify(s.call.args)}) -> ${s.result}`);
  console.log("refunds:", desk.refunds.length, "answer:", run.answer);
}
