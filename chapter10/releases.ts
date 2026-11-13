// Chapter 10 — two releases, one request, and the four kinds of difference.
//
// A release is a tool implementation plus a check. Running one request means
// executing the recorded decisions against it and asking its check. Running
// two releases in shadow means doing that twice, against two worlds, in stream
// order: the unit of comparison is not the request but the pair, because a
// refund is a thing the world remembers.

import type { Call, Request } from "./traffic.ts";
import { driver } from "./traffic.ts";

export interface Order {
  id: string;
  total: number;
  currency: string;
  days: number;
  region: string;
}

export interface Action {
  kind: "refund" | "escalation" | "skipped";
  orderId: string;
  amount?: number;
  currency?: string;
}

export interface World {
  orders: Map<string, Order>;
  refunds: number;
  escalations: number;
  /** Orders that have already been paid, which is what idempotency is about. */
  paid: Set<string>;
}

export function makeWorld(): World {
  return { orders: new Map(), refunds: 0, escalations: 0, paid: new Set() };
}

export interface View {
  order: Order;
  actions: Action[];
}

export interface Result {
  pass: boolean;
  crashed: boolean;
  actions: Action[];
  reason: string;
}

export interface Release {
  id: string;
  note: string;
  /** Apply the refund. May throw, which the engine records as a crash. */
  refund(world: World, order: Order, amount: number): Action;
  /** The verdict for one request, from its actions and its order. */
  check(view: View): { pass: boolean; reason: string };
  /** True when this release intends to behave differently on this request. */
  expects?(request: Request): boolean;
}

const WINDOW: Record<string, number> = { EU: 14, US: 30 };

function policy(region: string, windowShift = 0): { windowDays: number; maxAutoRefund: number } {
  const table: Record<string, { windowDays: number; maxAutoRefund: number }> = {
    EU: { windowDays: 14, maxAutoRefund: 500 },
    US: { windowDays: 30, maxAutoRefund: 1000 },
  };
  const found = table[region];
  if (!found) throw new Error(`no policy for region ${region}`);
  return { windowDays: found.windowDays + windowShift, maxAutoRefund: found.maxAutoRefund };
}

function orderOf(request: Request): Order {
  return {
    id: request.orderId,
    total: request.total,
    currency: request.currency,
    days: request.days,
    region: request.region,
  };
}

/** The incumbent's check: in policy, one refund of the total; outside it, one escalation. */
function strictCheck(view: View, windowShift = 0): { pass: boolean; reason: string } {
  const { order, actions } = view;
  const p = policy(order.region, windowShift);
  const refunds = actions.filter((a) => a.kind === "refund");
  const escalations = actions.filter((a) => a.kind === "escalation");
  const skipped = actions.filter((a) => a.kind === "skipped");

  if (skipped.length > 0) {
    return { pass: false, reason: `the refund was skipped for ${skipped[0].orderId}` };
  }
  if (order.days > p.windowDays) {
    const ok = refunds.length === 0 && escalations.length === 1;
    return {
      pass: ok,
      reason: ok
        ? `escalated ${order.id} after ${order.days} days`
        : `outside the ${p.windowDays}-day window: expected one escalation, got ${refunds.length} refund(s)`,
    };
  }
  if (order.total > p.maxAutoRefund) {
    const ok = refunds.length === 0 && escalations.length === 1;
    return {
      pass: ok,
      reason: ok
        ? `escalated ${order.id} over the ceiling of ${p.maxAutoRefund}`
        : `over the ceiling of ${p.maxAutoRefund}: expected one escalation, got ${refunds.length} refund(s)`,
    };
  }
  const refund = refunds[0];
  const ok =
    refunds.length === 1 &&
    escalations.length === 0 &&
    Math.abs((refund?.amount ?? 0) - order.total) < 0.005 &&
    refund?.currency === order.currency;
  return {
    pass: ok,
    reason: ok
      ? `refunded ${order.total.toFixed(2)} ${order.currency}`
      : `expected one refund of ${order.total.toFixed(2)} ${order.currency}, got ${refunds.length}`,
  };
}

/** The release that is running now. */
export const INCUMBENT: Release = {
  id: "r1-incumbent",
  note: "the desk as shipped",
  refund(world, order, amount) {
    world.refunds += 1;
    return { kind: "refund", orderId: order.id, amount, currency: order.currency };
  },
  check: (view) => strictCheck(view),
};

/**
 * A fix for a bug the incumbent has: a customer asking twice is paid twice.
 *
 * The release refuses the second refund and its check accepts the refusal as a
 * pass. It declares the requests it intends to change, which is what lets the
 * canary tell a planned divergence from a regression.
 */
export const IDEMPOTENT: Release = {
  id: "r2-idempotent",
  note: "a second refund for the same order is refused, not repeated",
  refund(world, order, amount) {
    if (world.paid.has(order.id)) return { kind: "skipped", orderId: order.id };
    world.paid.add(order.id);
    world.refunds += 1;
    return { kind: "refund", orderId: order.id, amount, currency: order.currency };
  },
  check(view) {
    if (view.actions.some((a) => a.kind === "skipped")) {
      return { pass: true, reason: `already refunded ${view.order.id}` };
    }
    return strictCheck(view);
  },
  expects: (request) => request.duplicateOf !== undefined,
};

/** The amount is rounded before it is written: correct for whole units, wrong for cents. */
export const ROUNDING: Release = {
  id: "r3-rounding",
  note: "the refund amount is rounded to whole units before the write",
  refund(world, order, amount) {
    const rounded = Math.round(amount);
    world.refunds += 1;
    return { kind: "refund", orderId: order.id, amount: rounded, currency: order.currency };
  },
  check: (view) => strictCheck(view),
};

