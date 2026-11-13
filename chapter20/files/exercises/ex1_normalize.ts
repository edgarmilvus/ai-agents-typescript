// Exercise 1 — normalize three events.
//
// The port is a translation table: a provider event in, zero or more normalized
// events out. This exercise writes the table for the shapes the chapter uses
// and prints what each raw event became.
//
// The translation is pure. It has no model, no request and no error handling.

export type Raw =
  | { type: "delta"; delta: { text: string } }
  | { type: "text"; delta: string }
  | { type: "usage"; input_tokens: number; output_tokens: number }
  | { type: "done"; finish_reason: string; usage: { input: number; output: number } }
  | { type: "message"; content: string; stop: string };

export type Event =
  | { type: "text"; text: string }
  | { type: "usage"; input: number; output: number }
  | { type: "finish"; finish: string };

export function finishOf(reason: string): string {
  if (reason === "end_turn" || reason === "end" || reason === "stop") return "stop";
  if (reason === "tool_use" || reason === "tool_call") return "tool_call";
  if (reason === "max_tokens") return "length";
  return "stop";
}

/** One raw event becomes zero or two normalized events, never more. */
export function normalize(raw: Raw): Event[] {
  switch (raw.type) {
    case "delta":
      return [{ type: "text", text: raw.delta.text }];
    case "text":
      return [{ type: "text", text: raw.delta }];
    case "usage":
      return [{ type: "usage", input: raw.input_tokens, output: raw.output_tokens }];
    case "done":
      return [
        { type: "usage", input: raw.usage.input, output: raw.usage.output },
        { type: "finish", finish: finishOf(raw.finish_reason) },
      ];
    case "message":
      return [
        { type: "text", text: raw.content },
        { type: "finish", finish: finishOf(raw.stop) },
      ];
  }
}

export const RAW: Raw[] = [
  { type: "delta", delta: { text: "Hello " } },
  { type: "text", delta: "world" },
  { type: "done", finish_reason: "end_turn", usage: { input: 12, output: 6 } },
];

export function demo(): { input: string; output: string }[] {
  return RAW.map((raw) => ({
    input: raw.type,
    output: normalize(raw)
      .map((event) =>
        event.type === "text"
          ? `text "${event.text}"`
          : event.type === "usage"
            ? `usage ${event.input}/${event.output}`
            : `finish ${event.finish}`,
      )
      .join(", "),
  }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# three raw events\n");
  console.log("  input   normalized");
  for (const row of rows) console.log(`  ${row.input.padEnd(8)}${row.output}`);
  console.log("");
  console.log("  delta and text collapse into the same event, which is why the agent");
  console.log("  never sees either name. done expands into two events because it carries");
  console.log("  two facts, and a normalizer that returns one event per input would have");
  console.log("  to drop one of them.");
}

if (import.meta.main) report(demo());
