// Exercise 2 — refuse before the wire.
//
// A scoped client is a wrapper: it checks the policy, and only then forwards.
// The proof is that the server never receives the call, which a request
// counter on the client can show.

import { McpClient } from "../../mcp/client.ts";

export interface Policy {
  allow: string[];
}

export function scoped(client: McpClient, policy: Policy, onRefusal?: (name: string) => void) {
  const calls = { forwarded: 0, refused: 0 };
  return {
    calls,
    async callTool(name: string, args: Record<string, unknown>) {
      if (policy.allow.length && !policy.allow.includes(name)) {
        calls.refused += 1;
        onRefusal?.(name);
        throw new Error(`policy: ${name} is not permitted for this agent`);
      }
      calls.forwarded += 1;
      return client.callTool(name, args);
    },
  };
}

export async function demo() {
  const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
  const agent = scoped(client, { allow: ["open_warehouse", "quote_rate"] });
  const refusedNames: string[] = [];

  await agent.callTool("open_warehouse", { warehouse: "berlin-1" });
  const quoted = await agent.callTool("quote_rate", { carrier: "dhl", country: "DE", weightKg: 3.2 });

  let refusal: string | undefined;
  try {
    await agent.callTool("book_pickup", { pickupId: "pick_01" });
  } catch (error) {
    refusal = (error as Error).message;
  }

  // the status read reports nothing booked: the call never crossed the wire
  const reopened = await client.callTool("open_warehouse", { warehouse: "berlin-1", status: true });
  client.close();
  return { quoted, refusal, calls: agent.calls, refusedNames, reopened };
}

if (import.meta.main) {
  const r = await demo();
  console.log("quoted  :", JSON.stringify(r.quoted));
  console.log("refusal :", r.refusal);
  console.log("calls   :", r.calls, "| pickups:", JSON.stringify(r.reopened));
}
