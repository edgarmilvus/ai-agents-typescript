// Exercise 5 — a result that is not the shape it promised.
//
// The server is allowed to answer with anything. A client that trusts
// `JSON.parse` and a cast will hand the agent a string where a number was
// promised, and the failure surfaces three layers up.

import { McpClient } from "../../mcp/client.ts";
import { validate } from "../../../chapter2/files/schema.ts";
import type { Schema } from "../../../chapter2/files/schema.ts";

export const quoteShape: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["carrier", "total", "currency"],
  properties: {
    carrier: { type: "string" },
    total: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["EUR", "USD", "GBP"] },
    surcharge: { type: "number", minimum: 0 },
  },
};

export class ResultMismatch extends Error {}

export function expectShape(value: unknown, shape: Schema): void {
  const issues = validate(shape, value);
  if (issues.length) {
    throw new ResultMismatch(issues.map((i) => `${i.path}: ${i.message}`).join("; "));
  }
}

export async function demo() {
  process.env.LIE_ON_QUOTE = "1";
  const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
  await client.callTool("open_warehouse", { warehouse: "berlin-1" });

  let mismatch: string | undefined;
  try {
    const quote = await client.callTool("quote_rate", { carrier: "dhl", country: "DE", weightKg: 3.2 });
    expectShape(quote, quoteShape);
  } catch (error) {
    mismatch = (error as Error).message;
  }
  client.close();
  process.env.LIE_ON_QUOTE = "0";
  return { mismatch };
}

if (import.meta.main) {
  const r = await demo();
  console.log("mismatch:", r.mismatch);
}
