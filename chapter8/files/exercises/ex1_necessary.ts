// Exercise 1 — necessary, sufficient, neither.
//
// The chapter's rule is a sentence, and this file turns the sentence into a
// function you can run against a table. Restoration is the test: an axis is
// *sufficient* when restoring it alone turns the run green, and *necessary*
// when the full restore stops repairing if you leave it out. The two are
// independent, and the four cells they make are the whole verdict taxonomy:
// sufficient and necessary is a single, sufficient but not necessary is joint,
// neither is an interaction, necessary but not sufficient is a component that
// has to move back as part of a set.
//
// Nothing here replays a tape. That is the point: the inference rule is
// separable from the instrument, so it can be checked by hand.

import type { Axis } from "../../trace.ts";

export type Role = "sufficient+necessary" | "sufficient" | "necessary" | "neither";

/** A repair predicate: does restoring this set of axes make the run pass? */
export type Repairs = (axes: readonly Axis[]) => boolean;

/**
 * Classify one axis against a repair predicate.
 *
 * `all` is the full set of suspect axes, which is assumed to repair the run —
 * otherwise there is no repair set to reason about and the caller should be
 * reporting `decisions` or `upstream` instead.
 */
export function roleOf(axis: Axis, all: readonly Axis[], repairs: Repairs): Role {
  const alone = repairs([axis]);
  // Necessary means: take it out of the full repair set and the repair stops.
  const necessary = !repairs(all.filter((a) => a !== axis));
  if (alone && necessary) return "sufficient+necessary";
  if (alone) return "sufficient";
  if (necessary) return "necessary";
  return "neither";
}

/** Every axis in the set, classified at once. */
export function roles(all: readonly Axis[], repairs: Repairs): Record<string, Role> {
  const out: Record<string, Role> = {};
  for (const axis of all) out[axis] = roleOf(axis, all, repairs);
  return out;
}

/** A table: which subsets repair, by sorted key. Everything absent is red. */
export type Table = Record<string, true>;

export function tableRepairs(table: Table): Repairs {
  return (axes) => table[[...axes].sort().join("+")] === true;
}

export interface Fixture {
  id: string;
  note: string;
  axes: Axis[];
  table: Table;
}

/**
 * Three fixtures, hand-written, one per shape the corpus will show.
 *
 * The keys are sorted and joined so that a set has one spelling and the
 * predicate is a lookup rather than a search.
 */
export const FIXTURES: Fixture[] = [
  {
    id: "one-component",
    note: "the tool alone breaks the write, and the tool alone fixes it",
    axes: ["tool"],
    table: { tool: true },
  },
  {
    id: "either-rollback",
    note: "a new field and a ledger that reads it: either rollback repairs",
    axes: ["tool", "world"],
    table: { "tool+world": true, tool: true, world: true },
  },
  {
    id: "neither-alone",
    note: "an outage behind a one-step loop: both have to move back",
    axes: ["tool", "harness"],
    table: { "harness+tool": true },
  },
  {
    id: "necessary-not-sufficient",
    note: "two components must move, and one of them is not enough on its own",
    axes: ["tool", "world", "grader"],
    table: { "grader+tool+world": true, "grader+tool": true },
  },
];

export function demo() {
  return FIXTURES.map((f) => ({
    id: f.id,
    note: f.note,
    roles: roles(f.axes, tableRepairs(f.table)),
    repairsWhenAll: tableRepairs(f.table)(f.axes),
  }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# four repair tables, four shapes\n");
  for (const row of rows) {
    console.log(`  ${row.id}`);
    console.log(`    ${row.note}`);
    for (const [axis, role] of Object.entries(row.roles)) {
      console.log(`    ${axis.padEnd(8)} ${role}`);
    }
    console.log(`    restoring all suspects repairs: ${row.repairsWhenAll ? "yes" : "no"}\n`);
  }
  console.log("  a single verdict is one sufficient+necessary axis; joint is a set of");
  console.log("  sufficient-not-necessary axes; an interaction is a set of axes that are");
  console.log("  necessary and not sufficient; and an axis that is neither is in the");
  console.log("  suspect list because the release moved it, not because it matters.");
}

if (import.meta.main) report(demo());
