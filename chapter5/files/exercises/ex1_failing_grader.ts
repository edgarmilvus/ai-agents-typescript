// Exercise 1 — a grader that can fail.
//
// A grader that always returns 1 is not a grader. This one checks the effect
// and the route, and it is written so that the second half can fail alone.

import type { Run } from "../../../chapter1/files/agent.ts";

export interface Verdict {
  passed: boolean;
  reasons: string[];
}

export function gradeRefund(run: Run, world: { refunds: { amount: number }[] }, expected: number): Verdict {
  const reasons: string[] = [];
  if (run.stopReason !== "answered") reasons.push(`run ended ${run.stopReason}`);
  if (world.refunds.length !== 1) reasons.push(`expected 1 refund, got ${world.refunds.length}`);
  else if (world.refunds[0].amount !== expected) reasons.push(`refunded ${world.refunds[0].amount}, expected ${expected}`);
  const asked = run.steps.some((s) => s.call.name === "refund_policy");
  if (!asked && world.refunds.length) reasons.push("refunded without reading the policy");
  return { passed: reasons.length === 0, reasons };
}

export function demo() {
  const good = { stopReason: "answered", answer: "ok", steps: [{ call: { name: "refund_policy" } }] } as unknown as Run;
  const bad = { stopReason: "answered", answer: "ok", steps: [] } as unknown as Run;
  return {
    good: gradeRefund(good, { refunds: [{ amount: 84 }] }, 84),
    wrongAmount: gradeRefund(good, { refunds: [{ amount: 48 }] }, 84),
    noPolicy: gradeRefund(bad, { refunds: [{ amount: 84 }] }, 84),
    nothing: gradeRefund(good, { refunds: [] }, 84),
  };
}

if (import.meta.main) {
  for (const [k, v] of Object.entries(demo())) console.log(`${k.padEnd(12)} ${v.passed ? "pass" : "fail"}  ${v.reasons.join("; ")}`);
}
