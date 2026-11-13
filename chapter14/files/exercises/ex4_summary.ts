// Exercise 4 — a summary of a summary.
//
// Compression keeps what it thinks will matter. This exercise makes that
// opinion explicit — decisions first, then preferences, then facts — and then
// applies it three times, because the second and third applications are where a
// summary stops describing the work and starts describing itself.

export type Kind = "fact" | "decision" | "preference";

export interface Note {
  id: string;
  text: string;
  kind: Kind;
  createdAt: number;
}

const ORDER: Record<Kind, number> = { decision: 0, preference: 1, fact: 2 };

export function tokens(note: Note): number {
  return Math.ceil(note.text.length / 4);
}

/** Keep whole notes, in priority order, until the ratio of the tokens is spent. */
export function keep(notes: Note[], ratio: number): Note[] {
  const total = notes.reduce((sum, note) => sum + tokens(note), 0);
  const budget = Math.floor(total * ratio);
  const ordered = [...notes].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || b.createdAt - a.createdAt);
  const kept: Note[] = [];
  let used = 0;
  for (const note of ordered) {
    if (used + tokens(note) > budget) break;
    kept.push(note);
    used += tokens(note);
  }
  return kept;
}

export const NOTES: Note[] = [
  { id: "n1", text: "ORD-7712 refund approved for 84 EUR after damage", kind: "decision", createdAt: 1 },
  { id: "n2", text: "damage photo shows a cracked headband", kind: "fact", createdAt: 2 },
  { id: "n3", text: "C-12 gets a 10 percent goodwill discount", kind: "preference", createdAt: 3 },
  { id: "n4", text: "ORD-7900 escalated to the partner desk", kind: "decision", createdAt: 4 },
  { id: "n5", text: "partner desk answered within two days", kind: "fact", createdAt: 5 },
  { id: "n6", text: "ORD-7801 refund exception for the window", kind: "decision", createdAt: 6 },
  { id: "n7", text: "the exception was signed by the duty manager", kind: "fact", createdAt: 7 },
  { id: "n8", text: "C-07 prefers email over phone", kind: "preference", createdAt: 8 },
  { id: "n9", text: "ORD-7712 shipped with Northwind", kind: "fact", createdAt: 9 },
  { id: "n10", text: "the packing list was reprinted", kind: "fact", createdAt: 10 },
];

export function rounds(ratio: number, count = 3): { round: number; notes: number; decisions: number; facts: number; tokens: number }[] {
  const out = [];
  let current = NOTES;
  for (let round = 0; round <= count; round += 1) {
    out.push({
      round,
      notes: current.length,
      decisions: current.filter((n) => n.kind === "decision").length,
      facts: current.filter((n) => n.kind === "fact").length,
      tokens: current.reduce((sum, n) => sum + tokens(n), 0),
    });
    current = keep(current, ratio);
  }
  return out;
}

export function demo() {
  return { half: rounds(0.5), quarter: rounds(0.25) };
}

export function report(d: ReturnType<typeof demo>): void {
  for (const [label, rows] of [["half", d.half], ["quarter", d.quarter]] as const) {
    console.log(`# ${label} the tokens each round\n`);
    console.log("  round  notes  decisions  facts  tokens");
    for (const row of rows) {
      console.log(`  ${String(row.round).padEnd(6)} ${String(row.notes).padStart(5)} ${String(row.decisions).padStart(10)} ${String(row.facts).padStart(6)} ${String(row.tokens).padStart(7)}`);
    }
    const last = rows[rows.length - 1];
    console.log(`  after ${rows.length - 1} rounds: ${last.decisions} decisions, ${last.facts} facts\n`);
  }
  console.log("  at half, the decisions outlive the evidence and the second round is");
  console.log("  enough to lose every fact. At a quarter, the first round already does");
  console.log("  it. The summary is not wrong about what was decided; it is silent about");
  console.log("  why, and a reviewer reading it cannot tell the difference.");
}

if (import.meta.main) report(demo());
