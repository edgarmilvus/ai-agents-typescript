// Exercise 4 — what a rollback costs, and what waiting costs.
//
// A canary does not prevent bad requests; it bounds them. The number that
// matters is exposure: how many customers saw the divergence before the rule
// stopped it. This file prices that, per candidate, under the two policies —
// and prices the third option, which is to have found the divergence in shadow
// and sent nothing at all.

import type { Comparison } from "../../releases.ts";
import { COSMETIC, IDEMPOTENT, LEFTOVER, ROUNDING, STALE_POLICY, shadow } from "../../releases.ts";
import { rollout, severityFirst } from "../../canary.ts";
import { stream } from "../../traffic.ts";

export interface Exposure {
  requests: number;
  bad: number;
  money: number;
}

function amountOf(row: Comparison): number {
  const amounts = [...row.incumbent.actions, ...row.candidate.actions]
    .filter((a) => a.kind === "refund")
    .map((a) => a.amount ?? 0);
  return amounts.length ? Math.max(...amounts) : 0;
}

/** What the first `stopAt` requests cost, before the rule stopped the rollout. */
export function exposure(rows: Comparison[], stopAt: number): Exposure {
  const seen = rows.slice(0, stopAt);
  const bad = seen.filter((r) => r.kind === "critical" || r.kind === "material" || r.kind === "silent");
  return {
    requests: seen.length,
    bad: bad.length,
    money: Number(bad.reduce((sum, row) => sum + amountOf(row), 0).toFixed(2)),
  };
}

export function demo() {
  const requests = stream();
  const candidates = [IDEMPOTENT, ROUNDING, STALE_POLICY, COSMETIC, LEFTOVER];
  return candidates.map((candidate) => {
    const rows = shadow(requests, candidate);
    const decision = rollout(rows, severityFirst());
    return {
      id: candidate.id,
      decision: decision.decision,
      at: decision.at,
      before: exposure(rows, decision.at),
      shadowOnly: exposure(rows, 0),
      ifPromoted: exposure(rows, rows.length),
    };
  });
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# exposure, by policy\n");
  console.log("  candidate          stop      requests  bad  money     if promoted instead");
  for (const row of rows) {
    console.log(
      `  ${row.id.padEnd(18)} ${`${row.decision}@${row.at}`.padEnd(9)} ${String(row.before.requests).padStart(8)}  ` +
        `${String(row.before.bad).padStart(3)}  ${String(row.before.money).padStart(8)}  ` +
        `${row.ifPromoted.requests} requests, ${row.ifPromoted.bad} bad, ${row.ifPromoted.money}`,
    );
  }

  console.log("\n  shadow is not a row in this table because its exposure is zero: the");
  console.log("  divergence is found before a customer is routed to the release at all.");
  console.log("  The canary's numbers are the ones you pay when you cannot shadow — an");
  console.log("  upstream change, a component you can only see in production, a load");
  console.log("  pattern nobody can reproduce.");
  console.log("\n  the cost of a rollback is one engineering hour and one awkward message.");
  console.log("  That is cheap, which is why the rule can be aggressive: the expensive");
  console.log("  mistake is not rolling back a good release, it is promoting a bad one and");
  console.log("  discovering it from a customer.");
}

if (import.meta.main) report(demo());
