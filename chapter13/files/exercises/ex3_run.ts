// Exercise 3, file 3 of 3 — the wiring, and five scenarios.
//
// The only file that owns a clock: every scenario moves `now` by hand, which is
// what makes expiry testable without waiting for anything.

import { approve, createStore, execute, propose, resume, revoke } from "./ex3_runs.ts";
import type { Store } from "./ex3_runs.ts";
import { KEY } from "./ex3_token.ts";

const APPROVERS = ["ada", "grace"];
const TTL = 5;
const ACTION = { tool: "issue_refund", args: { orderId: "ORD-7902", amount: 300 } };

function fixture(requester = "agent"): { store: Store; id: string } {
  const store = createStore();
  propose(store, "r1", ACTION, requester);
  return { store, id: "r1" };
}

export interface Row {
  id: string;
  note: string;
  status: string;
  effects: number;
  reason?: string;
}

export function demo(): Row[] {
  const rows: Row[] = [];

  {
    const { store, id } = fixture();
    approve(store, id, "ada", 1, TTL, APPROVERS);
    resume(store, id, store.runs.get(id)!.approval!, 2);
    execute(store, id, 3);
    const run = store.runs.get(id)!;
    rows.push({ id: "s1-happy", note: "approve, resume, execute", status: run.status, effects: run.effects });
  }

  {
    const { store, id } = fixture();
    approve(store, id, "ada", 1, TTL, APPROVERS);
    const late = resume(store, id, store.runs.get(id)!.approval!, 9);
    rows.push({ id: "s2-expired-token", note: "the token dies before it is used", status: store.runs.get(id)!.status, effects: 0, reason: late.ok ? undefined : late.reason });
  }

  {
    const { store, id } = fixture();
    approve(store, id, "ada", 1, TTL, APPROVERS);
    const run = store.runs.get(id)!;
    run.action = { ...ACTION, args: { amount: 3000 } };
    const out = resume(store, id, run.approval!, 2);
    rows.push({ id: "s3-edited", note: "the action changes after approval", status: run.status, effects: 0, reason: out.ok ? undefined : out.reason });
  }

  {
    const { store, id } = fixture("ada");
    const out = approve(store, id, "ada", 1, TTL, APPROVERS);
    rows.push({ id: "s4-self", note: "the requester approves their own", status: store.runs.get(id)!.status, effects: 0, reason: out.ok ? undefined : out.reason });
  }

  {
    const { store, id } = fixture();
    approve(store, id, "ada", 1, TTL, APPROVERS);
    revoke(store, id);
    const out = resume(store, id, store.runs.get(id)!.approval!, 2);
    rows.push({ id: "s5-revoked", note: "the approval is taken back", status: store.runs.get(id)!.status, effects: 0, reason: out.ok ? undefined : out.reason });
  }

  return rows;
}

export function report(rows: Row[]): void {
  console.log("# five scenarios, one clock\n");
  console.log("  scenario         status    effects  reason");
  for (const row of rows) {
    console.log(`  ${row.id.padEnd(16)} ${row.status.padEnd(9)} ${String(row.effects).padStart(7)}  ${row.reason ?? "-"}`);
  }
  console.log("\n  the clock is a parameter in every function, so s2 is two lines and no");
  console.log("  waiting. A machine that read the wall clock would need a mock, and a");
  console.log("  mock of time is where expiry tests go to die.");
}

if (import.meta.main) report(demo());
