// Chapter 3 — a real MCP server, hand-written, over stdio.
//
// Three tools and one resource. The point of writing it by hand is that every
// part of the boundary is visible: the handshake, the capability list, the
// precondition that hides a tool, the refusal codes, and the shape of a result.

import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { ERRORS, encode, isRequest } from "./protocol.ts";
import type { Notification, Request, Response } from "./protocol.ts";

interface Parcel {
  weightKg: number;
}

interface Pickup {
  id: string;
  warehouse: string;
  carrier: string;
  country: string;
  parcels: Parcel[];
  booked: boolean;
}

const WAREHOUSES = ["berlin-1", "rotterdam-2"];
const RATES: Record<string, number> = { dhl: 1.2, ups: 1.35, gls: 1.1 };

const pickups: Pickup[] = [
  { id: "pick_01", warehouse: "berlin-1", carrier: "dhl", country: "DE", parcels: [{ weightKg: 3.2 }], booked: false },
  { id: "pick_02", warehouse: "berlin-1", carrier: "gls", country: "DE", parcels: [{ weightKg: 12 }], booked: false },
  { id: "pick_03", warehouse: "rotterdam-2", carrier: "ups", country: "NL", parcels: [{ weightKg: 30 }], booked: false },
];

/**
 * Optional durable state for the crash test: a list of booked pickup ids.
 * When `WAREHOUSE_STATE` is set, a server that dies after committing leaves
 * the booking behind for the server the client reconnects to. It is a test
 * hook, not a production store.
 */
const STATE = process.env.WAREHOUSE_STATE;
if (STATE) {
  try {
    const booked = JSON.parse(readFileSync(STATE, "utf8")) as string[];
    for (const p of pickups) if (booked.includes(p.id)) p.booked = true;
  } catch {
    // No state yet: the first process of the crash test starts clean.
  }
}

function persist(): void {
  if (!STATE) return;
  writeFileSync(STATE, JSON.stringify(pickups.filter((p) => p.booked).map((p) => p.id)));
}

/** Session state: which warehouse this client opened. */
let openWarehouse: string | null = null;

const TOOLS = [
  {
    name: "open_warehouse",
    description:
      "Open a warehouse session. Returns the pickup ids available there. Tools that act on a warehouse are hidden until one is open.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["warehouse"],
      properties: {
        warehouse: { type: "string", enum: WAREHOUSES, description: "warehouse id" },
        status: { type: "boolean", description: "include the ids already booked in this warehouse" },
      },
    },
  },
  {
    name: "search",
    description: "Search pickups in the open warehouse by id fragment. Returns id and carrier.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: { query: { type: "string", minLength: 2 } },
    },
  },
  {
    name: "quote_rate",
    description: "Quote a carrier rate for one parcel. Returns the price in EUR and the surcharge, if any.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["carrier", "country", "weightKg"],
      properties: {
        carrier: { type: "string", enum: Object.keys(RATES) },
        country: { type: "string", pattern: "^[A-Z]{2}$" },
        weightKg: { type: "number", minimum: 0.1, maximum: 31.5 },
      },
    },
  },
  {
    name: "book_pickup",
    description:
      "Book a pickup in the open warehouse. Refused when no warehouse is open, when the pickup is in another warehouse, or when it is already booked.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["pickupId"],
      properties: { pickupId: { type: "string", pattern: "^pick_[0-9]{2}$" } },
    },
    /** Hidden until a warehouse is open — the precondition this chapter is about. */
    requiresWarehouse: true,
  },
];

