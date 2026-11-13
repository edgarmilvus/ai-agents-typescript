// 14.1 — one task, three strategies, and the note that decides it.
//
// The same request against the same store, with the memory section built three
// ways: nothing, the newest notes that fit, and the notes the request ranks
// highest. The two tasks are chosen to show both failure modes — a baseline
// that keeps the wrong notes and a retriever that cannot find a paraphrase.

import { createStore, tokensOf } from "../memory.ts";
import { assemble } from "../context.ts";
import { DISTRACTORS, OLD, TASKS } from "../tasks.ts";
import type { Strategy } from "../context.ts";

const store = createStore([...OLD, ...DISTRACTORS]);
const BUDGET = 130;

const strategies: Strategy[] = ["none", "transcript", "retrieval"];

for (const id of ["t4", "t14"]) {
  const task = TASKS.find((t) => t.id === id);
  if (!task) throw new Error(`no ${id}`);
  console.log(`# ${task.id} — ${task.request}`);
  console.log(`  needs ${task.needs.join(", ")}\n`);
  for (const strategy of strategies) {
    const context = assemble(task, store, strategy, 30, BUDGET);
    const ok = task.needs.every((need) => context.ids.includes(need));
    console.log(
      `  ${strategy.padEnd(11)} ${ok ? "answered" : "MISSED  "}  ${String(context.tokens).padStart(3)} tokens  [${context.ids.join(", ") || "empty"}]`,
    );
  }
  console.log("");
}

const needed = store.records.find((m) => m.id === "m4");
const unseen = store.records.find((m) => m.id === "m8");
console.log(`  t4 needs ${needed?.id}: "${needed?.text}"`);
console.log(`  it costs ${needed ? tokensOf(needed) : 0} tokens and it is older than ten notes that do not.`);
console.log(`  t14 needs ${unseen?.id}, and the request shares no word with it: "${unseen?.text}"`);
