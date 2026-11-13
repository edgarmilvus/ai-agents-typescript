// Chapter 9 — the suite: six cases, and the rule that makes one a case at all.
//
// A case is a tape, an expectation, and a reason to exist. The recorded tapes
// are the model's decisions from chapter 8; the authored ones are decisions
// nobody recorded, written by hand because a guard can only be tested by a
// request that violates it. That distinction is printed everywhere, because a
// hand-written decision is not a transcript and must never be read as one.
//
// An expectation is checked against state, never against prose: the pass bit,
// the number of refunds and escalations, the amount written and its currency.
// A case that only compares reasons would pass a run that wrote the wrong
// thing for the right reason.

import type { Trace } from "../chapter8/trace.ts";
import { BASELINE, loadTrace, replay } from "../chapter8/trace.ts";
import type { Desk } from "./desk9.ts";
import { runtime } from "./desk9.ts";
import type { Mutation, Subject, Survival } from "./variants.ts";
import { MUTATIONS } from "./variants.ts";

export interface Expect {
  pass?: boolean;
  refunds?: number;
  escalations?: number;
  amount?: number;
  currency?: string;
  /** What the tool told the model, which is not the same as what the desk kept. */
  reportedAmount?: number;
  reportedCurrency?: string;
}

export interface Case {
  id: string;
  tape: Trace;
  expect: Expect;
  note: string;
  source: "recorded" | "authored";
}

/** A decision fixture: calls with no history, because no model ever made them. */
export function decision(id: string, note: string, calls: { name: string; args: Record<string, unknown> }[]): Trace {
  return {
    id,
    task: note,
    model: "authored fixture",
    axes: { ...BASELINE },
    turns: calls.map((call) => ({ text: "", calls: [call] })),
    results: [],
    outcome: { pass: false, reason: "authored fixture: no history" },
    usage: { calls: 0, promptTokens: 0, outputTokens: 0 },
  };
}

const refund7901 = decision("h-window", "a refund for an order outside the window, under the ceiling", [
  { name: "lookup_order", args: { orderId: "ORD-7901" } },
  { name: "issue_refund", args: { orderId: "ORD-7901", amount: 84, reason: "customer asked for the money back" } },
]);

const refund7900 = decision("h-ceiling", "a refund for a US order above the automatic ceiling", [
  { name: "lookup_order", args: { orderId: "ORD-7900" } },
  { name: "issue_refund", args: { orderId: "ORD-7900", amount: 1200, reason: "customer asked for the money back" } },
]);

const partial7712 = decision("h-partial", "a partial refund of an order that is otherwise refundable", [
  { name: "lookup_order", args: { orderId: "ORD-7712" } },
  { name: "issue_refund", args: { orderId: "ORD-7712", amount: 50, reason: "customer asked for half" } },
]);

const unknown = decision("h-unknown", "a lookup for an order that does not exist", [
  { name: "lookup_order", args: { orderId: "ORD-9999" } },
]);

/**
 * Six cases, and each failing case is refused by exactly one rule.
 *
 * That last property is the chapter's craft: a case that is refused by the
 * window and the ceiling at once cannot say which of them the suite is
 * testing, and a mutant of either one survives for a reason nobody learns.
 */
export const CASES: Case[] = [
  {
    id: "s1-refund",
    tape: loadTrace("t1"),
    expect: {
      pass: true,
      refunds: 1,
      escalations: 0,
      amount: 84,
      currency: "EUR",
      reportedAmount: 84,
      reportedCurrency: "EUR",
    },
    note: "the recorded refund run, end to end",
    source: "recorded",
  },
  {
    id: "s2-escalate",
    tape: loadTrace("t2"),
    expect: { pass: true, refunds: 0, escalations: 1 },
    note: "the recorded outside-window run, which escalated",
    source: "recorded",
  },
  {
    id: "s3-window",
    tape: refund7901,
    expect: { pass: false, refunds: 0, escalations: 0 },
    note: "a refund request refused by the window, and only by the window",
    source: "authored",
  },
  {
    id: "s4-ceiling",
    tape: refund7900,
    expect: { pass: false, refunds: 0 },
    note: "a refund request refused by the ceiling, and only by the ceiling",
    source: "authored",
  },
  {
    id: "s5-partial",
    tape: partial7712,
    expect: { pass: false, refunds: 0 },
    note: "a refund request refused by the total rule, and only by the total rule",
    source: "authored",
  },
  {
    id: "s6-unknown",
    tape: unknown,
    expect: { pass: false, refunds: 0, escalations: 0 },
    note: "a lookup for an order that does not exist",
    source: "authored",
  },
];

