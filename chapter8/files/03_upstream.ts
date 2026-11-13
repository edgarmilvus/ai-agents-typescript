// 8.3 — the change a tape cannot test.
//
// t3a and t3b were run with an instruction to escalate damaged claims. The
// tape records the escalation, so replaying it under the old instruction is not
// a counterfactual: it is the same decision with a different label. Context is
// upstream, and the only test is another run.

import { attribute, explain } from "../attribute.ts";
import { GREEN, restore, runUnder } from "../desk.ts";
import { loadTrace, diff, path } from "../trace.ts";
import type { Axis } from "../trace.ts";

const base = loadTrace("t1");
const first = loadTrace("t3a");
const second = loadTrace("t3b");

console.log("# the same task under two instructions");
console.log("  task-v1       :", path(base).join(" -> "), "|", base.outcome.pass ? "pass" : "fail");
console.log("  task-escalate :", path(first).join(" -> "), "|", first.outcome.pass ? "pass" : "fail");
console.log("  second run    :", path(second).join(" -> "), "|", second.outcome.pass ? "pass" : "fail");
console.log();

const where = diff(base, first);
console.log("# first difference between the tapes");
console.log(" ", where.kind === "turn" ? `turn ${where.index}: ${where.a} -> ${where.b}` : where.kind);
console.log();

const config = { ...GREEN, context: "task-escalate" };
const probe = (axes: Axis[]) => runUnder(first, axes.reduce((cfg, a) => restore(cfg, a), config));
const attribution = await attribute(first, base, probe);

console.log("# attribution");
console.log("  suspects :", attribution.suspects.join(", "));
console.log(
  "  probes   :",
  attribution.replays,
  attribution.suspects.every((a) => a === "context" || a === "model")
    ? "(no downstream axis differs, so a replay has nothing to vary)"
    : "(downstream restores tried)",
);
console.log("  verdict  :", explain(attribution.verdict));
console.log();
console.log("  the test this needs is a run under the other instruction:");
console.log(`  t3a cost ${first.usage.calls} calls, t3b cost ${second.usage.calls}, and both took the same path:`,
  path(first).join(" -> ") === path(second).join(" -> ") ? "yes" : "no");
