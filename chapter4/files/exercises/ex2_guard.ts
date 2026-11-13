// Exercise 2 — a recording belongs to a task.
//
// Replaying yesterday's turns against today's task is the subtlest way to
// produce a passing test that proves nothing. The recording carries the task
// hash; the guard refuses the mismatch.

import { readFileSync } from "node:fs";
import { RecordingError, assertSameTask } from "../../guard.ts";
import { recordingPath } from "../../recording.ts";
import type { Recording } from "../../recording.ts";

export function demo() {
  const recording = JSON.parse(readFileSync(recordingPath("triage.json"), "utf8")) as Recording;
  const results: { label: string; ok: boolean; detail: string }[] = [];

  for (const [label, task] of [
    ["same task", recording.task],
    ["same task, different whitespace", "  " + recording.task.replace(/ /g, "  ") + "\n"],
    ["different order", recording.task.replace("ORD-7712", "ORD-7801")],
  ] as const) {
    try {
      assertSameTask(recording, task);
      results.push({ label, ok: true, detail: "accepted" });
    } catch (error) {
      results.push({ label, ok: false, detail: (error as RecordingError).message });
    }
  }
  return results;
}

if (import.meta.main) {
  for (const r of demo()) console.log(`${r.label.padEnd(30)} ${r.ok ? "accepted" : "refused"}  ${r.detail}`);
}
