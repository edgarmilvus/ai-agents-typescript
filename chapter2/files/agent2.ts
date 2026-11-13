// Chapter 2 — the chapter 1 loop, with a real schema and a repair budget.
//
// The loop does not change. What changes is what "valid" means: a Schema from
// schema.ts instead of three scalar types, and a bounded number of repair
// turns when a call is refused, so a confused model cannot spin forever.

import type { Message, Model, ModelReply, ToolCall } from "../../chapter1/files/agent.ts";
import { coerce, signature, validate } from "./schema.ts";
import type { Issue, Schema } from "./schema.ts";

export interface SchemaTool {
  name: string;
  /** Written for the model: what it does, what it needs, what it refuses. */
  description: string;
  input: Schema;
  run(args: Record<string, unknown>): Promise<string> | string;
}

export interface ToolAttempt {
  call: ToolCall;
  /** Issues from the schema check; empty when the call ran. */
  issues: Issue[];
  /** Present when the tool ran, including when it threw. */
  result?: string;
  repaired: boolean;
}

export interface SchemaRun {
  answer: string;
  transcript: Message[];
  attempts: ToolAttempt[];
  stopReason: "answered" | "step_limit";
  /** Characters sent back to the model as refusals — the cost of repair. */
  repairChars: number;
}

export interface SchemaAgentOptions {
  maxSteps?: number;
  /** How many times one call may be re-asked before the loop gives up on it. */
  maxRepairs?: number;
  onAttempt?: (attempt: ToolAttempt) => void;
}

export class SchemaAgent {
  model: Model;
  tools: SchemaTool[];
  maxSteps: number;
  maxRepairs: number;
  onAttempt: ((attempt: ToolAttempt) => void) | undefined;

  constructor(model: Model, tools: SchemaTool[], options: SchemaAgentOptions = {}) {
    this.model = model;
    this.tools = tools;
    this.maxSteps = options.maxSteps ?? 10;
    this.maxRepairs = options.maxRepairs ?? 2;
    this.onAttempt = options.onAttempt;
  }

  find(name: string): SchemaTool | undefined {
    return this.tools.find((t) => t.name === name);
  }

  /** The tool list as the model sees it: name, description, schema signature. */
  menu(): string {
    return this.tools
      .map((t) => `${t.name}(${signature(t.input)})\n  ${t.description}`)
      .join("\n\n");
  }

  async run(task: string): Promise<SchemaRun> {
    const transcript: Message[] = [{ role: "user", content: task }];
    const attempts: ToolAttempt[] = [];
    let repairChars = 0;
    let repairsLeft = this.maxRepairs;

    for (let i = 0; i < this.maxSteps; i += 1) {
      const reply: ModelReply = await this.model.step(transcript, this.tools as never);

      if (!reply.toolCalls?.length) {
        transcript.push({ role: "assistant", content: reply.text ?? "" });
        return { answer: reply.text ?? "", transcript, attempts, stopReason: "answered", repairChars };
      }

      transcript.push({
        role: "assistant",
        content: reply.text ?? "",
        toolName: reply.toolCalls.map((c) => c.name).join(","),
        toolCalls: reply.toolCalls,
      });

      for (const call of reply.toolCalls) {
        const tool = this.find(call.name);
        if (!tool) {
          const message = `Error: no tool "${call.name}". Available: ${this.tools.map((t) => t.name).join(", ")}.`;
          transcript.push({ role: "tool", content: message, toolCallId: call.id, toolName: call.name });
          attempts.push({ call, issues: [], result: message, repaired: false });
          continue;
        }

        const coerced = coerce(tool.input, call.args);
        const issues = validate(tool.input, coerced);
        if (issues.length) {
          const message = `Error: invalid arguments.\n${issues.map((x) => `- ${x.path}: ${x.message}`).join("\n")}`;
          repairChars += message.length;
          transcript.push({ role: "tool", content: message, toolCallId: call.id, toolName: call.name });
          attempts.push({ call, issues, repaired: true });

          repairsLeft -= 1;
          if (repairsLeft < 0) {
            const stop = `Stopped: too many invalid calls (${attempts.length}).`;
            transcript.push({ role: "assistant", content: stop });
            return { answer: stop, transcript, attempts, stopReason: "step_limit", repairChars };
          }
          continue;
        }

        let result: string;
        try {
          result = await tool.run(coerced as Record<string, unknown>);
        } catch (error) {
          result = `Error: ${(error as Error).message}`;
        }
        transcript.push({ role: "tool", content: result, toolCallId: call.id, toolName: call.name });
        const attempt: ToolAttempt = { call, issues: [], result, repaired: false };
        attempts.push(attempt);
        this.onAttempt?.(attempt);
      }
    }

    const stop = `Stopped after ${this.maxSteps} steps.`;
    transcript.push({ role: "assistant", content: stop });
    return { answer: stop, transcript, attempts, stopReason: "step_limit", repairChars };
  }
}
