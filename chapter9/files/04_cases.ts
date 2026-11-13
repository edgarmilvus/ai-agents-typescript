// 9.4 — the cases are code too, and they fail in two directions.
//
// A mutation score is computed from two inputs: the mutants and the cases.
// Nobody audits the second one, because a suite that is green looks finished.
// Three edits to the case list show what that costs: a weakened expectation, a
// deleted case, and a wrong expectation. Two of them lower the score silently;
// the third turns the suite red before a mutant exists.

import { CASES, clean, matrix, runSuite, score } from "../suite.ts";
import type { Case } from "../suite.ts";

const line = (label: string, s: ReturnType<typeof score>) =>
  `${label.padEnd(28)} killed ${String(s.killed).padStart(2)}/${s.mutants}  ` +
  `adjusted ${String(Math.round(s.adjusted * 100)).padStart(3)}%  unexplained ${s.unexplained.length}`;

const baseline = score(await matrix());
console.log("# the suite as written\n");
console.log(`  ${line("baseline", baseline)}`);
console.log(`  ${"".padEnd(28)} ${baseline.unexplained.join(", ") || "no unexplained survivors"}\n`);

// 1 — weaken one expectation. The tool's claim stops being checked, and two
// mutants that only lie in the reply become invisible.
const weakened: Case[] = CASES.map((c) =>
  c.id === "s1-refund" ? { ...c, expect: { ...c.expect, reportedAmount: undefined, reportedCurrency: undefined } } : c,
);
const weak = score(await matrix(weakened));
console.log("# edit 1 — drop the two expectations on what the tool reported\n");
console.log(`  ${line("weakened s1-refund", weak)}`);
console.log(`  survivors now: ${weak.unexplained.join(", ") || "none"}`);
console.log("  the suite is still green. The score is not, and nothing else says so.\n");

// 2 — delete a case. The guard it covered is now untested, and the matrix says
// which mutant noticed.
const without = CASES.filter((c) => c.id !== "s3-window");
const missing = score(await matrix(without));
console.log("# edit 2 — delete s3-window\n");
console.log(`  ${line("five cases", missing)}`);
console.log(`  survivors now: ${missing.unexplained.join(", ") || "none"}`);
const windowRow = (await matrix(without)).find((r) => r.id === "tool-skip-window");
console.log(`  tool-skip-window: ${windowRow?.killed ? `killed by ${windowRow.killedBy}` : "survives"}\n`);

// 3 — write an expectation that cannot hold. This is the one failure mode that
// is loud, and the only reason it is loud is that the clean run is checked too.
const wrong: Case[] = CASES.map((c) => (c.id === "s5-partial" ? { ...c, expect: { ...c.expect, refunds: 1 } } : c));
const red = await runSuite(clean, wrong);
console.log("# edit 3 — expect the partial refund to succeed\n");
for (const r of red.filter((r) => !r.holds)) {
  console.log(`  ${r.id.padEnd(11)} FAILS on the clean code: ${r.failed.join(", ")}`);
}
console.log("\n  a case that is red before any mutant runs is not evidence about the code.");
console.log("  it is evidence that the case was written from the wrong expectation, and");
console.log("  the only reason it is caught is that the suite is run against the clean");
console.log("  build as well as the mutants.");
