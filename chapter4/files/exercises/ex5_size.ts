// Exercise 5 — what a fixture must not contain.
//
// A recording stores the model's turns and the hashes of its prompts. It must
// not store tool results: those are recomputed by the code under test, and
// storing them would make the replay pass against a stale world.

import { readFileSync, statSync } from "node:fs";
import { recordingPath } from "../../recording.ts";
import type { Recording } from "../../recording.ts";

export function audit(recording: Recording, bytes: number) {
  const storedToolResults = recording.turns.filter((t) => (t.reply as { role?: string }).role === "tool").length;
  const replies = recording.turns.length;
  const calls = recording.turns.reduce((n, t) => n + (t.reply.toolCalls?.length ?? 0), 0);
  return {
    replies,
    calls,
    bytes,
    bytesPerTurn: Math.round(bytes / Math.max(1, replies)),
    storedToolResults,
    hashes: recording.turns.every((t) => /^[0-9a-f]{16}$/.test(t.inputHash)),
  };
}

export function demo() {
  const file = recordingPath("triage.json");
  const recording = JSON.parse(readFileSync(file, "utf8")) as Recording;
  return audit(recording, statSync(file).size);
}

if (import.meta.main) {
  console.log(JSON.stringify(demo(), null, 2));
}
