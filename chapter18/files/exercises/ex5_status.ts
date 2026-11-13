// Exercise 5 — a deletion with a status.
//
// A deletion is not a boolean. It has evidence, and the evidence has holes:
// nobody scanned, the scan found something, the scan was clean but nobody
// recorded it. This exercise turns those holes into a state machine with five
// names, because a status that cannot say "unrecorded" is a status that says
// "clean" about a purge nobody can audit.

export interface Evidence {
  removed: number;
  scanned: boolean;
  hits: number;
  recorded: boolean;
}

export type Status = "not-started" | "open" | "residual" | "unrecorded" | "clean";

/**
 * Read the evidence, in order.
 *
 * `removed === 0` with no record is not clean: it is a tenant nobody has
 * started on, or one whose tombstone was lost. Both need a person, not a
 * success message.
 */
export function statusOf(e: Evidence): Status {
  if (!e.scanned && !e.recorded && e.removed === 0) return "not-started";
  if (!e.scanned) return "open";
  if (e.hits > 0) return "residual";
  if (!e.recorded) return "unrecorded";
  return "clean";
}

export const CASES: { id: string; note: string; evidence: Evidence }[] = [
  { id: "s1", note: "nothing has run", evidence: { removed: 0, scanned: false, hits: 0, recorded: false } },
  { id: "s2", note: "rows deleted, no scan", evidence: { removed: 7, scanned: false, hits: 0, recorded: false } },
  { id: "s3", note: "the scan found a backup", evidence: { removed: 7, scanned: true, hits: 1, recorded: false } },
  { id: "s4", note: "clean, nothing written down", evidence: { removed: 7, scanned: true, hits: 0, recorded: false } },
  { id: "s5", note: "clean and recorded", evidence: { removed: 7, scanned: true, hits: 0, recorded: true } },
  { id: "s6", note: "run again after s5", evidence: { removed: 0, scanned: true, hits: 0, recorded: true } },
];

export function demo(): { id: string; note: string; status: Status }[] {
  return CASES.map((c) => ({ id: c.id, note: c.note, status: statusOf(c.evidence) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# six points in a deletion\n");
  console.log("  case  status       note");
  for (const row of rows) console.log(`  ${row.id.padEnd(6)}${row.status.padEnd(13)}${row.note}`);

  const states = new Set(rows.map((row) => row.status));
  console.log(`\n  ${states.size} distinct states across ${rows.length} cases.`);
  console.log("");
  console.log("  s4 is the one teams ship: everything removed, scan clean, no record.");
  console.log("  It reads as success and it is indistinguishable from a purge that never");
  console.log("  ran, which is why the tombstone is part of the control rather than a");
  console.log("  compliance afterthought. s5 is the only state that means what it says.");
}

if (import.meta.main) report(demo());
