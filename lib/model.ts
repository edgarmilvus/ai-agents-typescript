// One OpenAI-compatible provider for every model call in the book.
//
// Defaults point at OpenRouter; the only thing a reader must supply is a key.
// To use another OpenAI-compatible provider, change all three variables:
//
//   OPENAI_COMPATIBLE_BASE_URL   https://openrouter.ai/api/v1
//   OPENAI_COMPATIBLE_MODEL      ~deepseek/deepseek-flash-latest
//   OPENAI_COMPATIBLE_API_KEY    the key for that endpoint
//
// Nothing else selects a provider. The adapter sends the same chat-completions
// request to whatever those three variables name.

import { randomUUID } from "node:crypto";

import type { Budget } from "./budget.ts";
import { OpenAIChatModel } from "./openai.ts";

const SESSION = randomUUID();

export const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "~deepseek/deepseek-flash-latest";

export function modelKey(): string | undefined {
  return process.env.OPENAI_COMPATIBLE_API_KEY?.trim();
}

export function modelName(): string {
  return process.env.OPENAI_COMPATIBLE_MODEL?.trim() || DEFAULT_MODEL;
}

export function modelBaseUrl(): string {
  return process.env.OPENAI_COMPATIBLE_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

export function makeModel(budget: Budget): OpenAIChatModel {
  const key = modelKey();
  if (!key) {
    throw new Error("no key: set OPENAI_COMPATIBLE_API_KEY before a live run");
  }
  const baseUrl = modelBaseUrl();
  return new OpenAIChatModel(budget, {
    baseUrl,
    model: modelName(),
    key,
    maxTokens: 2048,
    // OpenCode Go asks for a stable session id on every request. Other
    // OpenAI-compatible endpoints do not need one.
    headers: baseUrl.includes("opencode.ai") ? { "x-opencode-session": SESSION } : undefined,
  });
}
