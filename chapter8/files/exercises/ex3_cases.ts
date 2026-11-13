// Exercise 3, file 1 of 3 — the corpus, as data.
//
// No replay, no desk, no imports at runtime: this file is a table. Each row
// says which green tape to replay, which single change to make to the release,
// and which axes the construction blames. The last row is not a release at
// all: the same six versions as the green run, and a failure anyway.
//
// Keeping the truth here, next to the change instead of next to the verdict,
// is what makes the exercise a test rather than a demonstration.

import type { Config } from "../../desk.ts";
import type { Axis } from "../../trace.ts";

export interface Case {
  id: string;
  /** The tape whose decisions are replayed. */
  base: string;
  /** The release, as a diff from green. Empty for the no-change row. */
  change: Partial<Config>;
  /** The axes that are responsible. Empty means: the decisions themselves. */
  truth: Axis[];
  note: string;
}

export const CASES: Case[] = [
  {
    id: "k1-tool",
    base: "t1",
    change: { tool: "cents" },
    truth: ["tool"],
    note: "the refund is written in cents",
  },
  {
    id: "k2-world",
    base: "t1",
    change: { world: "drop" },
    truth: ["world"],
    note: "the ledger loses the write the tool reported",
  },
  {
    id: "k3-grader",
    base: "t2",
    change: { grader: "wrong" },
    truth: ["grader"],
    note: "a correct escalation failed by a check that demands a refund",
  },
  {
    id: "k4-harness",
    base: "t1",
    change: { harness: 1 },
    truth: ["harness"],
    note: "the loop stops after the lookup",
  },
  {
    id: "k5-joint",
    base: "t1",
    change: { tool: "centsMeta", world: "preferCents" },
    truth: ["tool", "world"],
    note: "a new field and a ledger that reads it: either rollback works",
  },
  {
    id: "k6-interaction",
    base: "t1",
    change: { tool: "throws", harness: 1 },
    truth: ["tool", "harness"],
    note: "an outage behind a loop with no room to retry",
  },
  {
    id: "k7-upstream",
    base: "t3a",
    change: { context: "task-escalate" },
    truth: ["context"],
    note: "the model was told to escalate, and did",
  },
  {
    id: "k8-decisions",
    base: "t3a",
    change: {},
    truth: [],
    note: "a tape that escalated, replayed under the release that was green",
  },
];

/** The number of axes a row moves, which is the size of its suspect list. */
export function width(c: Case): number {
  return Object.keys(c.change).length;
}
