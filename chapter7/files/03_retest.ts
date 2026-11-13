// 7.3 — the same image, twice, three times over.
//
// Temperature 0 is not determinism, and an audit is a sample like any other.
// Running the same render through the same prompt twice is the cheapest
// reliability test there is, and it belongs in the harness, not in a hope.

import { audit, renderPath } from "../audit.ts";
import { byId } from "../corpus.ts";
import { truthOf } from "../render.ts";
import { open } from "../../lib/scenario.ts";

const IDS = ["r03", "r05", "r07"];
const session = open("ch7-retest", 8);

console.log("# each render audited twice, same prompt, same temperature");
let flips = 0;
for (const id of IDS) {
  const a = await audit(session.model, renderPath(id));
  const b = await audit(session.model, renderPath(id));
  const same = a.defects.join() === b.defects.join();
  if (!same) flips += 1;
  console.log(
    `  ${id}  ${(a.defects.join(",") || "none").padEnd(16)} ${(b.defects.join(",") || "none").padEnd(16)} ${same ? "same" : "FLIP"}`,
  );
  console.log(`      truth ${truthOf(byId(id)).join(",") || "clean"} | confidence ${a.confidence} then ${b.confidence}`);
}
session.close();

console.log(`\n  flips    : ${flips} of ${IDS.length} renders`);
if (session.live) console.log("  tokens   :", session.budget.promptTokens, "in /", session.budget.outputTokens, "out");
