// Exercise 4 — a fixture that has gone stale.
//
// A fixture is a claim that a bug, reintroduced, would be caught. This exercise
// checks that claim by reintroducing the bug, and decides what to do with the
// fixtures whose claim is no longer true.

export interface Fixture {
  id: string;
  covers: string;
  component: string;
  mutant: string;
  /** Does the suite still fail when the mutant is reintroduced? */
  detects: boolean;
}

export const FIXTURES: Fixture[] = [
  { id: "f1", covers: "inc-1", component: "tool", mutant: "cents", detects: true },
  { id: "f2", covers: "inc-2", component: "world", mutant: "drop-write", detects: true },
  { id: "f3", covers: "inc-3", component: "check", mutant: "always-pass", detects: false },
  { id: "f4", covers: "inc-4", component: "harness", mutant: "budget-one", detects: true },
  { id: "f5", covers: "inc-5", component: "cache", mutant: "stale-entry", detects: false },
];

export type Decision = { id: string; verdict: "live" | "stale"; action: string };

/** A stale fixture is repaired, not deleted: the incident is still on record. */
export function triage(fixtures: Fixture[]): Decision[] {
  return fixtures.map((fixture) => ({
    id: fixture.id,
    verdict: fixture.detects ? "live" : "stale",
    action: fixture.detects
      ? "keep"
      : `re-point at the current ${fixture.component}, or retire with a reason`,
  }));
}

export function stale(fixtures: Fixture[]): Fixture[] {
  return fixtures.filter((f) => !f.detects);
}

export function demo() {
  return { decisions: triage(FIXTURES), stale: stale(FIXTURES).length };
}

export function report(d: ReturnType<typeof demo>): void {
  console.log("# five fixtures, checked by reintroducing their bug\n");
  console.log("  fixture  covers  component  mutant        verdict  action");
  for (const fixture of FIXTURES) {
    const decision = d.decisions.find((row) => row.id === fixture.id)!;
    console.log(
      `  ${fixture.id.padEnd(7)}  ${fixture.covers.padEnd(6)}  ${fixture.component.padEnd(9)}  ${fixture.mutant.padEnd(12)} ${decision.verdict.padEnd(7)}  ${decision.action}`,
    );
  }
  console.log(`\n  ${d.stale} of ${FIXTURES.length} are stale: they run, they assert, they pass, and they`);
  console.log("  would pass with the bug back. The detector is the mutant, not the green");
  console.log("  tick — the same test chapter 9 applied to the suite as a whole, applied");
  console.log("  here to one fixture at a time.");
  console.log("");
  console.log("  the decision matters more than the verdict. Deleting a stale fixture");
  console.log("  deletes the only record that the suite ever noticed the incident;");
  console.log("  re-pointing it keeps the history and restores the claim.");
}

if (import.meta.main) report(demo());
