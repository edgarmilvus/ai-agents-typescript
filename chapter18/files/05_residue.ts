// 18.5 — the purge that refuses to say done.
//
// Acme's world has a backup taken before the lineage table existed. The graph
// cannot reach it, and the scan can. The report carries the hit and stays
// residual: the deletion is not finished, and it says which artefact is holding
// it open.
//
// A residual is not a failure of the code. It is the code telling the truth
// about a system it does not control.

import { makeWorld } from "../world.ts";
import { verified } from "../purge.ts";

const world = makeWorld();
const report = verified(world, world.acme);

console.log("# the purge that refuses to say done\n");
console.log(`  removed : ${report.deleted.length}`);
console.log(`  status  : ${report.status}`);
console.log(`  hits    : ${report.residue.length}`);

for (const hit of report.residue) {
  console.log(`\n  ${hit.id}   ${hit.kind}`);
  console.log(`    "${hit.snippet}"`);
}

console.log("\n  the hit is not deleted here. A backup is a restore path with its own");
console.log("  retention schedule, and removing it from this process would be a claim");
console.log("  about a system this process cannot see. The report stays residual until");
console.log("  that system confirms, and the confirmation is the missing evidence.");

console.log("\n# what the scan did not find\n");
const paraphrase = world.artefacts.get("a-paraphrase-1");
console.log(`  a-paraphrase-1 is still present: "${paraphrase?.content}"`);
console.log("  no label, no edge, no hit. A scan is a search for a needle you can");
console.log("  spell, and this copy never spells it.");
