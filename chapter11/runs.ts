// Chapter 11 — the recorded handoffs, as data.
//
// Kept apart from the recorder so that reading a run does not spend a call.
// The three tasks are a refund, an escalation, and a request that never named
// an order; between them they show a correct handoff and a parent that had
// nothing to hand over.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Packet } from "./contract.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export const RUNS = join(HERE, "runs");

export const RECORDED = ["t1-refund", "t2-escalate", "t4-amount-missing"];

export interface Saved {
  taskId: string;
  request: string;
  model: string;
  answer: string;
  packets: Packet[];
  calls: number;
  usage: { calls: number; promptTokens: number; outputTokens: number };
  recordedAt: string;
}
