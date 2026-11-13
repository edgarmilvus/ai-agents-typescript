// Exercise 1 — a menu is a snapshot, not a constant.
//
// A conditional capability is invisible until its precondition holds. A client
// that caches the menu forever believes the tool does not exist; a client that
// refreshes it discovers the tool and can explain why it appeared.

import { McpClient } from "../../mcp/client.ts";

export async function demo() {
  const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
  const before = await client.listTools();

  let hiddenError: { code: number; message: string } | undefined;
  try {
    await client.callTool("book_pickup", { pickupId: "pick_01" });
  } catch (error) {
    hiddenError = error as { code: number; message: string };
  }

  await client.callTool("open_warehouse", { warehouse: "berlin-1" });
  const after = await client.listTools();
  client.close();

  return {
    before: before.map((t) => t.name),
    after: after.map((t) => t.name),
    hiddenError,
    newlyAvailable: after.filter((t) => !before.some((b) => b.name === t.name)).map((t) => t.name),
  };
}

if (import.meta.main) {
  const r = await demo();
  console.log("before :", r.before.join(", "));
  console.log("call    :", r.hiddenError?.code, r.hiddenError?.message);
  console.log("after  :", r.after.join(", "));
  console.log("new    :", r.newlyAvailable.join(", "));
}
