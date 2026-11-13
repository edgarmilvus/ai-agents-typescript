// 8.5 — the repair set, and the greedy fix that does not repair.
//
// c6 is an outage behind a loop with one step of budget. Each rollback alone
// leaves the run red; the pair turns it green. That is the difference between
// "which component moved" and "which change fixes it", and it is why the
// verdict names a set rather than the first thing that looks guilty.

import { attribute, explain } from "../attribute.ts";
import { restore, runUnder } from "../desk.ts";
import { CASES, configOf, failing } from "../planted.ts";
import { loadTrace } from "../trace.ts";
import type { Axis } from "../trace.ts";

const c = CASES.find((x) => x.id === "c6-interaction");
if (!c) throw new Error("no c6-interaction case");

const base = loadTrace(c.base);
const config = configOf(c);
const failure = await failing(c, base);
const probe = (axes: Axis[]) => runUnder(base, axes.reduce((cfg, a) => restore(cfg, a), config));
const attribution = await attribute(failure, base, probe);

console.log(`# ${c.id} — ${c.note}`);
console.log("  failure  :", failure.outcome.reason);
console.log();
console.log("  restore              result");
for (const attempt of attribution.attempts) {
  const label = attempt.axes.join(" + ");
  console.log(
    `  ${label.padEnd(20)} ${attempt.repairs ? "repairs" : "still red"}   ${attempt.trace.outcome.reason}`,
  );
}
console.log();
console.log("  verdict  :", explain(attribution.verdict));
const singles = attribution.attempts.filter((a) => a.axes.length === 1).length;
const pairs = attribution.attempts.filter((a) => a.axes.length === 2).length;
console.log("  replays  :", attribution.replays, `(${singles} singles, ${pairs} pair${pairs === 1 ? "" : "s"})`);
console.log();
console.log("  the greedy fix is the trap: rolling back the harness alone leaves the outage,");
console.log("  rolling back the tool alone leaves no budget, and the run is green only after both.");
