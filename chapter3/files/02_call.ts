// 3.2 — one call that works, one the server refuses, one the server does not know.
//
// The client does not decide any of these. Its job is to turn each into a
// distinct, catchable outcome so the agent above can choose what to do.

import { McpClient, McpError } from "../mcp/client.ts";

const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
await client.callTool("open_warehouse", { warehouse: "berlin-1" });

console.log("# a call that works");
const quote = await client.callTool("quote_rate", { carrier: "dhl", country: "DE", weightKg: 3.2 });
console.log(" ", JSON.stringify(quote));

console.log("\n# a call the server refuses (state)");
try {
  await client.callTool("book_pickup", { pickupId: "pick_03" });
} catch (error) {
  const e = error as McpError;
  console.log(`  code ${e.code}: ${e.message}`);
}

console.log("\n# a call to a tool that does not exist");
try {
  await client.callTool("delete_everything", {});
} catch (error) {
  const e = error as McpError;
  console.log(`  code ${e.code}: ${e.message}`);
}

console.log("\n# the same pickup, twice");
await client.callTool("book_pickup", { pickupId: "pick_01" });
try {
  await client.callTool("book_pickup", { pickupId: "pick_01" });
} catch (error) {
  const e = error as McpError;
  console.log(`  code ${e.code}: ${e.message}`);
}

client.close();
