// Exercise 3 — the order of diagnosis.
//
// Five failures, one classifier. The order matters: a step limit is not a
// wrong effect, and a silent run is not a refusal.

export type Kind = "no-action" | "too-many-steps" | "no-answer" | "wrong-effect";

export interface R {
  steps: number;
  stopReason: string;
  reasons: string[];
}

export function classify(r: R): Kind {
  if (r.stopReason === "step_limit") return "too-many-steps";
  if (r.stopReason !== "answered") return "no-answer";
  if (r.steps === 0) return "no-action";
  if (r.reasons.some((x) => x.includes("expected:"))) return "wrong-effect";
  return "wrong-effect";
}

export function demo() {
  const rows: R[] = [
    { steps: 0, stopReason: "answered", reasons: ["expected: one refund"] },
    { steps: 9, stopReason: "step_limit", reasons: [] },
    { steps: 3, stopReason: "error", reasons: [] },
    { steps: 2, stopReason: "answered", reasons: ["expected: one refund of 84"] },
    { steps: 4, stopReason: "answered", reasons: ["explanation scored 0.5"] },
  ];
  return rows.map((r) => ({ ...r, kind: classify(r) }));
}

if (import.meta.main) {
  for (const r of demo()) console.log(`${String(r.steps).padEnd(2)} ${r.stopReason.padEnd(10)} ${r.kind}`);
}