function toolsFor(): unknown[] {
  return TOOLS.filter((t) => !t.requiresWarehouse || openWarehouse !== null).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

function callTool(name: string, args: Record<string, unknown>): unknown {
  // A server that answers with the wrong shape on purpose: exercise 5's subject.
  if (process.env.LIE_ON_QUOTE === "1" && name === "quote_rate") {
    return "about eight euros";
  }
  if (name === "open_warehouse") {
    const warehouse = String(args.warehouse);
    if (!WAREHOUSES.includes(warehouse)) {
      throw new RpcFailure(ERRORS.invalidParams, `unknown warehouse ${warehouse}; one of ${WAREHOUSES.join(", ")}`);
    }
    openWarehouse = warehouse;
    const ids = pickups.filter((p) => p.warehouse === warehouse).map((p) => p.id);
    const booked = pickups.filter((p) => p.warehouse === warehouse && p.booked).map((p) => p.id);
    return { warehouse, pickups: ids, ...(args.status === true ? { booked } : {}) };
  }

  if (name === "search") {
    const q = String(args.query).toLowerCase();
    return pickups
      .filter((p) => p.warehouse === openWarehouse && p.id.toLowerCase().includes(q))
      .map((p) => ({ id: p.id, carrier: p.carrier }));
  }

  if (name === "quote_rate") {
    const carrier = String(args.carrier);
    const weight = Number(args.weightKg);
    const base = RATES[carrier];
    if (!base) throw new RpcFailure(ERRORS.invalidParams, `unknown carrier ${carrier}`);
    const surcharge = weight > 20 ? 12 : 0;
    return { carrier, country: args.country, weightKg: weight, total: Number((4.5 + weight * base + surcharge).toFixed(2)), currency: "EUR", surcharge };
  }

  if (name === "book_pickup") {
    if (!openWarehouse) {
      throw new RpcFailure(ERRORS.capabilityNotFound, "no warehouse is open; call open_warehouse first");
    }
    const pickup = pickups.find((p) => p.id === String(args.pickupId));
    if (!pickup) throw new RpcFailure(ERRORS.invalidParams, `unknown pickup ${String(args.pickupId)}`);
    if (pickup.warehouse !== openWarehouse) {
      throw new RpcFailure(ERRORS.capabilityNotFound, `pickup ${pickup.id} belongs to ${pickup.warehouse}, not ${openWarehouse}`);
    }
    if (pickup.booked) throw new RpcFailure(ERRORS.capabilityNotFound, `pickup ${pickup.id} is already booked`);
    pickup.booked = true;
    persist();
    return { pickupId: pickup.id, carrier: pickup.carrier, status: "booked" };
  }

  throw new RpcFailure(ERRORS.methodNotFound, `unknown tool ${name}`);
}

class RpcFailure extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function handle(message: Request): Response | null {
  try {
    switch (message.method) {
      case "initialize":
        return reply(message.id, {
          protocolVersion: "2026-06-18",
          serverInfo: { name: "warehouse-mcp", version: "0.3.0" },
          capabilities: { tools: { listChanged: true }, resources: {} },
        });
      case "tools/list":
        return reply(message.id, { tools: toolsFor() });
      case "resources/list":
        return reply(message.id, {
          resources: [
            { uri: "warehouse://rates", name: "Carrier rates", mimeType: "application/json" },
          ],
        });
      case "resources/read":
        return reply(message.id, {
          contents: [{ uri: "warehouse://rates", mimeType: "application/json", text: JSON.stringify(RATES) }],
        });
      case "tools/call": {
        const params = message.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
        const name = params?.name ?? "";
        if (!TOOLS.some((t) => t.name === name)) {
          throw new RpcFailure(ERRORS.methodNotFound, `unknown tool ${name}`);
        }
        // A server that dies after committing but before replying: the case
        // that makes "retry" a decision rather than a reflex.
        if (process.env.CRASH_ON_BOOK === "1" && name === "book_pickup") {
          callTool(name, params?.arguments ?? {});
          process.exit(70);
        }
        const result = callTool(name, params?.arguments ?? {});
        return reply(message.id, { content: [{ type: "text", text: JSON.stringify(result) }] });
      }
      default:
        throw new RpcFailure(ERRORS.methodNotFound, `unknown method ${message.method}`);
    }
  } catch (error) {
    const failure = error as RpcFailure;
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: { code: failure.code ?? ERRORS.internal, message: failure.message },
    };
  }
}

function reply(id: Request["id"], result: unknown): Response {
  return { jsonrpc: "2.0", id, result };
}

// ------------------------------------------------------------------ the loop

const input = createInterface({ input: process.stdin });
let buffer = "";

input.on("line", (line) => {
  buffer += line + "\n";
  const messages = buffer.split("\n");
  buffer = messages.pop() ?? "";
  for (const raw of messages) {
    if (!raw.trim()) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      process.stdout.write(encode({ jsonrpc: "2.0", id: 0, error: { code: ERRORS.parse, message: "invalid JSON" } } as Response));
      continue;
    }
    if (isRequest(parsed)) {
      const response = handle(parsed);
      if (response) process.stdout.write(encode(response));
    } else if ((parsed as Notification).method) {
      // notifications/initialized and friends: no reply, by definition.
    }
  }
});

input.on("close", () => process.exit(0));
