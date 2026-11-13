// Chapter 3 harness.
//
//   node chapter3/files/run_ex3.ts

import { decode, encode, isRequest, isResponse, ERRORS } from "../mcp/protocol.ts";
import { McpClient, McpError, TransportError } from "../mcp/client.ts";
import { fromJsonSchema, UnsupportedSchema, summarise } from "../mcp/schema.ts";
import { permitted } from "./03_scope.ts";
import { recorded } from "../../lib/scenario.ts";
import { SchemaAgent } from "../../chapter2/files/agent2.ts";
import type { SchemaTool } from "../../chapter2/files/agent2.ts";
import { validate } from "../../chapter2/files/schema.ts";

let checks = 0;
let failures = 0;

function check(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// ------------------------------------------------------------------ 3.1 framing

{
  equal("3.1 a request is encoded with a newline", encode({ jsonrpc: "2.0", id: 1, method: "x" }).endsWith("\n"), true);
  const one = decode('{"jsonrpc":"2.0","id":1,"method":"a"}\n');
  equal("3.1 one frame decodes", one.messages.length, 1);
  equal("3.1 and leaves nothing", one.rest, "");
  const two = decode('{"a":1}\n{"b":2}\n');
  equal("3.1 two frames in one chunk", two.messages.length, 2);
  const half = decode('{"a":1}\n{"b":');
  equal("3.1 a half frame is kept", half.messages.length, 1);
  equal("3.1 and its remainder preserved", half.rest, '{"b":');
  const joined = decode('{"x":1}\n' + '{"y":2}\n');
  equal("3.1 a joined buffer still splits", joined.messages.length, 2);
  check("3.1 isRequest needs an id", isRequest({ jsonrpc: "2.0", method: "a" }) === false);
  check("3.1 isResponse accepts an error", isResponse({ jsonrpc: "2.0", id: 1, error: { code: -1, message: "x" } }));
  equal("3.1 the capability code is MCP's", ERRORS.capabilityNotFound, -32001);
}

// ------------------------------------------------------- 3.2 the server, live

{
  const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
  equal("3.2 handshake names the server", client.serverInfo?.name, "warehouse-mcp");
  check("3.2 capabilities include tools", "tools" in client.capabilities);

  const before = await client.listTools();
  equal("3.2 three tools before a warehouse is open", before.length, 3);
  check("3.2 book_pickup is hidden", !before.some((t) => t.name === "book_pickup"));

  await client.callTool("open_warehouse", { warehouse: "berlin-1" });
  const after = await client.listTools();
  equal("3.2 one tool more after opening", after.length, before.length + 1);
  check("3.2 book_pickup appeared", after.some((t) => t.name === "book_pickup"));

  const quote = (await client.callTool("quote_rate", { carrier: "dhl", country: "DE", weightKg: 3.2 })) as { total: number };
  equal("3.2 the quote is computed by the server", quote.total, 8.34);

  let stateRefusal: McpError | undefined;
  try {
    await client.callTool("book_pickup", { pickupId: "pick_03" });
  } catch (error) {
    stateRefusal = error as McpError;
  }
  equal("3.2 a cross-warehouse pickup is refused", stateRefusal?.code, ERRORS.capabilityNotFound);

  let unknown: McpError | undefined;
  try {
    await client.callTool("nope", {});
  } catch (error) {
    unknown = error as McpError;
  }
  equal("3.2 an unknown tool is method-not-found", unknown?.code, ERRORS.methodNotFound);

  await client.callTool("book_pickup", { pickupId: "pick_01" });
  let twice: McpError | undefined;
  try {
    await client.callTool("book_pickup", { pickupId: "pick_01" });
  } catch (error) {
    twice = error as McpError;
  }
  check("3.2 a second booking is refused", (twice?.message ?? "").includes("already booked"));
  client.close();
}

// ------------------------------------------------------------------ 3.3 scope

{
  const tool = { name: "book_pickup", description: "", inputSchema: {} };
  check("3.3 an allow-list admits only what it names", permitted(tool, { allow: ["quote_rate"], deny: [] }) === false);
  check("3.3 and admits what it names", permitted({ ...tool, name: "quote_rate" }, { allow: ["quote_rate"], deny: [] }) === true);
  check("3.3 deny beats allow", permitted({ ...tool, name: "quote_rate" }, { allow: ["quote_rate"], deny: ["quote_rate"] }) === false);
  check("3.3 an empty allow-list means everything not denied", permitted(tool, { allow: [], deny: [] }) === true);
}

// ------------------------------------------------------------- 3.4 resilience

{
  const read = await (async () => {
    const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
    try {
      return await client.callTool("quote_rate", { carrier: "gls", country: "DE", weightKg: 1 });
    } finally {
      client.close();
    }
  })();
  equal("3.4 a read returns a number", typeof (read as { total: number }).total, "number");

  process.env.CRASH_ON_BOOK = "1";
  let transport: TransportError | undefined;
  try {
    const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
    await client.callTool("open_warehouse", { warehouse: "berlin-1" });
    await client.callTool("book_pickup", { pickupId: "pick_01" });
  } catch (error) {
    transport = error as TransportError;
  }
  process.env.CRASH_ON_BOOK = "0";
  check("3.4 a dying server is a transport error", transport instanceof TransportError);
  check("3.4 and says the process exited", (transport?.message ?? "").includes("exited"));
}

// ------------------------------------------------------- 3.5 schema translation

{
  const nested = fromJsonSchema({
    type: "object",
    required: ["a"],
    additionalProperties: false,
    properties: { a: { type: "string", pattern: "^x" }, b: { type: "array", items: { type: "integer", minimum: 1 } } },
  });
  equal("3.5 a nested schema survives", validate(nested, { a: "xy", b: [1, 2] }).length, 0);
  equal("3.5 and refuses what it should", validate(nested, { a: "no", b: [0] }).length, 2);
  check("3.5 enum preserved", JSON.stringify(fromJsonSchema({ type: "string", enum: ["a", "b"] })).includes('"enum":["a","b"]'));
  check("3.5 union types are refused, not guessed", (() => {
    try { fromJsonSchema({ type: ["string", "null"] }); return false; } catch (e) { return e instanceof UnsupportedSchema; }
  })());
  const s = summarise([
    { name: "ok", inputSchema: { type: "object", properties: {} } },
    { name: "bad", inputSchema: { type: "object", properties: { x: { anyOf: [{ type: "string" }] } } } },
  ]);
  equal("3.5 one tool translates", s.ok, ["ok"]);
  check("3.5 and the other is reported", s.refused[0].startsWith("bad:"));
}

// ---------------------------------------------------------- 3.5 the live run

{
  const client = await McpClient.start("node", ["chapter3/mcp/server.ts"], { timeoutMs: 4000 });
  const offered = await client.listTools();
  const tools: SchemaTool[] = offered.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input: fromJsonSchema(tool.inputSchema),
    run: (args) => client.callTool(tool.name, args as Record<string, unknown>).then((v) => JSON.stringify(v)),
  }));

  const run = await new SchemaAgent(recorded("ch3-mcp"), tools, { maxSteps: 6 }).run(
    "You are the outbound coordinator. In warehouse berlin-1, pick the cheapest carrier for pickup pick_01 " +
      "and book it, but only if the quote is under 10 EUR. If it is not, say so and do nothing.",
  );

  check("3.5 the recorded run finished", run.stopReason === "answered", run.stopReason);
  check("3.5 it discovered the warehouse first", run.attempts[0].call.name === "open_warehouse");
  check("3.5 it asked the server for a quote", run.attempts.some((a) => a.call.name === "quote_rate"));
  check("3.5 it never booked, because 10.00 is not under 10", !run.attempts.some((a) => a.call.name === "book_pickup"));
  check("3.5 the answer says so", /not book|did not|under/i.test(run.answer), run.answer.slice(0, 90));
  client.close();
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
