// Chapter 16 — ten incidents, and what each one owes the suite.
//
// An incident is a fact about the system that cost money or trust. The question
// this chapter asks is not "what went wrong" but "what now exists because it
// did". Every incident owes at least one artefact, and an incident that owes
// nothing is an incident that will happen again.
//
// The ten are drawn from the book's own chapters: the cents bug, the double
// refund, the lenient check, the injection that got through, the stale token,
// the cache that served an old answer, the poisoned memory, the runaway loop,
// the dropped write and the truncated run.

export type Kind =
  | "wrong-amount"
  | "double-effect"
  | "false-green"
  | "injection"
  | "stale-answer"
  | "runaway"
  | "silent-drop";

export type Artefact =
  | "recording"
  | "fixture"
  | "gate-case"
  | "policy-rule"
  | "approval"
  | "budget"
  | "provenance";

export interface Incident {
  id: string;
  week: number;
  title: string;
  kind: Kind;
  /** The artefacts this incident owes. One is enough; more is better. */
  owes: Artefact[];
  /** Where in the book the incident comes from, for the ledger's provenance. */
  source: string;
}

export const INCIDENTS: Incident[] = [
  {
    id: "i1-cents",
    week: 1,
    title: "a refund written in cents",
    kind: "wrong-amount",
    owes: ["recording", "fixture", "gate-case"],
    source: "chapters 8 and 9",
  },
  {
    id: "i2-double",
    week: 1,
    title: "a customer paid twice for one order",
    kind: "double-effect",
    owes: ["fixture", "approval"],
    source: "chapters 11 and 13",
  },
  {
    id: "i3-lenient",
    week: 2,
    title: "a check that passed a five thousand euro refund",
    kind: "false-green",
    owes: ["gate-case", "fixture"],
    source: "chapter 9",
  },
  {
    id: "i4-injection",
    week: 2,
    title: "a note asking to send order history to an outside address",
    kind: "injection",
    owes: ["policy-rule", "fixture"],
    source: "chapter 12",
  },
  {
    id: "i5-stale-token",
    week: 3,
    title: "an approval used two days after it was signed",
    kind: "stale-answer",
    owes: ["approval", "gate-case"],
    source: "chapter 13",
  },
  {
    id: "i6-cache",
    week: 3,
    title: "a cache serving an answer from before a policy change",
    kind: "stale-answer",
    owes: ["fixture", "gate-case"],
    source: "chapter 15",
  },
  {
    id: "i7-memory",
    week: 4,
    title: "a store answering with a note a tool wrote",
    kind: "injection",
    owes: ["provenance", "fixture"],
    source: "chapter 14",
  },
  {
    id: "i8-runaway",
    week: 4,
    title: "a loop that spent four thousand tokens on a task that never finished",
    kind: "runaway",
    owes: ["budget", "fixture"],
    source: "chapter 15",
  },
  {
    id: "i9-dropped",
    week: 5,
    title: "a ledger that silently dropped a write",
    kind: "silent-drop",
    owes: ["fixture", "gate-case"],
    source: "chapters 8 and 10",
  },
  {
    id: "i10-truncated",
    week: 5,
    title: "a run cut off by the step budget and reported as an answer",
    kind: "false-green",
    owes: ["fixture", "gate-case", "budget"],
    source: "chapters 9 and 15",
  },
];

/** The artefacts an incident owes, as one line for the table. */
export function owes(incident: Incident): string {
  return incident.owes.join("+");
}

/** The kinds that appear more than once, which are the ones a fixture prevents. */
export function recurring(incidents: Incident[] = INCIDENTS): Kind[] {
  const counts = new Map<Kind, number>();
  for (const incident of incidents) counts.set(incident.kind, (counts.get(incident.kind) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n > 1).map(([kind]) => kind);
}
