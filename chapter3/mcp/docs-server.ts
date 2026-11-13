// Chapter 3 — a second MCP server, same protocol, different business.
//
// Nothing here is shared with the warehouse server except protocol.ts. That is
// the point: if the client only works against one server, it is not a client,
// it is a script.

import { createInterface } from "node:readline";

import { ERRORS, encode, isRequest } from "./protocol.ts";
import type { Request, Response } from "./protocol.ts";

interface Doc {
  id: string;
  title: string;
  body: string;
}

const DOCS: Doc[] = [
  {
    id: "doc_style",
    title: "Outbound style guide",
    body:
      "Carrier choice: use the cheapest compliant carrier. Compliance: DHL and GLS for DE, UPS for NL. " +
      "Pickups must be booked the same day. A quote is compliant only if it is strictly below the cap in the rate card.",
  },
  {
    id: "doc_rates",
    title: "Rate card 2026",
    body: "Caps for outbound: DE 12 EUR, NL 18 EUR. Surcharge above 20 kg is 12 EUR and counts against the cap.",
  },
  {
    id: "doc_returns",
    title: "Returns policy",
    body: "Returns are accepted within 14 days of delivery. Refunds are issued against the original invoice.",
  },
];

let openDoc: string | null = null;

class RpcFailure extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function tools() {
  const base = [
    {
      name: "search",
      description: "Search the internal documents by keyword. Returns id and title.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: { query: { type: "string", minLength: 2 } },
      },
    },
    {
      name: "open_doc",
      description: "Open a document by id. Required before summarise_doc.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["id"],
        properties: { id: { type: "string", pattern: "^doc_[a-z]+$" } },
      },
    },
  ];
  if (!openDoc) return base;
  return [
    ...base,
    {
      name: "summarise_doc",
      description: "Summarise the open document in one sentence. Refused when nothing is open.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
    },
  ];
}

function call(name: string, args: Record<string, unknown>): unknown {
  if (name === "search") {
    const q = String(args.query).toLowerCase();
    const hits = DOCS.filter((d) => d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q));
    return hits.map((d) => ({ id: d.id, title: d.title }));
  }
  if (name === "open_doc") {
    const doc = DOCS.find((d) => d.id === String(args.id));
    if (!doc) throw new RpcFailure(ERRORS.invalidParams, `unknown document ${String(args.id)}`);
    openDoc = doc.id;
    return { id: doc.id, title: doc.title, body: doc.body };
  }
  if (name === "summarise_doc") {
    if (!openDoc) throw new RpcFailure(ERRORS.capabilityNotFound, "no document is open; call open_doc first");
    const doc = DOCS.find((d) => d.id === openDoc);
    const sentence = doc ? doc.body.split(".")[0] + "." : "";
    return { id: openDoc, summary: sentence };
  }
  throw new RpcFailure(ERRORS.methodNotFound, `unknown tool ${name}`);
}

function handle(message: Request): Response | null {
  try {
    switch (message.method) {
      case "initialize":
        return { jsonrpc: "2.0", id: message.id, result: {
          protocolVersion: "2026-06-18",
          serverInfo: { name: "docs-mcp", version: "0.2.0" },
          capabilities: { tools: {}, resources: {} },
        } };
      case "tools/list":
        return { jsonrpc: "2.0", id: message.id, result: { tools: tools() } };
      case "resources/list":
        return { jsonrpc: "2.0", id: message.id, result: {
          resources: [{ uri: "docs://style-guide", name: "Outbound style guide", mimeType: "text/plain" }],
        } };
      case "resources/read":
        return { jsonrpc: "2.0", id: message.id, result: {
          contents: [{ uri: "docs://style-guide", mimeType: "text/plain", text: DOCS[0].body }],
        } };
      case "tools/call": {
        const params = message.params as { name?: string; arguments?: Record<string, unknown> } | undefined;
        const name = params?.name ?? "";
        if (!tools().some((t) => t.name === name)) {
          throw new RpcFailure(ERRORS.methodNotFound, `unknown tool ${name}`);
        }
        const result = call(name, params?.arguments ?? {});
        return { jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } };
      }
      default:
        throw new RpcFailure(ERRORS.methodNotFound, `unknown method ${message.method}`);
    }
  } catch (error) {
    const failure = error as RpcFailure;
    return { jsonrpc: "2.0", id: message.id, error: { code: failure.code ?? ERRORS.internal, message: failure.message } };
  }
}

const input = createInterface({ input: process.stdin });
input.on("line", (line) => {
  if (!line.trim()) return;
  let parsed: unknown;
  try { parsed = JSON.parse(line); } catch { return; }
  if (isRequest(parsed)) {
    const response = handle(parsed);
    if (response) process.stdout.write(encode(response));
  }
});
input.on("close", () => process.exit(0));
