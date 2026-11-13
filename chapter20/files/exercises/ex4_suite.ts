// Exercise 4 — two models, one suite.
//
// A conformance suite is a set of behaviours, written in the port's vocabulary,
// that every model has to satisfy. This exercise writes four and runs them
// against two models with different internals.
//
// The suite does not know which model answered. That is the property being
// tested, and a suite that needs to know is a suite that has not been ported.

export interface Model {
  name: string;
  answer: string;
  finish: string;
  usage: { input: number; output: number };
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
}

export const MODELS: Model[] = [
  {
    name: "alpha",
    answer: "The refund is within the window.",
    finish: "stop",
    usage: { input: 12, output: 18 },
    toolCall: { id: "call_1", name: "issue_refund", args: { orderId: "A-1" } },
  },
  {
    name: "beta",
    answer: "The refund is within the window. Policy applies.",
    finish: "stop",
    usage: { input: 12, output: 18 },
    toolCall: { id: "call_1", name: "issue_refund", args: { orderId: "A-1" } },
  },
];

export interface Check {
  name: string;
  run(model: Model): boolean;
}

export const CHECKS: Check[] = [
  { name: "answer", run: (m) => m.answer.startsWith("The refund") },
  { name: "finish", run: (m) => m.finish === "stop" },
  { name: "usage", run: (m) => m.usage.input === 12 && m.usage.output === 18 },
  { name: "tool call", run: (m) => m.toolCall?.args.orderId === "A-1" },
];

export function demo(): { model: string; cells: boolean[]; passed: number }[] {
  return MODELS.map((model) => {
    const cells = CHECKS.map((check) => check.run(model));
    return { model: model.name, cells, passed: cells.filter(Boolean).length };
  });
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# four checks, two models\n");
  console.log(`  ${"check".padEnd(12)}${MODELS.map((model) => model.name.padStart(7)).join("")}`);
  CHECKS.forEach((check, i) => {
    const cells = rows.map((row) => (row.cells[i] ? "ok" : "FAIL").padStart(7));
    console.log(`  ${check.name.padEnd(12)}${cells.join("")}`);
  });
  console.log("");
  for (const row of rows) console.log(`  ${row.model.padEnd(7)} ${row.passed}/${CHECKS.length}`);
  console.log("\n  the suite passes on both models, which is the only result that means the");
  console.log("  boundary works. A suite that passes on one model has measured that model.");
}

if (import.meta.main) report(demo());
