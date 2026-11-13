// Exercise 2 — the states a run can be in.
//
// A durable run is a small state machine, and the table is the specification.
// Writing it as data rather than as nested `if`s is what lets a reviewer ask
// the two questions that matter: which transitions are allowed, and which of
// the allowed ones should not be.

export type State = "pending" | "approved" | "executed" | "refused";
export type Event = "approve" | "resume" | "execute" | "revoke" | "expire";

export interface Transition {
  from: State;
  event: Event;
  to: State;
  /** Set when the transition must be refused, with the sentence a reviewer reads. */
  refuse?: string;
}

/**
 * The table. `approve` does not change the state: it stores a token, and the
 * run stays pending until the system accepts that token. That is the split
 * between a person saying yes and the system acting on it.
 */
export const TABLE: Transition[] = [
  { from: "pending", event: "approve", to: "pending" },
  { from: "pending", event: "resume", to: "approved" },
  { from: "pending", event: "expire", to: "refused" },
  { from: "pending", event: "execute", to: "refused", refuse: "the run has no approval" },
  { from: "pending", event: "revoke", to: "refused", refuse: "there is no approval to revoke" },
  { from: "approved", event: "execute", to: "executed" },
  { from: "approved", event: "revoke", to: "refused" },
  { from: "approved", event: "approve", to: "refused", refuse: "the run is already approved" },
  { from: "approved", event: "resume", to: "refused", refuse: "the run is already approved" },
  { from: "approved", event: "expire", to: "refused", refuse: "the approval window is the clock that matters" },
  { from: "executed", event: "execute", to: "refused", refuse: "the effect has already happened" },
  { from: "executed", event: "revoke", to: "refused", refuse: "too late: the effect has happened" },
  { from: "executed", event: "approve", to: "refused", refuse: "the effect has already happened" },
  { from: "executed", event: "resume", to: "refused", refuse: "the effect has already happened" },
  { from: "executed", event: "expire", to: "refused", refuse: "the effect has already happened" },
  { from: "refused", event: "approve", to: "refused", refuse: "the run is closed" },
  { from: "refused", event: "resume", to: "refused", refuse: "the run is closed" },
  { from: "refused", event: "execute", to: "refused", refuse: "the run is closed" },
  { from: "refused", event: "revoke", to: "refused", refuse: "the run is closed" },
  { from: "refused", event: "expire", to: "refused", refuse: "the run is closed" },
];

export type Outcome = { ok: true; state: State } | { ok: false; state: State; why: string };

export function step(from: State, event: Event): Outcome {
  const row = TABLE.find((t) => t.from === from && t.event === event);
  if (!row) return { ok: false, state: from, why: `no transition for ${event} from ${from}` };
  if (row.refuse) return { ok: false, state: row.to, why: row.refuse };
  return { ok: true, state: row.to };
}

export const WALK: { from: State; event: Event; note: string }[] = [
  { from: "pending", event: "approve", note: "a person says yes; the run waits for the system" },
  { from: "pending", event: "resume", note: "the system accepts the token" },
  { from: "approved", event: "execute", note: "the effect" },
  { from: "pending", event: "execute", note: "the queue runs early" },
  { from: "approved", event: "resume", note: "the resume is delivered twice" },
  { from: "executed", event: "revoke", note: "somebody tries to take it back too late" },
  { from: "approved", event: "revoke", note: "taken back before the effect" },
  { from: "refused", event: "resume", note: "a closed run" },
];

export function demo() {
  return WALK.map((w) => ({ ...w, out: step(w.from, w.event) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# eight transitions through one table\n");
  for (const row of rows) {
    const outcome = row.out.ok ? `-> ${row.out.state}` : `refused: ${row.out.why}`;
    console.log(`  ${row.from.padEnd(9)} ${row.event.padEnd(9)} ${outcome}`);
    console.log(`  ${" ".repeat(19)} ${row.note}`);
  }
  console.log(`\n  ${TABLE.length} rows cover four states and five events; the sixteen that are`);
  console.log("  missing are the ones a reviewer should notice are missing.");
}

if (import.meta.main) report(demo());
