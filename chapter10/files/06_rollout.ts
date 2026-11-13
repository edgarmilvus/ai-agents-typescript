// 10.6 — the rollout record: gate, shadow, canary, drift, decision.
//
// The canary is one of three inputs, and the record is what a reviewer reads
// after the fact. A release can pass the canary and still be held, because the
// comparison cannot see a failure both releases share; a release can fail the
// canary on a duplicate it declared, which is a bug in the declaration rather
// than in the release.

import { CANDIDATES, shadow } from "../releases.ts";
import { absolute, blindSpots } from "../drift.ts";
import { rollout, severityFirst } from "../canary.ts";
import { stream } from "../traffic.ts";

const requests = stream();

export type Final = "promote" | "hold" | "rollback";

export interface Record {
  release: string;
  requests: number;
  decidedAt: number;
  planned: number;
  cosmetic: number;
  unexpected: number;
  silent: number;
  absoluteFailures: number;
  blindSpots: string[];
  decision: Final;
  reason: string;
}

function decide(candidate: (typeof CANDIDATES)[number]): Record {
  const rows = shadow(requests, candidate);
  const canary = rollout(rows, severityFirst());
  const count = (kind: string) => rows.filter((r) => r.kind === kind).length;
  const absoluteFailures = absolute(requests, candidate).failures;
  const spots = blindSpots(requests, candidate).map((s) => `${s.feature}:${s.bucket}`);
  const unexpected = count("critical") + count("material") + count("silent");

  let decision: Final = "promote";
  let reason = `${canary.decision} at request ${canary.at} with ${unexpected} unexpected divergence(s)`;

  if (canary.decision === "rollback") {
    decision = "rollback";
    reason = `${canary.stoppedBy?.kind} at request ${canary.at}: ${canary.stoppedBy?.detail ?? "no detail"}`;
  } else if (spots.length > 0) {
    decision = "hold";
    reason =
      `the candidate is not worse than the incumbent, and ${absoluteFailures} request(s) fail ` +
      `in a bucket no case covers (${spots.join(", ")}); a human decides whether to promote and open an incident`;
  }

  return {
    release: candidate.id,
    requests: rows.length,
    decidedAt: canary.at,
    planned: count("planned"),
    cosmetic: count("cosmetic"),
    unexpected,
    silent: count("silent"),
    absoluteFailures,
    blindSpots: spots,
    decision,
    reason,
  };
}

const records = CANDIDATES.map(decide);

console.log("# five releases, five records\n");
console.log("  release          canary    unexpected  absolute  blind spots      decision");
for (const r of records) {
  console.log(
    `  ${r.release.padEnd(16)} ${String(r.decidedAt).padStart(4)} req  ${String(r.unexpected).padStart(10)}  ` +
      `${String(r.absoluteFailures).padStart(8)}  ${(r.blindSpots.join(",") || "-").padEnd(15)} ${r.decision}`,
  );
}

const promote = records.find((r) => r.release === "r2-idempotent");
console.log("\n# the record for the release that is actually correct\n");
console.log(JSON.stringify(promote, null, 2));

console.log("\n  the candidate removes a double payout that the incumbent performs on every");
console.log("  duplicate, and the record still does not say promote. Not because the");
console.log("  release is wrong — it is the only one in the table that is right — but");
console.log("  because the rollout would take the blame for a crash it did not cause.");
console.log("  The canary decides whether to trust the change. A human decides what to do");
console.log("  about the incident the change revealed.");
