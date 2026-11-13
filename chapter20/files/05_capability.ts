// 20.5 — the model that cannot call tools.
//
// Gamma answers and has no tool support. The three builds meet that fact in
// three ways: hardcoded ignores the answer, thin returns it as if the tool had
// been considered, and contract refuses before the first event with an error
// the caller can branch on.
//
// The interesting failure is thin's. It is not a crash; it is a confident
// answer to a question that required a tool, which is worse than an error.

import { gamma } from "../adapters.ts";
import { runBuild } from "../agent.ts";
import type { Build } from "../agent.ts";

const builds: Build[] = ["hardcoded", "thin", "contract"];

console.log("# a model without tools\n");
console.log(`  gamma capabilities: tools=false, streaming=false`);
console.log(`  the task needs:     issue_refund\n`);

for (const build of builds) {
  const outcome = await runBuild(build, gamma, "tool");
  if (outcome.ok) {
    console.log(
      `  ${build.padEnd(10)} answered, ${outcome.result.toolCalls.length} tool calls, text "${outcome.result.text}"`,
    );
  } else {
    console.log(`  ${build.padEnd(10)} ${outcome.error.kind} — ${outcome.error.message ?? "no detail"}`);
  }
}

console.log("\n  hardcoded did not even see the answer: gamma's message event is not an");
console.log("  alpha delta, so the text is empty and the run looks successful.");
console.log("");
console.log("  thin saw the text and returned it with no tool call. The caller has no");
console.log("  way to know the refund was never attempted, and the answer reads like a");
console.log("  policy decision rather than a missing capability.");
console.log("");
console.log("  contract refused before the first event. A capability is a fact about");
console.log("  the model, and the port is the only layer that can state it.");
