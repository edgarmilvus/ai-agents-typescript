// Chapter 20 — three providers, one port.
//
// Alpha and beta are the same model with different wires. Alpha streams
// `{delta:{text}}`, sends tool arguments as a JSON string and reports usage in
// the final event. Beta streams `{text:"..."}`, sends tool arguments as an
// object, reports usage on every event and calls the finish reason `end_turn`.
//
// Gamma is the capability case: it answers, and it cannot call tools.
//
// The adapters are where the wire vocabulary is translated. Nothing above this
// file sees `delta`, `end_turn`, `input_tokens` or `max_output_tokens`.

import type { Capabilities, ModelEvent, Port, RawEvent, Request, Scenario } from "./port.ts";
import { finishOf, WireError } from "./port.ts";

const USAGE = { input: 12, output: 18 };

function errorFor(scenario: Scenario): RawEvent {
  if (scenario === "rate") {
    return { type: "error", code: "rate_limit", retry_after: 2, message: "slow down" };
  }
  return {
    type: "error",
    code: "context_length_exceeded",
    message: "the request is longer than the context window",
  };
}

function alphaRaw(req: Request, scenario: Scenario): RawEvent[] {
  if (scenario === "rate" || scenario === "context") return [errorFor(scenario)];
  if (scenario === "tool") {
    return [
      { type: "delta", delta: { text: "I will refund. " } },
      { type: "tool_call", id: "call_1", name: "issue_refund", arguments: '{"orderId":"A-1"}' },
      { type: "done", finish_reason: "tool_use", usage: USAGE },
    ];
  }
  return [
    { type: "delta", delta: { text: "The refund " } },
    { type: "delta", delta: { text: "is within " } },
    { type: "delta", delta: { text: "the window." } },
    { type: "done", finish_reason: "stop", usage: USAGE },
  ];
}

function betaRaw(req: Request, scenario: Scenario): RawEvent[] {
  if (scenario === "rate" || scenario === "context") return [errorFor(scenario)];

  // A required field with a different name is the most common migration bug.
  if (!req.maxTokens || req.maxTokens <= 0) {
    return [
      { type: "error", code: "invalid_request", message: "max_output_tokens is required" },
    ];
  }

  const usage = { type: "usage", input_tokens: 4, output_tokens: 6 } as const;
  if (scenario === "tool") {
    return [
      { type: "text", delta: "I will refund. " },
      { type: "tool_use", id: "call_1", name: "issue_refund", input: { orderId: "A-1" } },
      usage,
      usage,
      usage,
      { type: "end", stop_reason: "tool_call" },
    ];
  }
  const policy = req.system.includes("refund policy") ? " Policy applies." : "";
  return [
    { type: "text", delta: "The refund " },
    { type: "text", delta: "is within " },
    { type: "text", delta: `the window.${policy}` },
    usage,
    usage,
    usage,
    { type: "end", stop_reason: "end_turn" },
  ];
}

function gammaRaw(_req: Request, scenario: Scenario): RawEvent[] {
  if (scenario === "rate" || scenario === "context") return [errorFor(scenario)];
  return [
    { type: "message", content: "Gamma can answer, but it cannot call tools.", stop: "end" },
  ];
}

function normalize(event: RawEvent): ModelEvent[] {
  switch (event.type) {
    case "delta":
      return [{ type: "text", text: event.delta.text }];
    case "text":
      return [{ type: "text", text: event.delta }];
    case "tool_call":
      return [
        {
          type: "tool_call",
          call: { id: event.id, name: event.name, args: safeParse(event.arguments) },
        },
      ];
    case "tool_use":
      return [{ type: "tool_call", call: { id: event.id, name: event.name, args: event.input } }];
    case "usage":
      return [{ type: "usage", usage: { input: event.input_tokens, output: event.output_tokens } }];
    case "done":
      return [
        { type: "usage", usage: event.usage },
        { type: "finish", finish: finishOf(event.finish_reason) },
      ];
    case "end":
      return [{ type: "finish", finish: finishOf(event.stop_reason) }];
    case "message":
      return [
        { type: "text", text: event.content },
        { type: "finish", finish: finishOf(event.stop) },
      ];
    case "error":
      return [];
  }
}

function safeParse(source: string): Record<string, unknown> {
  try {
    return JSON.parse(source) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function makePort(
  name: string,
  capabilities: Capabilities,
  raw: (req: Request, scenario: Scenario) => RawEvent[],
): Port {
  return {
    name,
    capabilities,
    raw,
    async *events(req, scenario) {
      for (const event of raw(req, scenario)) {
        if (event.type === "error") throw new WireError(event.code, event.retry_after, event.message);
        yield* normalize(event);
      }
    },
  };
}

export const alpha: Port = makePort("alpha", { tools: true, streaming: true }, alphaRaw);
export const beta: Port = makePort("beta", { tools: true, streaming: true }, betaRaw);
export const gamma: Port = makePort("gamma", { tools: false, streaming: false }, gammaRaw);

export const PORTS: Record<string, Port> = { alpha, beta, gamma };
