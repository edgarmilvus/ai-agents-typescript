// Exercise 5 — the capability check.
//
// A capability is a fact about a model, and the check is a comparison between
// that fact and what the task needs. It belongs before the first request, not
// after an answer that quietly ignored half the task.
//
// The exercise checks four combinations, including the one that is easy to get
// wrong: a model that cannot stream is still fine for a task that does not need
// streaming.

export interface Capabilities {
  tools: boolean;
  streaming: boolean;
}

export interface Need {
  tools: boolean;
  streaming: boolean;
}

export interface Verdict {
  ok: boolean;
  missing: string[];
}

export function check(capabilities: Capabilities, need: Need): Verdict {
  const missing: string[] = [];
  if (need.tools && !capabilities.tools) missing.push("tools");
  if (need.streaming && !capabilities.streaming) missing.push("streaming");
  return { ok: missing.length === 0, missing };
}

export const CASES: { model: string; capabilities: Capabilities; need: Need }[] = [
  { model: "full", capabilities: { tools: true, streaming: true }, need: { tools: true, streaming: false } },
  { model: "no-tools", capabilities: { tools: false, streaming: true }, need: { tools: true, streaming: false } },
  { model: "full", capabilities: { tools: true, streaming: true }, need: { tools: true, streaming: true } },
  { model: "no-stream", capabilities: { tools: true, streaming: false }, need: { tools: true, streaming: false } },
];

export function demo(): { model: string; need: string; result: string }[] {
  return CASES.map((c) => {
    const verdict = check(c.capabilities, c.need);
    const need = [c.need.tools ? "tools" : "", c.need.streaming ? "stream" : ""].filter(Boolean).join(",");
    return {
      model: c.model,
      need: need || "none",
      result: verdict.ok ? "ok" : `unsupported: ${verdict.missing.join(", ")}`,
    };
  });
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# four capability checks\n");
  console.log("  model      need          result");
  for (const row of rows) {
    console.log(`  ${row.model.padEnd(11)}${row.need.padEnd(14)}${row.result}`);
  }
  console.log("");
  console.log("  the second row is the only failure: a model without tools asked to use");
  console.log("  one. The fourth row passes even though the model cannot stream, because");
  console.log("  the task never asked it to; a capability check that requires everything");
  console.log("  rejects models that would have worked.");
}

if (import.meta.main) report(demo());
