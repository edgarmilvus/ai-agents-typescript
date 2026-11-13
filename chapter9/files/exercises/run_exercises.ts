// Chapter 9 exercise harness.
//
//   node chapter9/files/exercises/run_exercises.ts
//
// Offline by construction: every exercise replays recorded or authored
// decisions, and the one about cost only prices them.

process.env.AGENTLAB_REPLAY = "1";

import { decide, EU, OPERATORS, WITNESSES, demo as operators, kills } from "./ex1_operators.ts";
import { GUARDS, demo as coverage } from "./ex2_coverage.ts";
import { CASES } from "../../suite.ts";
import { byCase, summarise, survivors, verdict } from "./ex3_matrix.ts";
import type { Row } from "./ex3_matrix.ts";
import { run as runMatrix } from "./ex3_suite.ts";
import { demo as triageRows } from "./ex4_triage.ts";
import { CALLS_PER_RUN, cost, demo as costs, fits, triage } from "./ex5_budget.ts";

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

// 1 — operators and their witnesses
{
  const d = operators();
  equal("ex1 six operators", d.length, 6);
  equal("ex1 five are killed, one is equivalent", [d.filter((r) => r.killed).length, d.filter((r) => r.equivalent).length], [5, 1]);
  equal("ex1 the window boundary is killed on the boundary", d[0].first?.witness, 0);
  equal("ex1 the ceiling boundary is killed on the boundary", d[1].first?.witness, 1);
  equal("ex1 order matters at the intersection", [d[2].first?.original, d[2].first?.mutated], ["escalate", "refuse"]);
  equal("ex1 the widened ceiling lets a large refund through", d[3].first?.mutated, "refund");
  equal("ex1 dropping escalation refunds an out-of-window order", d[4].first?.mutated, "refund");
  equal("ex1 the negated ceiling is never observed", d[5].killed, false);

  equal("ex1 the original refuses over the ceiling", decide(1200, 10, EU), "refuse");
  equal("ex1 the original escalates past the window", decide(84, 21, EU), "escalate");
  equal("ex1 the original refunds on the boundary", decide(84, 14, EU), "refund");
  equal("ex1 no witness kills the equivalent operator", kills(OPERATORS[5]).length, 0);
  check("ex1 every witness keeps the original's answer defined", WITNESSES.every((w) => ["refund", "escalate", "refuse"].includes(decide(w.total, w.days, w.policy))));
}

// 2 — reachability without instrumentation
{
  const d = await coverage();
  equal("ex2 three guards", GUARDS.join(), "window,ceiling,total");
  equal("ex2 each refusal case depends on one guard", d.rows.filter((r) => r.needs.length > 0).map((r) => r.needs), [
    ["window"],
    ["ceiling"],
    ["total"],
  ]);
  equal("ex2 the positive cases depend on none", d.rows.filter((r) => r.needs.length === 0).map((r) => r.caseId), [
    "s1-refund",
    "s2-escalate",
    "s6-unknown",
  ]);
  equal("ex2 every guard is reached", d.unreached, []);
  equal("ex2 the ceiling case catches the ceiling mutant", d.caught.find((c) => c.caseId === "s4-ceiling")?.mutants, [
    "tool-skip-ceiling",
  ]);
  equal("ex2 the refund case catches six mutants", d.caught.find((c) => c.caseId === "s1-refund")?.mutants.length, 6);

}

// 3 — three files, one score, one stale declaration
{
  const rows = await runMatrix(CASES);
  const s = summarise(rows);
  equal("ex3 eleven of fourteen killed", [s.killed, s.mutants], [11, 14]);
  equal("ex3 three survivors, all declared", [s.survived, s.declared, s.unexplained.length], [3, 3, 0]);
  equal("ex3 adjusted score is one", s.adjusted, 1);
  equal("ex3 the base matrix merges", verdict(s), "merge");
  equal("ex3 the survivors are the three declared mutants", survivors(rows).sort(), [
    "grader-lenient",
    "harness-budget-12",
    "tool-rounds",
  ]);

  equal("ex3 byCase finds five killer cases", byCase(rows).length, 5);

  const hand: Row[] = [
    { mutant: "a", killedBy: "c1" },
    { mutant: "b" },
    { mutant: "c", declared: true },
    { mutant: "d", killedBy: "c2", declared: true },
  ];
  const hs = summarise(hand);
  equal("ex3 a hand matrix scores raw two of four", hs.raw, 0.5);
  equal("ex3 adjusted removes the declared survivor", hs.adjusted, 2 / 3);
  equal("ex3 an undeclared survivor is a problem", hs.unexplained, ["b"]);
  equal("ex3 a declared kill is a problem", hs.contradicted, ["d"]);
  equal("ex3 and the hand matrix blocks", verdict(hs), "blocked");
  equal("ex3 an empty matrix is refused", (() => {
    try {
      summarise([]);
      return "no throw";
    } catch {
      return "threw";
    }
  })(), "threw");
}

// 4 — triage, and the artefact behind each reason
{
  const rows = await triageRows();
  equal("ex4 three declared survivors", rows.length, 3);
  equal("ex4 each is fixed by a different artefact", rows.map((r) => r.fixedBy).sort(), ["a case", "a unit test", "nothing"]);
  equal("ex4 the data fix kills rounding", rows.find((r) => r.id === "tool-rounds")?.withData, "s7-fractional");
  equal("ex4 the unit tests see the lenient check", rows.find((r) => r.id === "grader-lenient")?.units, 4);
  equal("ex4 nothing sees the budget increase", rows.find((r) => r.id === "harness-budget-12")?.units, 0);
}

// 5 — what it costs
{
  const d = await costs();
  equal("ex5 four sizes", d.sizes.length, 4);
  equal("ex5 40 x 20 is 800 replays", d.sizes[1].replays, 800);
  equal("ex5 and 2,800 live calls", d.sizes[1].liveCalls, 2800);
  equal("ex5 and 1,181,600 tokens", d.sizes[1].liveTokens, 1181600);
  check("ex5 compute stays under a second for 4,800 replays", d.sizes[2].seconds < 1, d.sizes[2].seconds);
  equal("ex5 36 survivors is six hours", triage(36).hours, 6);
  equal("ex5 triage is linear", triage(12).minutes, 2 * triage(6).minutes);
  check("ex5 sixty seconds fits thousands of mutants", fits(60, 20, d.perReplayMs) > 1000, fits(60, 20, d.perReplayMs));
  equal("ex5 the live rate is the chapter 8 measurement", [CALLS_PER_RUN, cost(1, 1, 1).liveCalls], [3.5, 4]);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
