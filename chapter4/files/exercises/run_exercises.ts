// Chapter 4 exercise harness.
//
//   node chapter4/files/exercises/run_exercises.ts

import { readFileSync } from "node:fs";
import { demo as strictnessDemo } from "./ex1_strictness.ts";
import { demo as guardDemo } from "./ex2_guard.ts";
import { demo as divergenceDemo, summarise } from "./ex3_first_divergence.ts";
import { demo as prefixDemo } from "./ex4_prefix.ts";
import { demo as sizeDemo } from "./ex5_size.ts";
import { recordingPath, taskHash } from "../../recording.ts";
import type { Recording } from "../../recording.ts";

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

// 1 — strictness
{
  const r = await strictnessDemo();
  check("ex1 a clean strict replay succeeds", r.strictClean.ok);
  check("ex1 an edited description fails strict replay", !r.strictEdited.ok);
  check("ex1 and the divergence is recorded", r.strictEdited.diverged.length === 1, r.strictEdited);
  check("ex1 tolerant replay does not care", r.tolerantEdited.ok);
  check("ex1 but reports no divergence, which is the hazard", r.tolerantEdited.diverged.length === 0);
}

// 2 — the task guard
{
  const rows = guardDemo();
  check("ex2 the same task is accepted", rows[0].ok);
  check("ex2 whitespace does not matter", rows[1].ok);
  check("ex2 a different order is refused", !rows[2].ok);
  check("ex2 the refusal names both hashes", rows[2].detail.includes("recorded") && rows[2].detail.includes("asked"));
  const rec = JSON.parse(readFileSync(recordingPath("triage.json"), "utf8")) as Recording;
  equal("ex2 the guard compares hashes, not strings", taskHash(rec.task), rec.taskHash);
}

// 3 — first divergence
{
  const a = JSON.parse(readFileSync(recordingPath("triage.json"), "utf8")) as Recording;
  const b = JSON.parse(readFileSync(recordingPath("triage-2.json"), "utf8")) as Recording;
  const d = divergenceDemo(a, b);
  check("ex3 two runs of the same task agree on the decisions", d.same, d.detail);
  check("ex3 and on the canonical form", d.canonicalEqual);
  equal("ex3 with no first index", d.firstIndex, null);

  const changed: Recording = {
    ...a,
    turns: a.turns.map((t, i) => (i === 0 && t.reply.toolCalls?.length
      ? { ...t, reply: { toolCalls: [{ ...t.reply.toolCalls[0], name: "lookup_customer" }] } }
      : t)),
  };
  const s = summarise(a, changed);
  check("ex3 a different tool is found", !s.same);
  equal("ex3 at the right turn", s.firstIndex, 0);
  equal("ex3 and classified as a call", s.kind, "call");

  const longer: Recording = { ...a, turns: [...a.turns, { inputHash: "0".repeat(16), reply: { text: "x" } }] };
  equal("ex3 a longer run is a length divergence", summarise(a, longer).kind, "length");
}

// 4 — prefixes
{
  const [one, two, four] = await prefixDemo();
  check("ex4 one turn cannot finish the task", !one.completed);
  check("ex4 and it says why", one.error.includes("exhausted"));
  check("ex4 two turns also cannot", !two.completed);
  check("ex4 four turns complete it", four.completed);
  equal("ex4 the completed prefix refunds once", four.refunds, 1);
  equal("ex4 nothing is left over", four.remaining, 0);
}

// 5 — what a fixture contains
{
  const a = sizeDemo();
  equal("ex5 only model turns are stored", a.storedToolResults, 0);
  equal("ex5 every turn carries a hash", a.hashes, true);
  check("ex5 the fixture is small", a.bytes < 8000, a.bytes);
  check("ex5 under a kilobyte per turn", a.bytesPerTurn < 1000, a.bytesPerTurn);
  equal("ex5 three calls across four turns", a.calls, 3);
}

console.log(`\n${checks - failures}/${checks} exercise checks passed`);
if (failures) process.exit(1);
