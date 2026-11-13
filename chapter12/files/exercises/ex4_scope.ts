// Exercise 4 — what a read-only child cannot do, and the smallest registry.
//
// Capability is the cheapest control there is: a tool that is not in the
// registry cannot be called, whatever the model was persuaded to do. This
// exercise measures that, attack by attack, and then asks the obvious follow-up
// — if the registry has to shrink, which tool should go first?

import { ATTACKS } from "../../attacks.ts";

export type Tool = "issue_refund" | "escalate" | "send_email";

/** The tools an attack needs, given the action a fooled model would take. */
export function needs(tool: Tool): string[] {
  return ATTACKS.filter((attack) => attack.compromised.tool === tool).map((attack) => attack.id);
}

/** Attacks reachable from a registry. */
export function reachable(registry: Tool[]): string[] {
  return ATTACKS.filter((attack) => registry.includes(attack.compromised.tool as Tool)).map((a) => a.id);
}

/**
 * Greedy removal: take out the tool that blocks the most attacks still
 * reachable, repeat until nothing is reachable or no tool helps.
 */
export function minimal(registry: Tool[]): { tools: Tool[]; blocks: number }[] {
  const steps: { tools: Tool[]; blocks: number }[] = [];
  let remaining = [...registry];
  while (reachable(remaining).length > 0) {
    let best: { tool: Tool; blocks: number } | undefined;
    for (const tool of remaining) {
      const without = remaining.filter((t) => t !== tool);
      const blocks = reachable(remaining).length - reachable(without).length;
      if (!best || blocks > best.blocks) best = { tool, blocks };
    }
    if (!best || best.blocks === 0) break;
    remaining = remaining.filter((t) => t !== best.tool);
    steps.push({ tools: remaining, blocks: best.blocks });
  }
  return steps;
}

export function demo() {
  const registry: Tool[] = ["issue_refund", "escalate", "send_email"];
  return {
    registry,
    perTool: registry.map((tool) => ({ tool, attacks: needs(tool) })),
    reachable: reachable(registry),
    steps: minimal(registry),
    clerk: reachable(["issue_refund", "escalate"].filter((t) => t === "escalate") as Tool[]),
  };
}

export function report(d: ReturnType<typeof demo>): void {
  console.log("# which tool an attack needs\n");
  for (const row of d.perTool) {
    const short = row.attacks.map((id) => id.split("-")[0]);
    const list = short.length > 8 ? `${short.slice(0, 8).join(", ")}, +${short.length - 8}` : short.join(", ");
    console.log(`  ${row.tool.padEnd(12)} ${String(row.attacks.length).padStart(2)} attack(s)  ${list || "-"}`);
  }

  console.log(`\n  reachable from the full registry: ${d.reachable.length}/${ATTACKS.length}`);

  console.log("\n# removing tools, greedily\n");
  console.log("  registry after removal            attacks blocked");
  for (const step of d.steps) {
    console.log(`  ${step.tools.join(", ").padEnd(33)} ${step.blocks}`);
  }

  console.log("\n  the smallest registry that can refund anything still contains the refund");
  console.log("  tool, so this analysis says something uncomfortable: capability removal costs");
  console.log("  you the capability. That is why the child split is not an optimisation — the");
  console.log("  agent that reads the payload is the one that has to lose the write tool.");
}

if (import.meta.main) report(demo());
