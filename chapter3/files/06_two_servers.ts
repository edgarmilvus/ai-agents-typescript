// 3.6 — two servers, one client, and the collision that follows.
//
// Each client is independent: its own process, its own handshake, its own
// menu. What is not independent is the *name space*: both servers offer a tool
// called `search`, with different arguments and different results, and a flat
// menu would merge them into one name the model cannot disambiguate.

import { McpClient } from "../mcp/client.ts";
import type { ToolDescription } from "../mcp/client.ts";

const warehouse = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
const docs = await McpClient.start("node", ["chapter3/mcp/docs-server.ts"], { timeoutMs: 4000 });

const menus = [
  { prefix: "warehouse", client: warehouse },
  { prefix: "docs", client: docs },
];

console.log("# two handshakes");
for (const m of menus) console.log(`  ${m.prefix}: ${m.client.serverInfo?.name} ${JSON.stringify(Object.keys(m.client.capabilities))}`);

console.log("\n# flat menus, as each server reports them");
for (const m of menus) {
  await m.client.callTool(m.prefix === "warehouse" ? "open_warehouse" : "open_doc",
    m.prefix === "warehouse" ? { warehouse: "berlin-1" } : { id: "doc_style" });
  const names = (await m.client.listTools()).map((t: ToolDescription) => t.name);
  console.log(`  ${m.prefix}: ${names.join(", ")}`);
}

console.log("\n# the same names, prefixed");
const merged = new Map<string, { server: string; tool: ToolDescription }>();
for (const m of menus) {
  for (const tool of await m.client.listTools()) {
    const key = `${m.prefix}.${tool.name}`;
    if (merged.has(key)) console.log(`  COLLISION ${key}`);
    merged.set(key, { server: m.prefix, tool });
  }
}
for (const key of merged.keys()) console.log(`  ${key}`);

console.log("\n# per-server policy: docs may read, warehouse may quote");
const policy: Record<string, string[]> = { warehouse: ["open_warehouse", "quote_rate"], docs: ["search", "open_doc"] };
for (const [prefix, allow] of Object.entries(policy)) {
  const offered = (await menus.find((m) => m.prefix === prefix)!.client.listTools()).map((t: ToolDescription) => t.name);
  const blocked = offered.filter((n) => !allow.includes(n));
  console.log(`  ${prefix}: allowed ${allow.join(", ")} | blocked ${blocked.join(", ") || "(none)"}`);
}

console.log("\n# one server dying does not take the other with it");
docs.close();
const stillUp = await warehouse.listTools();
console.log("  warehouse after docs closed:", stillUp.map((t) => t.name).join(", "));

warehouse.close();
