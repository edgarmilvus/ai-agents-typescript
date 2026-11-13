// 8.6 — from the axis to the line a fix edits.
//
// "The tool is the cause" is not actionable. The drill-down follows the first
// differing tool result, names the call that produced it, and diffs the JSON
// so the field is visible. It works only for downstream axes, and that limit is
// the honest one: an upstream cause has no result to point at.

import { attribute } from "../attribute.ts";
import { restore, runUnder } from "../desk.ts";
import { CASES, configOf, failing } from "../planted.ts";
import { diff, fields, loadTrace } from "../trace.ts";
import type { Axis } from "../trace.ts";

const c = CASES.find((x) => x.id === "c1-tool");
if (!c) throw new Error("no c1-tool case");

const base = loadTrace(c.base);
const config = configOf(c);
const failure = await failing(c, base);
const probe = (axes: Axis[]) => runUnder(base, axes.reduce((cfg, a) => restore(cfg, a), config));
const attribution = await attribute(failure, base, probe);

const names = base.turns.flatMap((turn) => turn.calls.map((call) => call.name));
const where = diff(failure, base);

console.log(`# ${c.id} — drill-down`);
console.log("  axis     :", attribution.verdict.axes.join(", "));
console.log("  outcome  :", failure.outcome.reason);
console.log();

if (where.kind !== "result") {
  console.log("  no result differs, so there is nothing to drill into");
} else {
  console.log("  call     :", `${names[where.index]} (call ${where.index + 1} of ${names.length})`);
  console.log("  recorded :", where.b);
  console.log("  failing  :", where.a);
  console.log();
  console.log("  field differences");
  for (const f of fields(where.a, where.b)) {
    console.log(`    ${f.field.padEnd(12)} recorded ${JSON.stringify(f.b)} -> failing ${JSON.stringify(f.a)}`);
  }
  console.log();
  console.log("  the verdict names the component; the field names the line.");
}