export interface CaseResult {
  id: string;
  holds: boolean;
  /** The expectation fields that did not hold. */
  failed: string[];
  reason: string;
}

/** A fresh, clean subject: one per case, because a replay writes to its desk. */
export function clean(): Subject {
  return runtime();
}

function expectHolds(expect: Expect, desk: Desk, pass: boolean, results: readonly string[]): string[] {
  const failures: string[] = [];
  if (expect.pass !== undefined && expect.pass !== pass) failures.push("pass");
  if (expect.refunds !== undefined && expect.refunds !== desk.refunds.length) failures.push("refunds");
  if (expect.escalations !== undefined && expect.escalations !== desk.escalations.length) failures.push("escalations");
  if (expect.amount !== undefined && expect.amount !== desk.refunds[0]?.amount) failures.push("amount");
  if (expect.currency !== undefined && expect.currency !== desk.refunds[0]?.currency) failures.push("currency");

  // The claim and the world are two different things, and a case may check both.
  const reported = reportedRefund(results);
  if (expect.reportedAmount !== undefined && expect.reportedAmount !== reported.amount) failures.push("reportedAmount");
  if (expect.reportedCurrency !== undefined && expect.reportedCurrency !== reported.currency) {
    failures.push("reportedCurrency");
  }
  return failures;
}

/** The last refund the tools reported back, parsed from the replayed results. */
export function reportedRefund(results: readonly string[]): { amount?: number; currency?: string } {
  const raw = [...results].reverse().find((r) => r.includes("refundId"));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { amount?: unknown; currency?: unknown };
    return {
      amount: typeof parsed.amount === "number" ? parsed.amount : undefined,
      currency: typeof parsed.currency === "string" ? parsed.currency : undefined,
    };
  } catch {
    return {};
  }
}

export async function runCase(c: Case, subject: Subject): Promise<CaseResult> {
  const trace = await replay(c.tape, subject);
  const failed = expectHolds(c.expect, subject.desk, trace.outcome.pass, trace.results);
  return {
    id: c.id,
    holds: failed.length === 0,
    failed,
    reason: trace.outcome.reason,
  };
}

/** Run every case against a fresh subject from the factory. */
export async function runSuite(make: () => Subject, cases: Case[] = CASES): Promise<CaseResult[]> {
  const out: CaseResult[] = [];
  for (const c of cases) out.push(await runCase(c, make()));
  return out;
}

export interface MutantRow {
  id: string;
  axis: string;
  killed: boolean;
  /** The first case that failed, which is the one that caught it. */
  killedBy?: string;
  /** The declared survival reason, if the reviewer gave one. */
  declared?: Survival;
  why?: string;
}

/** Run one mutant against the whole suite and say which case noticed. */
export async function evaluate(m: Mutation, cases: Case[] = CASES): Promise<MutantRow> {
  const results = await runSuite(() => m.apply(runtime()), cases);
  const caught = results.find((r) => !r.holds);
  return {
    id: m.id,
    axis: m.axis,
    killed: caught !== undefined,
    killedBy: caught?.id,
    declared: m.survives?.kind,
    why: m.survives?.why,
  };
}

/** Every mutant, in declaration order. */
export async function matrix(cases: Case[] = CASES): Promise<MutantRow[]> {
  const rows: MutantRow[] = [];
  for (const m of MUTATIONS) rows.push(await evaluate(m, cases));
  return rows;
}

export interface Score {
  mutants: number;
  killed: number;
  survived: number;
  declared: number;
  raw: number;
  adjusted: number;
  /** Survivors with no written reason: the gate's actual failure. */
  unexplained: string[];
  /** Declared survivors that died: the exception list is stale. */
  contradicted: string[];
}

/**
 * Two scores, and the second is the one a gate should use.
 *
 * `raw` counts every mutant, so an exception list that grows lowers it and
 * nobody is ever right. `adjusted` removes the survivors a reviewer declared,
 * and then demands that every remaining survivor be explained — which is a
 * property of the report, not of the arithmetic.
 */
export function score(rows: MutantRow[]): Score {
  const killed = rows.filter((r) => r.killed).length;
  const survived = rows.length - killed;
  const declared = rows.filter((r) => !r.killed && r.declared).length;
  return {
    mutants: rows.length,
    killed,
    survived,
    declared,
    raw: rows.length === 0 ? 0 : killed / rows.length,
    adjusted: rows.length - declared === 0 ? 1 : killed / (rows.length - declared),
    unexplained: rows.filter((r) => !r.killed && !r.declared).map((r) => r.id),
    contradicted: rows.filter((r) => r.killed && r.declared).map((r) => r.id),
  };
}
