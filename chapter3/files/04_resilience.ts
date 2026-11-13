// 3.4 — when the pipe closes mid-call.
//
// The dangerous failure is not "the server said no". It is "the server closed
// the connection after it may have done the thing". A retry there is a second
// booking, and no amount of retry logic in the client can tell.

import { McpClient, TransportError } from "../mcp/client.ts";

type Outcome =
  | { kind: "ok"; value: unknown }
  | { kind: "refused"; message: string }
  | { kind: "unknown"; message: string };

/** Classify a failure by what it tells us about the world. */
function classify(error: unknown): Outcome {
  if (error instanceof TransportError) {
    // The request may or may not have been executed.
    return { kind: "unknown", message: error.message };
  }
  // A JSON-RPC error: the server understood and refused, so nothing happened
  // and retrying is pointless until the reason changes.
  return { kind: "refused", message: (error as Error).message };
}

async function attempt(mutating: boolean, call: (client: McpClient) => Promise<unknown>): Promise<Outcome> {
  let client: McpClient | undefined;
  try {
    client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 3000 });
    await client.callTool("open_warehouse", { warehouse: "berlin-1" });
    return { kind: "ok", value: await call(client) };
  } catch (error) {
    const outcome = classify(error);
    // The rule: replaying a read is free, replaying a write needs evidence.
    if (outcome.kind === "unknown" && mutating) {
      return { kind: "unknown", message: `${outcome.message} — a write may have committed; reconcile before retrying` };
    }
    return outcome;
  } finally {
    client?.close();
  }
}

process.env.CRASH_ON_BOOK = "1";
console.log("# a write that dies after committing");
const crashed = await attempt(true, (c) => c.callTool("book_pickup", { pickupId: "pick_01" }));
console.log(" ", crashed.kind, "|", crashed.message);

console.log("\n# a read that dies is merely retried");
process.env.CRASH_ON_BOOK = "0";
const read = await attempt(false, (c) => c.callTool("quote_rate", { carrier: "dhl", country: "DE", weightKg: 3.2 }));
console.log(" ", read.kind, "|", JSON.stringify(read.kind === "ok" ? read.value : read.message));

console.log("\n# a refusal is neither: it is information");
const refused = await attempt(true, (c) => c.callTool("book_pickup", { pickupId: "pick_03" }));
console.log(" ", refused.kind, "|", refused.message);
