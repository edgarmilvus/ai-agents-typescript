// 18.4 — a record that is not a copy.
//
// Globex's deletion can finish, because its world has no untracked copy. The
// demo removes the closure, scans, and writes a tombstone: a hash and a count,
// with no label in it.
//
// The tombstone is the one artefact a deletion must leave behind, and it must
// contain nothing that could be restored into a customer. That constraint is
// why the record holds a hash: a tombstone that names the customer is the last
// copy of what the deletion removed.

import { closure, makeWorld, residue, tenantRows } from "../world.ts";
import { verified } from "../purge.ts";

const world = makeWorld();
const rows = tenantRows(world, world.globex).map((row) => row.id);

console.log("# a deletion that can finish\n");
console.log(`  direct rows   : ${rows.join(", ")}`);
const preview = makeWorld();
const previewRows = tenantRows(preview, preview.globex).map((row) => row.id);
console.log(`  closure       : ${closure(preview, previewRows).length} artefacts`);

const report = verified(world, world.globex);
console.log(`  removed       : ${report.deleted.length}`);
console.log(`  status        : ${report.status}`);
console.log(`  scan("globex"): ${residue(world, "globex").length} hits`);
console.log(`\n  tombstone     : ${report.tombstone}`);
console.log(`  content       : ${world.artefacts.get(report.tombstone!)?.content}`);
console.log("");
console.log("  the record holds a hash and a count. It cannot hold the label, because a");
console.log("  record that names the customer is the last copy of what was deleted.");

console.log("\n# and running it again\n");
const again = verified(world, world.globex);
console.log(`  deleted       : ${again.deleted.length}`);
console.log(`  status        : ${again.status}`);
console.log(`  tombstone     : ${again.tombstone}`);
console.log("");
console.log("  idempotent because the roots are gone and the tombstone is keyed by a");
console.log("  hash. A second purge has nothing to remove and nothing to write.");
