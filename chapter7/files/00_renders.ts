// 7.0 — draw the corpus, and print its answer key.
//
// The renders are generated, never hand-edited: a PNG is a fact about
// chapter7/render.ts, and the truth about it is a fact about the injection.
// Rasterizing to PNG is the one step that needs a system tool; see
// chapter7/renders/rasterize.sh.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CORPUS, KEY } from "../corpus.ts";
import { render, truthOf } from "../render.ts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const RENDERS = join(ROOT, "renders");

mkdirSync(RENDERS, { recursive: true });

for (const entry of CORPUS) {
  const svg = render(entry.receipt, entry.defects);
  writeFileSync(join(RENDERS, `${entry.id}.svg`), svg + "\n");
  const truth = truthOf(entry);
  console.log(`  ${entry.id}  ${truth.length ? truth.join(",") : "clean"}`.padEnd(52) + `${svg.length} bytes of SVG`);
}

console.log("\n# the answer key, which no model was consulted about");
for (const line of KEY) console.log("  " + line);
