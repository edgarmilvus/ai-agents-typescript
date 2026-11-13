// Exercise 3, file 2 of 3 — the runs, and the clock.
//
// State, the used set and the revoked set live here, and nothing else does. The
// functions take `now` as an argument rather than reading a clock, which is what
// lets the scenario file move time by hand.

import { check, fingerprint, issue, KEY } from "./ex3_token.ts";
import type { Action, Token } from "./ex3_token.ts";

export type Status = "pending" | "approved" | "executed" | "refused";

export interface Run {
  id: string;
  status: Status;
  action: Action;
  requester: string;
  approval?: Token;
  refused?: string;
  effects: number;
}

export interface Store {
  runs: Map<string, Run>;
  used: Set<string>;
  revoked: Set<string>;
}

export function createStore(): Store {
  return { runs: new Map(), used: new Set(), revoked: new Set() };
}

export function propose(store: Store, id: string, action: Action, requester = "agent"): Run {
  const run: Run = { id, status: "pending", action, requester, effects: 0 };
  store.runs.set(id, run);
  return run;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string };

function refuse<T>(run: Run, reason: string): Outcome<T> {
  run.status = "refused";
  run.refused = reason;
  return { ok: false, reason };
}

export function approve(store: Store, id: string, approver: string, now: number, ttl: number, approvers: string[]): Outcome<Run> {
  const run = store.runs.get(id);
  if (!run) return { ok: false, reason: `no run ${id}` };
  if (run.status !== "pending") return refuse(run, `run is ${run.status}`);
  if (!approvers.includes(approver)) return refuse(run, `${approver} is not an approver`);
  if (approver === run.requester) return refuse(run, "the requester cannot approve their own action");

  run.approval = issue(
    { runId: run.id, actionHash: fingerprint(run.action), approver, issuedAt: now, expiresAt: now + ttl },
    KEY,
  );
  return { ok: true, value: run };
}

export function resume(store: Store, id: string, token: Token, now: number): Outcome<Run> {
  const run = store.runs.get(id);
  if (!run) return { ok: false, reason: `no run ${id}` };
  if (run.status !== "pending") return refuse(run, `run is ${run.status}`);
  if (store.revoked.has(token.signature)) return refuse(run, "the approval was revoked");
  if (store.used.has(token.signature)) return refuse(run, "this approval has already been used");

  const result = check(token, { runId: run.id, action: run.action, now }, KEY);
  if (!result.ok) {
    if (result.why === "expired") return { ok: false, reason: "the approval expired" };
    return refuse(run, `token refused: ${result.why}`);
  }

  run.approval = token;
  run.status = "approved";
  return { ok: true, value: run };
}

export function execute(store: Store, id: string, now: number): Outcome<Run> {
  const run = store.runs.get(id);
  if (!run) return { ok: false, reason: `no run ${id}` };
  if (run.status !== "approved" || !run.approval) return refuse(run, "the run has no approval");
  if (store.revoked.has(run.approval.signature)) return refuse(run, "the approval was revoked");
  if (store.used.has(run.approval.signature)) return refuse(run, "this approval has already been used");

  store.used.add(run.approval.signature);
  run.status = "executed";
  run.effects += 1;
  run.refused = undefined;
  return { ok: true, value: run };
}

export function revoke(store: Store, id: string): Outcome<Run> {
  const run = store.runs.get(id);
  if (!run) return { ok: false, reason: `no run ${id}` };
  if (run.status === "executed") return refuse(run, "too late: the effect has happened");
  if (!run.approval) return refuse(run, "there is no approval to revoke");
  store.revoked.add(run.approval.signature);
  return { ok: true, value: run };
}
