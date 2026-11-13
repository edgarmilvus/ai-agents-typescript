// Exercise 5 — every failure has a category, and the category picks the action.
//
// Retrying a refusal is the most expensive habit an agent can have. This maps
// four kinds of failure to the only sane response, and refuses to guess when
// the kind is unknown.

export type Failure = "missing" | "invalid" | "out-of-range" | "not-found" | "state" | "transport" | "unknown";
export type Action = "repair" | "escalate" | "retry" | "reconcile";

export function classify(message: string): Failure {
  const m = message.toLowerCase();
  if (m.includes("no tool named") || m.includes("unknown tool")) return "missing";
  if (m.includes("invalid arguments") || m.includes("must be")) return "invalid";
  if (m.includes("exceeds") || m.includes(">= ") || m.includes("<= ")) return "out-of-range";
  if (m.includes("no order") || m.includes("unknown sku") || m.includes("not found")) return "not-found";
  if (m.includes("already") || m.includes("not draft") || m.includes("outside the")) return "state";
  if (m.includes("exited") || m.includes("timed out")) return "transport";
  return "unknown";
}

export function action(failure: Failure): Action {
  switch (failure) {
    case "missing":
    case "invalid":
      return "repair";
    case "out-of-range":
    case "not-found":
      return "repair";
    case "state":
      return "escalate";
    case "transport":
      return "reconcile";
    case "unknown":
      return "escalate";
  }
}

export const SAMPLES = [
  'Error: no tool named "close_ticket". Available: lookup_order, issue_refund.',
  'Error: invalid arguments — "priority" must be number, got string.',
  "Error: total 8970 EUR exceeds the 5000 ceiling for Helio Optics; flag_for_review instead",
  "Error: no order ORD-9999",
  "Error: outside the 14-day window (delivered 21 days ago); escalate instead",
  "server exited with code 70",
  "something nobody has seen before",
];

export function demo() {
  return SAMPLES.map((message) => ({ message: message.slice(0, 62), failure: classify(message), action: action(classify(message)) }));
}

if (import.meta.main) {
  for (const r of demo()) console.log(`${r.failure.padEnd(12)} ${r.action.padEnd(10)} ${r.message}`);
}
