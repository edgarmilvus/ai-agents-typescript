// Exercise 2 — what the packet has to carry.
//
// The minimal packet for a task is the union of what its steps declare. The
// relay packet is what a parent volunteers. The difference is a list of
// omissions, and an omission is only harmless if the step that needed it never
// runs.

import { TASKS } from "../../corpus.ts";
import type { Facts, Task } from "../../contract.ts";

/** The facts a task cannot be completed without, across all its steps. */
export function required(task: Task): (keyof Facts)[] {
  const out = new Set<keyof Facts>();
  for (const step of task.steps) for (const key of step.needs) out.add(key);
  return [...out].sort();
}

/** The facts a relay packet carries: what the parent volunteers, plus what came back. */
export function relayed(task: Task): (keyof Facts)[] {
  const out = new Set<keyof Facts>(task.shared);
  for (const step of task.steps) {
    if (step.role === "clerk") {
      out.add("verdict");
      out.add("region");
    }
  }
  return [...out].filter((key) => task.facts[key] !== undefined || key === "verdict" || key === "region").sort();
}

export function omitted(task: Task): (keyof Facts)[] {
  const have = new Set(relayed(task));
  return required(task).filter((key) => !have.has(key));
}

export function demo() {
  return TASKS.map((task) => ({
    id: task.id,
    required: required(task),
    relayed: relayed(task),
    missing: omitted(task),
  }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# what each task needs, and what a relay packet omits\n");
  console.log("  task                  required                     omitted");
  for (const row of rows) {
    console.log(
      `  ${row.id.padEnd(20)}  ${row.required.join("+").padEnd(28)} ${row.missing.join("+") || "-"}`,
    );
  }
  const failing = rows.filter((r) => r.missing.length > 0);
  console.log(`\n  ${failing.length} of ${rows.length} tasks lose a fact under relay`);
  console.log("  the omissions are not random: they are the facts no earlier step produces");
  console.log("  and the request did not happen to name. A parent that relays is complete");
  console.log("  about the past and blind about the next step.");
}

if (import.meta.main) report(demo());
