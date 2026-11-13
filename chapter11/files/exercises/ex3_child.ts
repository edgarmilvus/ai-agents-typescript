// Exercise 3, file 2 of 3 — the child, and the seam it is given.
//
// The child does not import the desk. It is handed an `invoke` function and
// calls it by name, which is what lets the whole role be tested with a fake
// that answers from a table — and what stops this file from knowing whether the
// tools are real.

import type { Facts, PacketLike, Role } from "./ex3_packet.ts";
import { gaps } from "./ex3_packet.ts";

export interface Report {
  status: "ok" | "blocked";
  result: Record<string, unknown>;
  reason: string;
  calls: number;
}

export type Invoke = (name: string, args: Record<string, unknown>) => string;

const NEEDS: Record<Role, (keyof Facts)[]> = {
  clerk: ["orderId"],
  cashier: ["orderId", "amount", "verdict"],
};

const TOOLS: Record<Role, string[]> = {
  clerk: ["lookup_order", "refund_policy"],
  cashier: ["issue_refund", "escalate"],
};

/**
 * Execute one packet.
 *
 * The two refusals are different: a missing fact is the packet's fault and is
 * named, while a tool the role does not own is an error in the wiring and is
 * thrown.
 */
export function run(packet: PacketLike, invoke: Invoke): Report {
  const absent = gaps(packet, NEEDS[packet.role]);
  if (absent.length > 0) {
    return { status: "blocked", result: {}, reason: `missing ${absent.join(", ")}`, calls: 0 };
  }

  const call = (name: string, args: Record<string, unknown>): string => {
    if (!TOOLS[packet.role].includes(name)) throw new Error(`${packet.role} may not call ${name}`);
    return invoke(name, args);
  };

  const orderId = String(packet.facts.orderId);

  if (packet.role === "clerk") {
    const order = JSON.parse(call("lookup_order", { orderId })) as { region: string; deliveredDaysAgo: number; total: number };
    const policy = JSON.parse(call("refund_policy", { region: order.region })) as { windowDays: number; maxAutoRefund: number };
    const verdict = order.deliveredDaysAgo <= policy.windowDays && order.total <= policy.maxAutoRefund ? "refund" : "escalate";
    if (packet.facts.verdict !== undefined && packet.facts.verdict !== verdict) {
      return { status: "blocked", result: {}, reason: `packet says ${packet.facts.verdict}, policy says ${verdict}`, calls: 2 };
    }
    return { status: "ok", result: { verdict, region: order.region }, reason: "completed", calls: 2 };
  }

  if (packet.facts.verdict === "refund") {
    const refund = JSON.parse(call("issue_refund", { orderId, amount: packet.facts.amount, reason: packet.goal })) as {
      refundId: string;
    };
    return { status: "ok", result: { action: "refunded", reference: refund.refundId }, reason: "completed", calls: 1 };
  }

  const escalation = JSON.parse(call("escalate", { orderId, reason: packet.goal })) as { escalationId: string };
  return { status: "ok", result: { action: "escalated", reference: escalation.escalationId }, reason: "completed", calls: 1 };
}
