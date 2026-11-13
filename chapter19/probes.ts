// Chapter 19 — eight places a hang-up leaks work.
//
// Each probe is a customer closing the tab during a different phase, and each
// measures one kind of work that can continue after they leave. The point is
// not that a stream is hard to stop. It is that a run has six phases and a
// signal that reaches four of them is still a leak.
//
// The probes share the runtime and the script; only the moment of the hang-up
// and the evidence differ.

import type { Env, Mode, Scenario } from "./stream.ts";
import { makeEnv, run } from "./stream.ts";

export interface Probe {
  id: string;
  /** Which link of the chain the probe is about. */
  link: "stream" | "tool" | "turn" | "summary" | "ledger" | "retry";
  note: string;
  scenario: Scenario;
  /** True when work continued after the customer left. */
  leaked(env: Env): boolean;
}

export const PROBES: Probe[] = [
  {
    id: "p1-before-start",
    link: "stream",
    note: "the tab closes before the first chunk is requested",
    scenario: { abortAt: "start" },
    leaked: (env) => env.modelCalls > 0,
  },
  {
    id: "p2-mid-stream",
    link: "stream",
    note: "the tab closes after three chunks",
    scenario: { abortAt: "chunk", after: 3 },
    leaked: (env) => env.chunks > 3,
  },
  {
    id: "p3-tool-effect",
    link: "tool",
    note: "the tab closes while the refund tool is running",
    scenario: { abortAt: "tool" },
    leaked: (env) => env.effects.length > 0,
  },
  {
    id: "p4-second-turn",
    link: "turn",
    note: "the tab closes after the tool, before the second model call",
    scenario: { abortAt: "turn2" },
    leaked: (env) => env.modelCalls > 1,
  },
  {
    id: "p5-consumer-return",
    link: "stream",
    note: "the consumer stops reading without aborting",
    scenario: { stopAfter: 3 },
    leaked: (env) => env.summary !== undefined,
  },
  {
    id: "p6-backoff",
    link: "retry",
    note: "the tab closes during the retry backoff",
    scenario: { failFirst: true, abortAt: "backoff" },
    leaked: (env) => env.retries > 0,
  },
  {
    id: "p7-summary",
    link: "summary",
    note: "the tab closes before the run is summarised",
    scenario: { abortAt: "summary" },
    leaked: (env) => env.summary !== undefined,
  },
  {
    id: "p8-ledger",
    link: "ledger",
    note: "the tab closes and the ledger still says complete",
    scenario: { abortAt: "chunk", after: 3 },
    leaked: (env) => env.ledger === "complete",
  },
];

export function probeIds(): string[] {
  return PROBES.map((probe) => probe.id);
}

export interface Row {
  probe: string;
  link: Probe["link"];
  leaked: boolean;
}

export interface Summary {
  mode: Mode;
  rows: Row[];
  leaked: number;
  clean: number;
}

/** Run the corpus under one mode, each probe in its own conversation. */
export async function measure(mode: Mode): Promise<Summary> {
  const rows: Row[] = [];
  for (const probe of PROBES) {
    const env = await run(makeEnv(mode), probe.scenario);
    rows.push({ probe: probe.id, link: probe.link, leaked: probe.leaked(env) });
  }
  const leaked = rows.filter((row) => row.leaked).length;
  return { mode, rows, leaked, clean: rows.length - leaked };
}
