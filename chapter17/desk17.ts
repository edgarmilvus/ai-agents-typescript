// Chapter 17 — the desk, and the two ways to build its tools.
//
// The tools are the same four in both builds. The difference is what the lookup
// can see: one closes over a single tenant's orders, the other over every
// order the process knows. That is the whole bug, and it is nine lines of
// difference in one function.
//
// A tenant's data is not filtered out of a shared result set. It is absent from
// the closure, which means the tool cannot return it even if the model asks.

import type { ToolSpec } from "../chapter1/files/agent.ts";
import type { Tenant, TenantId } from "./tenant.ts";

export interface Order {
  id: string;
  total: number;
  currency: string;
  days: number;
  region: string;
}

export interface Refund {
  refundId: string;
  orderId: string;
  amount: number;
  currency: string;
}

export interface Escalation {
  escalationId: string;
  orderId: string;
  reason: string;
}

export interface Desk {
  refunds: Refund[];
  escalations: Escalation[];
  calls: { name: string; args: Record<string, unknown> }[];
}

export function makeDesk(): Desk {
  return { refunds: [], escalations: [], calls: [] };
}

export const POLICIES: Record<string, { windowDays: number; maxAutoRefund: number }> = {
  EU: { windowDays: 14, maxAutoRefund: 500 },
  US: { windowDays: 30, maxAutoRefund: 1000 },
};

/**
 * A scoped desk: the lookup can only ever see `tenant.orders`.
 *
 * `table` is the tenant's own array, closed over. Nothing here filters by a
 * tenant id, because a filter is a comparison somebody can get wrong; the
 * absence of the other rows is the control.
 */
export function toolsFor(tenant: Tenant, desk: Desk): ToolSpec[] {
  const table = tenant.orders;

  return [
    {
      name: "lookup_order",
      description: "Read an order: total, currency, days since delivery, region.",
      params: { orderId: { type: "string", required: true } },
      run({ orderId }) {
        desk.calls.push({ name: "lookup_order", args: { orderId } });
        const order = table.find((o) => o.id === String(orderId));
        if (!order) throw new Error(`no order ${String(orderId)}`);
        return JSON.stringify(order);
      },
    },
    {
      name: "refund_policy",
      description: "Read the refund policy for this desk's region.",
      params: { region: { type: "string", required: true } },
      run({ region }) {
        desk.calls.push({ name: "refund_policy", args: { region } });
        const policy = POLICIES[String(region)];
        if (!policy) throw new Error(`no policy for region ${String(region)}`);
        return JSON.stringify(policy);
      },
    },
    {
      name: "issue_refund",
      description: "Refund an order in full. Refuses anything the policy does not allow.",
      params: {
        orderId: { type: "string", required: true },
        amount: { type: "number", required: true },
        reason: { type: "string", required: true },
      },
      run({ orderId, amount, reason }) {
        desk.calls.push({ name: "issue_refund", args: { orderId, amount, reason } });
        const order = table.find((o) => o.id === String(orderId));
        if (!order) throw new Error(`no order ${String(orderId)} on this desk`);
        const policy = POLICIES[order.region];
        const n = Number(amount);
        if (order.days > policy.windowDays) throw new Error(`outside the ${policy.windowDays}-day window`);
        if (n > policy.maxAutoRefund) throw new Error(`over the ceiling of ${policy.maxAutoRefund}`);
        if (Math.abs(n - order.total) > 0.005) throw new Error(`partial refunds are not supported`);

        const refund: Refund = {
          refundId: `rf_${order.id.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
          orderId: order.id,
          amount: n,
          currency: order.currency,
        };
        desk.refunds.push(refund);
        return JSON.stringify(refund);
      },
    },
    {
      name: "escalate",
      description: "Hand a ticket to a human, with the reason written down.",
      params: { orderId: { type: "string", required: true }, reason: { type: "string", required: true } },
      run({ orderId, reason }) {
        desk.calls.push({ name: "escalate", args: { orderId, reason } });
        const escalation: Escalation = {
          escalationId: `esc_${String(orderId).toLowerCase()}`,
          orderId: String(orderId),
          reason: String(reason),
        };
        desk.escalations.push(escalation);
        return JSON.stringify(escalation);
      },
    },
  ];
}

/**
 * The global desk: the same tools, closed over every order in the process.
 *
 * This is not a strawman. It is what a service looks like when the desk was
 * written for one customer and the second customer arrived as a row in the
 * same table, and it is one array reference away from the scoped version.
 */
export function toolsForGlobal(tenant: Tenant, desk: Desk, everyone: Order[]): ToolSpec[] {
  const scoped = toolsFor(tenant, desk);
  return scoped.map((tool) => {
    if (tool.name !== "lookup_order" && tool.name !== "issue_refund") return tool;
    return {
      ...tool,
      run(input: Record<string, unknown>) {
        const shared = everyone.find((o) => o.id === String(input.orderId));
        if (!shared) {
          desk.calls.push({ name: tool.name, args: input });
          throw new Error(`no order ${String(input.orderId)}`);
        }
        // The tenant's own order goes through the scoped tool, guards and all.
        if (tenant.orders.some((o) => o.id === shared.id)) return tool.run(input);

        // The leak: a tool closed over every order answers about another
        // tenant's, and the only check is the policy — not the owner.
        desk.calls.push({ name: tool.name, args: input });
        if (tool.name === "lookup_order") return JSON.stringify(shared);

        const policy = POLICIES[shared.region];
        const n = Number(input.amount);
        if (shared.days > policy.windowDays) throw new Error(`outside the ${policy.windowDays}-day window`);
        if (n > policy.maxAutoRefund) throw new Error(`over the ceiling of ${policy.maxAutoRefund}`);
        const refund: Refund = {
          refundId: `rf_${shared.id.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
          orderId: shared.id,
          amount: n,
          currency: shared.currency,
        };
        desk.refunds.push(refund);
        return JSON.stringify(refund);
      },
    };
  });
}

export interface Outcome {
  pass: boolean;
  reason: string;
}

/** The strict check: one refund of the order total, or one escalation outside the window. */
export function check(tenant: Tenant, desk: Desk, orderId: string): Outcome {
  const order = tenant.orders.find((o) => o.id === orderId);
  if (!order) return { pass: false, reason: `${orderId} is not this tenant's order` };
  const policy = POLICIES[order.region];

  if (order.days > policy.windowDays) {
    const ok = desk.refunds.length === 0 && desk.escalations.length === 1;
    return { pass: ok, reason: ok ? `escalated ${order.id}` : `expected one escalation` };
  }
  const refund = desk.refunds[0];
  const ok = desk.refunds.length === 1 && desk.escalations.length === 0 && Math.abs((refund?.amount ?? 0) - order.total) < 0.005;
  return {
    pass: ok,
    reason: ok ? `refunded ${order.total.toFixed(2)} ${order.currency}` : `expected one refund of ${order.total.toFixed(2)}`,
  };
}

export type { Tenant, TenantId };
