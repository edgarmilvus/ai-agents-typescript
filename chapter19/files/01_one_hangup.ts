// 19.1 — one hang-up, two bills.
//
// The customer reads three chunks and closes the tab. The `leak` runtime keeps
// generating: it finishes the first turn, runs the refund tool, makes the
// second model call, writes the summary and marks the ledger complete. The
// `chain` runtime stops at the third chunk and records what it spent.
//
// Same customer, same click, two invoices.

import { makeEnv, run } from "../stream.ts";

const scenario = { abortAt: "chunk" as const, after: 3 };

const leak = await run(makeEnv("leak"), scenario);
const chain = await run(makeEnv("chain"), scenario);

console.log("# one hang-up, two bills\n");
console.log("  the customer read 3 chunks and closed the tab");
console.log("  the full answer is 8 chunks, and the run makes two model calls\n");

console.log("  leak");
console.log(`    tokens billed : ${leak.spent} (${leak.chunks} chunks generated)`);
console.log(`    answer length : ${leak.out.length} chars`);
console.log(`    summary       : ${leak.summary ? "written" : "none"}`);
console.log(`    ledger        : ${leak.ledger}`);

console.log("\n  chain");
console.log(`    tokens billed : ${chain.spent} (${chain.chunks} chunks generated)`);
console.log(`    answer length : ${chain.out.length} chars`);
console.log(`    summary       : ${chain.summary ? "written" : "none"}`);
console.log(`    ledger        : ${chain.ledger}`);

console.log("\n  the leak generated sixteen chunks for a customer who read three: both");
console.log("  turns, plus the tool, plus a summary nobody asked for. The chain stopped");
console.log("  at the click and billed the nine tokens that had already been produced.");
console.log("  A token that was generated is a token that cost money; the cancellation");
console.log("  cannot un-spend it, and it can stop the next one.");
