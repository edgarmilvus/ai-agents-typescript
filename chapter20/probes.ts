// Chapter 20 — nine behaviours a migration can break.
//
// Every probe is a behaviour the agent needs, expressed in the port's
// vocabulary and run against the new provider. A probe that fails is a place
// where the model was never behind a boundary.
//
// `beta` is the migration target: same model, different wire. `gamma` is the
// capability case: it answers and cannot call tools.

import type { Build, Outcome } from "./agent.ts";
import { runBuild } from "./agent.ts";
import type { Port, Scenario } from "./port.ts";
import { beta, gamma } from "./adapters.ts";

export interface Probe {
  id: string;
  note: string;
  provider: Port;
  scenario: Scenario;
  check(outcome: Outcome): boolean;
}

export const PROBES: Probe[] = [
  {
    id: "p1-text",
    note: "the deltas assemble into the answer",
    provider: beta,
    scenario: "text",
    check: (o) => o.ok && o.result.text.startsWith("The refund is within the window."),
  },
  {
    id: "p2-tool-args",
    note: "tool arguments arrive as an object, not a string",
    provider: beta,
    scenario: "tool",
    check: (o) => o.ok && o.result.toolCalls[0]?.args.orderId === "A-1",
  },
  {
    id: "p3-call-id",
    note: "the tool call keeps the id the provider assigned",
    provider: beta,
    scenario: "tool",
    check: (o) => o.ok && o.result.callId === "call_1",
  },
  {
    id: "p4-finish",
    note: "the finish reason is normalized, not passed through",
    provider: beta,
    scenario: "text",
    check: (o) => o.ok && o.result.finish === "stop",
  },
  {
    id: "p5-usage",
    note: "usage is summed wherever the provider reports it",
    provider: beta,
    scenario: "tool",
    check: (o) => o.ok && o.result.usage.input === 12 && o.result.usage.output === 18,
  },
  {
    id: "p6-rate-limit",
    note: "a rate limit is a typed error with a retry delay",
    provider: beta,
    scenario: "rate",
    check: (o) => !o.ok && o.error.kind === "rate_limit" && o.error.retryAfter === 2,
  },
  {
    id: "p7-context",
    note: "a context overflow is its own kind, not a string",
    provider: beta,
    scenario: "context",
    check: (o) => !o.ok && o.error.kind === "context",
  },
  {
    id: "p8-system",
    note: "the system prompt lands where the provider reads it",
    provider: beta,
    scenario: "text",
    check: (o) => o.ok && o.result.text.includes("Policy applies"),
  },
  {
    id: "p9-capability",
    note: "a model without tools fails in the contract's vocabulary",
    provider: gamma,
    scenario: "tool",
    check: (o) => !o.ok && o.error.kind === "unsupported",
  },
];

export function probeIds(): string[] {
  return PROBES.map((probe) => probe.id);
}

export interface Row {
  probe: string;
  pass: boolean;
}

export interface Summary {
  build: Build;
  rows: Row[];
  passed: number;
  failed: number;
}

export async function measure(build: Build): Promise<Summary> {
  const rows: Row[] = [];
  for (const probe of PROBES) {
    const outcome = await runBuild(build, probe.provider, probe.scenario);
    rows.push({ probe: probe.id, pass: probe.check(outcome) });
  }
  const passed = rows.filter((row) => row.pass).length;
  return { build, rows, passed, failed: rows.length - passed };
}
