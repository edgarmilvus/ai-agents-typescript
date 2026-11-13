// Chapter 14 — the recorded queries, as data.
//
// Kept apart from the recorder so that reading a run does not spend a call.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export const RUNS = join(HERE, "runs");

/** One keyword case and one paraphrase. */
export const RECORDED = ["t4", "t13"];

export interface Saved {
  taskId: string;
  request: string;
  model: string;
  queries: string[];
  answer: string;
  usage: { calls: number; promptTokens: number; outputTokens: number };
  recordedAt: string;
}
