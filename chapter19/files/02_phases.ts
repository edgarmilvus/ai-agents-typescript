// 19.2 — the same hang-up, read phase by phase.
//
// A cancellation is not one event. It arrives during a phase, and what happens
// next depends on whether that phase consults the signal. The demo gives both
// runtimes the same hang-up — during the refund tool — and prints the trace.
//
// The interesting line is the tool. `signal` stops at the next boundary, which
// is already too late; `chain` checks inside the tool, which is the only place
// that can prevent the side effect.

import { makeEnv, run } from "../stream.ts";

const scenario = { abortAt: "tool" as const };

function trace(name: string, env: Awaited<ReturnType<typeof run>>): void {
  console.log(`  ${name}`);
  console.log(`    turn 1      streamed ${env.chunks} chunks, ${env.spent} tokens`);
  console.log(`    tool        ${env.effects.length > 0 ? `refund written (${env.effects[0]})` : "aborted, no refund written"}`);
  console.log(`    turn 2      ${env.modelCalls > 1 ? "called" : "skipped"}`);
  console.log(`    summary     ${env.summary ? "written" : "skipped"}`);
  console.log(`    ledger      ${env.ledger}, ${env.spent} tokens billed`);
}

console.log("# one hang-up, phase by phase\n");
console.log("  the customer closes the tab while the refund tool is running");
console.log("  the tool takes three steps, and the refund is the last one\n");

trace("signal", await run(makeEnv("signal"), scenario));
console.log("");
trace("chain", await run(makeEnv("chain"), scenario));
console.log("\n  both runtimes streamed the same first turn, because the hang-up arrived");
console.log("  after it. The difference is the tool: `signal` asks the signal between");
console.log("  phases, and by the time it asks, the refund has been written. `chain`");
console.log("  passes the signal into the tool, and the last step never runs.");
