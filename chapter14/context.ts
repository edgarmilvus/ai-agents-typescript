// Chapter 14 — the context, as a budget with a strategy attached.
//
// A turn has a fixed number of tokens for memory, and four things compete for
// them: the system prompt, the task, the notes, and the recent conversation.
// This file only models the notes, because that is the part the chapter varies.
//
// The strategies are the three answers teams give to "how do we remember": keep
// everything recent, retrieve by query, or compress into a summary. Each is a
// different bet about which notes will matter, and each loses to the others on
// a different task.

import type { Memory, Store } from "./memory.ts";
import { live, tokensOf } from "./memory.ts";
import { asDoc, rank, recent } from "./retrieve.ts";
import type { Task } from "./tasks.ts";

export type Strategy = "none" | "transcript" | "retrieval" | "summary";

/** Four characters to a token, the book's estimate. */
export function estimate(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface Assembled {
  ids: string[];
  tokens: number;
  /** The strategy that produced it, for the table. */
  strategy: Strategy;
}

function pack(records: Memory[], budget: number): Memory[] {
  const out: Memory[] = [];
  let used = 0;
  for (const memory of records) {
    const cost = tokensOf(memory);
    if (used + cost > budget) break;
    out.push(memory);
    used += cost;
  }
  return out;
}

/**
 * Build the memory section of a turn.
 *
 * `transcript` is the newest notes that fit — the baseline, and correct exactly
 * as often as the last thing discussed is the thing that matters. `retrieval`
 * ranks the live set against the request and takes what fits. `summary` is what
 * a compressor keeps when it is told to prioritise decisions: the kind that
 * changes behaviour first, then preferences, then facts, newest first.
 */
export function assemble(task: Task, store: Store, strategy: Strategy, now: number, budget: number): Assembled {
  if (strategy === "none") return { ids: [], tokens: 0, strategy };

  const alive = live(store, now);

  if (strategy === "transcript") {
    const newestFirst = [...alive].sort((a, b) => b.createdAt - a.createdAt);
    const kept = pack(newestFirst, budget);
    return { ids: kept.map((m) => m.id), tokens: kept.reduce((sum, m) => sum + tokensOf(m), 0), strategy };
  }

  if (strategy === "retrieval") {
    const docs = alive.map(asDoc);
    const hits = rank(task.request, docs, docs.length);
    const byId = new Map(alive.map((m) => [m.id, m]));
    const ordered = hits.map((hit) => byId.get(hit.id)).filter((m): m is Memory => m !== undefined);
    const kept = pack(ordered, budget);
    return { ids: kept.map((m) => m.id), tokens: kept.reduce((sum, m) => sum + tokensOf(m), 0), strategy };
  }

  const order: Record<string, number> = { decision: 0, preference: 1, fact: 2 };
  const summarised = [...alive].sort(
    (a, b) => (order[a.kind] ?? 3) - (order[b.kind] ?? 3) || b.createdAt - a.createdAt,
  );
  const kept = pack(summarised, budget);
  return { ids: kept.map((m) => m.id), tokens: kept.reduce((sum, m) => sum + tokensOf(m), 0), strategy };
}

export interface Outcome {
  taskId: string;
  strategy: Strategy;
  ok: boolean;
  missing: string[];
  tokens: number;
}

/** A task is answered when every fact it needs is in the context. */
export function solve(task: Task, store: Store, strategy: Strategy, now: number, budget: number): Outcome {
  const context = assemble(task, store, strategy, now, budget);
  const missing = task.needs.filter((id) => !context.ids.includes(id));
  return { taskId: task.id, strategy, ok: missing.length === 0, missing, tokens: context.tokens + estimate(task.request) };
}
