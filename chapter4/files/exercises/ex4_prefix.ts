// Exercise 4 — replay a prefix, and be honest about what is missing.
//
// Half a recording is useful for testing the first half of a loop. It is only
// honest if the replay says where it stopped instead of returning silence.

import { readFileSync } from "node:fs";
import { Agent } from "../../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../../chapter1/files/03_support_triage.ts";
import { TapeDeck, ReplayError, recordingPath } from "../../recording.ts";
import type { Recording } from "../../recording.ts";

export async function replayTurns(n: number) {
  const full = JSON.parse(readFileSync(recordingPath("triage.json"), "utf8")) as Recording;
  const trimmed: Recording = { ...full, turns: full.turns.slice(0, n) };
  const desk = makeDesk();
  const deck = new TapeDeck(trimmed, "tolerant");
  try {
    const run = await new Agent(deck, deskTools(desk)).run(full.task);
    return { n, completed: true, answer: run.answer.slice(0, 60), refunds: desk.refunds.length, remaining: deck.remaining };
  } catch (error) {
    return { n, completed: false, error: (error as ReplayError).message, refunds: desk.refunds.length, remaining: deck.remaining };
  }
}

export async function demo() {
  return [await replayTurns(1), await replayTurns(2), await replayTurns(4)];
}

if (import.meta.main) {
  for (const r of await demo()) {
    console.log(`${String(r.n).padEnd(2)} ${r.completed ? "completed" : "stopped"} · refunds ${r.refunds} · left ${r.remaining} ${r.completed ? r.answer : r.error}`);
  }
}
