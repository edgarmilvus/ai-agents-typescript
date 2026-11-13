// Exercise 3, file 3 of 3 — the wiring, and the policy comparison.
//
// The same stream through the same boundary, with the severity question on and
// off. The interesting row is the leftover guard: with severity it stops at the
// first refusal, and without it the boundary promotes a release that crashes on
// one order in two hundred and forty.

import { DEFAULTS, boundary } from "./ex3_boundary.ts";
import { walk } from "./ex3_stream.ts";
import { IDEMPOTENT, LEFTOVER, ROUNDING, STALE_POLICY } from "../../releases.ts";
import { stream } from "../../traffic.ts";

const requests = stream();
const candidates = [IDEMPOTENT, ROUNDING, STALE_POLICY, LEFTOVER];

export function demo() {
  return candidates.map((candidate) => ({
    id: candidate.id,
    severity: walk(requests, candidate, boundary()),
    rateOnly: walk(requests, candidate, boundary({ ...DEFAULTS, severity: false })),
  }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# the same boundary, with and without the severity question\n");
  console.log("  candidate          severity first        rate only");
  for (const row of rows) {
    console.log(
      `  ${row.id.padEnd(18)} ${`${row.severity.decision} at ${row.severity.at}`.padEnd(21)} ` +
        `${row.rateOnly.decision} at ${row.rateOnly.at}`,
    );
  }
  console.log("\n  three of the four rows agree, which is the honest result: severity changes");
  console.log("  nothing when the rate is high enough to be caught anyway. The fourth is a");
  console.log("  release that refuses one order in two hundred and forty — one and a");
  console.log("  quarter percent — and the rate promotes it. That is the row the severity");
  console.log("  question exists for.");
}

if (import.meta.main) report(demo());
