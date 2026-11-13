// Exercise 3, file 2 of 3 — the stream, which is the only file with an effect.
//
// It walks the shadowed comparisons in order, feeds the boundary, and stops
// asking when the boundary has decided. It knows nothing about how a decision
// is computed and nothing about which candidates exist: it is handed both.

import { shadow } from "../../releases.ts";
import type { Release } from "../../releases.ts";
import type { Request } from "../../traffic.ts";
import type { Boundary, Decision } from "./ex3_boundary.ts";

export interface Outcome {
  decision: Decision;
  /** One-based request at which the decision was made. */
  at: number;
  seen: number;
  divergences: number;
  /** The request whose comparison stopped the rollout, if one did. */
  stoppedBy?: number;
}

export function walk(requests: Request[], candidate: Release, boundary: Boundary): Outcome {
  const rows = shadow(requests, candidate);
  let stoppedBy: number | undefined;

  for (const row of rows) {
    const decision = boundary.observe(row.kind);
    if (decision !== "continue") {
      stoppedBy ??= row.request.at + 1;
      return {
        decision,
        at: boundary.seen,
        seen: boundary.seen,
        divergences: boundary.divergences,
        stoppedBy,
      };
    }
  }

  return {
    decision: "promote",
    at: boundary.seen,
    seen: boundary.seen,
    divergences: boundary.divergences,
    stoppedBy,
  };
}
