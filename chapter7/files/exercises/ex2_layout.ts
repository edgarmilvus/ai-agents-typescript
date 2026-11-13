// Exercise 2 — ask for the geometry, and watch it not help.
//
// r06 has a button that runs off the right edge of the card. The direct prompt
// passes it. The layout prompt asks for each element's horizontal extent first,
// which is the standard advice for vision prompts — and it passes it too, with
// a confident "fully within bounds". The evidence was clipped away by the very
// defect being looked for.

import { audit, checklistPrompt, renderPath } from "../../audit.ts";
import { byId } from "../../corpus.ts";
import { truthOf } from "../../render.ts";
import { open } from "../../../lib/scenario.ts";

const ID = "r06";

const LAYOUT = [
  "This is an order-confirmation card, rendered at 480x640.",
  "First give each visible element's horizontal extent as fractions of the card width,",
  'for example "Total amount: 0.55-0.95". Then judge the card.',
  "",
  checklistPrompt(),
  "",
  "Put the extents in a field called layout, as an object of element to extent.",
].join("\n");

/** The extent the model claims for the control, as it wrote it. */
export function claimedExtent(raw: string): string | null {
  const line = raw.split("\n").find((l) => /button/i.test(l));
  return line?.match(/0?\.\d+-0?\.\d+/)?.[0] ?? null;
}

export async function demo() {
  const session = open("ch7-ex2", 4);
  const direct = await audit(session.model, renderPath(ID));
  const layout = await audit(session.model, renderPath(ID), { prompt: LAYOUT });
  session.close();
  return { direct, layout, truth: truthOf(byId(ID)), extent: claimedExtent(layout.raw) };
}

export function report(d: Awaited<ReturnType<typeof demo>>): void {
  console.log(`# ${ID} — truth: ${d.truth.join(", ")}\n`);
  for (const [label, v] of [["direct", d.direct], ["layout", d.layout]] as const) {
    console.log(`  ${label.padEnd(7)} ${v.verdict.padEnd(5)} ${(v.defects.join(",") || "(none)").padEnd(20)} ${v.answered ? "" : "REFUSED " + v.note}`);
    console.log(`          ${v.evidence}`);
  }
  console.log("\n  the layout the model reported for the control:");
  console.log("   ", d.extent ? `it claims ${d.extent}, i.e. entirely inside the card` : "(no extent reported)");
  console.log(`\n  truth says the control runs past 1.00; the model reported ${d.extent ?? "nothing"}`);
  console.log("  a clipped control looks exactly like a control that ends at the edge.");
}

if (import.meta.main) report(await demo());
