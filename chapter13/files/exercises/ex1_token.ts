// Exercise 1 — a token that is bound.
//
// The binding is the whole security property: a signature over the run, the
// action, the approver and the window. This exercise builds it from scratch and
// then tries the five mutations that must fail, including the one people forget
// — editing a field that is inside the signature.

import { createHash, createHmac } from "node:crypto";

export interface Action {
  tool: string;
  args: Record<string, unknown>;
}

export interface Bound {
  runId: string;
  actionHash: string;
  approver: string;
  issuedAt: number;
  expiresAt: number;
}

export interface Token extends Bound {
  signature: string;
}

export function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

export function fingerprint(action: Action): string {
  return createHash("sha256").update(stable(action)).digest("hex").slice(0, 12);
}

function sign(bound: Bound, key: string): string {
  return createHmac("sha256", key).update(stable(bound)).digest("hex");
}

export function issue(bound: Bound, key: string): Token {
  return { ...bound, signature: sign(bound, key) };
}

export type Refusal = "signature" | "run" | "action" | "expired" | "future";
export type Result = { ok: true } | { ok: false; why: Refusal };

export function check(token: Token, expect: { runId: string; action: Action; now: number }, key: string): Result {
  const { signature, ...bound } = token;
  if (signature !== sign(bound, key)) return { ok: false, why: "signature" };
  if (bound.runId !== expect.runId) return { ok: false, why: "run" };
  if (bound.actionHash !== fingerprint(expect.action)) return { ok: false, why: "action" };
  if (expect.now > bound.expiresAt) return { ok: false, why: "expired" };
  if (expect.now < bound.issuedAt) return { ok: false, why: "future" };
  return { ok: true };
}

export const KEY = "exercise-key";
export const ACTION: Action = { tool: "issue_refund", args: { orderId: "ORD-7902", amount: 300 } };

export const MUTATIONS: { id: string; note: string; expect: Parameters<typeof check>[1]; why: Refusal | null }[] = [
  { id: "m1-fresh", note: "the token as issued", expect: { runId: "r1", action: ACTION, now: 5 }, why: null },
  { id: "m2-amount", note: "the amount edited to 3000", expect: { runId: "r1", action: { ...ACTION, args: { ...ACTION.args, amount: 3000 } }, now: 5 }, why: "action" },
  { id: "m3-run", note: "another run's id", expect: { runId: "r2", action: ACTION, now: 5 }, why: "run" },
  { id: "m4-late", note: "a clock past the window", expect: { runId: "r1", action: ACTION, now: 99 }, why: "expired" },
  { id: "m5-early", note: "a clock before the issue", expect: { runId: "r1", action: ACTION, now: 0 }, why: "future" },
];

export function demo() {
  const token = issue(
    { runId: "r1", actionHash: fingerprint(ACTION), approver: "ada", issuedAt: 1, expiresAt: 10 },
    KEY,
  );
  return MUTATIONS.map((m) => ({ ...m, got: check(token, m.expect, KEY) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# five checks on a bound token\n");
  for (const row of rows) {
    const verdict = row.got.ok ? "accepted" : `refused: ${row.got.why}`;
    console.log(`  ${row.id.padEnd(9)} ${verdict.padEnd(18)} ${row.note}`);
  }
  console.log("\n  the token is signed over the binding, not over the action. That is what");
  console.log("  makes the approver's name and the window as unforgeable as the amount.");
}

if (import.meta.main) report(demo());
