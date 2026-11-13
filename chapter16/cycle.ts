// Chapter 16 — twelve weeks, two policies.
//
// The cycle is the same every week: an incident arrives, somebody decides what
// to do, and the suite either grows or does not. The two policies are "convert
// what looks expensive" and "convert everything", and the difference is not in
// the first week; it is in the recurrences.

import type { Incident, Kind } from "./incidents.ts";
import { createLedger, record } from "./ledger.ts";
import type { Ledger } from "./ledger.ts";

export type Policy = "ad-hoc" | "every-incident";

/**
 * The weeks. The kinds repeat on purpose: a desk sees the same failures, which
 * is the reason a fixture is worth more than a fix.
 */
const SCHEDULE: { week: number; kind: Kind; title: string }[] = [
  { week: 1, kind: "wrong-amount", title: "a refund in the wrong units" },
  { week: 1, kind: "injection", title: "a note that asked for an email out" },
  { week: 2, kind: "false-green", title: "a check that passed a bad refund" },
  { week: 2, kind: "wrong-amount", title: "another refund in the wrong units" },
  { week: 3, kind: "stale-answer", title: "an approval used after its window" },
  { week: 3, kind: "injection", title: "a document that tried to move money" },
  { week: 4, kind: "runaway", title: "a loop that spent the budget and stopped" },
  { week: 4, kind: "silent-drop", title: "a write the ledger never kept" },
  { week: 5, kind: "wrong-amount", title: "a third refund in the wrong units" },
  { week: 5, kind: "false-green", title: "a truncated run reported as an answer" },
  { week: 6, kind: "stale-answer", title: "a cache serving an old policy" },
  { week: 6, kind: "double-effect", title: "a customer paid twice" },
];

function owes(kind: Kind): Incident["owes"] {
  switch (kind) {
    case "wrong-amount":
      return ["fixture", "gate-case"];
    case "injection":
      return ["policy-rule", "fixture"];
    case "false-green":
      return ["gate-case", "fixture"];
    case "stale-answer":
      return ["approval", "gate-case"];
    case "runaway":
      return ["budget", "fixture"];
    case "silent-drop":
      return ["fixture", "provenance"];
    case "double-effect":
      return ["fixture", "approval"];
  }
}

/** The ad-hoc policy: convert the incidents that look expensive. */
function convertsAdHoc(kind: Kind): boolean {
  return kind === "wrong-amount" || kind === "double-effect";
}

export interface Week {
  week: number;
  incident: Incident;
  converted: boolean;
  /** True when the same kind arrived before and nothing existed from it. */
  recurrence: boolean;
}

export interface Cycle {
  policy: Policy;
  ledger: Ledger;
  weeks: Week[];
  recurrences: number;
  converted: number;
  artefacts: number;
}

export function run(policy: Policy, schedule = SCHEDULE): Cycle {
  const incidents: Incident[] = schedule.map((row, i) => ({
    id: `inc-${i + 1}`,
    week: row.week,
    title: row.title,
    kind: row.kind,
    owes: owes(row.kind),
    source: "the desk",
  }));

  const ledger = createLedger(incidents);
  const weeks: Week[] = [];
  const seen = new Map<Kind, string>();

  for (const incident of incidents) {
    const previous = seen.get(incident.kind);
    const recurrence =
      previous !== undefined && (ledger.produced.get(previous) ?? []).length === 0;

    const convert = policy === "every-incident" || convertsAdHoc(incident.kind);
    if (convert) for (const artefact of incident.owes) record(ledger, incident.id, artefact);
    if (!seen.has(incident.kind)) seen.set(incident.kind, incident.id);

    weeks.push({ week: incident.week, incident, converted: convert, recurrence });
  }

  const artefacts = [...ledger.produced.values()].reduce((n, list) => n + list.length, 0);
  return {
    policy,
    ledger,
    weeks,
    recurrences: weeks.filter((w) => w.recurrence).length,
    converted: weeks.filter((w) => w.converted).length,
    artefacts,
  };
}

/** The incidents that recurred, for a postmortem list. */
export function recurrenceList(cycle: Cycle): Week[] {
  return cycle.weeks.filter((w) => w.recurrence);
}
