// 3.3 — least privilege, enforced before the wire.
//
// The menu says the server offers three tools. The policy says this agent may
// call two. The refusal happens in the client, so the server never sees the
// request — which is the difference between a scoped agent and a polite one.

import { McpClient } from "../mcp/client.ts";
import type { ToolDescription } from "../mcp/client.ts";

interface Policy {
  allow: string[];
  deny: string[];
}

/** What this agent is permitted to do, independent of what the server offers. */
const POLICY: Policy = { allow: ["open_warehouse", "quote_rate"], deny: [] };

export function permitted(tool: ToolDescription, policy: Policy): boolean {
  if (policy.deny.includes(tool.name)) return false;
  if (policy.allow.length === 0) return true;
  return policy.allow.includes(tool.name);
}

const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
await client.callTool("open_warehouse", { warehouse: "berlin-1" });

const offered = await client.listTools();
const allowed = offered.filter((t) => permitted(t, POLICY));
const blocked = offered.filter((t) => !permitted(t, POLICY));

console.log("# offered by the server:", offered.map((t) => t.name).join(", "));
console.log("# allowed by policy   :", allowed.map((t) => t.name).join(", "));
console.log("# blocked             :", blocked.map((t) => t.name).join(", ") || "(none)");

console.log("\n# a blocked call never reaches the server");
try {
  if (!allowed.some((t) => t.name === "book_pickup")) {
    throw new Error("policy: book_pickup is not in this agent's allow-list");
  }
  await client.callTool("book_pickup", { pickupId: "pick_01" });
} catch (error) {
  console.log(" ", (error as Error).message);
}

console.log("\n# and the pickup is still unbooked on the server");
const again = await client.callTool("open_warehouse", { warehouse: "berlin-1" });
console.log(" ", JSON.stringify(again));

client.close();
