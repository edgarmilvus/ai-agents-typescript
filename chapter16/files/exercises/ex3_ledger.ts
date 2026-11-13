// Exercise 3, file 1 of 3 — the arithmetic, with no weeks.
//
// Coverage and escapes are two functions over a list of incidents and a map of
// what exists. No clock, no policy, no corpus: a table in, a number out.

export type Artefact = "fixture" | "gate-case" | "policy-rule";

export interface Incident {
  id: string;
  kind: string;
  owes: Artefact[];
}

export interface Ledger {
  incidents: Incident[];
  produced: Record<string, Artefact[]>;
}

export interface Summary {
  incidents: number;
  converted: number;
  complete: number;
  rate: number;
  escapes: string[];
}

export function summarise(ledger: Ledger): Summary {
  const converted = ledger.incidents.filter((i) => (ledger.produced[i.id] ?? []).length > 0);
  const complete = ledger.incidents.filter((i) => {
    const got = ledger.produced[i.id] ?? [];
    return got.length > 0 && i.owes.every((a) => got.includes(a));
  });
  return {
    incidents: ledger.incidents.length,
    converted: converted.length,
    complete: complete.length,
    rate: ledger.incidents.length === 0 ? 0 : converted.length / ledger.incidents.length,
    escapes: escapes(ledger),
  };
}

export function escapes(ledger: Ledger): string[] {
  const first = new Map<string, Incident>();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const incident of ledger.incidents) {
    if (!seen.has(incident.kind)) {
      seen.add(incident.kind);
      first.set(incident.kind, incident);
      continue;
    }
    const origin = first.get(incident.kind);
    if (origin && (ledger.produced[origin.id] ?? []).length === 0 && !out.includes(incident.kind)) {
      out.push(incident.kind);
    }
  }
  return out;
}

/** Incidents with nothing produced, in the order they arrived. */
export function open(ledger: Ledger): string[] {
  return ledger.incidents.filter((i) => (ledger.produced[i.id] ?? []).length === 0).map((i) => i.id);
}
