// Exercise 3, file 3 of 3 — the wiring, and the table.
//
// This is the only file that knows both halves: it reads the corpus from file
// 1, turns each row into a real failing trace, hands a subject to the engine in
// file 2, and prints what came back. The engine could be tested with a fake
// probe and no traces at all, and the corpus could be read by a different
// engine; the seam is the whole reason the exercise is three files.
//
// The last row is the one to look at. It has no change, no suspect, no probe
// and no replay, and it still fails: the decisions moved, not the release.

import { GREEN, restore, runUnder } from "../../desk.ts";
import { isUpstream, loadTrace } from "../../trace.ts";
import type { Axis, Trace } from "../../trace.ts";
import { CASES } from "./ex3_cases.ts";
import { sweep } from "./ex3_engine.ts";
import type { Row, Subject } from "./ex3_engine.ts";

export async function demo(): Promise<{ rows: Row[]; replays: number }> {
  const subjects: Subject[] = [];

  for (const c of CASES) {
    const base = loadTrace(c.base);
    const config = { ...GREEN, ...c.change };
    const failure: Trace = { ...(await runUnder(base, config)), id: c.id, usage: base.usage };
    // A downstream change is compared with the same decisions run green. An
    // upstream change cannot be: the tape's decisions were made under it.
    const baseline = c.truth.length === 0 || c.truth.some(isUpstream) ? loadTrace("t1") : base;
    const probe = (axes: Axis[]) => runUnder(base, axes.reduce((cfg, a) => restore(cfg, a), config));
    subjects.push({ id: c.id, truth: c.truth, failure, baseline, probe });
  }

  const rows = await sweep(subjects);
  return { rows, replays: rows.reduce((n, r) => n + r.replays, 0) };
}

export function report(result: Awaited<ReturnType<typeof demo>>): void {
  console.log(`# ${result.rows.length} failures, each with a cause chosen in advance\n`);
  console.log("  case             truth           suspects        derived      search       ok  replays");
  for (const row of result.rows) {
    const roles = Object.entries(row.roles)
      .map(([axis, role]) => `${axis}:${role.replace("sufficient+necessary", "both")}`)
      .join(" ");
    console.log(
      `  ${row.id.padEnd(16)} ${(row.truth.join("+") || "decisions").padEnd(15)} ` +
        `${(row.suspects.join("+") || "-").padEnd(15)} ${row.derived.padEnd(12)} ` +
        `${row.search.padEnd(12)} ${row.match ? "yes" : "NO "} ${String(row.replays).padStart(3)}`,
    );
    if (roles) console.log(`  ${" ".repeat(16)} ${roles}`);
  }

  const exact = result.rows.filter((r) => r.match).length;
  const agree = result.rows.filter((r) => r.agree).length;
  console.log(`\n  verdicts matching the truth   : ${exact}/${result.rows.length}`);
  console.log(`  derived kind agrees with search: ${agree}/${result.rows.length}`);
  console.log(`  replays                        : ${result.replays}`);
  console.log("  model calls                    : 0");
  console.log("\n  k5 and k6 are the rows that make the exercise worth three files:");
  for (const id of ["k5-joint", "k6-interaction"]) {
    const row = result.rows.find((r) => r.id === id);
    if (row) console.log(`  ${id.padEnd(16)} -> ${row.derived} (${row.suspects.join(" + ")})`);
  }
  const none = result.rows.find((r) => r.suspects.length === 0);
  if (none) {
    console.log(`\n  ${none.id} has no suspect and no repair, and the verdict is "${none.search}" —`);
    console.log("  which is the only honest answer when nothing in the release moved.");
  }
}

if (import.meta.main) report(await demo());
