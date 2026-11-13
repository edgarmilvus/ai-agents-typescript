// 18.1 — one deletion, one success, one copy that remains.
//
// Acme leaves. The obvious operation removes the three rows that carry acme's
// tenant id and reports three rows deleted. Then the demo reads the account
// summary, which was computed from acme's note by a batch job that wrote
// "platform" in the tenant column.
//
// The deletion was not wrong about the rows. It was wrong about the world.

import { makeWorld, tenantRows } from "../world.ts";
import { naive } from "../purge.ts";

const world = makeWorld();
const before = world.artefacts.size;
const owns = tenantRows(world, world.acme);

console.log("# acme leaves\n");
console.log(`  the world holds ${before} artefacts, ${owns.length} of them acme's rows`);
for (const row of owns) console.log(`    ${row.id.padEnd(12)} ${row.kind}`);

const report = naive(world, world.acme);
console.log(`\n  delete where tenant = acme → ${report.deleted.length} rows removed, ${report.survivors.length} left`);
console.log(`  the operation returned: ${report.status} (it has no evidence either way)`);

const summary = world.artefacts.get("a-summary-1");
console.log("\n# and the summary survives\n");
console.log(`  a-summary-1 (${summary?.kind}, tenant ${summary?.tenant.label}) still says:`);
console.log(`    "${summary?.content}"`);
console.log(`  its input was a-note-1, which the delete removed. The row that recorded`);
console.log(`  the input was owned by the batch, so the row filter never looked at it.`);
console.log("");
console.log("  the success count is real. The deletion is not.");
