// Chapter 11 — two children, and neither can do the other's job.
//
// The clerk reads the order and the policy. The cashier moves money or
// escalates. Their tool lists are disjoint, which is what makes the seam
// load-bearing: a supervisor cannot "just do it" when a child refuses, because
// the supervisor has no tools at all beyond `delegate`.
//
// The planner is scripted. It follows the policy in a fixed order and refuses
// when a fact its role needs is absent — it does not guess, because a child
// that guesses turns a broken handoff into a wrong refund.

import type { ToolSpec } from "../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../chapter1/files/03_support_triage.ts";
import type { Desk } from "../chapter1/files/03_support_triage.ts";
import type { Facts, Packet, Report, Role } from "./contract.ts";
import { blocked, done } from "./contract.ts";

/** The facts each role cannot work without, independent of who is calling. */
export const NEEDS: Record<Role, (keyof Facts)[]> = {
  clerk: ["orderId"],
  cashier: ["orderId", "amount", "verdict"],
};

const TOOLS: Record<Role, string[]> = {
  clerk: ["lookup_order", "refund_policy"],
  cashier: ["issue_refund", "escalate"],
};

/** The subset of the desk a role is allowed to touch. */
export function toolsFor(role: Role, desk: Desk): ToolSpec[] {
  const allowed = TOOLS[role];
  return deskTools(desk).filter((tool) => allowed.includes(tool.name));
}

/** A crude but honest token count: four characters to a token. */
export function tokensIn(value: unknown): number {
  return Math.ceil(JSON.stringify(value).length / 4);
}

function missing(packet: Packet): (keyof Facts)[] {
  return NEEDS[packet.role].filter((key) => packet.facts[key] === undefined);
}

/**
 * Run one role against one packet.
 *
 * The clerk looks the order up and reads the policy for its region; the cashier
 * acts on the verdict it was handed. Both count their calls and the tokens the
 * packet cost, because the seam's price is part of its contract.
 */
export function runRole(packet: Packet, desk: Desk = makeDesk()): Report {
  const packetTokens = tokensIn(packet);
  const absent = missing(packet);
  if (absent.length > 0) {
    return blocked(`missing ${absent.join(", ")}: this role cannot work without it`, 0, packetTokens);
  }

  const tools = toolsFor(packet.role, desk);
  const call = (name: string, args: Record<string, unknown>): string => {
    const tool = tools.find((t) => t.name === name);
    if (!tool) throw new Error(`${packet.role} has no tool ${name}`);
    const value = tool.run(args);
    return typeof value === "string" ? value : "";
  };

  const orderId = String(packet.facts.orderId);

  if (packet.role === "clerk") {
    const order = JSON.parse(call("lookup_order", { orderId })) as { region: string; deliveredDaysAgo: number; total: number };
    const policy = JSON.parse(call("refund_policy", { region: order.region })) as {
      windowDays: number;
      maxAutoRefund: number;
    };
    const verdict =
      order.deliveredDaysAgo <= policy.windowDays && order.total <= policy.maxAutoRefund ? "refund" : "escalate";
    if (verdict !== packet.facts.verdict && packet.facts.verdict !== undefined) {
      return blocked(
        `policy says ${verdict} for ${orderId}; the packet said ${packet.facts.verdict}`,
        2,
        packetTokens,
      );
    }
    return done({ verdict, region: order.region }, 2, packetTokens);
  }

  if (packet.facts.verdict === "refund") {
    const refund = JSON.parse(
      call("issue_refund", {
        orderId,
        amount: packet.facts.amount,
        reason: packet.goal,
      }),
    ) as { refundId: string };
    return done({ action: "refunded", reference: refund.refundId }, 1, packetTokens);
  }

  const escalation = JSON.parse(
    call("escalate", { orderId, reason: `policy verdict: escalate. ${packet.goal}` }),
  ) as { escalationId: string };
  return done({ action: "escalated", reference: escalation.escalationId }, 1, packetTokens);
}
