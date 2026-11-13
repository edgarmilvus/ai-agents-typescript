// 18.2 — the walk that finds what the filter could not.
//
// A deletion is the closure of the tenant's rows under the derived-from edges.
// The demo prints every edge the closure crosses, removes the closure, and then
// prints what is left — including the two copies with no edge at all.
//
// The edges are the artefact of the writers, not of the purge. The purge can
// only walk what the writes recorded.

import { closure, makeWorld, successors, tenantRows } from "../world.ts";
import { graph } from "../purge.ts";

const world = makeWorld();
const roots = tenantRows(world, world.acme).map((row) => row.id);
const reachable = closure(world, roots);

console.log("# the edges acme's rows carry\n");
for (const id of reachable) {
  const next = successors(world, id).map((a) => a.id);
  console.log(`  ${id.padEnd(14)} → ${next.length > 0 ? next.join(", ") : "(nothing)"}`);
}

console.log(`\n# the closure\n`);
console.log(`  ${reachable.length} of ${world.artefacts.size} artefacts are reachable from ${roots.length} rows`);

const before = world.artefacts.size;
const report = graph(world, world.acme);
console.log(`\n  delete the closure → ${report.deleted.length} removed, ${before - report.deleted.length} left`);

console.log("\n# what the walk cannot see\n");
for (const id of report.survivors) {
  const artefact = world.artefacts.get(id)!;
  const untracked = artefact.derivedFrom.length === 0 && artefact.tenant === world.platform;
  if (untracked) {
    console.log(`  ${id.padEnd(16)} ${artefact.kind.padEnd(9)} no edge, platform-owned`);
    console.log(`    "${artefact.content}"`);
  }
}

console.log("\n  a-backup-1 was taken before the lineage table existed. a-paraphrase-1 was");
console.log("  written by a person into a shared document. Neither called derive, so");
console.log("  neither has an input to walk, and the graph is complete only for the");
console.log("  writes that recorded their inputs.");
