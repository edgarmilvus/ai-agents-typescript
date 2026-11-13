// Chapter 4 — a run, written down.
//
// A recording is not a mock. It is what a real model said, with enough
// context to prove the replay is the same conversation: the task, the model,
// and a hash of the exact messages the model saw on every turn.

import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Message, Model, ModelReply } from "../../chapter1/files/agent.ts";

export interface Turn {
  /** sha256 of the messages the model saw before this reply. */
  inputHash: string;
  reply: ModelReply;
}

export interface Recording {
  version: 1;
  model: string;
  recordedAt: string;
  task: string;
  taskHash: string;
  turns: Turn[];
  usage?: { calls: number; promptTokens: number; outputTokens: number };
}

/** Recordings resolve from this module, so a demo runs from any directory. */
const HERE = dirname(fileURLToPath(import.meta.url));

export function recordingPath(name: string): string {
  return join(HERE, "recordings", name);
}

export function normaliseTask(task: string): string {
  return task.trim().replace(/\s+/g, " ");
}

export function taskHash(task: string): string {
  return createHash("sha256").update(normaliseTask(task)).digest("hex").slice(0, 16);
}

/** The transcript is part of the fixture: a changed prompt is a different run. */
export function inputHash(messages: readonly Message[], tools: readonly { name: string; description: string }[]): string {
  const payload = JSON.stringify({
    messages: messages.map((m) => ({ role: m.role, content: m.content, toolName: m.toolName ?? null, calls: m.toolCalls?.map((c) => ({ name: c.name, args: c.args })) ?? null })),
    tools: tools.map((t) => ({ name: t.name, description: t.description })),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/** Wrap any model and keep what it said, turn by turn. */
export class Recorder implements Model {
  inner: Model;
  recording: Recording;
  readonly name: string;

  constructor(inner: Model, task: string) {
    this.inner = inner;
    this.name = inner.name;
    this.recording = {
      version: 1,
      model: inner.name,
      recordedAt: new Date().toISOString(),
      task: normaliseTask(task),
      taskHash: taskHash(task),
      turns: [],
    };
  }

  async step(messages: readonly Message[], tools: readonly { name: string; description: string }[]): Promise<ModelReply> {
    const reply = await this.inner.step(messages, tools);
    this.recording.turns.push({ inputHash: inputHash(messages, tools), reply });
    return reply;
  }
}

export type ReplayMode = "strict" | "tolerant";

export class ReplayError extends Error {}

/**
 * Replay a recording.
 *
 * Strict mode compares the hash of every prompt with the hash recorded at the
 * same turn, so a changed tool description or an edited system message fails
 * loudly instead of quietly returning yesterday's answer to today's question.
 * Tolerant mode only counts turns, which is useful when the point is the loop.
 */
export class TapeDeck implements Model {
  readonly name: string;
  private recording: Recording;
  private mode: ReplayMode;
  private index = 0;
  /** Turn indices whose prompt did not match, in strict mode. */
  readonly diverged: number[] = [];

  constructor(recording: Recording, mode: ReplayMode = "strict") {
    this.recording = recording;
    this.mode = mode;
    this.name = `replay:${recording.model}`;
  }

  get remaining(): number {
    return this.recording.turns.length - this.index;
  }

  async step(messages: readonly Message[], tools: readonly { name: string; description: string }[]): Promise<ModelReply> {
    const turn = this.recording.turns[this.index];
    if (!turn) throw new ReplayError(`recording exhausted after ${this.recording.turns.length} turns`);
    if (this.mode === "strict") {
      const actual = inputHash(messages, tools);
      if (actual !== turn.inputHash) {
        this.diverged.push(this.index);
        throw new ReplayError(
          `prompt diverged at turn ${this.index}: recorded ${turn.inputHash}, replaying ${actual}`,
        );
      }
    }
    this.index += 1;
    return turn.reply;
  }
}

// ---------------------------------------------------------------- diffing

export type Divergence =
  | { kind: "same" }
  | { kind: "length"; a: number; b: number }
  | { kind: "call"; index: number; a: string; b: string }
  | { kind: "text"; index: number; a: string; b: string };

/** Stable JSON: key order is not part of a tool call's meaning. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const FREE_TEXT = new Set(["reason", "body", "message", "note"]);

/** Drop prose fields from a tool call: wording is not a decision. */
export function decision(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decision);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (FREE_TEXT.has(key)) continue;
      out[key] = decision((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function describe(reply: ModelReply): string {
  if (reply.toolCalls?.length) {
    return reply.toolCalls.map((c) => `${c.name}(${stable(decision(c.args))})`).join(" + ");
  }
  return reply.text ?? "";
}

/** Where two recordings of the same task stop agreeing. */
export function diff(a: Recording, b: Recording): Divergence {
  const n = Math.min(a.turns.length, b.turns.length);
  for (let i = 0; i < n; i += 1) {
    const ra = a.turns[i].reply;
    const rb = b.turns[i].reply;
    const ca = ra.toolCalls?.[0]?.name ?? null;
    const cb = rb.toolCalls?.[0]?.name ?? null;
    if (ca !== cb) return { kind: "call", index: i, a: describe(ra), b: describe(rb) };
    // Two answers that differ only in wording are the same decision. A turn
    // with no tool call is prose, and prose is not what divergence measures.
    if (ca === null) continue;
    if (describe(ra) !== describe(rb)) return { kind: "text", index: i, a: describe(ra), b: describe(rb) };
  }
  if (a.turns.length !== b.turns.length) {
    return { kind: "length", a: a.turns.length, b: b.turns.length };
  }
  return { kind: "same" };
}
