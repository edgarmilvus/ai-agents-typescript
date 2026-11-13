// Exercise 5 — three ledger states.
//
// A ledger row is evidence, and evidence has to distinguish three outcomes: the
// run finished, the run was cancelled, and the run stopped for a reason nobody
// recorded. The last state is the dangerous one, because it looks like the first
// if the only field you read is the token count.

export interface Evidence {
  /** True when the run was told to stop. */
  cancelled: boolean;
  /** Chunks the consumer actually read. */
  delivered: number;
  /** Chunks the script would have produced. */
  produced: number;
  /** True when the side effect the run exists for was committed. */
  tool: boolean;
}

export type Ledger = "complete" | "cancelled" | "incomplete";

/**
 * The status is derived, never passed in.
 *
 * Cancellation wins over everything: a cancelled run is cancelled even if the
 * tool happened to commit before the signal arrived, because that combination
 * is an incident rather than a success.
 */
export function statusOf(e: Evidence): Ledger {
  if (e.cancelled) return "cancelled";
  if (e.tool && e.delivered === e.produced) return "complete";
  return "incomplete";
}

export const CASES: { id: string; note: string; evidence: Evidence }[] = [
  { id: "l1", note: "finished, tool committed", evidence: { cancelled: false, delivered: 8, produced: 8, tool: true } },
  { id: "l2", note: "cancelled after three chunks", evidence: { cancelled: true, delivered: 3, produced: 8, tool: false } },
  { id: "l3", note: "cancelled before the first chunk", evidence: { cancelled: true, delivered: 0, produced: 8, tool: false } },
  { id: "l4", note: "finished, tool never ran", evidence: { cancelled: false, delivered: 8, produced: 8, tool: false } },
  { id: "l5", note: "stopped short, not cancelled", evidence: { cancelled: false, delivered: 3, produced: 8, tool: false } },
];

export function demo(): { id: string; note: string; ledger: Ledger }[] {
  return CASES.map((c) => ({ id: c.id, note: c.note, ledger: statusOf(c.evidence) }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# three ledger states, five cases\n");
  console.log("  case  ledger      note");
  for (const row of rows) console.log(`  ${row.id.padEnd(6)}${row.ledger.padEnd(12)}${row.note}`);
  const states = new Set(rows.map((row) => row.ledger));
  console.log(`\n  ${states.size} distinct states across ${rows.length} cases: ${[...states].sort().join(", ")}.`);
  console.log("");
  console.log("  l5 is the one to watch. Nobody cancelled, the tool never ran, and the");
  console.log("  token count is small; if the only field the reader checks is cost, it");
  console.log("  looks like a cheap success. The status is what says the conversation");
  console.log("  stopped for a reason nobody wrote down.");
}

if (import.meta.main) report(demo());
