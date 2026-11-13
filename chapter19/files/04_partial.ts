// 19.4 — the answer that stopped mid-sentence.
//
// When a stream is cancelled after three chunks, the customer has read "I
// checked the " and nothing else. The partial text is not an error to hide; it
// is a fact about the conversation, and it has to be stored as partial.
//
// The demo compares what the customer saw with what the full run would have
// said, and prints the state the run recorded. A store that keeps the partial
// as a completed answer is a store that will summarise an order that was never
// checked.

import { makeEnv, run, SCRIPT } from "../stream.ts";

const full = SCRIPT.map((chunk) => chunk.text).join("");
const partial = await run(makeEnv("chain"), { abortAt: "chunk", after: 3 });

console.log("# the answer that stopped mid-sentence\n");
console.log(`  the customer saw : "${partial.out}"`);
console.log(`  the full answer  : "${full}"`);
console.log(`  stored as        : partial, ${partial.chunks} of ${SCRIPT.length} chunks`);
console.log(`  ledger           : ${partial.ledger}, ${partial.spent} tokens`);
console.log("");
console.log("  the partial string does tell the truth about what was delivered. It does");
console.log("  not tell the truth about what was promised, and the difference is a field");
console.log("  on the record: `cancelled` is not `complete` with fewer words.");
console.log("");
console.log("  a summary written from this text would read \"the order was checked\",");
console.log("  because that is what the first three chunks say. The run stopped before");
console.log("  the sentence that says whether it is within the window.");
