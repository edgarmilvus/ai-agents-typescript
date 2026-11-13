// 20.2 — the same three builds on both providers.
//
// A port is not proved by working on the provider it was written for. The
// table runs one text task through each build on alpha and on beta; the
// interesting cell is hardcoded-beta, and the interesting column is the one
// that does not change.
//
// The table only asks whether the build produced an answer. The matrix in the
// next demo asks which behaviours survived.

import { alpha, beta } from "../adapters.ts";
import { runBuild } from "../agent.ts";
import type { Build } from "../agent.ts";

const builds: Build[] = ["hardcoded", "thin", "contract"];

console.log("# three builds, two providers\n");
console.log(`  ${"build".padEnd(12)}${["alpha", "beta"].map((name) => name.padStart(6)).join("")}`);
for (const build of builds) {
  const cells: string[] = [];
  for (const port of [alpha, beta]) {
    const outcome = await runBuild(build, port, "text");
    cells.push((outcome.ok ? "ok" : "crash").padStart(6));
  }
  console.log(`  ${build.padEnd(12)}${cells.join("")}`);
}

console.log("\n  hardcoded works on alpha because alpha is the provider it was written");
console.log("  against. The beta cell is the migration: a required field with a");
console.log("  different name, and a build that has no way to know it exists.");
console.log("");
console.log("  thin and contract both survive the text task. The matrix shows why they");
console.log("  are not the same: thin has no vocabulary for errors or capabilities, and");
console.log("  a text task never asks it to use either.");
