// Chapter 6 exercise harness.
//
//   node chapter6/files/exercises/run_exercises.ts

import { rate, wilson, compare, runsNeeded } from "../../stats.ts";
import { report, demo as noiseDemo } from "./ex1_noise.ts";
import { demo as precisionDemo, width } from "./ex2_precision.ts";
import { demo as variabilityDemo } from "./ex3_variability.ts";
import { demo as compareDemo } from "./ex4_compare.ts";
import { demo as runsDemo } from "./ex5_runs.ts";

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

// 1 — a rate needs its interval
{
  const rows = noiseDemo();
  check("ex1 nine of ten is undecided against 80 %", rows[0].undecided, rows[0]);
  check("ex1 ninety of a hundred clears", rows[1].claimsClear);
  check("ex1 ten of ten is not certainty", rows[2].undecided && wilson({ runs: 10, passed: 10 }).high === 1);
  check("ex1 no runs decides nothing", rows[3].undecided);
  equal("ex1 the text carries the interval", rows[0].text.includes("–"), true);
}

// 2 — precision is bought with runs
{
  const rows = precisionDemo();
  check("ex2 more runs narrow the interval", rows.every((r, i) => i === 0 || r.width < rows[i - 1].width), rows);
  check("ex2 four hundred runs is under ten points", rows.at(-1)!.width < 0.1, rows.at(-1));
  check("ex2 three runs is uselessly wide", rows[0].width > 0.6, rows[0]);
  equal("ex2 width is high minus low", width({ runs: 10, passed: 6 }), wilson({ runs: 10, passed: 6 }).high - wilson({ runs: 10, passed: 6 }).low);
}

// 3 — the multi-file exercise
{
  const r = await variabilityDemo();
  equal("ex3 twenty runs were made", r.tally.runs, 20);
  equal("ex3 the measured rate matches the built-in mixture", r.tally.passed, 14);
  check("ex3 the interval contains the built-in rate", r.interval.low <= r.builtIn && r.builtIn <= r.interval.high, r);
  check("ex3 failures cluster rather than scatter", r.streak >= 2, r.streak);
  equal("ex3 every outcome has a behaviour note", r.outcomes.every((o) => /actor|talker/.test(o.note)), true);
  equal("ex3 the pattern is deterministic", (await variabilityDemo()).outcomes.map((o) => o.passed).join(""), r.outcomes.map((o) => o.passed).join(""));
}

// 4 — comparing two versions
{
  const rows = compareDemo();
  equal("ex4 a large gap is better", rows.clear.verdict, "better");
  equal("ex4 a small gap is indistinguishable", rows.crowded.verdict, "indistinguishable");
  equal("ex4 the same run is indistinguishable", rows.same.verdict, "indistinguishable");
  equal("ex4 a small sample hides a large gap", rows.small.verdict, "indistinguishable");
  check("ex4 the delta is b minus a", rows.clear.delta > 0.4, rows.clear.delta);
  equal("ex4 separation is reported", rows.clear.separated, true);
}

// 5 — how many runs
{
  const rows = runsDemo();
  check("ex5 tighter intervals need more runs", rows[1].n > rows[0].n && rows[2].n > rows[1].n);
  check("ex5 a rate near 0.5 needs the most", runsNeeded(0.5, 0.1) > runsNeeded(0.9, 0.1));
  equal("ex5 the formula is symmetric", runsNeeded(0.1, 0.1), runsNeeded(0.9, 0.1));
  equal("ex5 five percent needs hundreds", runsNeeded(0.5, 0.05) > 300, true);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
