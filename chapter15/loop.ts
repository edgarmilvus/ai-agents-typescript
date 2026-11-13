// Chapter 15 — three shapes for the same task.
//
// A task is a number of steps. The shape decides how those steps are paid for:
// one agent re-sending its history, a supervisor plus a child per step, or a
// cache hit that sends almost nothing.
//
// The numbers are a model calibrated on the book's own recordings, not a
// benchmark. What transfers is the shape: which term grows with steps, which
// grows with history, and which does not grow at all.

import { MODELS, TURN, callCost, loopCost } from "./price.ts";

export type Shape = "single" | "delegated" | "cached";

export interface Task {
  id: string;
  label: string;
  steps: number;
  difficulty: "easy" | "hard";
}

export interface Run {
  taskId: string;
  shape: Shape;
  calls: number;
  promptTokens: number;
  outputTokens: number;
  usd: number;
}

/**
 * The supervisor's turn is slightly fatter than a single agent's, because it
 * carries the delegation tool and the reports it has already read. Measured in
 * chapter 11 at 1,086 prompt tokens over three calls.
 */
const SUPERVISOR = { base: 300, perTurn: 90, output: 40 };
/** A child does one step and answers: chapter 11's estimate of 420 tokens. */
const CHILD = { prompt: 420, output: 60 };

export function simulate(task: Task, shape: Shape, model = MODELS.cheap): Run {
  if (shape === "single") {
    const loop = loopCost(model, task.steps + 1);
    return {
      taskId: task.id,
      shape,
      calls: loop.turns,
      promptTokens: loop.promptTokens,
      outputTokens: loop.outputTokens,
      usd: loop.usd,
    };
  }

  if (shape === "delegated") {
    const supervisor = loopCost(model, task.steps + 1, SUPERVISOR);
    const children = task.steps;
    const promptTokens = supervisor.promptTokens + children * CHILD.prompt;
    const outputTokens = supervisor.outputTokens + children * CHILD.output;
    return {
      taskId: task.id,
      shape,
      calls: supervisor.turns + children,
      promptTokens,
      outputTokens,
      usd: callCost(model, promptTokens, outputTokens),
    };
  }

  // A cache hit answers from what was stored: one call, no history.
  const promptTokens = TURN.base + 40;
  const outputTokens = TURN.output;
  return {
    taskId: task.id,
    shape,
    calls: 1,
    promptTokens,
    outputTokens,
    usd: callCost(model, promptTokens, outputTokens),
  };
}

/** The task corpus: four easy two-step tasks and one hard five-step task. */
export const TASKS: Task[] = [
  { id: "t1", label: "refund an order", steps: 3, difficulty: "easy" },
  { id: "t2", label: "answer a policy question", steps: 2, difficulty: "easy" },
  { id: "t3", label: "escalate a damaged claim", steps: 2, difficulty: "easy" },
  { id: "t4", label: "audit a week of refunds", steps: 5, difficulty: "hard" },
];

/** Total cost of a set of tasks under one shape. */
export function total(tasks: Task[], shape: Shape, model = MODELS.cheap): number {
  return tasks.reduce((sum, task) => sum + simulate(task, shape, model).usd, 0);
}
