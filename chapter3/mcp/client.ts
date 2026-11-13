// Chapter 3 — an MCP client, hand-written.
//
// Spawn the server, speak JSON-RPC over its stdio, and treat every reply as
// untrusted. Three things this client does that a naive one does not:
// it frames correctly across chunk boundaries, it times out, and it refuses a
// result whose shape does not match what the server promised.

import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

import { ERRORS, encode, isResponse } from "./protocol.ts";
import type { JsonRpcId, Request, Response } from "./protocol.ts";

export interface ToolDescription {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export class McpError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/** A failure of the channel, not a decision by the server. */
export class TransportError extends McpError {}

export interface ClientOptions {
  /** Milliseconds before a pending request is failed. */
  timeoutMs?: number;
  onStderr?: (line: string) => void;
}

export class McpClient {
  private child: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<JsonRpcId, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private timeoutMs: number;
  serverInfo: { name: string; version: string } | null = null;
  capabilities: Record<string, unknown> = {};

  private constructor(child: ChildProcessWithoutNullStreams, options: ClientOptions = {}) {
    this.child = child;
    this.timeoutMs = options.timeoutMs ?? 5_000;

    const out = createInterface({ input: child.stdout });
    out.on("line", (line) => this.onLine(line));
    if (options.onStderr) {
      const err = createInterface({ input: child.stderr });
      err.on("line", options.onStderr);
    }
    child.on("exit", (code) => this.onExit(code));
  }

  static async start(command: string, args: string[], options: ClientOptions = {}): Promise<McpClient> {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const client = new McpClient(child, options);
    await client.initialize();
    return client;
  }

  /** The handshake: initialize, then tell the server we are initialised. */
  async initialize(): Promise<void> {
    const result = (await this.request("initialize", {
      protocolVersion: "2026-06-18",
      clientInfo: { name: "chapter3", version: "1.0.0" },
      capabilities: {},
    })) as { serverInfo?: { name: string; version: string }; capabilities?: Record<string, unknown> };
    this.serverInfo = result.serverInfo ?? null;
    this.capabilities = result.capabilities ?? {};
    this.notify("notifications/initialized");
  }

  /** What the server says it can do — and it may change between calls. */
  async listTools(): Promise<ToolDescription[]> {
    const result = (await this.request("tools/list")) as { tools?: ToolDescription[] };
    return result.tools ?? [];
  }

  /**
   * Call a tool.
   *
   * A JSON-RPC error is a refusal from the server; a `result` whose content is
   * not text is a protocol violation. Both throw, with different codes, because
   * the caller's response to each is different.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = (await this.request("tools/call", { name, arguments: args })) as {
      content?: { type: string; text?: string }[];
      isError?: boolean;
    };
    const text = result.content?.find((c) => c.type === "text")?.text;
    if (text === undefined) {
      throw new McpError(ERRORS.internal, `tool ${name} returned no text content`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new McpError(ERRORS.internal, `tool ${name} returned non-JSON text: ${text.slice(0, 80)}`);
    }
    if (result.isError) throw new McpError(ERRORS.internal, `tool ${name} failed: ${text.slice(0, 120)}`);
    return parsed;
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const message: Request = { jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new TransportError(ERRORS.internal, `${method} timed out after ${this.timeoutMs} ms`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(encode(message));
    });
  }

  notify(method: string, params?: unknown): void {
    this.child.stdin.write(encode({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) }));
  }

  close(): void {
    for (const [, p] of this.pending) clearTimeout(p.timer);
    this.pending.clear();
    this.child.stdin.end();
    this.child.kill();
  }

  private onLine(line: string): void {
    if (!line.trim()) return;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      return; // a server that writes logs to stdout is a server with a bug
    }
    if (!isResponse(message)) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new McpError(message.error.code, message.error.message));
    else pending.resolve(message.result);
  }

  private onExit(code: number | null): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new TransportError(ERRORS.internal, `server exited with code ${code}`));
    }
    this.pending.clear();
  }
}
