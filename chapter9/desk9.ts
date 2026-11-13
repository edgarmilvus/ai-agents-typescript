// Chapter 9 — the subject under test: a refund desk a mutant can break.
//
// This is chapter 1's desk with the rows the mutation run needed. Two orders
// are the ones the recorded runs used; two were added because a guard cannot
// be tested by a case that has some other reason to fail: a refund has to be
// refused by the rule the case names, and by nothing else.
//
// The policy table is imported, not copied. The tools are written out because
// chapter 9 mutates them, and a mutant is only interesting if you can see the
// line it moved.

import type { ToolSpec } from "../chapter1/files/agent.ts";
import type { Escalation, Order, Refund } from "../chapter1/files/03_support_triage.ts";
import { POLICIES } from "../chapter1/files/03_support_triage.ts";
import type { Outcome, Runtime } from "../chapter8/trace.ts";

export type { Order, Refund, Escalation };

/**
 * Four orders, each with a job.
 *
 * ORD-7712 and ORD-7801 are chapter 1's, unchanged, and they are what the
 * recorded model runs replay. ORD-7901 is inside the ceiling and outside the
 * window. ORD-7900 is inside the window and outside the US ceiling. Neither
 * of the last two is refundable, and each is refused by exactly one rule.
 */
export const ORDERS: Order[] = [
  { id: "ORD-7712", total: 84, currency: "EUR", deliveredDaysAgo: 6, region: "EU" },
  { id: "ORD-7801", total: 640, currency: "EUR", deliveredDaysAgo: 21, region: "EU" },
  { id: "ORD-7900", total: 1200, currency: "USD", deliveredDaysAgo: 10, region: "US" },
  { id: "ORD-7901", total: 84, currency: "EUR", deliveredDaysAgo: 21, region: "EU" },
];

/**
 * The rules a refund must satisfy, as three switches.
 *
 * Currency is not one of them: the tool reads it from the order, so a
 * currency guard inside the tool could never fire. The check compares the
 * written currency with the order's, which is the only place it can differ.
 */
export interface Guards {
  window: boolean;
  ceiling: boolean;
  total: boolean;
}

export const ALL_GUARDS: Guards = { window: true, ceiling: true, total: true };

/** The ledger's own failure modes: it can lose a write or divide on the way in. */
export type Ledger = "clean" | "drop" | "divide";

export interface Desk {
  refunds: Refund[];
  escalations: Escalation[];
  calls: { name: string; args: Record<string, unknown> }[];
}

export function makeDesk(): Desk {
  return { refunds: [], escalations: [], calls: [] };
}

export function orderById(id: unknown): Order {
  const order = ORDERS.find((o) => o.id === String(id));
  if (!order) throw new Error(`no order ${String(id)}`);
  return order;
}

/** The order the run was about: the first lookup, else the first action. */
export function orderUnderReview(desk: Desk): Order | undefined {
  const looked = desk.calls.find((c) => c.name === "lookup_order")?.args.orderId;
  const id =
    typeof looked === "string" ? looked : (desk.refunds[0]?.orderId ?? desk.escalations[0]?.orderId);
  return id === undefined ? undefined : ORDERS.find((o) => o.id === id);
}

export interface DeskOptions {
  guards?: Partial<Guards>;
  ledger?: Ledger;
}

export function toolsFor(desk: Desk, options: DeskOptions = {}): ToolSpec[] {
  const guards = { ...ALL_GUARDS, ...options.guards };
  const ledger = options.ledger ?? "clean";

  const write = (refund: Refund): void => {
    if (ledger === "drop") return;
    const amount = ledger === "divide" ? Math.round(refund.amount) / 100 : refund.amount;
    desk.refunds.push({ ...refund, amount });
  };

  return [
    {
      name: "lookup_order",
      description: "Read an order: total, currency, days since delivery, region.",
      params: { orderId: { type: "string", required: true } },
      run({ orderId }) {
        desk.calls.push({ name: "lookup_order", args: { orderId } });
        return JSON.stringify(orderById(orderId));
      },
    },
    {
      name: "refund_policy",
      description: "Read the refund policy for a region: the window and the automatic ceiling.",
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
        const order = orderById(orderId);
        const policy = POLICIES[order.region];
        const n = Number(amount);

        // Four rules, in a fixed order, each with one sentence a human can read.
        if (guards.window && order.deliveredDaysAgo > policy.windowDays) {
          throw new Error(
            `outside the ${policy.windowDays}-day window (delivered ${order.deliveredDaysAgo} days ago); escalate instead`,
          );
        }
        if (guards.ceiling && n > policy.maxAutoRefund) {
          throw new Error(`amount ${n} exceeds the automatic ceiling of ${policy.maxAutoRefund}`);
        }
        if (guards.total && Math.abs(n - order.total) > 0.005) {
          throw new Error(`partial refunds are not supported: order total is ${order.total}`);
        }
        const refund: Refund = {
          refundId: `rf_${order.id.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
          orderId: order.id,
          amount: n,
          currency: order.currency,
        };
        write(refund);
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
        desk.calls.push({ name: "escalate", args: { orderId, reason } });
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

/**
 * The strict check.
 *
 * Inside the window it wants exactly one refund, of exactly the order total,
 * in the order's currency. Outside it wants exactly one escalation and no
 * refund. Anything else is a failure with a sentence that names the gap.
 */
export function check(desk: Desk): Outcome {
  const order = orderUnderReview(desk);
  if (!order) return { pass: false, reason: "no order was looked up, so nothing can be checked" };

  const policy = POLICIES[order.region];

  if (order.deliveredDaysAgo > policy.windowDays) {
    const ok = desk.refunds.length === 0 && desk.escalations.length === 1;
    return {
      pass: ok,
      reason: `outside the ${policy.windowDays}-day window: expected one escalation, got ${desk.refunds.length} refund(s) and ${desk.escalations.length} escalation(s)`,
    };
  }

  const refund = desk.refunds[0];
  const amount = refund?.amount ?? 0;
  const ok =
    desk.refunds.length === 1 &&
    desk.escalations.length === 0 &&
    Math.abs(amount - order.total) < 0.005 &&
    refund?.currency === order.currency;

  return {
    pass: ok,
    reason: ok
      ? `refunded ${order.total.toFixed(2)} ${order.currency}`
      : `expected one refund of ${order.total.toFixed(2)} ${order.currency}, got ${desk.refunds.length} refund(s)${
          refund ? ` of ${amount.toFixed(2)} ${refund.currency}` : ""
        } and ${desk.escalations.length} escalation(s)`,
  };
}

/** A fresh desk, its tools and its check: the clean subject a mutant rewrites. */
export function runtime(options: DeskOptions & { maxSteps?: number } = {}): Runtime & { desk: Desk } {
  const desk = makeDesk();
  return {
    desk,
    tools: toolsFor(desk, options),
    check: () => check(desk),
    maxSteps: options.maxSteps ?? 8,
  };
}
