// 7.6 — the same corpus, half the pixels.
//
// A vision grader's accuracy is a property of the pixels it was given, not of
// the model alone. The same four renders, rasterized at 240x320 instead of
// 480x640, audited with the same prompt: whatever moves here moved because the
// input pipeline changed, which is exactly the claim a second domain has to make.

import { join } from "node:path";
import { audit, RENDERS } from "../audit.ts";
import { byId } from "../corpus.ts";
import { truthOf } from "../render.ts";
import { open } from "../../lib/scenario.ts";

const IDS = ["r02", "r03", "r05", "r07"];

const session = open("ch7-scale", 6);
console.log("# 240x320 instead of 480x640, same prompt\n");
console.log("  render  truth               got                     exact  confidence");
let exact = 0;
for (const id of IDS) {
  const v = await audit(session.model, join(RENDERS, "small", `${id}.png`));
  const truth = truthOf(byId(id));
  const ok = v.defects.slice().sort().join() === truth.slice().sort().join();
  if (ok) exact += 1;
  console.log(
    `  ${id.padEnd(7)} ${truth.join(",").padEnd(19)} ${(v.defects.join(",") || "none").padEnd(23)} ${(ok ? "yes" : "no").padEnd(6)} ${v.confidence}`,
  );
}
session.close();
console.log(`\n  exact at half size : ${exact}/${IDS.length}`);
console.log("  at full size       : 4/4 on these renders (04_agreement)");
