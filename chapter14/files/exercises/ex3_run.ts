// Exercise 3, file 3 of 3 — the wiring, and a small corpus.
//
// Six tasks over eight documents, the same shape as the chapter's corpus at a
// size a reader can check by hand: one keyword case, one paraphrase, one whose
// note is recent. The table reports whether the needed document made it into
// the context, which is the only number the exercise cares about.

import { cost, pack } from "./ex3_context.ts";
import { newest, search } from "./ex3_index.ts";
import type { Doc } from "./ex3_index.ts";

export const DOCS: Doc[] = [
  { id: "d1", text: "ORD-7712 refund approved for 84 EUR damaged headphones", about: "ORD-7712" },
  { id: "d2", text: "customer C-12 gets a 10 percent goodwill discount", about: "C-12" },
  { id: "d3", text: "ORD-7900 escalated to the partner desk", about: "ORD-7900" },
  { id: "d4", text: "ORD-7712 delivery photo uploaded", about: "ORD-7712" },
  { id: "d5", text: "C-12 asked for a callback", about: "C-12" },
  { id: "d6", text: "ORD-7801 packaging replaced", about: "ORD-7801" },
  { id: "d7", text: "customer C-07 changed their number", about: "C-07" },
  { id: "d8", text: "ORD-7900 invoice attached", about: "ORD-7900" },
  { id: "d9", text: "refund policy exception for ORD-7801", about: "ORD-7801" },
  { id: "d10", text: "refund ceiling for the EU region", about: "EU" },
];

export interface Task {
  id: string;
  request: string;
  needs: string;
}

export const TASKS: Task[] = [
  { id: "q1", request: "Refund ORD-7712 again.", needs: "d1" },
  { id: "q2", request: "Give C-12 the usual break.", needs: "d2" },
  { id: "q3", request: "Handle ORD-7900 like before.", needs: "d3" },
  { id: "q4", request: "Where is the delivery photo?", needs: "d4" },
  { id: "q5", request: "Where should the replacement go?", needs: "d2" },
  { id: "q6", request: "Any news on ORD-7801?", needs: "d6" },
];

export const BUDGET = 24;

export interface Row {
  id: string;
  request: string;
  needs: string;
  retrieval: boolean;
  newest: boolean;
  dropped?: string;
}

export function demo(): Row[] {
  return TASKS.map((task) => {
    const ranked = search(task.request, DOCS, DOCS.length).map((hit) => ({
      id: hit.id,
      tokens: cost(DOCS.find((doc) => doc.id === hit.id)!.text),
    }));
    const packed = pack(ranked, BUDGET);
    const naive = pack(newest(DOCS, 3).map((hit) => ({ id: hit.id, tokens: cost(DOCS.find((d) => d.id === hit.id)!.text) })), BUDGET);
    return {
      ...task,
      retrieval: packed.ids.includes(task.needs),
      newest: naive.ids.includes(task.needs),
      dropped: packed.dropped[0],
    };
  });
}

export function report(rows: Row[]): void {
  console.log("# six tasks, one budget\n");
  console.log("  task  needs  retrieval  newest  request");
  for (const row of rows) {
    console.log(`  ${row.id.padEnd(4)}  ${row.needs.padEnd(5)}  ${(row.retrieval ? "yes" : "no").padEnd(9)}  ${(row.newest ? "yes" : "no").padEnd(6)}  ${row.request}`);
  }
  const found = rows.filter((r) => r.retrieval).length;
  console.log(`\n  retrieval answered ${found}/${rows.length}, newest-first ${rows.filter((r) => r.newest).length}/${rows.length}`);
  const dropped = rows.filter((r) => r.dropped);
  console.log(`  notes ranked but not affordable: ${dropped.map((r) => `${r.id}→${r.dropped}`).join(", ") || "none"}`);
  console.log("\n  the budget file is the only place that knows a note can be ranked and");
  console.log("  still not fit, and that distinction is why it is a separate file.");
}

if (import.meta.main) report(demo());
