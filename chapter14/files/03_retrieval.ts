// 14.3 — where the right note ranks, and where it does not appear at all.
//
// Retrieval either finds a note or it does not, and "does not" has two shapes:
// the note is in the list but below the budget, or the note scored zero because
// the request and the note share no word. The second is the interesting one,
// because no budget fixes it.

import { createStore, live } from "../memory.ts";
import { asDoc, rank } from "../retrieve.ts";
import { DISTRACTORS, OLD, TASKS } from "../tasks.ts";

const store = createStore([...OLD, ...DISTRACTORS]);
const docs = live(store, 30).map(asDoc);

console.log("# the rank of the note each task needs\n");
console.log("  task  needs  rank  request");
for (const task of TASKS) {
  const ranked = rank(task.request, docs, docs.length);
  const position = ranked.findIndex((row) => row.id === task.needs[0]);
  const label = position === -1 ? "absent" : String(position + 1);
  console.log(`  ${task.id.padEnd(5)} ${task.needs[0].padEnd(6)} ${label.padEnd(5)} ${task.request}`);
}

const absent = TASKS.filter((task) => rank(task.request, docs, docs.length).findIndex((r) => r.id === task.needs[0]) === -1);
const first = TASKS.filter((task) => rank(task.request, docs, docs.length)[0]?.id === task.needs[0]);

console.log(`\n  the note is first for ${first.length} of ${TASKS.length} tasks and absent for ${absent.length}`);
console.log(`  absent: ${absent.map((t) => t.id).join(", ")}`);
console.log("\n  a note that scores zero is not a budget problem: no context window is big");
console.log("  enough to include a document the retriever never returned. The fix is a");
console.log("  different scorer — embeddings, or a query the model rewrites — and both");
console.log("  are outside this chapter, which is about the decision the ranking feeds.");
