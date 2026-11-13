// 20.3 — nine behaviours, three builds.
//
// Every row is a behaviour the agent needs on the new provider. The columns are
// the three builds. `FAIL` means the behaviour did not survive the migration.
//
// The middle column is the lesson: a thin adapter that normalizes events gets
// six of nine, and the three it misses are errors and capabilities, which are
// not events.

import { measure, PROBES } from "../probes.ts";
import type { Build } from "../agent.ts";

const builds: Build[] = ["hardcoded", "thin", "contract"];
const summaries = await Promise.all(builds.map((build) => measure(build)));

console.log("# nine behaviours, three builds\n");
console.log(`  ${"probe".padEnd(15)} ${builds.map((build) => build.padStart(10)).join("")}`);
for (let i = 0; i < PROBES.length; i += 1) {
  const cells = summaries.map((summary) => (summary.rows[i].pass ? "ok" : "FAIL").padStart(10));
  console.log(`  ${PROBES[i].id.padEnd(15)}${cells.join("")}`);
}

console.log("");
for (const summary of summaries) {
  console.log(`  ${summary.build.padEnd(11)} passed ${summary.passed}/${summary.rows.length}   failed ${summary.failed}`);
}

console.log("\n  hardcoded is the migration with no boundary: every behaviour that");
console.log("  depended on alpha's wire is gone, and nothing in the code says so.");
console.log("  thin normalizes the events, which is most of the work, and then treats");
console.log("  every failure as `unknown` and never asks what the model can do.");
console.log("  contract is the only column where a failure would be a failure of the");
console.log("  provider rather than a failure of the adapter.");
