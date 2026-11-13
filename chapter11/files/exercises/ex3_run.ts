// Exercise 3, file 3 of 3 — the wiring, and the table.
//
// The only file that knows both halves: the corpus with its tasks, and the
// desk with its tools. It builds a packet per step, hands it to the child with
// an `invoke` bound to the real tools, and prints what came back.

import { TASKS } from "../../corpus.ts";
import type { Facts, Mode } from "../../contract.ts";
import { makeDesk } from "../../../chapter1/files/03_support_triage.ts";
import { deskTools } from "../../../chapter1/files/03_support_triage.ts";
import { build, sortedKeys, workable } from "./ex3_packet.ts";
import { run } from "./ex3_child.ts";
import type { Invoke } from "./ex3_child.ts";

const MODES: Mode[] = ["goal", "relay", "full"];

/** Bind `invoke` to the tools of one role on one desk. */
function invoker(role: "clerk" | "cashier", desk: ReturnType<typeof makeDesk>): Invoke {
  const allowed = role === "clerk" ? ["lookup_order", "refund_policy"] : ["issue_refund", "escalate"];
  return (name, args) => {
    const tool = deskTools(desk).find((t) => t.name === name);
    if (!tool || !allowed.includes(name)) throw new Error(`no tool ${name} for ${role}`);
    const value = tool.run(args);
    return typeof value === "string" ? value : "";
  };
}

export function demo() {
  return MODES.map((mode) => {
    const rows = TASKS.map((task) => {
      const desk = makeDesk();
      const learned: Facts = {};
      let blockedAt: number | undefined;

      for (const [i, step] of task.steps.entries()) {
        const packet = build(task, step, mode, learned);
        const report = run(packet, invoker(step.role, desk));
        for (const key of ["verdict", "region"] as const) {
          if (report.result[key] !== undefined) (learned as Record<string, unknown>)[key] = report.result[key];
        }
        if (report.status !== "ok") {
          blockedAt = i + 1;
          break;
        }
        if (!workable(packet, step.needs)) {
          blockedAt = i + 1;
          break;
        }
      }

      return { id: task.id, ok: blockedAt === undefined, blockedAt };
    });
    return { mode, rows };
  });
}

export function report(groups: ReturnType<typeof demo>): void {
  console.log("# packet rules, rebuilt as three files\n");
  console.log("  task                  goal  relay  full");
  for (let i = 0; i < TASKS.length; i += 1) {
    const cell = (g: (typeof groups)[number]) => (g.rows[i].ok ? "  yes" : `  no@${g.rows[i].blockedAt}`);
    console.log(`  ${TASKS[i].id.padEnd(20)}${groups.map(cell).join("")}`);
  }
  const totals = groups.map((g) => g.rows.filter((r) => r.ok).length);
  console.log(`  ${"complete".padEnd(20)}${totals.map((n) => String(n).padStart(5)).join("")} of 8`);

  const example = build(TASKS[0], TASKS[0].steps[1], "full");
  console.log(`\n  one full packet: role=${example.role} facts=${sortedKeys(example).join(",")}`);
  console.log("  the packet file decided that list, the child only acted on it.");
}

if (import.meta.main) report(demo());
