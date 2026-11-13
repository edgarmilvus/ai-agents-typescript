// Chapter 8 exercise harness.
//
//   node chapter8/files/exercises/run_exercises.ts
//
// Offline by construction: every exercise replays a recorded tape, and the one
// that talks about live runs only prices them.

process.env.AGENTLAB_REPLAY = "1";

import { FIXTURES, roleOf, roles, tableRepairs } from "./ex1_necessary.ts";
import { callAt, demo as fourFailures, locate } from "./ex2_divergence.ts";
import { demo as corpus } from "./ex3_run.ts";
import { kindFrom, repairsFrom } from "./ex3_engine.ts";
import { demo as sampled } from "./ex4_upstream.ts";
import { exhaustive, liveRunCost, staged, timed } from "./ex5_cost.ts";
import { GREEN, runUnder } from "../../desk.ts";
import { loadTrace } from "../../trace.ts";

let checks = 0;
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// 1 — necessary, sufficient, neither
{
  const one = roles(["tool"], tableRepairs({ tool: true }));
  equal("ex1 a single axis is both", one.tool, "sufficient+necessary");

  const either = roles(["tool", "world"], tableRepairs({ tool: true, world: true, "tool+world": true }));
  equal("ex1 both rollbacks are sufficient", [either.tool, either.world], ["sufficient", "sufficient"]);

  const pair = roles(["tool", "harness"], tableRepairs({ "harness+tool": true }));
  equal("ex1 a pair that only works together is necessary twice", [pair.tool, pair.harness], ["necessary", "necessary"]);

  const three = roles(["tool", "world", "grader"], tableRepairs({ "grader+tool+world": true, "grader+tool": true }));
  equal("ex1 the axis nobody needs is neither", three.world, "neither");
  equal("ex1 the two that carry the fix are necessary", [three.tool, three.grader], ["necessary", "necessary"]);
  equal("ex1 there is no sufficient single in that table", FIXTURES[3].axes.filter((a) => tableRepairs(FIXTURES[3].table)([a])), []);

  const emptyIsRed = tableRepairs({ tool: true })([]);
  equal("ex1 restoring nothing never repairs", emptyIsRed, false);
  equal("ex1 roleOf agrees with roles", roleOf("tool", ["tool"], tableRepairs({ tool: true })), "sufficient+necessary");
}

// 2 — the first difference, and the field behind it
{
  const rows = await fourFailures();
  const c1 = rows.find((r) => r.id === "c1-tool");
  if (!c1) throw new Error("no c1");
  check("ex2 c1 diverges at a result", c1.located.divergence.kind === "result", c1.located.divergence);
  if (c1.located.divergence.kind === "result") equal("ex2 c1 diverges at the third call", c1.located.divergence.index, 2);
  equal("ex2 c1 names the refund call", c1.located.call, "issue_refund");
  equal("ex2 c1 has one differing field", c1.located.changes, [{ field: "amount", recorded: 84, failing: 8400 }]);

  const c2 = rows.find((r) => r.id === "c2-world");
  if (!c2) throw new Error("no c2");
  equal("ex2 a dropped write diverges at the outcome", c2.located.divergence.kind, "outcome");
  equal("ex2 and the tool still claims a refund", c2.claim?.refunds, 0);
  equal("ex2 with no field to point at", c2.located.changes, []);

  const c3 = rows.find((r) => r.id === "c3-grader");
  const c4 = rows.find((r) => r.id === "c4-harness");
  equal("ex2 a wrong check diverges at the outcome", c3?.located.divergence.kind, "outcome");
  equal("ex2 a short loop diverges at the length", c4?.located.divergence.kind, "length");

  const t1 = loadTrace("t1");
  equal("ex2 a trace does not differ from itself", locate(t1, t1).divergence.kind, "same");
  equal("ex2 the call index is tape order", callAt(t1, 1), "refund_policy");

  const world = await runUnder(t1, { ...GREEN, world: "drop" });
  equal("ex2 the same result text, a different ledger", locate(world, t1).changes.length, 0);
}

// 3 — eight failures, three files
{
  const d = await corpus();
  equal("ex3 eight rows", d.rows.length, 8);
  equal("ex3 every verdict matches its truth", d.rows.filter((r) => r.match).length, 8);
  equal("ex3 the second derivation agrees with the search", d.rows.filter((r) => r.agree).length, 8);
  equal("ex3 the corpus costs nine replays", d.replays, 9);
  equal("ex3 five verdict kinds are exercised", new Set(d.rows.map((r) => r.derived)).size, 5);

  const k5 = d.rows.find((r) => r.id === "k5-joint");
  equal("ex3 a joint row has two sufficient suspects", [k5?.roles.tool, k5?.roles.world], ["sufficient", "sufficient"]);
  const k6 = d.rows.find((r) => r.id === "k6-interaction");
  equal("ex3 an interaction has two necessary suspects", [k6?.roles.tool, k6?.roles.harness], ["necessary", "necessary"]);
  const k8 = d.rows.find((r) => r.id === "k8-decisions");
  equal("ex3 the no-change row has no suspect", [k8?.suspects.length, k8?.match], [0, true]);
  equal("ex3 an unprobed set is red", repairsFrom([])(["tool"]), false);
  equal("ex3 kindFrom reads the roles", kindFrom(["tool"], { tool: "sufficient+necessary" }), "single");
}

// 4 — the upstream test is a sample
{
  const d = await sampled();
  check("ex4 the two runs are not identical", d.differentBytes);
  check("ex4 and their token counts differ", d.tokens[0] !== d.tokens[1], d.tokens);
  check("ex4 two runs are not a bound", d.boundAtTwo > 0.7, d.boundAtTwo);
  equal("ex4 a ten percent flake needs twenty-nine runs", d.rates[1].runs, 29);
  check("ex4 no downstream restore repairs an escalation", d.test.rows.every((r) => !r.repairs), d.test.rows);
  equal("ex4 so the verdict is upstream, at no cost", [d.test.verdict, d.test.replays], ["upstream", 0]);
  equal("ex4 and it names the context", d.test.axes, ["context"]);
}

// 5 — what attribution costs
{
  equal("ex5 four suspects cost ten replays", staged(4), 10);
  equal("ex5 six suspects exhausted cost sixty-three", exhaustive(6), 63);
  equal("ex5 with one suspect the two strategies agree", [staged(1), exhaustive(1)], [1, 1]);
  equal("ex5 twenty-nine runs are a hundred and two calls", liveRunCost(29).calls, 102);
  equal("ex5 seven runs cost ten thousand tokens", liveRunCost(7).tokens, 10339);
  const t = await timed();
  equal("ex5 the timed sweep spends the same nine replays", t.replays, 9);
  check("ex5 and finishes in milliseconds", t.ms > 0 && t.ms < 5000, t.ms);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
