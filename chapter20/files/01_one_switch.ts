// 20.1 — one task, two providers, one boundary.
//
// The same refund task goes to alpha and to beta. The contract build does not
// know which one answered: the deltas, the finish reason and the usage arrive
// in the same vocabulary.
//
// The hardcoded build is the control. It works on alpha and crashes on beta,
// with the provider's message, because it was written against a wire.

import { alpha, beta } from "../adapters.ts";
import { runBuild } from "../agent.ts";

async function describe(build: "hardcoded" | "contract"): Promise<void> {
  for (const port of [alpha, beta]) {
    const outcome = await runBuild(build, port, "text");
    if (outcome.ok) {
      console.log(`    ${port.name.padEnd(6)} ok, ${outcome.result.usage.input + outcome.result.usage.output} tokens, "${outcome.result.text}"`);
    } else {
      console.log(`    ${port.name.padEnd(6)} ${outcome.error.kind}: ${outcome.error.message ?? "no detail"}`);
    }
  }
}

console.log("# one task, two providers\n");
console.log("  contract");
await describe("contract");
console.log("\n  hardcoded");
await describe("hardcoded");

console.log("\n  the contract build's code is identical for both rows. The hardcoded");
console.log("  build is not wrong about alpha; it is right about alpha and has no");
console.log("  vocabulary for anything else. The crash is the boundary being absent.");
