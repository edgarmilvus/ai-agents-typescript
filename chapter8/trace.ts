// Chapter 8 — a run as a tape, and a difference you can point at.
//
// The transcript of a failed run answers "what happened", never "what moved".
// This file makes the run replayable without the model: the decisions are
// recorded as a tape, and every downstream component can be substituted and
// the tape re-executed. That is the whole instrument of the chapter.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ToolSpec } from "../chapter1/files/agent.ts";
import { stable } from "../chapter4/recording.ts";

/** The six things a suite owns, and the only things a verdict may name. */
export type Axis = "context" | "model" | "tool" | "world" | "grader" | "harness";

export const AXES: readonly Axis[] = ["context", "model", "tool", "world", "grader", "harness"];

/**
 * Two axes are upstream of the model's decisions and four are downstream.
 * The split is the chapter's cost model: a downstream substitution is a
 * replay, an upstream one is a new run.
 */
export const UPSTREAM: readonly Axis[] = ["context", "model"];

export function isUpstream(axis: Axis): boolean {
  return UPSTREAM.includes(axis);
}

/** What the model asked for on one turn. Recorded, never re-derived. */
export interface Call {
  name: string;
  args: Record<string, unknown>;
}

export interface Turn {
  text: string;
  calls: Call[];
}

export interface Outcome {
  pass: boolean;
  reason: string;
}

export interface Usage {
  calls: number;
  promptTokens: number;
  outputTokens: number;
}

/**
 * A run, with the model's decisions kept as data.
 *
 * `axes` is the configuration the run happened under: the deploy log, in six
 * lines. It is a suspect list, never a verdict — a release that changed three
 * components produces three suspects and one cause.
 */
export interface Trace {
  id: string;
  task: string;
  model: string;
  axes: Record<Axis, string>;
  turns: Turn[];
  /** One string per tool call, flat and in order, exactly as the loop saw it. */
  results: string[];
  outcome: Outcome;
  usage: Usage;
  recordedAt?: string;
}

export const BASELINE: Record<Axis, string> = {
  context: "task-v1",
  model: "deepseek-v4.1-flash",
  tool: "tool-clean",
  world: "ledger-clean",
  grader: "check-strict",
  harness: "loop-8",
};

/** The runtime a replay needs: a fresh desk, the tools, the check, the budget. */
export interface Runtime {
  tools: ToolSpec[];
  check(): Outcome;
  maxSteps: number;
}

function signature(turn: Turn): string {
  if (turn.calls.length === 0) return turn.text;
  return turn.calls.map((c) => `${c.name}(${stable(c.args)})`).join(" + ");
}

function runOne(tool: ToolSpec, args: Record<string, unknown>): Promise<string> | string {
  try {
    return tool.run(args);
  } catch (error) {
    return `Error: ${(error as Error).message}`;
  }
}

/**
 * Re-execute the recorded decisions against a different runtime.
 *
 * No model is called. The tape says what was asked; the runtime decides what
 * happens next. A turn without calls ends the run, and `maxSteps` counts
 * turns, not calls, because that is what the loop's budget means.
 */
export async function replay(trace: Trace, rt: Runtime): Promise<Trace> {
  const results: string[] = [];
  const turns: Turn[] = [];

  for (const turn of trace.turns) {
    if (turns.length >= rt.maxSteps) break;
    turns.push(turn);
    for (const call of turn.calls) {
      const tool = rt.tools.find((t) => t.name === call.name);
      if (!tool) {
        results.push(`Error: no tool named "${call.name}".`);
        continue;
      }
      const value = runOne(tool, call.args);
      results.push(value instanceof Promise ? await value : value);
    }
  }

  return {
    ...trace,
    turns,
    results,
    outcome: rt.check(),
    usage: { calls: 0, promptTokens: 0, outputTokens: 0 },
  };
}

/** The sequence of decisions: one string per turn, tool names only. */
export function path(trace: Trace): string[] {
  return trace.turns.map((turn) => turn.calls.map((c) => c.name).join("+") || "answer");
}

