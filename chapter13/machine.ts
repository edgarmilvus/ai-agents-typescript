// Chapter 13 — the run, and the four moves it allows.
//
// A run is proposed, approved, resumed and executed, and it can be refused at
// any of those points. The machine keeps the proposal, the token and the
// refusal reason, because the audit is the point: a refusal that does not say
// which check failed is indistinguishable from a bug.
//
// The agent's only role is to propose. It cannot approve, it cannot mint a
// token, and it cannot resume without one: the token is the authorisation and
// the key lives on the other side of the boundary.

import type { Action, Token } from "./token.ts";
import { actionHash, mint, verify } from "./token.ts";
import type { World } from "./world.ts";
import { apply } from "./world.ts";

export type Status = "pending" | "approved" | "executed" | "refused";

export interface Proposal {
  action: Action;
  /** Why the agent thinks this should happen, in its own words. */
  reason: string;
  /** What it read to decide: order ids, policy rows, note ids. */
  evidence: string[];
  /** A proposal nobody approves by this tick is dead. */
  expiresAt: number;
}

export interface Run {
  id: string;
  status: Status;
  requester: string;
  proposal: Proposal;
  approval?: Token;
  refused?: string;
  executedAt?: number;
  /** What the world did when the run was executed. */
  applied?: boolean;
}

export interface Store {
  runs: Map<string, Run>;
  /** Signatures that have already produced an effect. */
  used: Set<string>;
  /** Signatures revoked before they were used. */
  revoked: Set<string>;
}

export function createStore(): Store {
  return { runs: new Map(), used: new Set(), revoked: new Set() };
}

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string };

function fail<T>(run: Run | undefined, reason: string): Result<T> {
  if (run && run.status !== "executed") {
    run.status = "refused";
    run.refused = reason;
  }
  return { ok: false, reason };
}

/** The agent's move: turn a proposal into a pending run. */
export function propose(store: Store, run: Omit<Run, "status">): Run {
  const full: Run = { ...run, status: "pending" };
  store.runs.set(full.id, full);
  return full;
}

/**
 * The approver's move.
 *
 * Four checks, in an order that makes the refusal useful: the run is still
 * waiting, the proposal has not expired, the approver is allowed to approve,
 * and the approver is not the party that asked. The last one is the four-eyes
 * rule, and it is the difference between an approval and a confirmation.
 */
export function approve(
  store: Store,
  id: string,
  approver: string,
  now: number,
  ttl: number,
  key: string,
  approvers: string[],
): Result<Run> {
  const run = store.runs.get(id);
  if (!run) return fail(undefined, `no run ${id}`);
  if (run.status !== "pending") return fail(run, `run ${id} is ${run.status}, not pending`);
  if (now > run.proposal.expiresAt) return fail(run, "the proposal expired before anyone approved it");
  if (!approvers.includes(approver)) return fail(run, `${approver} is not an approver`);
  if (approver === run.requester) return fail(run, "the requester cannot approve their own action");

  const token = mint(
    {
      runId: run.id,
      actionHash: actionHash(run.proposal.action),
      approver,
      issuedAt: now,
      expiresAt: Math.min(now + ttl, run.proposal.expiresAt),
    },
    key,
  );
  run.approval = token;
  return { ok: true, value: run };
}

/** The system's move: accept a token and put the run back on its feet. */
export function resume(
  store: Store,
  id: string,
  token: Token,
  now: number,
  key: string,
): Result<Run> {
  const run = store.runs.get(id);
  if (!run) return fail(undefined, `no run ${id}`);
  if (run.status === "executed") return fail(run, `run ${id} has already been executed`);
  if (run.status !== "pending") return fail(run, `run ${id} is ${run.status}, not pending`);

  const revoked = store.revoked.has(token.signature);
  if (revoked) return fail(run, "the approval was revoked");

  const check = verify(token, { runId: run.id, action: run.proposal.action, now }, key);
  if (!check.ok) {
    // An expired token is not a refusal of the request: the proposal is still
    // open, and a fresh approval can be issued inside its window. A tampered or
    // misdirected token is a refusal, because it is an attempt at something.
    if (/expired/.test(check.reason)) return { ok: false, reason: check.reason };
    return fail(run, check.reason);
  }

  if (store.used.has(token.signature)) return fail(run, "this approval has already been used");

  run.approval = token;
  run.status = "approved";
  return { ok: true, value: run };
}

/**
 * The effect.
 *
 * The world de-duplicates on the run-and-action key, so a process that died
 * after the refund and before the record produces one refund and one
 * reconciliation, not two refunds. The token is burned on the way out: an
 * approval is good for one effect, ever.
 */
export function execute(store: Store, id: string, world: World, now: number): Result<{ run: Run; applied: boolean }> {
  const run = store.runs.get(id);
  if (!run) return fail(undefined, `no run ${id}`);
  if (run.status !== "approved") return fail(run, `run ${id} is ${run.status}, not approved`);
  if (!run.approval) return fail(run, "no approval on record");
  if (store.revoked.has(run.approval.signature)) return fail(run, "the approval was revoked before the effect");
  if (store.used.has(run.approval.signature)) return fail(run, "this approval has already been used");

  const key = `${run.id}/${actionHash(run.proposal.action)}`;
  const result = apply(world, key, run.proposal.action.tool, run.proposal.action.args, now);
  store.used.add(run.approval.signature);
  run.status = "executed";
  run.executedAt = now;
  run.applied = result.applied;
  return { ok: true, value: { run, applied: result.applied } };
}

/** Take an approval back before it is used. */
export function revoke(store: Store, id: string): Result<Run> {
  const run = store.runs.get(id);
  if (!run) return fail(undefined, `no run ${id}`);
  if (run.status === "executed") return fail(run, "too late: the effect has happened");
  if (!run.approval) return fail(run, "there is no approval to revoke");
  store.revoked.add(run.approval.signature);
  return { ok: true, value: run };
}
