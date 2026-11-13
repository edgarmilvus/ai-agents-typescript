// 19.5 — the refund that ran after the hang-up.
//
// The tool is where cancellation stops being about wasted tokens and starts
// being about money and state. A stream that is read one chunk too many costs
// a fraction of a cent; a refund that is written after the customer left costs
// the refund.
//
// Both runtimes below take the same hang-up, during the tool. The difference is
// one boolean passed into the tool, and it is the difference between an effect
// and a record.

import { makeEnv, run } from "../stream.ts";

const scenario = { abortAt: "tool" as const };

const signal = await run(makeEnv("signal"), scenario);
const chain = await run(makeEnv("chain"), scenario);

console.log("# the refund that ran after the hang-up\n");
console.log(`  customer closed the tab during the tool`);
console.log(`  tool steps: 3, and the refund is written on the last one\n`);

console.log("  signal");
console.log(`    tool runs : ${signal.toolRuns}`);
console.log(`    effect    : ${signal.effects[0] ?? "none"}`);
console.log(`    ledger    : ${signal.ledger}, ${signal.spent} tokens`);

console.log("\n  chain");
console.log(`    tool runs : ${chain.toolRuns}`);
console.log(`    effect    : ${chain.effects[0] ?? "none"}`);
console.log(`    ledger    : ${chain.ledger}, ${chain.spent} tokens`);

console.log("\n  a cancellation that arrives after the side effect is not a cancellation.");
console.log("  It is a refund with a closed browser tab, and no amount of stream");
console.log("  handling fixes it: the signal has to be inside the tool, checked before");
console.log("  the step that commits. A tool whose first step commits cannot be");
console.log("  cancelled at all, which is a property of the tool and a decision to make");
console.log("  deliberately.");
