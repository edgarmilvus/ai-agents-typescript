// Exercise 3, file 2 of 3 — the engine, which knows nothing about the corpus.
//
// A subject is a failure, the green run it is compared with, and a probe that
// restores axes and replays. The engine probes, reads the four roles from the
// attempts it has, and derives a verdict kind from those roles alone. It does
// not import the desk and it has never heard of a refund: the refunds live in
// file 3, which is the only file that knows what a case is.
//
// Deriving the kind a second way — from roles rather than from the search — is
// the point of the exercise. When two derivations disagree, one of them is
// wrong, and the disagreement is a test that runs on every row.

import { attribute } from "../../attribute.ts";
import type { Attempt, Attribution, Probe } from "../../attribute.ts";
import { isUpstream } from "../../trace.ts";
import type { Axis, Trace } from "../../trace.ts";
import { roleOf } from "./ex1_necessary.ts";
import type { Repairs, Role } from "./ex1_necessary.ts";

export interface Subject {
  id: string;
  /** The axes the construction blames. Empty means the decisions. */
  truth: Axis[];
  failure: Trace;
  baseline: Trace;
  probe: Probe;
}

export interface Row {
  id: string;
  truth: Axis[];
  suspects: Axis[];
  roles: Record<string, Role>;
  /** The kind the library's search reports. */
  search: Attribution["verdict"]["kind"];
  /** The kind derived from the roles, without looking at the search. */
  derived: Attribution["verdict"]["kind"];
  /** Both say the same thing. */
  agree: boolean;
  replays: number;
  match: boolean;
  outcome: string;
}

/** A repair predicate backed by attempts already made: unprobed sets are red. */
export function repairsFrom(attempts: Attempt[]): Repairs {
  const key = (axes: readonly Axis[]) => [...axes].sort().join("+");
  const table = new Map(attempts.map((a) => [key(a.axes), a.repairs]));
  return (axes) => table.get(key(axes)) === true;
}

/**
 * The verdict kind, from the roles of the suspects.
 *
 * The order matters. A sufficient axis that is also necessary is the only
 * component that has to move, so it is a single; several sufficient axes mean
 * either rollback works; no sufficient axis but every suspect necessary means
 * the set has to move together; and when no downstream axis can be blamed, the
 * answer is upstream of the decisions or in the decisions themselves.
 */
export function kindFrom(suspects: Axis[], roles: Record<string, Role>): Attribution["verdict"]["kind"] {
  const sufficient = suspects.filter((a) => roles[a]?.startsWith("sufficient"));
  const necessary = suspects.filter((a) => roles[a]?.endsWith("necessary"));
  const downstream = suspects.filter((a) => !isUpstream(a));

  if (sufficient.length === 1 && necessary.length === 1) return "single";
  if (sufficient.length > 1) return "joint";
  if (sufficient.length === 0 && downstream.length > 0 && necessary.length === downstream.length) {
    return "interaction";
  }
  if (suspects.some((a) => isUpstream(a))) return "upstream";
  return "decisions";
}

/** Probe one subject, then read the verdict two ways and compare them. */
export async function judge(subject: Subject): Promise<Row> {
  const attribution = await attribute(subject.failure, subject.baseline, subject.probe);
  const repairs = repairsFrom(attribution.attempts);
  const roles: Record<string, Role> = {};
  for (const axis of attribution.suspects) {
    roles[axis] = roleOf(axis, attribution.suspects, repairs);
  }

  const derived = kindFrom(attribution.suspects, roles);
  return {
    id: subject.id,
    truth: subject.truth,
    suspects: attribution.suspects,
    roles,
    search: attribution.verdict.kind,
    derived,
    agree:
      derived === attribution.verdict.kind &&
      subject.truth.length === attribution.verdict.axes.length,
    replays: attribution.replays,
    match: [...subject.truth].sort().join("+") === [...attribution.verdict.axes].sort().join("+"),
    outcome: subject.failure.outcome.reason,
  };
}

/** One subject after another: replays build fresh desks, so order is free. */
export async function sweep(subjects: Subject[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (const subject of subjects) rows.push(await judge(subject));
  return rows;
}
