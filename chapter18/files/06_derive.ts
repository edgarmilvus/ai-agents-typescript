// 18.6 — the edge you did not write.
//
// The guard in `derive` is the whole chapter in one function: a derivation that
// names no inputs, or names an input that does not exist, is refused at write
// time. At deletion time the same mistake is invisible, because the copy has no
// edge to walk and no label to scan.
//
// The second half removes the backup so the scan can come back clean, and then
// prints the paraphrase that is still in the world. Clean is a statement about
// the scan, not about the world.

import { closure, derive, makeWorld, residue, tenantRows } from "../world.ts";
import { verified } from "../purge.ts";

console.log("# a derivation that names nothing\n");
try {
  derive(makeWorld(), { id: "a-summary-2", kind: "summary", content: "Acme again", from: [] });
} catch (error) {
  console.log(`  from: []            → refused: ${(error as Error).message}`);
}
try {
  derive(makeWorld(), { id: "a-summary-2", kind: "summary", content: "Acme again", from: ["a-note-9"] });
} catch (error) {
  console.log(`  from: ["a-note-9"]   → refused: ${(error as Error).message}`);
}

const world = makeWorld();
const roots = tenantRows(world, world.acme).map((row) => row.id);
console.log(`\n  a real derivation is accepted, and its edge is the evidence:`);
console.log(`  ${roots.length} rows → ${closure(world, roots).length} artefacts in the closure`);

console.log("\n# a copy that never called derive\n");
world.artefacts.delete("a-backup-1");
const report = verified(world, world.acme);
console.log(`  status        : ${report.status}`);
console.log(`  scan("acme")  : ${residue(world, "acme").length} hits`);
console.log(`  tombstone     : ${report.tombstone}`);
console.log("");
console.log(`  a-paraphrase-1 is still there:`);
console.log(`    "${world.artefacts.get("a-paraphrase-1")?.content}"`);
console.log("");
console.log("  clean means \"nothing the scan can see\", not \"nothing in the world\". A");
console.log("  copy that records its input can be walked; a copy that does not is");
console.log("  outside every deletion this chapter can run. The only fix is at write");
console.log("  time, which is why derive refuses an edge it cannot resolve.");