/** sha256 of everything that defines a run except its id and timestamp. */
export function fingerprint(trace: Trace): string {
  const payload = stable({
    task: trace.task,
    axes: trace.axes,
    turns: trace.turns,
    results: trace.results,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export type Divergence =
  | { kind: "same" }
  | { kind: "turn"; index: number; a: string; b: string }
  | { kind: "result"; index: number; a: string; b: string }
  | { kind: "length"; a: number; b: number }
  | { kind: "outcome"; a: string; b: string };

/**
 * Where two runs stop agreeing.
 *
 * Turns first, because a different call is a different decision; then results,
 * because the same call answered differently is the interesting case; then the
 * length; then the verdict. The first difference is the only one worth
 * reporting, and it is what the drill-down names.
 */
export function diff(a: Trace, b: Trace): Divergence {
  const turns = Math.min(a.turns.length, b.turns.length);
  for (let i = 0; i < turns; i += 1) {
    const sa = signature(a.turns[i]);
    const sb = signature(b.turns[i]);
    if (sa !== sb) return { kind: "turn", index: i, a: sa, b: sb };
  }

  const results = Math.min(a.results.length, b.results.length);
  for (let i = 0; i < results; i += 1) {
    if (a.results[i] !== b.results[i]) {
      return { kind: "result", index: i, a: a.results[i], b: b.results[i] };
    }
  }

  if (a.turns.length !== b.turns.length || a.results.length !== b.results.length) {
    return { kind: "length", a: a.results.length, b: b.results.length };
  }
  if (a.outcome.pass !== b.outcome.pass) {
    return { kind: "outcome", a: a.outcome.reason, b: b.outcome.reason };
  }
  return { kind: "same" };
}

export interface FieldDifference {
  field: string;
  a: unknown;
  b: unknown;
}

/**
 * The fields of two JSON tool results that disagree.
 *
 * A verdict of "tool" is not actionable; "the `amount` field of the refund
 * call" is. This is the step from an axis to the line a fix edits.
 */
export function fields(a: string, b: string): FieldDifference[] {
  let left: unknown;
  let right: unknown;
  try {
    left = JSON.parse(a);
    right = JSON.parse(b);
  } catch {
    return [];
  }
  if (!left || !right || typeof left !== "object" || typeof right !== "object") return [];
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const out: FieldDifference[] = [];
  for (const key of keys) {
    const l = (left as Record<string, unknown>)[key];
    const r = (right as Record<string, unknown>)[key];
    if (stable(l) !== stable(r)) out.push({ field: key, a: l, b: r });
  }
  return out;
}

// ------------------------------------------------------------------ storage

const HERE = dirname(fileURLToPath(import.meta.url));
export const RUNS = join(HERE, "runs");

export function tracePath(id: string): string {
  return join(RUNS, `${id}.json`);
}

export function saveTrace(trace: Trace): string {
  mkdirSync(RUNS, { recursive: true });
  writeFileSync(tracePath(trace.id), JSON.stringify(trace, null, 2) + "\n");
  return tracePath(trace.id);
}

export function loadTrace(id: string): Trace {
  const path = tracePath(id);
  if (!existsSync(path)) throw new Error(`no trace at ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as Trace;
}

export function runIds(): string[] {
  if (!existsSync(RUNS)) return [];
  return readdirSync(RUNS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

/** A trace built from a live loop: assistant turns and tool results, in order. */
export function traceFrom(
  id: string,
  task: string,
  model: string,
  axes: Record<Axis, string>,
  turns: { text?: string; calls?: { name: string; args: unknown }[] }[],
  results: string[],
  outcome: Outcome,
  usage: Usage,
): Trace {
  return {
    id,
    task,
    model,
    axes,
    turns: turns.map((t) => ({
      text: t.text ?? "",
      calls: (t.calls ?? []).map((c) => ({ name: c.name, args: (c.args ?? {}) as Record<string, unknown> })),
    })),
    results,
    outcome,
    usage,
    recordedAt: new Date().toISOString(),
  };
}
