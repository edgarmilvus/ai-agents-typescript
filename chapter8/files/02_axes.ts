// 8.2 — one release, two changes, two stories that both fit.
//
// The failing tape is the c5 case: a new `amountCents` field ships beside the
// old one, and the ledger learns to prefer it. Restoring either the tool or
// the ledger repairs the run, and behaviour alone cannot say which one is the
// bug. The verdict says so instead of picking.

import { attribute, explain } from "../attribute.ts";
import { restore, runUnder } from "../desk.ts";
import { CASES, configOf, failing } from "../planted.ts";
import { loadTrace } from "../trace.ts";
import type { Axis } from "../trace.ts";

const c = CASES.find((x) => x.id === "c5-joint");
if (!c) throw new Error("no c5-joint case");

const base = loadTrace(c.base);
const config = configOf(c);
const failure = await failing(c, base);
const probe = (axes: Axis[]) => runUnder(base, axes.reduce((cfg, a) => restore(cfg, a), config));
const attribution = await attribute(failure, base, probe);

console.log(`# ${c.id} — ${c.note}`);
console.log("  outcome  :", failure.outcome.pass ? "pass" : "fail", "—", failure.outcome.reason);
console.log("  suspects :", attribution.suspects.join(", "), `(${attribution.suspects.length} of 6 axes differ)`);
console.log();
console.log("  restore           result");
for (const attempt of attribution.attempts) {
  console.log(
    `  ${attempt.axes.join(" + ").padEnd(16)} ${attempt.repairs ? "repairs" : "still red"}   ${attempt.trace.outcome.reason}`,
  );
}
console.log();
console.log("  verdict  :", explain(attribution.verdict));
console.log("  replays  :", attribution.replays, "| model calls: 0");
