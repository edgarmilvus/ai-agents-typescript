// Chapter 8 harness.
//
//   node chapter8/files/run_ex8.ts
//
// Everything here replays a recorded tape: no key, no quota, no clock. The
// assertions are about the inference rules, which a fixture cannot get wrong.

import { attribute, explain, matches, suspectsOf } from "../attribute.ts";
import { GREEN, check, makeDesk, restore, runUnder, runtime, toolsFor } from "../desk.ts";
import { CASES, baselineId, configOf, failing } from "../planted.ts";
import { AXES, diff, fields, fingerprint, loadTrace, path, replay } from "../trace.ts";
import type { Axis, Trace } from "../trace.ts";

let checks = 0;
let failures = 0;

function check_(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check_(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

const t1 = loadTrace("t1");
const t2 = loadTrace("t2");
const t3a = loadTrace("t3a");
const t3b = loadTrace("t3b");

// 1 — the tape and its replay
{
  equal("t1 is four turns", t1.turns.length, 4);
  equal("t1 made three calls", t1.results.length, 3);
  check_("t1 passed under the green release", t1.outcome.pass, t1.outcome);
  equal("t1 path", path(t1), ["lookup_order", "refund_policy", "issue_refund", "answer"]);

  const once = await runUnder(t1, GREEN);
  const twice = await runUnder(t1, GREEN);
  check_("two replays agree", fingerprint(once) === fingerprint(twice), [fingerprint(once), fingerprint(twice)]);
  equal("a replay costs no model call", once.usage.calls, 0);
  equal("a replay keeps the tape", once.turns.length, t1.turns.length);
  equal("replaying does not mutate the recording", t1.results.length, 3);
  check_("the fingerprint is sixteen hex characters", /^[0-9a-f]{16}$/.test(fingerprint(once)));

  const short = await runUnder(t1, { ...GREEN, harness: 1 });
  equal("a one-turn budget executes one turn", short.turns.length, 1);
  equal("and one call", short.results.length, 1);
  check_("and fails the check", !short.outcome.pass, short.outcome);
}

// 2 — the desk under each mode
{
  const green = makeDesk();
  for (const tool of toolsFor(green, GREEN)) {
    if (tool.name === "lookup_order") await tool.run({ orderId: "ORD-7712" });
    if (tool.name === "issue_refund") await tool.run({ orderId: "ORD-7712", amount: 84, reason: "damaged" });
  }
  check_("the green tools pass the strict check", check(green, "strict").pass);

  const broken = await runUnder(t1, { ...GREEN, tool: "cents" });
  check_("cents fails the strict check", !broken.outcome.pass, broken.outcome);
  equal("the cents refund is in the ledger result", JSON.parse(broken.results[2]).amount, 8400);

  const lenient = await runUnder(t1, { ...GREEN, tool: "cents", grader: "lenient" });
  check_("the lenient check passes the broken amount", lenient.outcome.pass, lenient.outcome);

  const wrong = await runUnder(t2, { ...GREEN, grader: "wrong" });
  check_("the wrong check fails a correct escalation", !wrong.outcome.pass, wrong.outcome);

  const dropped = await runUnder(t1, { ...GREEN, world: "drop" });
  check_("the tool claims a refund the ledger never saw", /rf_ord7712/.test(dropped.results[2]) && /0 refund/.test(dropped.outcome.reason), dropped.outcome);
}

// 3 — divergence
{
  equal("a trace does not diverge from itself", diff(t1, t1).kind, "same");

  const broken = await runUnder(t1, { ...GREEN, tool: "cents" });
  const where = diff(broken, t1);
  check_("the cents run diverges at a result", where.kind === "result", where);
  if (where.kind === "result") {
    equal("at the third call", where.index, 2);
    const changes = fields(where.a, where.b);
    equal("one field differs", changes.length, 1);
    equal("and it is the amount", changes[0].field, "amount");
    equal("recorded, then failing", [changes[0].b, changes[0].a], [84, 8400]);
  }

  check_("the two escalate runs reach the same outcome", t3a.outcome.pass === t3b.outcome.pass, [t3a.outcome, t3b.outcome]);
  check_("but the recorded tapes are not byte-identical", diff(t3a, t3b).kind !== "same", diff(t3a, t3b));
}

// 4 — attribution rules
{
  const c1 = CASES.find((c) => c.id === "c1-tool")!;
  const f1 = await failing(c1, t1);
  const a1 = await attribute(f1, t1, (axes) =>
    runUnder(t1, axes.reduce((cfg, a) => restore(cfg, a), configOf(c1))),
  );
  equal("c1 has one suspect", suspectsOf(f1, t1), ["tool"]);
  equal("c1 is a single", a1.verdict.kind, "single");
  equal("c1 names the tool", a1.verdict.axes, ["tool"]);
  equal("c1 cost one replay", a1.replays, 1);
  check_("c1 matches its truth", matches(a1.verdict, c1.truth));

  const c5 = CASES.find((c) => c.id === "c5-joint")!;
  const f5 = await failing(c5, t1);
  const a5 = await attribute(f5, t1, (axes) =>
    runUnder(t1, axes.reduce((cfg, a) => restore(cfg, a), configOf(c5))),
  );
  equal("c5 has two suspects", suspectsOf(f5, t1).sort(), ["tool", "world"]);
  equal("c5 is joint, not single", a5.verdict.kind, "joint");
  equal("c5 names both", a5.verdict.axes.slice().sort(), ["tool", "world"]);
  check_("a joint verdict does not pick one", a5.verdict.axes.length === 2);

  const c6 = CASES.find((c) => c.id === "c6-interaction")!;
  const f6 = await failing(c6, t1);
  const a6 = await attribute(f6, t1, (axes) =>
    runUnder(t1, axes.reduce((cfg, a) => restore(cfg, a), configOf(c6))),
  );
  equal("c6 is an interaction", a6.verdict.kind, "interaction");
  check_("c6 needed the pair", a6.attempts.filter((x) => x.axes.length === 2 && x.repairs).length === 1);
  check_("no single repair existed", a6.attempts.filter((x) => x.axes.length === 1 && x.repairs).length === 0);

  const c7 = CASES.find((c) => c.id === "c7-upstream")!;
  const f7 = await failing(c7, t3a);
  const a7 = await attribute(f7, t1, async () => {
    throw new Error("an upstream axis must never be probed by replay");
  });
  equal("c7 is upstream", a7.verdict.kind, "upstream");
  equal("c7 names the context", a7.verdict.axes, ["context"]);
  equal("c7 spends no replay", a7.replays, 0);

  // A tape that fails under the very release that was green: no configuration
  // diff, nothing downstream to restore, so the decisions are the difference.
  const orphan = await runUnder(t3a, GREEN);
  const a8 = await attribute(orphan, t1, async () => {
    throw new Error("nothing to probe");
  });
  equal("no suspects and no repair is a decision problem", a8.verdict.kind, "decisions");
  equal("and it names no axis", a8.verdict.axes, []);

  check_("matches rejects a wrong axis", !matches(a1.verdict, ["world"]));
  check_("matches rejects a set of the wrong size", !matches(a5.verdict, ["tool"]));
  check_("explain carries the verdict kind", /^single:/.test(explain(a1.verdict)));
}

// 5 — the corpus
{
  const rows = [];
  for (const c of CASES) {
    const base = loadTrace(c.base);
    const failure = await failing(c, base);
    const attribution = await attribute(failure, loadTrace(baselineId(c)), (axes: Axis[]) =>
      runUnder(base, axes.reduce((cfg, a) => restore(cfg, a), configOf(c))),
    );
    rows.push({ c, attribution, ok: matches(attribution.verdict, c.truth) });
  }

  equal("seven cases", rows.length, 7);
  equal("every verdict matches", rows.filter((r) => r.ok).length, 7);
  equal("four singles", rows.filter((r) => r.attribution.verdict.kind === "single").length, 4);
  equal("one joint, one interaction, one upstream", [
    rows.filter((r) => r.attribution.verdict.kind === "joint").length,
    rows.filter((r) => r.attribution.verdict.kind === "interaction").length,
    rows.filter((r) => r.attribution.verdict.kind === "upstream").length,
  ], [1, 1, 1]);
  equal("the corpus costs nine replays", rows.reduce((n, r) => n + r.attribution.replays, 0), 9);
  equal("the axes are closed", AXES.length, 6);

  const kinds = new Set(rows.map((r) => r.attribution.verdict.kind));
  check_("the corpus exercises four verdict kinds", kinds.size === 4, [...kinds]);
}

// 6 — from axis to field
{
  const c1 = CASES.find((c) => c.id === "c1-tool")!;
  const failure = await failing(c1, t1);
  const where = diff(failure, t1);
  check_("the drill-down lands on a result", where.kind === "result", where);
  if (where.kind === "result") {
    const names = t1.turns.flatMap((turn) => turn.calls.map((call) => call.name));
    equal("the call is issue_refund", names[where.index], "issue_refund");
  }
  equal("an unparseable pair has no fields", fields("not json", "{}"), []);
}

// 7 — the tapes are data
{
  equal("four tapes on disk", ["t1", "t2", "t3a", "t3b"].every((id) => loadTrace(id).turns.length > 0), true);
  equal("t2 escalated", t2.outcome.pass && t2.results.length === 3, true);
  check_("the recordings carry their usage", t1.usage.promptTokens > 0, t1.usage);
  equal("the baseline is six axes", Object.keys(t1.axes).length, 6);

  const rt = runtime(GREEN);
  const replayed = await replay(t1, rt);
  equal("the runtime check and the trace outcome agree", replayed.outcome.pass, t1.outcome.pass);
  check_("the runtime's ledger holds the refund", rt.desk.refunds.length === 1, rt.desk.refunds);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
