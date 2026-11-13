// Exercise 4 — the judge's own variance, measured.
//
// A single audit is a sample of the judge, not a fact about the render. Running
// the same renders twice turns that sentence into a number: the flip rate, and
// the interval around it from chapter 6.

import { audit, renderPath } from "../../audit.ts";
import { byId } from "../../corpus.ts";
import { truthOf } from "../../render.ts";
import { wilson } from "../../../chapter6/stats.ts";
import { open } from "../../../lib/scenario.ts";

const IDS = ["r02", "r03", "r04", "r07"];

export async function demo() {
  const session = open("ch7-ex4", 10);
  const rows = [];
  for (const id of IDS) {
    const a = await audit(session.model, renderPath(id));
    const b = await audit(session.model, renderPath(id));
    rows.push({
      id,
      a,
      b,
      same: a.defects.slice().sort().join() === b.defects.slice().sort().join(),
      truth: truthOf(byId(id)),
    });
  }
  session.close();

  const flips = rows.filter((r) => !r.same).length;
  return { rows, flips, interval: wilson({ runs: IDS.length, passed: flips }) };
}

export function report(d: Awaited<ReturnType<typeof demo>>): void {
  console.log("# each render audited twice, same prompt, same temperature\n");
  console.log("  render  run 1               run 2               stable  truth");
  for (const r of d.rows) {
    console.log(
      `  ${r.id.padEnd(7)} ${(r.a.defects.join(",") || "none").padEnd(19)} ${(r.b.defects.join(",") || "none").padEnd(19)} ${(r.same ? "yes" : "FLIP").padEnd(7)} ${r.truth.join(",")}`,
    );
    if (!r.same) {
      const extra = r.b.defects.filter((c) => !r.a.defects.includes(c));
      const gone = r.a.defects.filter((c) => !r.b.defects.includes(c));
      console.log(`          +${extra.join(",") || "-"} −${gone.join(",") || "-"}  confidence ${r.a.confidence} → ${r.b.confidence}`);
    }
  }
  console.log(`\n  flips      : ${d.flips} of ${d.rows.length} (${((d.flips / d.rows.length) * 100).toFixed(0)}%)`);
  console.log(`  interval   : ${(d.interval.low * 100).toFixed(0)}% – ${(d.interval.high * 100).toFixed(0)}%`);
  console.log("  read it as : the chance that a single audit of this corpus changes its mind");
  console.log("  a flip on a code that was absent adds a false alarm; on a code that was");
  console.log("  present it removes a catch. Both are the judge's sampling, not the render.");
}

if (import.meta.main) report(await demo());
