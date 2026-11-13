// Chapter 8 — suspects, probes, and the four verdicts a probe can support.
//
// The rule is narrow on purpose. A component is the cause when restoring it,
// and only it, turns the run green. Everything that rule cannot decide is
// reported as undecided, because a confident wrong attribution is worse than
// an honest "two deploys, either rollback works".

import type { Axis, Trace } from "./trace.ts";
import { AXES, isUpstream } from "./trace.ts";

export type Verdict =
  | { kind: "single"; axes: Axis[]; note: string }
  | { kind: "joint"; axes: Axis[]; note: string }
  | { kind: "interaction"; axes: Axis[]; note: string }
  | { kind: "upstream"; axes: Axis[]; note: string }
  | { kind: "decisions"; axes: []; note: string };

export interface Attempt {
  axes: Axis[];
  trace: Trace;
  repairs: boolean;
}

export interface Attribution {
  /** Axes whose configuration differs from the green run. */
  suspects: Axis[];
  attempts: Attempt[];
  verdict: Verdict;
  /** How many replays the verdict cost. A re-run would cost model calls. */
  replays: number;
}

/** Restore one or more axes and replay the failing tape under the result. */
export type Probe = (axes: Axis[]) => Promise<Trace>;

export function suspectsOf(failure: Trace, baseline: Trace): Axis[] {
  return AXES.filter((axis) => failure.axes[axis] !== baseline.axes[axis]);
}

function pairs(axes: Axis[]): Axis[][] {
  const out: Axis[][] = [];
  for (let i = 0; i < axes.length; i += 1) {
    for (let j = i + 1; j < axes.length; j += 1) out.push([axes[i], axes[j]]);
  }
  return out;
}

const label = (axes: Axis[]): string => axes.join(" + ");

/**
 * Attribute a failure by substitution.
 *
 * The probe restores a set of axes to their known-good version and replays the
 * failing tape. The verdict is the smallest set whose restoration repairs the
 * run; when no downstream set repairs, the cause is upstream by elimination,
 * and the report says so instead of naming a component it did not test.
 */
export async function attribute(
  failure: Trace,
  baseline: Trace,
  probe: Probe,
): Promise<Attribution> {
  const suspects = suspectsOf(failure, baseline);
  const downstream = suspects.filter((axis) => !isUpstream(axis));
  const attempts: Attempt[] = [];

  for (const axis of downstream) {
    const trace = await probe([axis]);
    attempts.push({ axes: [axis], trace, repairs: trace.outcome.pass });
  }

  const singles = attempts.filter((a) => a.repairs).map((a) => a.axes[0]);

  if (singles.length === 1) {
    return {
      suspects,
      attempts,
      replays: attempts.length,
      verdict: {
        kind: "single",
        axes: singles,
        note: `restoring ${singles[0]} alone turns the run green`,
      },
    };
  }

  if (singles.length > 1) {
    return {
      suspects,
      attempts,
      replays: attempts.length,
      verdict: {
        kind: "joint",
        axes: singles,
        note: `${label(singles)} each repair the run alone; together they are the failure, and behaviour cannot say which one is the bug`,
      },
    };
  }

  const pairAttempts: Attempt[] = [];
  for (const pair of pairs(downstream)) {
    const trace = await probe(pair);
    pairAttempts.push({ axes: pair, trace, repairs: trace.outcome.pass });
  }
  attempts.push(...pairAttempts);

  const repairing = pairAttempts.filter((a) => a.repairs);
  if (repairing.length === 1) {
    return {
      suspects,
      attempts,
      replays: attempts.length,
      verdict: {
        kind: "interaction",
        axes: repairing[0].axes,
        note: `no single restore repairs the run; ${label(repairing[0].axes)} together do`,
      },
    };
  }

  if (repairing.length > 1) {
    return {
      suspects,
      attempts,
      replays: attempts.length,
      verdict: {
        kind: "decisions",
        axes: [],
        note: `${repairing.length} pairs repair the run, so the probe cannot name one cause`,
      },
    };
  }

  const upstream = suspects.filter((axis) => isUpstream(axis));
  if (upstream.length > 0) {
    return {
      suspects,
      attempts,
      replays: attempts.length,
      verdict: {
        kind: "upstream",
        axes: upstream,
        note: `${label(upstream)} changed upstream of the decisions; no replay can test it, so the answer needs a new run`,
      },
    };
  }

  return {
    suspects,
    attempts,
    replays: attempts.length,
    verdict: {
      kind: "decisions",
      axes: [],
      note: "no configuration changed and no downstream restore repairs the run: the decisions themselves are the cause",
    },
  };
}

/** Does a verdict name exactly the axes the planted failure used? */
export function matches(verdict: Verdict, truth: readonly Axis[]): boolean {
  if (truth.length === 0) return verdict.kind === "decisions";
  if (verdict.axes.length !== truth.length) return false;
  return truth.every((axis) => verdict.axes.includes(axis));
}

export function explain(verdict: Verdict): string {
  return `${verdict.kind}: ${verdict.note}`;
}
