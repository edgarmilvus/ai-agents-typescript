// Exercise 1 — a verdict you can count.
//
// A parser that refuses has to say *why*, or the refusals become a single
// bucket called "bad output" and nobody can fix the prompt. Six reason codes,
// seven hand-written replies, and one live audit.

import { audit, firstObject, renderPath } from "../../audit.ts";
import type { Code } from "../../render.ts";
import { CODES } from "../../render.ts";
import { open } from "../../../lib/scenario.ts";

export type Outcome = "pass" | "fail" | "refused";

export type Reason =
  | "no_json"
  | "bad_json"
  | "bad_verdict"
  | "contradictory"
  | "unactionable"
  | "unsupported";

export interface Counted {
  outcome: Outcome;
  codes: Code[];
  reason?: Reason;
  detail?: string;
}

/**
 * Turn a reply into an outcome a report can tally.
 *
 * The difference from a plain parse is that every refusal has a name, so a
 * dashboard can show "unactionable: 12" and someone can act on it.
 */
export function strict(raw: string, codes: readonly Code[] = CODES): Counted {
  const json = firstObject(raw);
  if (!json) return { outcome: "refused", codes: [], reason: "no_json" };

  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { outcome: "refused", codes: [], reason: "bad_json" };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { outcome: "refused", codes: [], reason: "bad_json", detail: "not an object" };
  }

  const v = value as Record<string, unknown>;
  if (v.verdict !== "pass" && v.verdict !== "fail") {
    return { outcome: "refused", codes: [], reason: "bad_verdict", detail: String(v.verdict) };
  }

  const words = Array.isArray(v.defects) ? v.defects : [];
  const known = words.filter((w): w is Code => typeof w === "string" && (codes as readonly string[]).includes(w));
  const evidence = typeof v.evidence === "string" ? v.evidence.trim() : "";

  if (v.verdict === "pass" && known.length) {
    return { outcome: "refused", codes: [], reason: "contradictory" };
  }
  if (v.verdict === "fail" && !known.length) {
    return { outcome: "refused", codes: [], reason: "unactionable", detail: `${words.length} word(s) none of ours` };
  }
  if (v.verdict === "fail" && !evidence) {
    return { outcome: "refused", codes: known, reason: "unsupported" };
  }
  return { outcome: v.verdict, codes: [...new Set(known)] };
}

const CASES: [string, string][] = [
  ["clean pass", '{"verdict":"pass","defects":[],"evidence":"nothing wrong"}'],
  ["named defect", '{"verdict":"fail","defects":["overlap"],"evidence":"the tax row sits on the total"}'],
  ["prose only", "The receipt looks acceptable to me."],
  ["free-text defects", '{"verdict":"fail","defects":["the total is a bit faint"],"evidence":"faint"}'],
  ["pass with codes", '{"verdict":"pass","defects":["overlap"],"evidence":""}'],
  ["unbalanced json", '{"verdict":"fail","defects":["overlap"'],
  ["no evidence", '{"verdict":"fail","defects":["overlap"],"evidence":""}'],
];

export async function demo() {
  const cases = CASES.map(([name, raw]) => ({ name, ...strict(raw) }));

  const session = open("ch7-ex1", 3);
  const verdict = await audit(session.model, renderPath("r02"));
  session.close();
  const live = strict(verdict.raw);

  return { cases, live, caught: live.codes.join() === "missing_total" };
}

export function report(d: Awaited<ReturnType<typeof demo>>): void {
  console.log("# seven replies, seven outcomes\n");
  console.log("  case                 outcome  reason          codes");
  for (const c of d.cases) {
    console.log(`  ${c.name.padEnd(20)} ${c.outcome.padEnd(8)} ${(c.reason ?? "-").padEnd(15)} ${c.codes.join(",") || "-"}`);
  }

  console.log("\n# one live audit, parsed the same way");
  console.log(`  r02                  ${d.live.outcome.padEnd(8)} ${(d.live.reason ?? "-").padEnd(15)} ${d.live.codes.join(",") || "-"}`);
  console.log(`  truth                ${d.caught ? "caught" : "missed"}`);
  const reasons = new Set(d.cases.map((c) => c.reason).filter(Boolean));
  console.log(`\n  reasons exercised    ${reasons.size} of 6`);
}

if (import.meta.main) report(await demo());
