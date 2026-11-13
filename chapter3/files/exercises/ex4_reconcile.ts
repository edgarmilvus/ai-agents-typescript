// Exercise 4 — reconcile after an unknown outcome.
//
// When the pipe dies mid-write, the client cannot know whether the write
// landed. The fix is not a retry: it is a read that answers the question
// before deciding.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { McpClient, TransportError } from "../../mcp/client.ts";

export type Decision = "retry" | "already-done" | "escalate";

/** The decision is a function of the booked state, not of the branch that reached it. */
export function decide(booked: readonly string[] | undefined, pickupId: string): Decision {
  return booked?.includes(pickupId) ? "already-done" : "retry";
}


export async function bookWithReconciliation(pickupId: string) {
  let client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 3000 });
  await client.callTool("open_warehouse", { warehouse: "berlin-1" });

  try {
    const booked = await client.callTool("book_pickup", { pickupId });
    client.close();
    return { decision: "already-done" as Decision, detail: JSON.stringify(booked), reconciled: false };
  } catch (error) {
    client.close();
    if (!(error instanceof TransportError)) {
      return { decision: "escalate" as Decision, detail: (error as Error).message, reconciled: false };
    }
  }

  // The write is in doubt. Reconnect and read the state before deciding.
  client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 3000 });
  const state = (await client.callTool("open_warehouse", { warehouse: "berlin-1", status: true })) as {
    pickups: string[];
    booked?: string[];
  };
  client.close();
  return {
    decision: decide(state.booked, pickupId),
    detail: `reconciled from ${JSON.stringify(state)}`,
    reconciled: true,
  };
}

export async function demo() {
  const dir = mkdtempSync(join(tmpdir(), "mcp-reconcile-"));
  process.env.WAREHOUSE_STATE = join(dir, "booked.json");
  process.env.CRASH_ON_BOOK = "1";
  try {
    return await bookWithReconciliation("pick_01");
  } finally {
    process.env.CRASH_ON_BOOK = "0";
    delete process.env.WAREHOUSE_STATE;
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const r = await demo();
  console.log("decision :", r.decision);
  console.log("reconciled:", r.reconciled);
  console.log("detail   :", r.detail);
}
