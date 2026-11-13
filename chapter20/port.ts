// Chapter 20 — the port: one event vocabulary, one error vocabulary.
//
// A provider is a wire format, a set of capabilities and a taxonomy of
// failures. The agent needs none of those; it needs text, tool calls, a finish
// reason, usage and a typed error. This file is that smaller vocabulary, and
// everything above it is written against it.

export type Scenario = "text" | "tool" | "rate" | "context";

export interface Request {
  system: string;
  messages: string[];
  tools: string[];
  /** The completion budget. Every provider spells it differently. */
  maxTokens: number;
}

export type Capability = "tools" | "streaming";

export interface Capabilities {
  tools: boolean;
  streaming: boolean;
}

/** The four reasons a completion can end, in the agent's vocabulary. */
export type Finish = "stop" | "tool_call" | "length" | "refusal";

export interface Usage {
  input: number;
  output: number;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * The raw events a provider sends.
 *
 * This union is deliberately ugly: it is the wire, and the wire is allowed to
 * be ugly. Nothing above `adapters.ts` imports this type.
 */
export type RawEvent =
  | { type: "delta"; delta: { text: string } }
  | { type: "tool_call"; id: string; name: string; arguments: string }
  | { type: "done"; finish_reason: string; usage: Usage }
  | { type: "text"; delta: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "usage"; input_tokens: number; output_tokens: number }
  | { type: "end"; stop_reason: string }
  | { type: "message"; content: string; stop: string }
  | { type: "error"; code: string; retry_after?: number; message: string };

/** The normalized event, which is what the agent consumes. */
export type ModelEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "usage"; usage: Usage }
  | { type: "finish"; finish: Finish };

/** A provider error, still in the provider's words. */
export class WireError extends Error {
  code: string;
  retryAfter?: number;

  constructor(code: string, retryAfter?: number, message = code) {
    super(message);
    this.name = "WireError";
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export type ErrorKind = "rate_limit" | "context" | "unsupported" | "wire";

/** A model error, in the agent's words. */
export class ModelError extends Error {
  kind: ErrorKind;
  retryAfter?: number;

  constructor(kind: ErrorKind, message: string, retryAfter?: number) {
    super(message);
    this.name = "ModelError";
    this.kind = kind;
    this.retryAfter = retryAfter;
  }
}

export class Unsupported extends ModelError {
  constructor(capability: Capability) {
    super("unsupported", `this model does not support ${capability}`);
    this.name = "Unsupported";
  }
}

export interface Result {
  text: string;
  toolCalls: ToolCall[];
  finish: Finish;
  usage: Usage;
  /** The id of the first tool call, echoed for the tool result. */
  callId?: string;
}

/**
 * The port itself.
 *
 * `raw` exists for the coupled build, which is the point: the leak the chapter
 * measures is code that reads this method. A port with no raw escape hatch
 * would make the bug impossible to write, and the bug is what the first column
 * of the matrix is.
 */
export interface Port {
  name: string;
  capabilities: Capabilities;
  raw(req: Request, scenario: Scenario): RawEvent[];
  events(req: Request, scenario: Scenario): AsyncGenerator<ModelEvent>;
}

const FINISHES: Record<string, Finish> = {
  stop: "stop",
  end_turn: "stop",
  end: "stop",
  tool_use: "tool_call",
  tool_call: "tool_call",
  length: "length",
  max_tokens: "length",
  refusal: "refusal",
};

export function finishOf(reason: string): Finish {
  return FINISHES[reason] ?? "stop";
}

export function mapError(error: WireError): ModelError {
  switch (error.code) {
    case "rate_limit":
      return new ModelError("rate_limit", "the provider is rate limiting", error.retryAfter);
    case "context_length_exceeded":
      return new ModelError("context", "the request is longer than the context window");
    default:
      return new ModelError("wire", error.message);
  }
}

/**
 * Read a port to the end and return one result.
 *
 * The capability check is before the first event on purpose: a model that
 * cannot call tools should fail before it is asked to, with an error the caller
 * can branch on, rather than return an answer that quietly ignored the tools.
 */
export async function complete(port: Port, req: Request, scenario: Scenario): Promise<Result> {
  if (req.tools.length > 0 && !port.capabilities.tools) throw new Unsupported("tools");

  const result: Result = {
    text: "",
    toolCalls: [],
    finish: "stop",
    usage: { input: 0, output: 0 },
  };

  try {
    for await (const event of port.events(req, scenario)) {
      switch (event.type) {
        case "text":
          result.text += event.text;
          break;
        case "tool_call":
          result.toolCalls.push(event.call);
          result.callId ??= event.call.id;
          break;
        case "usage":
          result.usage.input += event.usage.input;
          result.usage.output += event.usage.output;
          break;
        case "finish":
          result.finish = event.finish;
          break;
      }
    }
  } catch (error) {
    if (error instanceof WireError) throw mapError(error);
    throw error;
  }

  return result;
}
