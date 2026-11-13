// Chapter 8 — seven failures whose cause is known, because we built it.
//
// The corpus is the calibration set for the verdicts. Each case replays a
// green tape under a configuration with one deliberate change, so the truth is
// a fact about the construction and not an opinion about the output.

import { GREEN, runUnder } from "./desk.ts";
import type { Config } from "./desk.ts";
import type { Axis, Trace } from "./trace.ts";

export interface Case {
  id: string;
  kind: "single" | "joint" | "interaction" | "upstream";
  /** The green trace whose decisions are replayed. */
  base: string;
  /** The release that produced the failure. */
  config: Partial<Config>;
  /** The axes that are responsible, as a set. */
  truth: Axis[];
  note: string;
}

export const CASES: Case[] = [
  {
    id: "c1-tool",
    kind: "single",
    base: "t1",
    config: { tool: "cents" },
    truth: ["tool"],
    note: "the refund is written in cents",
  },
  {
    id: "c2-world",
    kind: "single",
    base: "t1",
    config: { world: "drop" },
    truth: ["world"],
    note: "the ledger loses the write the tool reported",
  },
  {
    id: "c3-grader",
    kind: "single",
    base: "t2",
    config: { grader: "wrong" },
    truth: ["grader"],
    note: "a correct escalation failed by a check that demands a refund",
  },
  {
    id: "c4-harness",
    kind: "single",
    base: "t1",
    config: { harness: 1 },
    truth: ["harness"],
    note: "the loop stops after the lookup",
  },
  {
    id: "c5-joint",
    kind: "joint",
    base: "t1",
    config: { tool: "centsMeta", world: "preferCents" },
    truth: ["tool", "world"],
    note: "a new field and a ledger that reads it: either rollback works",
  },
  {
    id: "c6-interaction",
    kind: "interaction",
    base: "t1",
    config: { tool: "throws", harness: 1 },
    truth: ["tool", "harness"],
    note: "an outage behind a loop with no room to retry",
  },
  {
    id: "c7-upstream",
    kind: "upstream",
    base: "t3a",
    config: { context: "task-escalate" },
    truth: ["context"],
    note: "the model was told to escalate, and did",
  },
];

/** The green run a case is compared with. */
export function baselineId(c: Case): string {
  return c.kind === "upstream" ? "t1" : c.base;
}

/** The release a case is describing, expanded from the baseline. */
export function configOf(c: Case): Config {
  return { ...GREEN, ...c.config };
}

/** The failing trace: the base decisions, executed under the case's release. */
export async function failing(c: Case, base: Trace): Promise<Trace> {
  const trace = await runUnder(base, configOf(c));
  return { ...trace, id: c.id, usage: base.usage };
}
