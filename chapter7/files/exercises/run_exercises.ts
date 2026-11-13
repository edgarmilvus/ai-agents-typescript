// Chapter 7 exercise harness.
//
//   node chapter7/files/exercises/run_exercises.ts
//
// Offline by construction: every audit here is replayed from a recorded run.

process.env.AGENTLAB_REPLAY = "1";

import { demo as countable, strict } from "./ex1_countable.ts";
import { demo as layout, claimedExtent } from "./ex2_layout.ts";
import { demo as priced } from "./ex3_agreement.ts";
import { demo as retest } from "./ex4_retest.ts";
import { budget, demo as costs } from "./ex5_cost.ts";

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

// 1 — a verdict you can count
{
  const d = await countable();
  const reasons = new Set(d.cases.map((c) => c.reason).filter(Boolean));
  check("ex1 refusals carry distinct reasons", reasons.size >= 4, [...reasons]);
  check("ex1 prose only is not an answer", d.cases[2].outcome === "refused" && d.cases[2].reason === "no_json");
  check("ex1 free-text defects are unactionable", d.cases[3].reason === "unactionable");
  check("ex1 a pass with codes is contradictory", d.cases[4].reason === "contradictory");
  check("ex1 a fail without evidence is unsupported", d.cases[6].reason === "unsupported");
  equal("ex1 the named defect survives the parser", d.cases[1].codes, ["overlap"]);
  check("ex1 the live audit finds the missing total", d.caught, d.live);
}

// 2 — the prompt cannot recover clipped evidence
{
  const d = await layout();
  check("ex2 both prompts answer", d.direct.answered && d.layout.answered);
  check("ex2 the layout prompt reports an extent", d.extent !== null, d.extent);
  check("ex2 the claimed extent stops at the card edge", Number(d.extent?.split("-")[1]) <= 0.95, d.extent);
  check("ex2 the truth is the control offscreen", d.truth.join() === "offscreen_control");
  check("ex2 neither prompt catches it", !d.direct.defects.includes("offscreen_control") && !d.layout.defects.includes("offscreen_control"));
  equal("ex2 the claimed extent is parsed from the reply", claimedExtent('"Return this order button": "0.62-0.95",'), "0.62-0.95");
}

// 3 — the ledger
{
  const d = await priced();
  equal("ex3 six renders, six answers", [d.tried, d.refused.length], [6, 0]);
  equal("ex3 five exact out of six", d.exact, 5);
  equal("ex3 three of four defects caught", Math.round(d.catchRate * 100), 75);
  equal("ex3 no clean render is held", d.falseAlarm, 0);
  equal("ex3 the miss costs twelve dollars", d.cost, 12);
  equal("ex3 only the offscreen control is missed", d.got[3], []);
}

// 4 — the judge's variance
{
  const d = await retest();
  equal("ex4 four renders, two audits each", d.rows.length, 4);
  check("ex4 every row has a truth", d.rows.every((r) => r.truth.length > 0));
  equal("ex4 the sample is stable", d.flips, 0);
  check("ex4 zero flips is not evidence of zero", d.interval.high > 0.4, d.interval);
  check("ex4 the interval brackets the rate", d.interval.low <= 0 && 0 <= d.interval.high);
}

// 5 — the budget
{
  const rows = costs();
  check("ex5 audits scale with renders", rows.every((r, i) => i === 0 || r.audits > rows[i - 1].audits));
  equal("ex5 three runs cost three times one", rows[1].tokens, rows[0].tokens * 3);
  check("ex5 a thousand renders does not fit in a day", budget(1000, 3).days > 1, budget(1000, 3));
  check("ex5 fifteen a minute is the fast limit", budget(15, 1).minutes === 1);
  equal("ex5 tokens per audit is constant", rows[3].tokens / rows[3].audits, 1305);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
