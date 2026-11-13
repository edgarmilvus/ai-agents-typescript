// 16.6 — what a stranger runs.
//
// The last demo is the smallest one: the commands a reader with the clone and
// no key needs, gathered from the chapters' own specs. If a command is missing
// from a spec, it does not appear here, which is why chapter 6's absence in the
// previous demo matters.

import { readBook } from "../book.ts";

const chapters = readBook();

console.log("# one command\n");
console.log("  ./run_offline.sh");
console.log("  # every chapter, every harness, offline, in a couple of minutes\n");

console.log("# and per chapter\n");
console.log("  n   harness");
for (const chapter of chapters) {
  console.log(`  ${String(chapter.n).padStart(2)}  ${chapter.harness ?? "(none declared)"}`);
}

const declared = chapters.filter((c) => c.harness);
const assertions = chapters
  .map((c) => /^(\d+)\/\d+/.exec(c.expected ?? "")?.[1])
  .filter((n): n is string => n !== undefined)
  .map(Number)
  .reduce((a, b) => a + b, 0);

console.log(`\n  ${declared.length}/${chapters.length} chapters declare a harness`);
console.log(`  ${assertions} assertions declared across the chapters that name a count`);
console.log(`  one command runs them all, and the exit code is the answer`);

console.log("\n  the point of gathering this from the specs rather than from a README is");
console.log("  the same point as chapter 16's ledger: a claim a machine can read is a");
console.log("  claim a machine can check, and a claim only a human can read is a claim");
console.log("  that will be true until somebody forgets.");
