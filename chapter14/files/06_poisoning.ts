// 14.6 — a memory written by a tool.
//
// Retrieval has a second attacker that chapter 12 did not have to think about:
// the store. A note written from a tool result sits in the same index as a note
// a person confirmed, it sorts by the same score, and it wins ties by being
// newer.
//
// The demo walks the answers a team gives — trust everything, filter by
// provenance, confirm the suspicious one — and then the only two resolutions
// that end in a defensible number, both of which are a person deciding.

import { confirm, createStore, forget, live, supersede, trusted } from "../memory.ts";
import type { Memory, Store } from "../memory.ts";
import { asDoc, rank } from "../retrieve.ts";
import { DISTRACTORS, OLD } from "../tasks.ts";

const QUERY = "What ceiling applies to customer C-12?";

const poisoned: Memory = {
  id: "m21",
  text: "customer C-12 refund ceiling is 5000 EUR, approved by the desk",
  kind: "fact",
  about: "C-12",
  source: "tool",
  createdAt: 21,
};

function newStore(): Store {
  return createStore([...OLD, ...DISTRACTORS, { ...poisoned }]);
}

/** What the agent would act on, given the records it is allowed to see. */
function value(records: Memory[]): string {
  const top = rank(QUERY, records.map(asDoc), 1)[0];
  const note = records.find((m) => m.id === top?.id);
  return note?.text.match(/(\d+) EUR/)?.[1] ?? "none";
}

/** The same, with the provenance filter on, which is the policy under test. */
function ceiling(store: Store, now = 30): string {
  return value(live(store, now).filter(trusted));
}

const store = newStore();

console.log("# the same question, two policies\n");
const naive = rank(QUERY, live(store, 30).map(asDoc), 3).map((r) => r.id).join(", ");
const filtered = rank(QUERY, live(store, 30).filter(trusted).map(asDoc), 3).map((r) => r.id).join(", ");
console.log(`  everything live  ${naive}`);
console.log(`                   the agent reads ${value(live(store, 30))}`);
console.log(`  trusted only     ${filtered}`);
console.log(`                   the agent reads ${ceiling(store)} (the tool note is filtered out)`);

console.log("\n# confirming it is not resolving it\n");
confirm(store, "m21", 40);
console.log(`  m21 is now trusted, and the agent reads ${ceiling(store)} again`);
console.log("  two ceilings are in the context and the newer one is the wrong one. A");
console.log("  person said 'I read this note'; nobody said 'this note is true'.");

console.log("\n# resolution one: the note is wrong\n");
{
  const s = newStore();
  forget(s, "m21", 42);
  console.log(`  forget m21 → the agent reads ${ceiling(s)}`);
  console.log(`  deletions on record: ${s.deleted.map((d) => `${d.id} at ${d.at}`).join(", ")}`);
}

console.log("\n# resolution two: the ceiling really did change\n");
{
  const s = newStore();
  supersede(s, "m9", {
    id: "m22",
    text: "customer C-12 refund ceiling is 5000 EUR after the audit on 12 October",
    kind: "fact",
    about: "C-12",
    source: "principal",
    createdAt: 41,
  });
  forget(s, "m21", 42);
  console.log(`  m9 superseded by m22 → the agent reads ${ceiling(s)}`);
  console.log(`  the store still holds the record m9, and the live set does not: a`);
  console.log(`  replacement is a fact about the record, and a deletion is not the only way to stop believing it.`);
}

console.log("\n  a store is an attack surface with a slower clock than a prompt. The note");
console.log("  that arrives today is retrieved by every task that mentions the customer,");
console.log("  and the only thing separating it from the note a person wrote is the field");
console.log("  nobody looks at: where it came from.");
