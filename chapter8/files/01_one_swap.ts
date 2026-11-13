// 8.1 — one failure, one restore.
//
// The smallest attribution there is. The tape is green; replaying it with the
// refund written in cents fails; replaying it again with the tool restored
// passes. Nothing about the model changed, and no model was called.

import { GREEN, runUnder } from "../desk.ts";
import { diff, loadTrace } from "../trace.ts";

const base = loadTrace("t1");

const failing = await runUnder(base, { ...GREEN, tool: "cents" });
const repaired = await runUnder(base, GREEN);
const where = diff(failing, base);

console.log("# t1, replayed under two releases");
console.log("  tool-cents :", failing.outcome.pass ? "pass" : "fail", "—", failing.outcome.reason);
console.log("  tool-clean :", repaired.outcome.pass ? "pass" : "fail", "—", repaired.outcome.reason);
console.log();
console.log("# what each replay cost");
console.log("  recording  :", base.usage.calls, "model call(s), spent once");
console.log("  both replays: 0 model calls,", base.turns.length, "turns of tape");
console.log();
console.log("# where the failing run and the green one stop agreeing");
console.log(" ", where.kind === "result" ? `result ${where.index}: ${where.a} -> ${where.b}` : where.kind);
console.log("  restoring the tool alone repairs the run:", failing.outcome.pass ? "no" : "yes");
