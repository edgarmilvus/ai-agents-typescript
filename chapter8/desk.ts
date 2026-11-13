// Chapter 8 — the desk, and the five switches a release can flip.
//
// The refund desk is chapter 1's: same orders, same policy, same refusals.
// What is new is that every component has a named mode, so a failure can be
// produced by moving exactly one of them and repaired by moving it back.

import type { ToolSpec } from "../chapter1/files/agent.ts";
import type { Escalation, Order, Refund } from "../chapter1/files/03_support_triage.ts";
import { ORDERS, POLICIES } from "../chapter1/files/03_support_triage.ts";
import type { Axis, Outcome, Runtime, Trace } from "./trace.ts";
import { BASELINE, replay } from "./trace.ts";

export type ToolMode = "clean" | "cents" | "centsMeta" | "throws";
export type WorldMode = "clean" | "divide" | "drop" | "preferCents";
export type GraderMode = "strict" | "lenient" | "wrong";

/**
 * A release, in five lines.
 *
 * `context` and `model` are upstream: they change what the model decides, so
 * a tape recorded under one cannot be replayed under the other.
 */
export interface Config {
  tool: ToolMode;
  world: WorldMode;
  grader: GraderMode;
  harness: number;
  context?: string;
  model?: string;
}

export const GREEN: Config = { tool: "clean", world: "clean", grader: "strict", harness: 8 };

/** A refund as it reaches the ledger, which may know about an extra field. */
export interface StoredRefund extends Refund {
  amountCents?: number;
}

export interface Desk {
  refunds: Refund[];
  escalations: Escalation[];
  calls: { name: string; args: Record<string, unknown> }[];
}

export function makeDesk(): Desk {
  return { refunds: [], escalations: [], calls: [] };
}

function orderById(id: unknown): Order {
  const order = ORDERS.find((o) => o.id === String(id));
  if (!order) throw new Error(`no order ${String(id)}`);
  return order;
}

function write(desk: Desk, mode: WorldMode, refund: StoredRefund): void {
  if (mode === "drop") return;
  let amount = refund.amount;
  if (mode === "divide") amount = Math.round(amount) / 100;
  if (mode === "preferCents" && typeof refund.amountCents === "number") amount = refund.amountCents;
  desk.refunds.push({ ...refund, amount });
}

/**
 * The tools, in one of four modes.
 *
 * `cents` is the classic unit bug at the write boundary; `centsMeta` ships a
 * second field that only the new ledger reads; `throws` is an outage. All
 * three are downstream of the model's decision, which is what makes them
 * replayable.
 */
export function toolsFor(desk: Desk, config: Config): ToolSpec[] {
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
        if (config.tool === "throws") throw new Error("refund service unavailable: connection reset");

        const order = orderById(orderId);
        const policy = POLICIES[order.region];
        const n = Number(amount);

        if (order.deliveredDaysAgo > policy.windowDays) {
          throw new Error(
            `outside the ${policy.windowDays}-day window (delivered ${order.deliveredDaysAgo} days ago); escalate instead`,
          );
        }
        if (n > policy.maxAutoRefund) {
          throw new Error(`amount ${n} exceeds the automatic ceiling of ${policy.maxAutoRefund}`);
        }
        if (Math.abs(n - order.total) > 0.005) {
          throw new Error(`partial refunds are not supported: order total is ${order.total}`);
        }

        const refund: StoredRefund = {
          refundId: `rf_${order.id.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
          orderId: order.id,
          amount: config.tool === "cents" ? n * 100 : n,
          currency: order.currency,
        };
        // The new field is harmless until a ledger learns to prefer it.
        if (config.tool === "centsMeta") refund.amountCents = n * 100;

        write(desk, config.world, refund);
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
 * The check, in one of three modes.
 *
 * `strict` is the rule the business wrote. `lenient` asks only that something
 * happened, which is how a broken amount ships. `wrong` demands a refund even
 * when the policy says escalate, which is how a correct run is failed.
 */
export function check(desk: Desk, mode: GraderMode): Outcome {
  const looked = desk.calls.find((c) => c.name === "lookup_order")?.args.orderId;
  const id =
    typeof looked === "string" ? looked : (desk.refunds[0]?.orderId ?? desk.escalations[0]?.orderId ?? "");
  const order = ORDERS.find((o) => o.id === id);
  if (!order) {
    return { pass: false, reason: "no order was looked up, so nothing can be checked" };
  }

  if (mode === "lenient") {
    const actions = desk.refunds.length + desk.escalations.length;
    return { pass: actions > 0, reason: `${actions} action(s) taken, amount not checked` };
  }

  if (mode === "wrong") {
    const ok = desk.escalations.length === 0 && desk.refunds.length === 1;
    return {
      pass: ok,
      reason: `rule: one refund and no escalation (got ${desk.refunds.length} refund(s), ${desk.escalations.length} escalation(s))`,
    };
  }

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

/** The six configuration strings a trace carries. */
export function axesOf(config: Config): Record<Axis, string> {
  return {
    ...BASELINE,
    context: config.context ?? BASELINE.context,
    model: config.model ?? BASELINE.model,
    tool: `tool-${config.tool}`,
    world: `ledger-${config.world}`,
    grader: `check-${config.grader}`,
    harness: `loop-${config.harness}`,
  };
}

/** Set one axis back to the known-good implementation. */
export function restore(config: Config, axis: Axis): Config {
  switch (axis) {
    case "tool":
      return { ...config, tool: "clean" };
    case "world":
      return { ...config, world: "clean" };
    case "grader":
      return { ...config, grader: "strict" };
    case "harness":
      return { ...config, harness: 8 };
    case "context":
      return { ...config, context: BASELINE.context };
    case "model":
      return { ...config, model: BASELINE.model };
  }
}

/**
 * A fresh desk with the given configuration, ready to replay a tape.
 *
 * Every call builds new state: two replays of the same tape must not share a
 * ledger, or the second one would see the first one's refund.
 */
export function runtime(config: Config): Runtime & { desk: Desk } {
  const desk = makeDesk();
  return {
    desk,
    tools: toolsFor(desk, config),
    check: () => check(desk, config.grader),
    maxSteps: config.harness,
  };
}

/**
 * Replay a tape under a release, and label the result with that release.
 *
 * The label matters as much as the outcome: the trace says which six versions
 * produced it, which is what makes the configuration diff a suspect list.
 */
export async function runUnder(base: Trace, config: Config): Promise<Trace> {
  const rt = runtime(config);
  const trace = await replay(base, rt);
  return { ...trace, axes: axesOf(config), outcome: rt.check() };
}
