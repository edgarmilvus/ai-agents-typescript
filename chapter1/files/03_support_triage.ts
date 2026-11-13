// 1.3 — a real desk: refund triage.
//
// The loop from 1.1 with tools that have consequences. Two tickets, two
// outcomes: one inside policy, one outside it and escalated instead of
// refunded. The interesting part is not that the model chose well — it is
// that the tools made the wrong choice impossible.

import { Agent, ReplayModel, toolCall } from "./agent.ts";
import type { Message, ToolSpec } from "./agent.ts";

export interface Order {
  id: string;
  total: number;
  currency: string;
  deliveredDaysAgo: number;
  region: string;
}

export const ORDERS: Order[] = [
  { id: "ORD-7712", total: 84, currency: "EUR", deliveredDaysAgo: 6, region: "EU" },
  { id: "ORD-7801", total: 640, currency: "EUR", deliveredDaysAgo: 21, region: "EU" },
];

/** The policy table, in one place, so both the tool and the answer agree. */
export const POLICIES: Record<string, { windowDays: number; maxAutoRefund: number }> = {
  EU: { windowDays: 14, maxAutoRefund: 500 },
  US: { windowDays: 30, maxAutoRefund: 1000 },
};

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

/** Everything the refund tools touch, so the harness can inspect it later. */
export interface Desk {
  refunds: Refund[];
  escalations: Escalation[];
  calls: { name: string; args: unknown }[];
}

export function makeDesk(today = new Date("2026-10-29T00:00:00Z")): Desk {
  return { refunds: [], escalations: [], calls: [] };
}

export function deskTools(desk: Desk): ToolSpec[] {
  const findOrder = (id: unknown): Order => {
    const order = ORDERS.find((o) => o.id === String(id));
    if (!order) throw new Error(`no order ${String(id)}`);
    return order;
  };

  return [
    {
      name: "lookup_order",
      description: "Read an order: total, currency, days since delivery, region.",
      params: { orderId: { type: "string", required: true } },
      run({ orderId }) {
        const o = findOrder(orderId);
        return JSON.stringify(o);
      },
    },
    {
      name: "refund_policy",
      description: "Read the refund policy for a region: the window and the automatic ceiling.",
      params: { region: { type: "string", required: true } },
      run({ region }) {
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
        const o = findOrder(orderId);
        const policy = POLICIES[o.region];
        const n = Number(amount);

        // Three refusals, in the order an auditor would ask them.
        if (o.deliveredDaysAgo > policy.windowDays) {
          throw new Error(
            `outside the ${policy.windowDays}-day window (delivered ${o.deliveredDaysAgo} days ago); escalate instead`,
          );
        }
        if (n > policy.maxAutoRefund) {
          throw new Error(`amount ${n} exceeds the automatic ceiling of ${policy.maxAutoRefund}`);
        }
        if (Math.abs(n - o.total) > 0.005) {
          throw new Error(`partial refunds are not supported: order total is ${o.total}`);
        }

        const refund: Refund = {
          refundId: `rf_${o.id.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
          orderId: o.id,
          amount: n,
          currency: o.currency,
        };
        desk.refunds.push(refund);
        return JSON.stringify(refund);
      },
    },
    {
      name: "escalate",
      description: "Hand a ticket to a human, with the reason written down.",
      params: {
        orderId: { type: "string", required: true },
        reason: { type: "string", required: true },
      },
      run({ orderId, reason }) {
        const escalation: Escalation = {
          escalationId: `esc_${String(orderId).toLowerCase().replace(/[^a-z0-9]/g, "")}`,
          orderId: String(orderId),
          reason: String(reason),
        };
        desk.escalations.push(escalation);
        return JSON.stringify(escalation);
      },
    },
  ];
}

// -------------------------------------------------------------------- runs
//
// Two tickets, run against the real model when a key is available and from the
// recording otherwise. The tools and the loop are identical in both cases.

export interface Case {
  fixture: string;
  label: string;
  task: string;
  expect: { refunds: number; escalations: number };
}

export const CASES: Case[] = [
  {
    fixture: "ch1-inside",
    label: "inside policy",
    task:
      "A customer says the headphones arrived damaged and wants a full refund. Order ORD-7712. " +
      "Refund it if policy allows, otherwise escalate to a human.",
    expect: { refunds: 1, escalations: 0 },
  },
  {
    fixture: "ch1-outside",
    label: "outside policy",
    task:
      "A customer says order ORD-7801 was delivered three weeks ago and wants the money back. " +
      "Refund it if policy allows, otherwise escalate to a human.",
    expect: { refunds: 0, escalations: 1 },
  },
];

