// 20.6 — the suite is the gate a new adapter has to pass.
//
// The probes measured the migration against the new provider. A conformance
// suite asks the same question the other way round: for each provider, does the
// contract hold? A new adapter is done when both columns are full, and not
// before.
//
// The five checks are the behaviours every provider must support in the same
// vocabulary: an answer, a finish reason, a usage total, tool arguments and the
// tool call id.

import { alpha, beta } from "../adapters.ts";
import { runBuild } from "../agent.ts";
import type { Port } from "../port.ts";

async function answer(port: Port): Promise<boolean> {
  const outcome = await runBuild("contract", port, "text");
  return outcome.ok && outcome.result.text.startsWith("The refund");
}

async function finish(port: Port): Promise<boolean> {
  const outcome = await runBuild("contract", port, "text");
  return outcome.ok && outcome.result.finish === "stop";
}

async function usage(port: Port): Promise<boolean> {
  const outcome = await runBuild("contract", port, "text");
  return outcome.ok && outcome.result.usage.input === 12 && outcome.result.usage.output === 18;
}

async function args(port: Port): Promise<boolean> {
  const outcome = await runBuild("contract", port, "tool");
  return outcome.ok && outcome.result.toolCalls[0]?.args.orderId === "A-1";
}

async function callId(port: Port): Promise<boolean> {
  const outcome = await runBuild("contract", port, "tool");
  return outcome.ok && outcome.result.callId === "call_1";
}

const checks: { name: string; run: (port: Port) => Promise<boolean> }[] = [
  { name: "answer", run: answer },
  { name: "finish", run: finish },
  { name: "usage", run: usage },
  { name: "tool arguments", run: args },
  { name: "call id", run: callId },
];

const ports: Port[] = [alpha, beta];

console.log("# the conformance suite, two providers\n");
console.log(`  ${"check".padEnd(16)}${ports.map((port) => port.name.padStart(7)).join("")}`);
for (const check of checks) {
  const cells: string[] = [];
  for (const port of ports) cells.push(((await check.run(port)) ? "ok" : "FAIL").padStart(7));
  console.log(`  ${check.name.padEnd(16)}${cells.join("")}`);
}

const totals: string[] = [];
for (const port of ports) {
  let passed = 0;
  for (const check of checks) if (await check.run(port)) passed += 1;
  totals.push(`${passed}/${checks.length}`);
}
console.log(`\n  ${ports.map((port, i) => `${port.name}: ${totals[i]}`).join("   ")}`);
console.log("");
console.log("  the suite is the gate. A new adapter is not done when the demo answers;");
console.log("  it is done when every check passes on both providers, and the checks are");
console.log("  written in the port's vocabulary rather than in either wire's.");
