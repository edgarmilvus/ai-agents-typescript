// 3.1 — read a server's capabilities before using them.
//
// The client starts the server, performs the handshake, and asks for the tool
// list. Notice what is *not* there yet: book_pickup, because no warehouse is
// open. A capability can be conditional, and a menu is a snapshot.

import { McpClient } from "../mcp/client.ts";

const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });

console.log("# handshake");
console.log("server      :", client.serverInfo);
console.log("capabilities:", Object.keys(client.capabilities));

console.log("\n# tools before opening a warehouse");
for (const tool of await client.listTools()) {
  console.log(`  ${tool.name}(${JSON.stringify(tool.inputSchema.required ?? [])})`);
}

console.log("\n# opening berlin-1");
const opened = await client.callTool("open_warehouse", { warehouse: "berlin-1" });
console.log("  ->", JSON.stringify(opened));

console.log("\n# tools after opening it");
for (const tool of await client.listTools()) {
  console.log(`  ${tool.name}(${JSON.stringify(tool.inputSchema.required ?? [])})`);
}

console.log("\n# a refusal from the server, not from us");
try {
  await client.callTool("book_pickup", { pickupId: "pick_03" });
} catch (error) {
  const e = error as { code: number; message: string };
  console.log(`  code ${e.code}: ${e.message}`);
}

client.close();
