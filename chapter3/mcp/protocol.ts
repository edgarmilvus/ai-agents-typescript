// Chapter 3 — the wire.
//
// MCP's stdio transport is JSON-RPC 2.0, one message per line, UTF-8. That is
// the whole framing: no length prefix, no delimiter negotiation. Reading and
// writing it by hand is about sixty lines, and those sixty lines are the
// chapter's subject — a boundary you can see is a boundary you can debug.

export type JsonRpcId = number | string;

export interface Request {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface Notification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface Response {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: RpcError;
}

/** The error codes this book uses, named rather than numeric at the call site. */
export const ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  /** MCP's own: the server understood, but the capability is not available. */
  capabilityNotFound: -32001,
  resourceNotFound: -32002,
} as const;

export function isRequest(value: unknown): value is Request {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.jsonrpc === "2.0" && typeof v.method === "string" && "id" in v;
}

export function isNotification(value: unknown): value is Notification {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.jsonrpc === "2.0" && typeof v.method === "string" && !("id" in v);
}

export function isResponse(value: unknown): value is Response {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.jsonrpc === "2.0" && "id" in v && ("result" in v || "error" in v);
}

/**
 * Encode one message. `JSON.stringify` cannot emit a newline inside a string
 * value, so a single append is a complete frame — which is exactly why the
 * transport chose lines over a length prefix.
 */
export function encode(message: Request | Notification | Response): string {
  return JSON.stringify(message) + "\n";
}

export interface Decoded {
  messages: unknown[];
  rest: string;
}

/**
 * Split a buffer into complete messages, keeping the remainder.
 *
 * A reader that assumes one `data` event is one message works in testing and
 * fails under load, when the OS hands over three frames in one chunk or half
 * a frame in two. This function is the difference between a demo and a client.
 */
export function decode(buffer: string): Decoded {
  const messages: unknown[] = [];
  let rest = buffer;
  for (;;) {
    const newline = rest.indexOf("\n");
    if (newline < 0) break;
    const line = rest.slice(0, newline).trim();
    rest = rest.slice(newline + 1);
    if (!line) continue;
    messages.push(JSON.parse(line));
  }
  return { messages, rest };
}
