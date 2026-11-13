// Exercise 2 — coverage you can count.
//
// Two numbers and a list. Coverage is the share of incidents with at least one
// artefact; escapes are the kinds that came back with nothing to show for the
// first occurrence. This exercise computes both on six incidents.

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

export function coverage(ledger: Ledger) {
  const open = ledger.incidents.filter((i) => (ledger.produced[i.id] ?? []).length === 0);
  const complete = ledger.incidents.filter((i) => {
    const got = ledger.produced[i.id] ?? [];
    return got.length > 0 && i.owes.every((a) => got.includes(a));
  });
  const converted = ledger.incidents.length - open.length;
  return {
    incidents: ledger.incidents.length,
    converted,
    complete: complete.length,
    open: open.map((i) => i.id),
    rate: ledger.incidents.length === 0 ? 0 : converted / ledger.incidents.length,
  };
}

/** Kinds that recur while nothing exists from the first occurrence. */
export function escapes(ledger: Ledger): string[] {
  const byKind = new Map<string, Incident[]>();
  for (const incident of ledger.incidents) {
    const list = byKind.get(incident.kind) ?? [];
    list.push(incident);
    byKind.set(incident.kind, list);
  }
  const out: string[] = [];
  for (const [kind, list] of byKind) {
    if (list.length < 2) continue;
    if ((ledger.produced[list[0].id] ?? []).length === 0) out.push(kind);
  }
  return out;
}

export const LEDGER: Ledger = {
  incidents: [
    { id: "a", kind: "wrong-amount", owes: ["fixture", "gate-case"] },
    { id: "b", kind: "injection", owes: ["policy-rule", "fixture"] },
    { id: "c", kind: "false-green", owes: ["fixture", "gate-case"] },
    { id: "d", kind: "injection", owes: ["policy-rule", "fixture"] },
    { id: "e", kind: "runaway", owes: ["fixture"] },
    { id: "f", kind: "wrong-amount", owes: ["fixture", "gate-case"] },
  ],
  produced: {
    a: ["fixture", "gate-case"],
    c: ["fixture"],
    d: ["policy-rule", "fixture"],
  },
};

export function demo() {
  return { ...coverage(LEDGER), escapes: escapes(LEDGER) };
}

export function report(d: ReturnType<typeof demo>): void {
  console.log("# six incidents, three converted\n");
  console.log(`  converted ${d.converted}/${d.incidents} (${(d.rate * 100).toFixed(0)}%)`);
  console.log(`  complete  ${d.complete}`);
  console.log(`  open      ${d.open.join(", ") || "none"}`);
  console.log(`  escapes   ${d.escapes.join(", ") || "none"}`);
  console.log("\n  c is the interesting row: it has a fixture and is missing the gate case, so");
  console.log("  it counts as converted and not as complete. The distinction is the same");
  console.log("  one chapter 9 drew between a mutant that is killed and a survivor that is");
  console.log("  explained: both are progress, and only one is done.");
  console.log("");
  console.log("  one escape: injection. Its first occurrence (b) produced nothing, and");
  console.log("  the second (d) arrived with the same shape. Convert b and the escape");
  console.log("  disappears, which is the whole mechanism in one edit.");
}

if (import.meta.main) report(demo());
