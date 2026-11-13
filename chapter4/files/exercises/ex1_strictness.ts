// Exercise 1 — strict replay must fail at the turn that changed.
//
// A recording is only a proof if the prompt it was recorded under is still the
// prompt being sent. This reports which turn diverged, not merely that one did.

import { readFileSync } from "node:fs";
import { Agent } from "../../../chapter1/files/agent.ts";
import { deskTools, makeDesk } from "../../../chapter1/files/03_support_triage.ts";
import { TapeDeck, ReplayError, recordingPath } from "../../recording.ts";
import type { Recording } from "../../recording.ts";

export async function run(mode: "strict" | "tolerant", editDescription: boolean) {
  const recording = JSON.parse(readFileSync(recordingPath("triage.json"), "utf8")) as Recording;
  const tools = deskTools(makeDesk());
  const edited = editDescription
    ? tools.map((t) => (t.name === "issue_refund" ? { ...t, description: t.description + " (edited)" } : t))
    : tools;

  const deck = new TapeDeck(recording, mode);
  try {
    const result = await new Agent(deck, edited).run(recording.task);
    return { mode, edited: editDescription, ok: true, answer: result.answer.slice(0, 60), diverged: deck.diverged };
  } catch (error) {
    return { mode, edited: editDescription, ok: false, error: (error as ReplayError).message, diverged: deck.diverged };
  }
}

export async function demo() {
  return {
    strictClean: await run("strict", false),
    strictEdited: await run("strict", true),
    tolerantEdited: await run("tolerant", true),
  };
}

if (import.meta.main) {
  for (const [label, r] of Object.entries(await demo())) {
    console.log(`${label.padEnd(15)} ${r.ok ? "ok" : "failed"}  ${r.ok ? r.answer : r.error}`);
  }
}
