// Exercise 3 — the first place two runs stop agreeing.
//
// "The agent behaved differently" is not a bug report. "Turn 2, different tool"
// is. This reduces a diff to one line a reviewer can act on.

import { decision, diff, stable } from "../../recording.ts";
import type { Recording, Divergence } from "../../recording.ts";

export interface Summary {
  same: boolean;
  firstIndex: number | null;
  kind: string;
  detail: string;
}

export function summarise(a: Recording, b: Recording): Summary {
  const d: Divergence = diff(a, b);
  switch (d.kind) {
    case "same":
      return { same: true, firstIndex: null, kind: "same", detail: `${a.turns.length} turns agree` };
    case "length":
      return { same: false, firstIndex: Math.min(d.a, d.b), kind: "length", detail: `${d.a} vs ${d.b} turns` };
    case "call":
      return { same: false, firstIndex: d.index, kind: "call", detail: `turn ${d.index}: ${d.a} vs ${d.b}` };
    case "text":
      return { same: false, firstIndex: d.index, kind: "text", detail: `turn ${d.index}: ${stable(d.a)} vs ${stable(d.b)}` };
  }
}

/** What a diff compares: the decision, never the provider's opaque fields. */
function canonical(recording: Recording): string {
  return stable(
    recording.turns.flatMap((t) =>
      (t.reply.toolCalls ?? []).map((c) => ({ name: c.name, args: decision(c.args) })),
    ),
  );
}

export function demo(a: Recording, b: Recording) {
  const s = summarise(a, b);
  return { ...s, canonicalEqual: canonical(a) === canonical(b) };
}

if (import.meta.main) {
  const { readFileSync } = await import("node:fs");
  const { recordingPath } = await import("../../recording.ts");
  const a = JSON.parse(readFileSync(recordingPath("triage.json"), "utf8")) as Recording;
  const b = JSON.parse(readFileSync(recordingPath("triage-2.json"), "utf8")) as Recording;
  console.log(JSON.stringify(demo(a, b), null, 2));
}
