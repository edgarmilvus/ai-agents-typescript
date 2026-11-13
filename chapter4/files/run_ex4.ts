// Chapter 4 harness — recordings, replay and diffs.
//
//   node chapter4/files/run_ex4.ts

import { readFileSync } from "node:fs";
import { Agent, ReplayModel, toolCall } from "../../chapter1/files/agent.ts";
import type { ModelReply } from "../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../chapter1/files/03_support_triage.ts";
import { Recorder, TapeDeck, ReplayError, diff, inputHash, stable, taskHash, normaliseTask, recordingPath } from "../recording.ts";
import type { Recording } from "../recording.ts";

let checks = 0;
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// ---------------------------------------------------------------- 4.1 hashing

{
  equal("4.1 whitespace does not change the task hash", taskHash("a  b\n"), taskHash("a b"));
  equal("4.1 a different task does", taskHash("a b") === taskHash("a c"), false);
  equal("4.1 normalise collapses runs", normaliseTask("  x \n y  "), "x y");
  const m = [{ role: "user" as const, content: "hi" }];
  const tools = [{ name: "t", description: "d" }];
  equal("4.1 the same transcript hashes the same", inputHash(m, tools), inputHash(m, tools));
  equal("4.1 a changed description changes it", inputHash(m, tools) === inputHash(m, [{ name: "t", description: "d2" }]), false);
  equal("4.1 stable sorts keys", stable({ b: 1, a: 2 }), '{"a":2,"b":1}');
  equal("4.1 stable is recursive", stable({ z: { b: 1, a: 2 } }), '{"z":{"a":2,"b":1}}');
}

// ------------------------------------------------------------- 4.2 recording

{
  const replies: ModelReply[] = [
    { toolCalls: [toolCall("lookup_order", { orderId: "ORD-7712" }, "t1")] },
    { text: "done" },
  ];
  const recorder = new Recorder(new ReplayModel(replies), "refund ORD-7712");
  const desk = makeDesk();
  await new Agent(recorder, deskTools(desk)).run("refund ORD-7712");

  equal("4.2 every model turn was recorded", recorder.recording.turns.length, 2);
  equal("4.2 the task hash is stored", recorder.recording.taskHash, taskHash("refund ORD-7712"));
  check("4.2 every turn carries an input hash", recorder.recording.turns.every((t) => /^[0-9a-f]{16}$/.test(t.inputHash)));
  equal("4.2 the recording knows its model", recorder.recording.model, "replay");
  equal("4.2 version is pinned", recorder.recording.version, 1);
}

// ---------------------------------------------------------------- 4.3 replay

{
  const recording = JSON.parse(readFileSync(recordingPath("triage.json"), "utf8")) as Recording;
  const task = recording.task;

  const strict = new TapeDeck(recording, "strict");
  const desk = makeDesk();
  const run = await new Agent(strict, deskTools(desk)).run(task);
  equal("4.3 strict replay reaches the recorded answer", run.answer, recording.turns.at(-1)?.reply.text);
  equal("4.3 strict replay consumes every turn", strict.remaining, 0);
  equal("4.3 the desk sees the recorded refund", desk.refunds.length, 1);

  const edited = deskTools(makeDesk()).map((t) => (t.name === "issue_refund" ? { ...t, description: t.description + " v2" } : t));
  const strictEdited = new TapeDeck(recording, "strict");
  let caught: ReplayError | undefined;
  try {
    await new Agent(strictEdited, edited).run(task);
  } catch (error) {
    caught = error as ReplayError;
  }
  check("4.3 a changed description fails strict replay", caught instanceof ReplayError);
  check("4.3 and the message names the turn", (caught?.message ?? "").includes("turn 0"));

  const tolerant = new TapeDeck(recording, "tolerant");
  const desk2 = makeDesk();
  const run2 = await new Agent(tolerant, deskTools(desk2)).run(task);
  equal("4.3 tolerant replay answers anyway", run2.answer, run.answer);
  equal("4.3 which is the point and the danger", tolerant.diverged.length, 0);

  const short: Recording = { ...recording, turns: recording.turns.slice(0, 1) };
  const deck = new TapeDeck(short, "tolerant");
  let exhausted: ReplayError | undefined;
  try {
    const d = makeDesk();
    await new Agent(deck, deskTools(d)).run(task);
  } catch (error) {
    exhausted = error as ReplayError;
  }
  check("4.3 a short recording fails loudly", exhausted instanceof ReplayError);
  equal("4.3 with the number of turns", exhausted?.message.includes("after 1 turns"), true);
}

// ----------------------------------------------------------------- 4.4 diffs

{
  const a = JSON.parse(readFileSync(recordingPath("triage.json"), "utf8")) as Recording;
  equal("4.4 a recording does not differ from itself", diff(a, a).kind, "same");

  const reordered: Recording = {
    ...a,
    turns: a.turns.map((t) => ({
      ...t,
      reply: t.reply.toolCalls?.length
        ? { toolCalls: t.reply.toolCalls.map((c) => ({ ...c, args: reverseKeys(c.args) })) }
        : t.reply,
    })),
  };
  equal("4.4 key order is not a divergence", diff(a, reordered).kind, "same");

  const changed: Recording = {
    ...a,
    turns: a.turns.map((t, i) =>
      i === 0 && t.reply.toolCalls?.length
        ? { ...t, reply: { toolCalls: [{ ...t.reply.toolCalls[0], name: "lookup_customer" }] } }
        : t,
    ),
  };
  const d = diff(a, changed);
  equal("4.4 a different tool is a call divergence", d.kind, "call");
  equal("4.4 reported at its turn", d.kind === "call" ? d.index : -1, 0);

  const longer: Recording = { ...a, turns: [...a.turns, { inputHash: "0".repeat(16), reply: { text: "extra" } }] };
  equal("4.4 a longer recording is a length divergence", diff(a, longer).kind, "length");
}

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).reverse();
    return Object.fromEntries(entries.map(([k, v]) => [k, reverseKeys(v)]));
  }
  return value;
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
