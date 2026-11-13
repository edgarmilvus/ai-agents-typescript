// 8.4 — seven failures, seven verdicts, one truth each.
//
// Every case in the corpus replays a green tape under a release whose cause we
// chose. The engine sees the outcome and the configuration diff, never the
// cause, and its verdict is compared with the construction.

import { attribute, matches } from "../attribute.ts";
import { restore, runUnder } from "../desk.ts";
import { CASES, baselineId, configOf, failing } from "../planted.ts";
import { loadTrace } from "../trace.ts";
import type { Axis, Trace } from "../trace.ts";

export interface Row {
  id: string;
  kind: string;
  truth: Axis[];
  verdict: string;
  axes: Axis[];
  match: boolean;
  replays: number;
  outcome: string;
}

export async function sweep(): Promise<Row[]> {
  const rows: Row[] = [];
  for (const c of CASES) {
    const base = loadTrace(c.base);
    const baseline: Trace = loadTrace(baselineId(c));
    const failure = await failing(c, base);
    const config = configOf(c);
    const probe = (axes: Axis[]) => runUnder(base, axes.reduce((cfg, a) => restore(cfg, a), config));
    const attribution = await attribute(failure, baseline, probe);

    rows.push({
      id: c.id,
      kind: c.kind,
      truth: c.truth,
      verdict: attribution.verdict.kind,
      axes: attribution.verdict.axes,
      match: matches(attribution.verdict, c.truth),
      replays: attribution.replays,
      outcome: failure.outcome.reason,
    });
  }
  return rows;
}

const rows = await sweep();

console.log("# seven failures whose cause was chosen before the engine ran\n");
console.log("  case               truth              verdict        axes               ok   replays");
for (const r of rows) {
  console.log(
    `  ${r.id.padEnd(18)} ${r.truth.join("+").padEnd(18)} ${r.verdict.padEnd(14)} ` +
      `${(r.axes.join("+") || "-").padEnd(18)} ${r.match ? "yes" : "NO"}  ${String(r.replays).padStart(2)}`,
  );
}

const exact = rows.filter((r) => r.match).length;
console.log(`\n  verdicts matching the truth : ${exact}/${rows.length}`);
console.log(`  replays                     : ${rows.reduce((n, r) => n + r.replays, 0)}`);
console.log("  model calls                 : 0");
console.log("\n  the two cases the engine refuses to collapse:");
for (const r of rows.filter((x) => x.kind === "joint" || x.kind === "interaction")) {
  console.log(`  ${r.id.padEnd(18)} -> ${r.axes.join(" + ")}`);
}
