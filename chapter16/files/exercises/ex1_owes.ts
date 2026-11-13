// Exercise 1 — what an incident owes.
//
// An incident is a fact that cost something; the artefacts are what stop it
// costing it again. This exercise is the classification: given four incidents,
// name the artefacts each one owes, and say what a suite without them can and
// cannot see.

export type Kind = "wrong-amount" | "double-effect" | "false-green" | "injection";
export type Artefact = "recording" | "fixture" | "gate-case" | "policy-rule" | "approval";

export interface Incident {
  id: string;
  title: string;
  kind: Kind;
  owes: Artefact[];
}

export const INCIDENTS: Incident[] = [
  {
    id: "x1",
    title: "a refund in cents",
    kind: "wrong-amount",
    owes: ["recording", "fixture", "gate-case"],
  },
  {
    id: "x2",
    title: "a customer paid twice",
    kind: "double-effect",
    owes: ["fixture", "approval"],
  },
  {
    id: "x3",
    title: "a check that passed anything",
    kind: "false-green",
    owes: ["gate-case", "fixture"],
  },
  {
    id: "x4",
    title: "a note that asked for data to leave",
    kind: "injection",
    owes: ["policy-rule", "fixture"],
  },
];

/** The artefacts that stop a kind from recurring, as one string. */
export function stops(kind: Kind): Artefact[] {
  const found = INCIDENTS.filter((i) => i.kind === kind).flatMap((i) => i.owes);
  return [...new Set(found)];
}

export function demo() {
  return INCIDENTS.map((incident) => ({ ...incident, unique: incident.owes }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# four incidents, four debts\n");
  console.log("  incident  kind            owes");
  for (const row of rows) {
    console.log(`  ${row.id.padEnd(9)} ${row.kind.padEnd(15)} ${row.owes.join("+")}`);
  }
  console.log("\n  the fixture is the only artefact every one of them owes. A recording");
  console.log("  without a fixture is a story; a gate case without a fixture has nothing");
  console.log("  to run; a policy rule without a fixture is a rule nobody tests.");
  console.log("");
  console.log("  the artefacts that are not fixtures are the ones a fixture cannot be: an");
  console.log("  approval changes what a person does, and a policy rule changes what the");
  console.log("  system refuses. Those need a different test, and the difference is the");
  console.log("  subject of chapter 13.");
}

if (import.meta.main) report(demo());
