// Chapter 1 — the loop, the state, the tool surface.
//
// This file is the whole idea of an agent in about a hundred lines: a model
// that can ask for a tool, a registry that runs it, and a loop that keeps
// going until the model answers instead of asking. Everything later in the
// book is this loop with better manners.

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  /** Set on tool results, so a model can match a result to its call. */
  toolCallId?: string;
  /** Set on tool results and on the assistant turn that requested them. */
  toolName?: string;
  /** The calls the assistant asked for, kept so a provider adapter can rebuild the turn. */
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  /**
   * Provider-specific payload that must be echoed back verbatim (a thought
   * signature or a provider call id, for instance). The loop never reads it; the adapter
   * does. Keeping it here is what lets a transcript be replayed to the same
   * provider later in the run.
   */
  raw?: unknown;
}

export interface ModelReply {
  text?: string;
  toolCalls?: ToolCall[];
}

export interface Model {
  readonly name: string;
  step(messages: readonly Message[], tools: readonly ToolSpec[]): Promise<ModelReply>;
}

export type ParamType = "string" | "number" | "boolean";

export interface ParamSpec {
  type: ParamType;
  required?: boolean;
  description?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  params: Record<string, ParamSpec>;
  run(input: Record<string, unknown>): Promise<string> | string;
}

export interface ToolError {
  ok: false;
  errors: string[];
}

export type Validated = { ok: true; value: Record<string, unknown> } | ToolError;

/**
 * The whole validation surface: a tool declares its parameters, and this
 * function is the only thing that decides whether a model-supplied object is
 * allowed to reach `run`. It never throws and never guesses.
 */
export function validate(spec: ToolSpec, raw: unknown): Validated {
  const errors: string[] = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["arguments must be an object"] };
  }
  const given = raw as Record<string, unknown>;
  const value: Record<string, unknown> = {};

  for (const [key, param] of Object.entries(spec.params)) {
    const present = Object.hasOwn(given, key);
    if (!present) {
      if (param.required) errors.push(`missing required argument "${key}"`);
      continue;
    }
    const v = given[key];
    const got = typeof v;
    if (got !== param.type) {
      errors.push(`"${key}" must be ${param.type}, got ${got}`);
      continue;
    }
    if (param.type === "number" && !Number.isFinite(v as number)) {
      errors.push(`"${key}" must be a finite number`);
      continue;
    }
    value[key] = v;
  }

  for (const key of Object.keys(given)) {
    if (!Object.hasOwn(spec.params, key)) errors.push(`unknown argument "${key}"`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export interface Step {
  index: number;
  call: ToolCall;
  /** What the loop wrote back into the transcript for this call. */
  result: string;
  ms: number;
}

export type StopReason = "answered" | "step_limit";

export interface Run {
  answer: string;
  steps: Step[];
  transcript: Message[];
  stopReason: StopReason;
  /** Sum of the tool execution times, in milliseconds. */
  toolMs: number;
}

export interface AgentOptions {
  maxSteps?: number;
  /** Called after every tool result; handy for logs and for tests. */
  onStep?: (step: Step) => void;
}

export class Agent {
  model: Model;
  tools: ToolSpec[];
  maxSteps: number;
  onStep: ((step: Step) => void) | undefined;

  constructor(model: Model, tools: ToolSpec[], options: AgentOptions = {}) {
    this.model = model;
    this.tools = tools;
    this.maxSteps = options.maxSteps ?? 8;
    this.onStep = options.onStep;
  }

  find(name: string): ToolSpec | undefined {
    return this.tools.find((t) => t.name === name);
  }

  /**
   * The loop. One turn of the model, zero or more tool calls, repeat.
   *
   * A tool that is not in the registry, or whose arguments do not validate,
   * never runs: the model is told what was wrong, in the transcript, and gets
   * another turn. That is the difference between an agent that degrades and
   * one that crashes.
   */
  async run(task: string): Promise<Run> {
    const transcript: Message[] = [{ role: "user", content: task }];
    const steps: Step[] = [];
    let toolMs = 0;

    for (let i = 0; i < this.maxSteps; i += 1) {
      const reply = await this.model.step(transcript, this.tools);

      if (!reply.toolCalls || reply.toolCalls.length === 0) {
        transcript.push({ role: "assistant", content: reply.text ?? "" });
        return { answer: reply.text ?? "", steps, transcript, stopReason: "answered", toolMs };
      }

      transcript.push({
        role: "assistant",
        content: reply.text ?? "",
        toolName: reply.toolCalls.map((c) => c.name).join(","),
        toolCalls: reply.toolCalls,
      });

      for (const call of reply.toolCalls) {
        const started = performance.now();
        const tool = this.find(call.name);
        let result: string;

        if (!tool) {
          result = `Error: no tool named "${call.name}". Available: ${this.tools
            .map((t) => t.name)
            .join(", ")}.`;
        } else {
          const checked = validate(tool, call.args);
          if (!checked.ok) {
            result = `Error: invalid arguments — ${checked.errors.join("; ")}.`;
          } else {
            try {
              result = await tool.run(checked.value);
            } catch (error) {
              result = `Error: ${(error as Error).message}`;
            }
          }
        }

        const ms = performance.now() - started;
        toolMs += ms;
        const step: Step = { index: steps.length, call, result, ms };
        steps.push(step);
        this.onStep?.(step);
        transcript.push({ role: "tool", content: result, toolCallId: call.id, toolName: call.name });
      }
    }

    return {
      answer: `Stopped after ${this.maxSteps} steps without a final answer.`,
      steps,
      transcript,
      stopReason: "step_limit",
      toolMs,
    };
  }
}

/**
 * A model whose replies are written down in advance.
 *
 * Not a mock in the mocking-library sense: it is a *recording*, and the point
 * of chapter 4 is that a recorded agent run is a test you can keep. It also
 * makes every assertion in this chapter deterministic and free.
 */
export class ReplayModel implements Model {
  readonly name = "replay";
  private replies: ModelReply[];
  /** Every call the loop made, with the transcript it saw at the time. */
  readonly calls: { messages: Message[]; toolNames: string[] }[] = [];

  constructor(replies: ModelReply[]) {
    this.replies = [...replies];
  }

  async step(messages: readonly Message[], tools: readonly ToolSpec[]): Promise<ModelReply> {
    this.calls.push({
      messages: messages.map((m) => ({ ...m })),
      toolNames: tools.map((t) => t.name),
    });
    const next = this.replies.shift();
    if (!next) throw new Error("ReplayModel ran out of replies");
    return next;
  }
}

export function toolCall(name: string, args: unknown, id = `call_${name}`): ToolCall {
  return { id, name, args };
}
