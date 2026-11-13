// Chapter 9 — the gate: six conditions, and the one that tests the check.
//
// A mutation threshold on its own is a number a team learns to negotiate. The
// gate here is a conjunction: enough cases, all of them green on the clean
// build, every survivor explained, no stale declaration, the score above the
// line. Then a sixth condition that no tape can supply: direct tests of the
// check, run on hand-built desks, because the check is code and can be
// mutated like any other component.

import type { Subject } from "./variants.ts";
import type { Case } from "./suite.ts";
import { matrix, runSuite, score } from "./suite.ts";
import type { Desk, Refund } from "./desk9.ts";

export const GATE = { minCases: 6, minAdjusted: 1 };

function lookup(): { name: string; args: Record<string, unknown> } {
  return { name: "lookup_order", args: { orderId: "ORD-7712" } };
}

function refund(overrides: Partial<Refund> = {}): Refund {
  return { refundId: "rf_t", orderId: "ORD-7712", amount: 84, currency: "EUR", ...overrides };
}

/**
 * Six desks with a known right answer.
 *
 * Each test builds the subject, writes into *its* desk, and asks its check.
 * That is the only way to test a check that might be ignoring the desk: a
 * helper that called `check()` directly would test the clean code even when
 * the subject's check is the mutant.
 */
export function checkTests(make: () => Subject): { name: string; ok: boolean; got: boolean }[] {
  const tests: { name: string; fill: (desk: Desk) => void; expected: boolean }[] = [
    { name: "a correct refund passes", fill: (d) => d.refunds.push(refund()), expected: true },
    { name: "no action fails", fill: () => {}, expected: false },
    { name: "a refund in cents fails", fill: (d) => d.refunds.push(refund({ amount: 8400 })), expected: false },
    { name: "a wrong currency fails", fill: (d) => d.refunds.push(refund({ currency: "USD" })), expected: false },
    {
      name: "a refund plus an escalation fails",
      fill: (d) => {
        d.refunds.push(refund());
        d.escalations.push({ escalationId: "esc_t", orderId: "ORD-7712", reason: "customer asked" });
      },
      expected: false,
    },
    {
      name: "an escalation where a refund was due fails",
      fill: (d) => d.escalations.push({ escalationId: "esc_t", orderId: "ORD-7712", reason: "customer asked" }),
      expected: false,
    },
  ];

  return tests.map((t) => {
    const subject = make();
    subject.desk.calls.push(lookup());
    t.fill(subject.desk);
    const got = subject.check().pass;
    return { name: t.name, ok: got === t.expected, got };
  });
}

export interface GateResult {
  checks: { name: string; ok: boolean; detail: string }[];
  ok: boolean;
}

export async function gate(cases: Case[], make: () => Subject): Promise<GateResult> {
  const checks: GateResult["checks"] = [];

  checks.push({
    name: "enough cases",
    ok: cases.length >= GATE.minCases,
    detail: `${cases.length} cases (floor ${GATE.minCases})`,
  });

  const green = await runSuite(make, cases);
  const red = green.filter((r) => !r.holds);
  checks.push({
    name: "green on the clean build",
    ok: red.length === 0,
    detail: red.length === 0 ? "every case holds" : `${red.map((r) => r.id).join(", ")} fail on clean code`,
  });

  const s = score(await matrix(cases));
  checks.push({
    name: "score above the line",
    ok: s.adjusted >= GATE.minAdjusted,
    detail: `adjusted ${(s.adjusted * 100).toFixed(0)}% (floor ${(GATE.minAdjusted * 100).toFixed(0)}%)`,
  });
  checks.push({
    name: "every survivor explained",
    ok: s.unexplained.length === 0,
    detail: s.unexplained.length === 0 ? `${s.survived} survivor(s), all declared` : s.unexplained.join(", "),
  });
  checks.push({
    name: "no stale declaration",
    ok: s.contradicted.length === 0,
    detail: s.contradicted.length === 0 ? "none" : `${s.contradicted.join(", ")} declared but killed`,
  });

  const units = checkTests(make);
  const bad = units.filter((t) => !t.ok);
  checks.push({
    name: "the check is tested directly",
    ok: bad.length === 0,
    detail:
      bad.length === 0
        ? `${units.length} desks, all as expected`
        : `${bad.length}/${units.length} fail: ${bad.map((t) => t.name).join("; ")}`,
  });

  return { checks, ok: checks.every((c) => c.ok) };
}
