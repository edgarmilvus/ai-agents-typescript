// Chapter 20 — three builds of one agent.
//
// `hardcoded` is written against alpha's wire: `delta.text`, `arguments` as a
// JSON string, `done.finish_reason`, usage in the final event. It is what an
// agent looks like when the first provider is the only provider.
//
// `thin` reads the port's normalized events but has no vocabulary for
// capabilities or typed errors: every failure becomes `unknown`.
//
// `contract` reads the port, checks capabilities before the first event, and
// maps the wire errors into the four kinds the agent can branch on.

import type { Finish, Port, Request, Result, Scenario, ToolCall, Usage } from "./port.ts";
import { complete, ModelError } from "./port.ts";

export type Build = "hardcoded" | "thin" | "contract";

export interface Failure {
  kind: string;
  retryAfter?: number;
  message?: string;
}

export type Outcome = { ok: true; result: Result } | { ok: false; error: Failure };

const SYSTEM = "refund policy v3";
const MESSAGES = ["refund A-1"];

function request(scenario: Scenario): Request {
  return {
    system: SYSTEM,
    messages: MESSAGES,
    tools: scenario === "tool" ? ["issue_refund"] : [],
    maxTokens: 200,
  };
}

async function hardcoded(port: Port, scenario: Scenario): Promise<Outcome> {
  // The alpha-shaped request: system in the messages and no maxTokens, because
  // alpha ignores both. Beta requires the field and reads the system elsewhere.
  const req = { system: "", messages: [SYSTEM, ...MESSAGES], tools: request(scenario).tools } as Request;

  let text = "";
  let finish: Finish = "stop";
  let usage: Usage = { input: 0, output: 0 };
  const toolCalls: ToolCall[] = [];
  let callId: string | undefined;

  try {
    for (const event of port.raw(req, scenario)) {
      switch (event.type) {
        case "delta":
          text += event.delta.text;
          break;
        case "tool_call": {
          const args = JSON.parse(event.arguments) as Record<string, unknown>;
          toolCalls.push({ id: event.id, name: event.name, args });
          callId ??= event.id;
          break;
        }
        case "done":
          finish = event.finish_reason as Finish;
          usage = event.usage;
          break;
        case "error":
          throw new Error(event.message);
      }
    }
  } catch (error) {
    return { ok: false, error: { kind: "crash", message: (error as Error).message } };
  }

  return { ok: true, result: { text, toolCalls, finish, usage, callId } };
}

async function thin(port: Port, scenario: Scenario): Promise<Outcome> {
  const result: Result = { text: "", toolCalls: [], finish: "stop", usage: { input: 0, output: 0 } };

  try {
    for await (const event of port.events(request(scenario), scenario)) {
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
  } catch {
    return { ok: false, error: { kind: "unknown" } };
  }

  return { ok: true, result };
}

async function contract(port: Port, scenario: Scenario): Promise<Outcome> {
  try {
    return { ok: true, result: await complete(port, request(scenario), scenario) };
  } catch (error) {
    if (error instanceof ModelError) {
      return { ok: false, error: { kind: error.kind, retryAfter: error.retryAfter, message: error.message } };
    }
    throw error;
  }
}

export function runBuild(build: Build, port: Port, scenario: Scenario): Promise<Outcome> {
  switch (build) {
    case "hardcoded":
      return hardcoded(port, scenario);
    case "thin":
      return thin(port, scenario);
    case "contract":
      return contract(port, scenario);
  }
}
