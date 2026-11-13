// 16.4 — a fixture that has gone stale.
//
// A fixture is a claim that a particular bug, if it returned, would be caught.
// When the component around it is rewritten, the fixture keeps passing — for a
// different reason — and the claim becomes false without anybody noticing.
//
// The test is chapter 9's: re-run the mutant the fixture was written for. If
// the suite stays green, the fixture is no longer testing what it says.

interface Fixture {
  id: string;
  covers: string;
  component: "tool" | "world" | "grader" | "harness";
  /** The mutant this fixture was written for. */
  writtenFor: string;
  /** Does the suite still fail when that mutant is reintroduced? */
  detects: boolean;
  week: number;
}

export const FIXTURES: Fixture[] = [
  { id: "f1", covers: "i1-cents", component: "tool", writtenFor: "tool-cents", detects: true, week: 1 },
  { id: "f2", covers: "i2-double", component: "world", writtenFor: "world-drop", detects: true, week: 1 },
  { id: "f3", covers: "i3-lenient", component: "grader", writtenFor: "grader-lenient", detects: true, week: 2 },
  { id: "f4", covers: "i4-injection", component: "tool", writtenFor: "policy-egress", detects: true, week: 2 },
  { id: "f5", covers: "i6-cache", component: "world", writtenFor: "cache-stale", detects: false, week: 3 },
  { id: "f6", covers: "i8-runaway", component: "harness", writtenFor: "budget-runaway", detects: true, week: 4 },
  { id: "f7", covers: "i9-dropped", component: "world", writtenFor: "world-drop", detects: false, week: 5 },
  { id: "f8", covers: "i10-truncated", component: "harness", writtenFor: "harness-truncate", detects: false, week: 5 },
];

const stale = FIXTURES.filter((f) => !f.detects);

console.log("# eight fixtures, checked by reintroducing their bug\n");
console.log("  fixture  component  written for        still fails  verdict");
for (const fixture of FIXTURES) {
  console.log(
    `  ${fixture.id.padEnd(7)}  ${fixture.component.padEnd(9)}  ${fixture.writtenFor.padEnd(18)} ${(fixture.detects ? "yes" : "no").padEnd(12)} ${fixture.detects ? "live" : "STALE"}`,
  );
}

console.log(`\n  ${stale.length} of ${FIXTURES.length} fixtures still pass when their bug is reintroduced.`);
console.log("  They are not broken tests — they run, they assert, they are green. They have");
console.log("  stopped being about the thing they were written for, because the component");
console.log("  around them was rewritten and the assertion no longer reaches it.");

console.log("\n# what to do with a stale fixture\n");
for (const fixture of stale) {
  console.log(`  ${fixture.id}  covers ${fixture.covers} (week ${fixture.week}) → re-point at the new ${fixture.component}, or retire it with a reason`);
}

console.log("\n  deleting is the wrong default. The incident still happened once, and the");
console.log("  fixture is the only record that the suite ever noticed. A retired fixture");
console.log("  keeps its incident id and a sentence saying why the assertion cannot be");
console.log("  re-pointed, which is the same discipline chapter 9 applied to a survivor.");
