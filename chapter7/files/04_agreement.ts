// 7.4 — the audit, measured against an answer key.
//
// Eight renders, eight audits, and a matrix. The numbers here are the only
// reason a model grader can be used at all: they say how often it agrees with
// a truth that was written before it spoke.

import { audit, renderPath } from "../audit.ts";
import { agreement, recall, precision } from "../agreement.ts";
import { CORPUS, truths } from "../corpus.ts";
import { CODES } from "../render.ts";
import { open } from "../../lib/scenario.ts";

const session = open("ch7-agreement", 10);
const verdicts = [];
for (const entry of CORPUS) verdicts.push(await audit(session.model, renderPath(entry.id)));
session.close();

const truth = truths();
const result = agreement(truth, verdicts, CORPUS.map((r) => r.id));

console.log("# eight renders, audited once each\n");
console.log("  render  truth               verdict  got                     exact");
for (const row of result.rows) {
  console.log(
    `  ${row.id.padEnd(7)} ${(row.truth.join(",") || "clean").padEnd(19)} ${row.verdict.padEnd(8)} ${(row.got.join(",") || "-").padEnd(23)} ${row.exact ? "yes" : "no"}`,
  );
}

console.log("\n  code                tp  fp  fn   recall  precision");
for (const code of CODES) {
  const cell = result.perCode[code];
  console.log(
    `  ${code.padEnd(19)} ${String(cell.truePositive).padStart(2)}  ${String(cell.falsePositive).padStart(2)}  ${String(cell.falseNegative).padStart(2)}   ${(recall(cell) * 100).toFixed(0).padStart(4)}%   ${(precision(cell) * 100).toFixed(0).padStart(4)}%`,
  );
}

console.log(
  `\n  exact     : ${result.exact}/${result.evaluated} (${(result.agreement * 100).toFixed(1)}%)`,
);
console.log(
  `  interval  : ${(result.interval.low * 100).toFixed(0)}% – ${(result.interval.high * 100).toFixed(0)}%`,
);
console.log(`  kappa     : ${result.kappa.toFixed(2)} (agreement beyond chance)`);
console.log(`  unanswered: ${result.unanswered}`);
