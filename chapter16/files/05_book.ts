// 16.5 — the book's ledger, read from its own contracts.
//
// Every chapter of this book declares an invariant, a harness and the string
// that harness prints. This demo reads those files from disk and checks that
// the claims are still there — which is the smallest possible version of the
// chapter's own argument, applied to the book.
//
// It also finds something, because a ledger that never finds anything is a
// ledger nobody filled in.

import { readBook, summarise } from "../book.ts";

const chapters = readBook();
const summary = summarise(chapters);

console.log("# sixteen chapters, sixteen contracts\n");
console.log("  n   expected              title");
for (const chapter of chapters) {
  const expected = chapter.expected ?? "—";
  console.log(`  ${String(chapter.n).padStart(2)}  ${expected.padEnd(20)} ${chapter.title.slice(0, 56)}`);
}

console.log(`\n  invariants declared : ${summary.withInvariant}/${chapters.length}`);
console.log(`  harnesses declared  : ${summary.withHarness}/${chapters.length}`);
console.log(`  expected strings    : ${summary.withExpected}/${chapters.length}`);
console.log(`  legacy key names    : ${summary.legacy.join(", ") || "none"}`);
console.log(`  unresolved          : ${summary.unresolved.join(", ") || "none"}`);

console.log(`\n# what the ledger found\n`);
for (const chapter of chapters.filter((c) => c.legacy)) {
  console.log(`  chapter ${chapter.n} declares its gate under the older keys (run, run_expected)`);
}
for (const chapter of chapters.filter((c) => !(c.harness ?? "").startsWith("node "))) {
  console.log(`  chapter ${chapter.n} declares no harness at all: "${chapter.title.slice(0, 40)}"`);
}
for (const n of summary.unresolved) console.log(`  chapter ${n} still has a placeholder where its expected string should be`);

console.log("\n  two findings, two kinds. The first is contract drift: the same claim");
console.log("  written in two spellings, which a parser reads as one and misses the");
console.log("  other. The second is a real gap: a chapter whose gate is its exercises and");
console.log("  nothing else, so its demos are run but not asserted.");
console.log("");
console.log("  the third finding was this chapter's own row, empty until the chapter was");
console.log("  finished. A ledger that finds nothing is a ledger nobody filled in; this");
console.log("  one found the row that was doing the finding.");
