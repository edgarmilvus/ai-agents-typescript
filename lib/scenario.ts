// Live runs, recorded.
//
// A demo runs against the real model when a key is available, and writes what
// the model actually said to fixtures/<name>.json. Without a key — or with
// --replay — the same demo runs from that recording. The recording is data
// from a real run, never a script we wrote by hand.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Message, Model, ModelReply, ToolCall } from "../../chapter1/files/agent.ts";
import { makeModel, modelKey } from "./model.ts";
import { newBudget } from "./budget.ts";
import type { Budget } from "./budget.ts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FIXTURES = join(ROOT, "fixtures");

export interface Opening {
  model: Model;
  /** Call after the run: writes the fixture when the run was live. */
  close(): void;
  live: boolean;
  budget: Budget;
}

function replayFrom(file: string): Model {
  const replies = JSON.parse(readFileSync(file, "utf8")) as ModelReply[];
  let i = 0;
  return {
    name: `replay:${file.split("/").pop()}`,
    async step(): Promise<ModelReply> {
      if (i >= replies.length) throw new Error(`fixture exhausted after ${replies.length} replies`);
      return replies[i++];
    },
  };
}

/**
 * Open a model for a named scenario.
 *
 * Live when a key exists and --replay was not passed; otherwise the recorded
 * run. In both cases the agent code is identical — that is the point.
 */
export function open(name: string, maxCalls = 12): Opening {
  const replay = process.argv.includes("--replay") || process.env.AGENTLAB_REPLAY === "1";
  const key = modelKey();
  const file = join(FIXTURES, `${name}.json`);

  if (key && !replay) {
    const budget = newBudget(maxCalls);
    const model = makeModel(budget);
    return {
      model,
      live: true,
      budget,
      close() {
        mkdirSync(FIXTURES, { recursive: true });
        const replies = model.exchanges.map((e) => e.reply);
        writeFileSync(file, JSON.stringify(replies, null, 2) + "\n");
        console.log(`   recorded ${replies.length} turns -> fixtures/${name}.json`);
      },
    };
  }

  if (!existsSync(file)) {
    throw new Error(`no key and no fixture for ${name}; run once with a key to record it`);
  }
  return { model: replayFrom(file), live: false, budget: newBudget(0), close() {} };
}

/** A model that replays a fixture and nothing else — for harnesses. */
export function recorded(name: string): Model {
  const file = join(FIXTURES, `${name}.json`);
  if (!existsSync(file)) throw new Error(`missing fixture ${name}`);
  return replayFrom(file);
}

export function fixturePath(name: string): string {
  return join(FIXTURES, `${name}.json`);
}