/** The check reads a policy that is two days stale. */
export const STALE_POLICY: Release = {
  id: "r4-stale-policy",
  note: "the check uses a cached policy with a 12-day EU window",
  refund(world, order, amount) {
    world.refunds += 1;
    return { kind: "refund", orderId: order.id, amount, currency: order.currency };
  },
  check: (view) => strictCheck(view, -2),
};

/** The same verdicts, a different sentence. Nothing for a canary to roll back. */
export const COSMETIC: Release = {
  id: "r5-cosmetic",
  note: "the check reports the same verdict in different words",
  refund(world, order, amount) {
    world.refunds += 1;
    return { kind: "refund", orderId: order.id, amount, currency: order.currency };
  },
  check(view) {
    const strict = strictCheck(view);
    return { pass: strict.pass, reason: strict.pass ? `ok: ${view.order.id}` : `not ok: ${view.order.id}` };
  },
};

/**
 * A debugging hook left in: one order is refused with a message nobody shipped
 * on purpose. One request in the stream, which is why a rate cannot see it.
 */
export const LEFTOVER: Release = {
  id: "r6-leftover",
  note: "a debug guard refuses one hard-coded order",
  refund(world, order, amount) {
    if (order.id === "TRD-1003") throw new Error("debug: refusing this order");
    world.refunds += 1;
    return { kind: "refund", orderId: order.id, amount, currency: order.currency };
  },
  check: (view) => strictCheck(view),
};

export const CANDIDATES: Release[] = [IDEMPOTENT, ROUNDING, STALE_POLICY, COSMETIC, LEFTOVER];

function runCall(release: Release, world: World, order: Order, call: Call): Action | undefined {
  switch (call.name) {
    case "lookup_order":
      return undefined;
    case "refund_policy":
      policy(String(call.args.region));
      return undefined;
    case "issue_refund":
      return release.refund(world, order, Number(call.args.amount));
    case "escalate":
      world.escalations += 1;
      return { kind: "escalation", orderId: order.id };
    default:
      throw new Error(`no tool named ${call.name}`);
  }
}

/** Execute one request against one release, in a world that remembers. */
export function run(release: Release, world: World, request: Request): Result {
  const order = orderOf(request);
  world.orders.set(order.id, order);
  const actions: Action[] = [];
  let crashed = false;

  for (const call of driver(request)) {
    try {
      const action = runCall(release, world, order, call);
      if (action) actions.push(action);
    } catch {
      crashed = true;
    }
  }

  try {
    const verdict = release.check({ order, actions });
    return { pass: verdict.pass, crashed, actions, reason: verdict.reason };
  } catch (error) {
    return { pass: false, crashed: true, actions, reason: `check threw: ${(error as Error).message}` };
  }
}

export type Kind = "agree" | "cosmetic" | "material" | "critical" | "planned" | "silent";

export interface Comparison {
  request: Request;
  incumbent: Result;
  candidate: Result;
  kind: Kind;
  /** One sentence, written for a human reading the rollout record. */
  detail: string;
}

function actionsEqual(a: Action[], b: Action[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((left, i) => {
    const right = b[i];
    return (
      left.kind === right.kind &&
      left.orderId === right.orderId &&
      left.amount === right.amount &&
      left.currency === right.currency
    );
  });
}

/**
 * Classify one pair of results.
 *
 * Money and crashes first: any difference in what was done is critical, unless
 * the release declared it. A differing verdict with the same actions is
 * material. A differing sentence with the same verdict is cosmetic. A declared
 * request that behaved identically is silent, which is its own finding.
 */
export function classify(request: Request, incumbent: Result, candidate: Result, declared: boolean): Comparison {
  const sameActions = actionsEqual(incumbent.actions, candidate.actions) && incumbent.crashed === candidate.crashed;
  const declaredHere = declared;

  if (!sameActions) {
    return {
      request,
      incumbent,
      candidate,
      kind: declaredHere ? "planned" : "critical",
      detail: `${request.id}: incumbent ${describe(incumbent)} → candidate ${describe(candidate)}`,
    };
  }
  if (declaredHere) {
    return {
      request,
      incumbent,
      candidate,
      kind: "silent",
      detail: `${request.id}: declared a change, behaved identically`,
    };
  }
  if (incumbent.pass !== candidate.pass) {
    return {
      request,
      incumbent,
      candidate,
      kind: "material",
      detail: `${request.id}: verdict ${incumbent.pass ? "pass" : "fail"} → ${candidate.pass ? "pass" : "fail"} — ${candidate.reason}`,
    };
  }
  if (incumbent.reason !== candidate.reason) {
    return { request, incumbent, candidate, kind: "cosmetic", detail: `${request.id}: ${candidate.reason}` };
  }
  return { request, incumbent, candidate, kind: "agree", detail: `${request.id}: agree` };
}

function describe(result: Result): string {
  if (result.crashed) return "crash";
  const refunds = result.actions.filter((a) => a.kind === "refund");
  const skipped = result.actions.filter((a) => a.kind === "skipped");
  const escalated = result.actions.filter((a) => a.kind === "escalation");
  if (skipped.length) return "skipped";
  if (refunds.length) return `refund ${refunds[0].amount?.toFixed(2)}`;
  if (escalated.length) return "escalation";
  return "nothing";
}

/**
 * Run the stream through two releases in lockstep.
 *
 * Each release gets its own world and they advance together, because a world
 * that has seen request 40 is not the same world for both releases unless the
 * history is replayed for both.
 */
export function shadow(requests: Request[], candidate: Release, incumbent: Release = INCUMBENT): Comparison[] {
  const left = makeWorld();
  const right = makeWorld();
  return requests.map((request) => {
    const a = run(incumbent, left, request);
    const b = run(candidate, right, request);
    return classify(request, a, b, candidate.expects?.(request) === true);
  });
}
