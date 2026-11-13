// Exercise 3, file 2 of 3 — the cycle, which owns the policy.
//
// The ledger file answers questions about a table. This file builds the table:
// it walks the weeks, decides what to convert, and records the artefacts. The
// policy is a parameter, so the same schedule can be run two ways.

import type { Artefact, Incident, Ledger } from "./ex3_ledger.ts";
import { escapes, summarise } from "./ex3_ledger.ts";
import type { Summary } from "./ex3_ledger.ts";

export type Policy = "money-only" | "every-incident";

/** Six weeks of the same three kinds, arriving in a fixed order. */
export const SCHEDULE: { week: number; kind: string; owes: Artefact[] }[] = [
  { week: 1, kind: "wrong-amount", owes: ["fixture", "gate-case"] },
  { week: 1, kind: "injection", owes: ["policy-rule", "fixture"] },
  { week: 2, kind: "wrong-amount", owes: ["fixture", "gate-case"] },
  { week: 3, kind: "false-green", owes: ["fixture", "gate-case"] },
  { week: 4, kind: "injection", owes: ["policy-rule", "fixture"] },
  { week: 5, kind: "false-green", owes: ["fixture", "gate-case"] },
];

function converts(policy: Policy, kind: string): boolean {
  return policy === "every-incident" || kind === "wrong-amount";
}

export interface Cycle extends Summary {
  policy: Policy;
  weeks: { week: number; kind: string; converted: boolean; recurrence: boolean }[];
}

export function run(policy: Policy): Cycle {
  const incidents: Incident[] = SCHEDULE.map((row, i) => ({
    id: `c${i + 1}`,
    kind: row.kind,
    owes: row.owes,
  }));
  const ledger: Ledger = { incidents, produced: {} };
  const first = new Map<string, string>();
  const weeks: Cycle["weeks"] = [];

  for (const incident of incidents) {
    const origin = first.get(incident.kind);
    const recurrence = origin !== undefined && (ledger.produced[origin] ?? []).length === 0;
    if (!first.has(incident.kind)) first.set(incident.kind, incident.id);
    if (converts(policy, incident.kind)) ledger.produced[incident.id] = [...incident.owes];
    weeks.push({ week: SCHEDULE[Number(incident.id.slice(1)) - 1].week, kind: incident.kind, converted: converts(policy, incident.kind), recurrence });
  }

  return { policy, weeks, ...summarise(ledger) };
}

export { escapes };
