// Exercise 2 — the first difference, and the field behind it.
//
// A verdict names an axis. A fix needs a line. The bridge is the earliest
// difference between the failing run and the green one, followed by a field
// diff if the difference is a tool result. This file builds that bridge and
// then shows the three cases where it dead-ends, because knowing when there is
// nothing to point at is part of the drill-down.
//
// The ordering is not cosmetic. Turns are compared before results, because a
// different call is a different decision and no field of a result can explain
// it; results before length, because a short run is usually a run that stopped
// after a call that answered differently.

import { attribute } from "../../attribute.ts";
import { GREEN, restore, runUnder } from "../../desk.ts";
import { CASES, configOf, failing } from "../../planted.ts";
import { diff, fields, loadTrace } from "../../trace.ts";
import type { Axis, Divergence, Trace } from "../../trace.ts";

/** The call that produced result `index`, in tape order. */
export function callAt(trace: Trace, index: number): string | undefined {
  return trace.turns.flatMap((turn) => turn.calls.map((c) => c.name))[index];
}

export interface Located {
  divergence: Divergence;
  /** The call behind the difference, when the difference is a result. */
  call?: string;
  /** The fields that disagree, when both sides are JSON objects. */
  changes: { field: string; recorded: unknown; failing: unknown }[];
  /** Anything a reader can act on. */
  actionable: boolean;
}

/** Locate the earliest difference and, if it is a result, the field in it. */
export function locate(failingRun: Trace, green: Trace): Located {
  const divergence = diff(failingRun, green);
  if (divergence.kind !== "result") {
    return { divergence, changes: [], actionable: divergence.kind !== "same" };
  }
  const changes = fields(divergence.a, divergence.b).map((f) => ({
    field: f.field,
    recorded: f.b,
    failing: f.a,
  }));
  return {
    divergence,
    call: callAt(green, divergence.index),
    changes,
    actionable: changes.length > 0,
  };
}

/**
 * The claim a tool made, and the count the ledger kept.
 *
 * For a failure that never shows up as a differing result — the tool returned
 * the right JSON and the write went nowhere — this is the only field there is.
 */
export function claim(reason: string): { refunds: number; escalations: number } {
  const refunds = /got (\d+) refund\(s\)/.exec(reason);
  const escalations = /and (\d+) escalation\(s\)/.exec(reason);
  return {
    refunds: refunds ? Number(refunds[1]) : -1,
    escalations: escalations ? Number(escalations[1]) : -1,
  };
}

export async function demo() {
  const ids = ["c1-tool", "c2-world", "c3-grader", "c4-harness"];

  const rows = [];
  for (const id of ids) {
    const c = CASES.find((x) => x.id === id);
    if (!c) throw new Error(`no case ${id}`);
    const green = loadTrace(c.base);
    const failure = await failing(c, green);
    const config = configOf(c);
    const probe = (axes: Axis[]) => runUnder(green, axes.reduce((cfg, a) => restore(cfg, a), config));
    const verdict = await attribute(failure, green, probe);
    rows.push({
      id,
      axis: verdict.verdict.axes.join("+"),
      located: locate(failure, green),
      claim: id === "c2-world" ? claim(failure.outcome.reason) : undefined,
      reason: failure.outcome.reason,
    });
  }
  return rows;
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# four failures, four first differences\n");
  for (const row of rows) {
    const d = row.located.divergence;
    const where =
      d.kind === "result" ? `result ${d.index}` : d.kind === "turn" ? `turn ${d.index}` : d.kind;
    console.log(`  ${row.id.padEnd(11)} axis ${row.axis.padEnd(9)} first difference: ${where}`);
    if (row.located.call) console.log(`              call ${row.located.call}`);
    for (const change of row.located.changes) {
      console.log(
        `              ${change.field}: ${JSON.stringify(change.recorded)} -> ${JSON.stringify(change.failing)}`,
      );
    }
    if (row.claim) {
      console.log(
        `              tool claimed 1 refund, ledger kept ${row.claim.refunds}, escalations ${row.claim.escalations}`,
      );
    }
    console.log(`              actionable: ${row.located.actionable ? "yes" : "no"}, ${row.reason}\n`);
  }
  console.log("  c1 has a field to edit. c2, c3 and c4 do not: the tool answered the same");
  console.log("  way in both runs, or the run stopped before the call. For those the");
  console.log("  evidence is the check's reason, and the drill-down stops at the axis.");
}

if (import.meta.main) report(await demo());
