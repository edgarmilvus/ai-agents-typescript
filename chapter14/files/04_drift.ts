// 14.4 — a summary of a summary.
//
// Compression is a bet about what will matter later. The bet this compressor
// makes is the one most teams make: keep decisions and preferences, drop facts,
// newest first. Three rounds of it show what that bet costs — the decisions
// survive, the evidence for them does not, and the tasks that need the evidence
// stop being answerable.

import { createStore, tokensOf } from "../memory.ts";
import type { Memory } from "../memory.ts";
import { DISTRACTORS, OLD, TASKS } from "../tasks.ts";

const PRIORITY: Record<string, number> = { decision: 0, preference: 1, fact: 2 };

/** Keep whole records, in priority order, until the ratio of the tokens is spent. */
export function compress(records: Memory[], ratio: number): Memory[] {
  const total = records.reduce((sum, m) => sum + tokensOf(m), 0);
  const budget = Math.floor(total * ratio);
  const ordered = [...records].sort(
    (a, b) => (PRIORITY[a.kind] ?? 3) - (PRIORITY[b.kind] ?? 3) || b.createdAt - a.createdAt,
  );
  const kept: Memory[] = [];
  let used = 0;
  for (const memory of ordered) {
    const cost = tokensOf(memory);
    if (used + cost > budget) break;
    kept.push(memory);
    used += cost;
  }
  return kept;
}

const DECISIONS = ["m1", "m4", "m7"];

function report(round: number, kept: Memory[]): void {
  const decisions = DECISIONS.filter((id) => kept.some((m) => m.id === id)).length;
  const facts = kept.filter((m) => m.kind === "fact").length;
  const answerable = TASKS.filter((task) => task.needs.every((id) => kept.some((m) => m.id === id))).length;
  const tokens = kept.reduce((sum, m) => sum + tokensOf(m), 0);
  console.log(
    `  ${String(round).padEnd(6)} ${String(kept.length).padStart(5)} ${String(decisions).padStart(9)}/${DECISIONS.length} ` +
      `${String(facts).padStart(6)} ${String(answerable).padStart(9)}/${TASKS.length} ${String(tokens).padStart(7)}`,
  );
}

const store = createStore([...OLD, ...DISTRACTORS]);
let kept: Memory[] = store.records;

console.log("# three rounds at half the tokens each\n");
console.log("  round  kept  decisions  facts  answerable  tokens");
report(0, kept);
for (let round = 1; round <= 3; round += 1) {
  kept = compress(kept, 0.5);
  report(round, kept);
}

console.log(`\n  after two rounds the decisions are all still there and every fact that`);
console.log("  justified them is gone. That is the summary a reviewer reads: it says what");
console.log("  was decided, cannot say why, and would pass every check that looks for a");
console.log("  decision in the context. The third round starts eating decisions, which");
console.log("  is the point where the summary stops being about the work at all.");
