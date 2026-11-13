// Chapter 16 — the ledger: what was converted, and what is still owed.
//
// A ledger is two maps and four questions. Incidents arrived; artefacts exist.
// The questions are: which incidents produced at least one artefact, which
// produced all of them, which kinds recurred without a fixture, and what the
// suite now covers that it did not before.

import type { Artefact, Incident, Kind } from "./incidents.ts";

export interface Ledger {
  incidents: Incident[];
  /** Incident id to the artefacts that exist because of it. */
  produced: Map<string, Artefact[]>;
}

export function createLedger(incidents: Incident[]): Ledger {
  return { incidents, produced: new Map() };
}

/** Record that an incident produced an artefact. Idempotent. */
export function record(ledger: Ledger, incidentId: string, artefact: Artefact): void {
  if (!ledger.incidents.some((i) => i.id === incidentId)) throw new Error(`no incident ${incidentId}`);
  const list = ledger.produced.get(incidentId) ?? [];
  if (!list.includes(artefact)) list.push(artefact);
  ledger.produced.set(incidentId, list);
}

export interface Coverage {
  incidents: number;
  /** Incidents with at least one artefact. */
  converted: number;
  /** Incidents with every artefact they owe. */
  complete: number;
  /** Incidents with nothing. */
  open: Incident[];
  /** Incidents that produced some artefacts but not all. */
  partial: Incident[];
  /** How many artefacts exist, across all incidents. */
  artefacts: number;
  rate: number;
}

export function coverage(ledger: Ledger): Coverage {
  let converted = 0;
  let complete = 0;
  let artefacts = 0;
  const open: Incident[] = [];
  const partial: Incident[] = [];

  for (const incident of ledger.incidents) {
    const produced = ledger.produced.get(incident.id) ?? [];
    artefacts += produced.length;
    if (produced.length === 0) {
      open.push(incident);
      continue;
    }
    converted += 1;
    const missing = incident.owes.filter((a) => !produced.includes(a));
    if (missing.length === 0) complete += 1;
    else partial.push(incident);
  }

  return {
    incidents: ledger.incidents.length,
    converted,
    complete,
    open,
    partial,
    artefacts,
    rate: ledger.incidents.length === 0 ? 0 : converted / ledger.incidents.length,
  };
}

/**
 * A kind of incident escapes if it happens again after the first time.
 *
 * The first occurrence is the discovery; the second is the escape. That
 * definition is the chapter's whole argument: an incident is allowed to happen
 * once, and the ledger is what makes a second occurrence a finding rather than
 * bad luck.
 */
export function escapes(ledger: Ledger): { kind: Kind; incidents: Incident[] }[] {
  const byKind = new Map<Kind, Incident[]>();
  for (const incident of ledger.incidents) {
    const list = byKind.get(incident.kind) ?? [];
    list.push(incident);
    byKind.set(incident.kind, list);
  }

  const out: { kind: Kind; incidents: Incident[] }[] = [];
  for (const [kind, list] of byKind) {
    if (list.length < 2) continue;
    const first = list[0];
    const produced = ledger.produced.get(first.id) ?? [];
    // If the first was converted, the repeat is not an escape: something
    // existed and the repeat is a gap in that something, which is a finding
    // for a different chapter. If nothing existed, the suite could not have
    // caught it.
    if (produced.length > 0) continue;
    out.push({ kind, incidents: list });
  }
  return out;
}

/** Incidents that produced nothing, with the artefacts they still owe. */
export function owed(ledger: Ledger): { incident: Incident; missing: Artefact[] }[] {
  return ledger.incidents
    .map((incident) => {
      const produced = ledger.produced.get(incident.id) ?? [];
      return { incident, missing: incident.owes.filter((a) => !produced.includes(a)) };
    })
    .filter((row) => row.missing.length > 0);
}
