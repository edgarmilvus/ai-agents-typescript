// Exercise 3, file 1 of 3 — the port, with no provider.
//
// A normalizer is a total function from a wire event to zero or more port
// events. It has no request, no model and no error handling; it is the one part
// of an adapter that can be tested with a literal.

export type Raw =
  | { type: "delta"; text: string }
  | { type: "text"; text: string }
  | { type: "end"; reason: string };

export type Event =
  | { type: "text"; text: string }
  | { type: "finish"; reason: string };

export function finishOf(reason: string): string {
  if (reason === "end_turn" || reason === "end" || reason === "stop") return "stop";
  return reason;
}

export function normalize(raw: Raw): Event[] {
  switch (raw.type) {
    case "delta":
      return [{ type: "text", text: raw.text }];
    case "text":
      return [{ type: "text", text: raw.text }];
    case "end":
      return [{ type: "finish", reason: finishOf(raw.reason) }];
  }
}

/** The port's only read operation: a provider's raw events, normalized. */
export function read(raw: Raw[]): Event[] {
  return raw.flatMap(normalize);
}
