// 14.3 — what the model asked for, and whether asking helped.
//
// The recorded runs are two tasks and the queries the model wrote for them. The
// demo replays each query against the store and reports the rank of the note
// the task actually needed — which separates "the retriever failed" from "the
// question was answerable and the query was wrong".

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createStore, live, trusted } from "../memory.ts";
import { asDoc, rank } from "../retrieve.ts";
import { DISTRACTORS, OLD, TASKS } from "../tasks.ts";
import { RECORDED, RUNS } from "../runs.ts";
import type { Saved } from "../runs.ts";

const store = createStore([...OLD, ...DISTRACTORS]);
const docs = live(store, 30).filter(trusted).map(asDoc);

function rankOf(query: string, need: string): string {
  const hits = rank(query, docs, docs.length);
  const position = hits.findIndex((hit) => hit.id === need);
  return position === -1 ? "absent" : String(position + 1);
}

for (const id of RECORDED) {
  const saved = JSON.parse(readFileSync(join(RUNS, `${id}.json`), "utf8")) as Saved;
  const task = TASKS.find((t) => t.id === id)!;
  console.log(`# ${saved.taskId} — ${saved.request}`);
  console.log(`  needs ${task.needs[0]}: "${store.records.find((m) => m.id === task.needs[0])?.text}"\n`);
  console.log(`  the request itself   ranks it ${rankOf(saved.request, task.needs[0])}`);
  for (const query of saved.queries) {
    console.log(`  query "${query}"`.padEnd(40) + ` ranks it ${rankOf(query, task.needs[0])}`);
  }
  console.log(`  answer: ${saved.answer.slice(0, 120)}\n`);
}

console.log("  the first task shows query rewriting working: the model turned a vague");
console.log("  request into the order id and the phrase the note uses, and the note moved");
console.log("  to the top of the ranking.");
console.log("");
console.log("  the second shows where rewriting stops being retrieval. Eight of nine");
console.log("  phrasings share no word with the note, because it says 'goodwill discount'");
console.log("  and the request says 'break'. The one that found it guessed 'discount");
console.log("  concession': the model supplied the synonym, the store did not learn it.");
