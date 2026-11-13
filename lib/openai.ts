// One OpenAI-compatible chat client for every provider in this book.
//
// DeepSeek direct and DeepSeek Flash through OpenRouter expose the same
// OpenAI-compatible protocol; the only differences are the base URL, the model
// name and the key. Tool calls,
// usage and finish reasons arrive in the same shape, which is exactly the
// boundary chapter 20 is about.
//
//   OpenRouter: https://openrouter.ai/api/v1
//
// Thinking mode is disabled where a provider supports it, so tool turns do
// not require echoing reasoning_content and the loop stays deterministic.

import type { Message, Model, ModelReply, ToolCall, ToolSpec } from "../../chapter1/files/agent.ts";
import type { Schema } from "../../chapter2/files/schema.ts";
import type { Budget } from "./budget.ts";

type ProviderTool = ToolSpec & { input?: Schema };

export interface OpenAIConfig {
  baseUrl: string;
  model: string;
  key: string;
  maxTokens?: number;
  disableThinking?: boolean;
  headers?: Record<string, string>;
}

function jsonSchema(schema: Schema): Record<string, unknown> {
  switch (schema.type) {
    case "object": {
      const properties: Record<string, unknown> = {};
      for (const [key, sub] of Object.entries(schema.properties)) {
        properties[key] = sub.description ? { ...jsonSchema(sub), description: sub.description } : jsonSchema(sub);
      }
      return { type: "object", properties, ...(schema.required?.length ? { required: schema.required } : {}) };
    }
    case "array":
      return { type: "array", items: jsonSchema(schema.items) };
    case "string":
      return schema.enum ? { type: "string", enum: schema.enum } : { type: "string" };
    case "number":
      return { type: schema.integer ? "integer" : "number" };
    case "boolean":
      return { type: "boolean" };
  }
}

function parametersOf(tool: ProviderTool): Record<string, unknown> {
  if (tool.input) return jsonSchema(tool.input);
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, p] of Object.entries(tool.params ?? {})) {
    properties[key] = { type: p.type, ...(p.description ? { description: p.description } : {}) };
    if (p.required) required.push(key);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

function messagesFor(messages: readonly Message[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", tool_call_id: m.toolCallId ?? m.toolName ?? "tool", content: m.content };
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((call) => {
          const raw = call.raw as { extra_content?: unknown } | undefined;
          const wire = {
            id: call.id,
            type: "function",
            function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
          };
          // Some providers require an opaque field from the original call to
          // be echoed with the assistant turn. Echo it when present.
          return raw?.extra_content ? { ...wire, extra_content: raw.extra_content } : wire;
        }),
      };
    }
    // A message may carry an image (chapter 7 audits renders). OpenAI-compatible
    // providers take it as a data URL inside the content array.
    const image = (m as { image?: { mimeType: string; data: string } }).image;
    if (image) {
      return {
        role: m.role,
        content: [
          { type: "text", text: m.content },
          { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.data}` } },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

interface WireToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export class OpenAIChatModel implements Model {
  readonly name: string;
  protected key: string;
  protected budget: Budget;
  private baseUrl: string;
  private maxTokens: number;
  private disableThinking: boolean;
  private headers: Record<string, string>;
  readonly exchanges: { messages: Message[]; reply: ModelReply }[] = [];

  constructor(budget: Budget, config: OpenAIConfig) {
    this.budget = budget;
    this.key = config.key;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.name = config.model;
    this.maxTokens = config.maxTokens ?? 768;
    this.disableThinking = config.disableThinking ?? false;
    this.headers = config.headers ?? {};
  }

  async step(messages: readonly Message[], tools: readonly ProviderTool[]): Promise<ModelReply> {
    if (this.budget.calls >= this.budget.maxCalls) {
      throw new Error(`budget: spent ${this.budget.calls} of ${this.budget.maxCalls} model calls`);
    }

    // Some providers reject dots and colons in function names (MCP tools are
    // often namespaced `docs.search`). Translate to the provider's alphabet and
    // keep the original for the agent.
    const wireNames = new Map<string, string>();
    const wireName = (name: string): string => {
      let candidate = name.replace(/[^a-zA-Z0-9_-]/g, "_");
      while ([...wireNames.keys()].includes(candidate) && wireNames.get(candidate) !== name) {
        candidate = `${candidate}_`;
      }
      wireNames.set(candidate, name);
      return candidate;
    };

    const body: Record<string, unknown> = {
      model: this.name,
      messages: messagesFor(messages),
      max_tokens: this.maxTokens,
      temperature: 0,
      ...(this.disableThinking ? { thinking: { type: "disabled" } } : {}),
      ...(tools.length
        ? {
            tools: tools.map((tool) => ({
              type: "function",
              function: {
                name: wireName(tool.name),
                description: tool.description,
                parameters: parametersOf(tool),
              },
            })),
            tool_choice: "auto",
          }
        : {}),
    };

    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.key}`,
            ...this.headers,
          },
          body: JSON.stringify(body),
        });
      } catch (error) {
        if (attempt === 2) throw error;
        const wait = 2_000 * (attempt + 1);
        console.log(`   (network error: retrying in ${wait / 1000}s, attempt ${attempt + 1} of 3)`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (response.status !== 429) break;
      const wait = 5_000 * (attempt + 1);
      console.log(`   (429 from the provider: waiting ${wait / 1000}s, attempt ${attempt + 1} of 3)`);
      await new Promise((r) => setTimeout(r, wait));
    }
    if (!response) throw new Error("no response from the provider");
    this.budget.calls += 1;

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${this.name} ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: WireToolCall[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    this.budget.promptTokens += data.usage?.prompt_tokens ?? 0;
    this.budget.outputTokens += data.usage?.completion_tokens ?? 0;

    const message = data.choices?.[0]?.message;
    const text = (message?.content ?? "").trim();
    const calls: ToolCall[] = (message?.tool_calls ?? []).map((call, i) => {
      let args: unknown = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      return {
        id: call.id || `c${this.budget.calls}_${i}`,
        name: wireNames.get(call.function.name) ?? call.function.name,
        args,
        raw: call,
      };
    });

    const reply: ModelReply = calls.length ? { text: text || undefined, toolCalls: calls } : { text };
    this.exchanges.push({ messages: messages.map((m) => ({ ...m })), reply });
    return reply;
  }
}
