// Exercise 5 — the book's own ledger.
//
// The capstone of the capstone: six chapters, six contracts, and the three
// questions a ledger asks. No disk, no parser — the contracts are a table, and
// the exercise is the arithmetic plus the judgement about what to fix first.

export interface Contract {
  n: number;
  title: string;
  /** The harness command it declares, if any. */
  harness?: string;
  /** The string the harness prints, if it names one. */
  expected?: string;
  /** True when the gate is declared under older key names. */
  legacy?: boolean;
}

export const BOOK: Contract[] = [
  { n: 1, title: "the loop", harness: "node chapter1/files/run_ex1.ts", expected: "29/29 checks passed", legacy: true },
  { n: 2, title: "contracts", harness: "node chapter2/files/run_ex2.ts", expected: "38/38 checks passed" },
  { n: 3, title: "the protocol", harness: "node chapter3/files/run_ex3.ts", expected: "38/38 checks passed" },
  { n: 4, title: "recordings", harness: "node chapter4/files/run_ex4.ts" },
  { n: 5, title: "grading", harness: "node chapter5/files/run_ex5.ts", expected: "25/25 checks passed" },
  { n: 6, title: "statistics" },
];

export interface Findings {
  chapters: number;
  withInvariant: number;
  withHarness: number;
  withExpected: number;
  legacy: number[];
  unresolved: number[];
  missingHarness: number[];
  assertions: number;
}

export function audit(book: Contract[]): Findings {
  const expectedNumbers = book
    .map((c) => /^(\d+)\/\d+/.exec(c.expected ?? "")?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number);

  return {
    chapters: book.length,
    withInvariant: book.filter((c) => c.title.length > 0).length,
    withHarness: book.filter((c) => (c.harness ?? "").startsWith("node ")).length,
    withExpected: book.filter((c) => /^\d+\/\d+/.test(c.expected ?? "")).length,
    legacy: book.filter((c) => c.legacy).map((c) => c.n),
    unresolved: book.filter((c) => /NN\/NN/.test(c.expected ?? "")).map((c) => c.n),
    missingHarness: book.filter((c) => !(c.harness ?? "").startsWith("node ")).map((c) => c.n),
    assertions: expectedNumbers.reduce((a, b) => a + b, 0),
  };
}

/** What to fix first: a missing gate beats a legacy spelling. */
export function priority(findings: Findings): string[] {
  const out: string[] = [];
  for (const n of findings.missingHarness) out.push(`add a harness to chapter ${n}`);
  for (const n of findings.unresolved) out.push(`fill the expected string for chapter ${n}`);
  for (const n of findings.legacy) out.push(`rename the legacy keys in chapter ${n}`);
  return out;
}

export function demo() {
  const findings = audit(BOOK);
  return { findings, order: priority(findings) };
}

export function report(d: ReturnType<typeof demo>): void {
  console.log("# six contracts, three findings\n");
  console.log(`  chapters       : ${d.findings.chapters}`);
  console.log(`  with a harness : ${d.findings.withHarness}`);
  console.log(`  with expected  : ${d.findings.withExpected}`);
  console.log(`  legacy keys    : ${d.findings.legacy.join(", ") || "none"}`);
  console.log(`  no harness     : ${d.findings.missingHarness.join(", ") || "none"}`);
  console.log(`  assertions     : ${d.findings.assertions}`);
  console.log("\n# order of work\n");
  for (const step of d.order) console.log(`  ${step}`);
  console.log("\n  the order is not alphabetical and not by chapter number. A missing gate");
  console.log("  comes first because nothing is checked; a placeholder second because the");
  console.log("  check exists and its result is unknown; a legacy spelling last because the");
  console.log("  check runs and only a reader is inconvenienced.");
}

if (import.meta.main) report(demo());
