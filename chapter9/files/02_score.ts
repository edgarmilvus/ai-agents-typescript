// 9.2 — thirteen breakages, six cases, and the cells in between.
//
// A mutation score is a matrix with a shape: rows are mutants, columns are
// cases, a cell is the case noticing. The score is the fraction of rows with a
// cell in them. Printing the matrix rather than the score is what makes the
// number arguable, because the empty rows and the empty columns are visible.

import { CASES, matrix, score } from "../suite.ts";
import { MUTATIONS } from "../variants.ts";

const rows = await matrix();
const s = score(rows);

console.log("# the mutant x case matrix\n");
console.log(`  ${"mutant".padEnd(20)} ${"axis".padEnd(8)} ${CASES.map((c) => c.id.split("-")[0].padStart(4)).join("")}  killed by`);
for (const row of rows) {
  const m = MUTATIONS.find((x) => x.id === row.id);
  if (!m) continue;
  const cells = CASES.map((c) => (row.killedBy === c.id ? "   x" : "   .")).join("");
  console.log(
    `  ${row.id.padEnd(20)} ${row.axis.padEnd(8)} ${cells}  ${row.killedBy ?? (row.declared ? `survives (${row.declared})` : "SURVIVES")}`,
  );
}

console.log(`\n  mutants            : ${s.mutants}`);
console.log(`  killed             : ${s.killed}`);
console.log(`  survived           : ${s.survived} (${s.declared} declared, ${s.survived - s.declared} unexplained)`);
console.log(`  raw score          : ${(s.raw * 100).toFixed(0)}%  (${s.killed}/${s.mutants})`);
console.log(`  adjusted score     : ${(s.adjusted * 100).toFixed(0)}%  (${s.killed}/${s.mutants - s.declared}, declared survivors removed)`);
console.log(`  unexplained        : ${s.unexplained.join(", ") || "none"}`);
console.log(`  declared but killed: ${s.contradicted.join(", ") || "none"}`);

const dead = new Set(rows.filter((r) => r.killedBy).map((r) => r.killedBy));
const idle = CASES.filter((c) => !dead.has(c.id)).map((c) => c.id);
console.log(`\n  cases that caught nothing: ${idle.join(", ") || "none"}`);
console.log("\n  the matrix is the report. A score without it hides three different things:");
console.log("  a guard no case reaches, a declaration that is stale, and a case that");
console.log("  can never be the first to notice because another case always gets there.");
