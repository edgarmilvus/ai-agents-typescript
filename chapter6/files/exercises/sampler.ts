// Exercise 3, file 1 of 3 — a model with a distribution.
//
// Real models vary; recordings do not. To test the measurement machinery
// honestly we need a model whose behaviour is drawn from a known mixture, so
// that a measured rate can be compared with the rate we built in.

import type { Message, Model, ModelReply, ToolSpec } from "../../../chapter1/files/agent.ts";

export type Behaviour = "actor" | "talker";

export interface Pool {
  /** Behaviour for run i, deterministic: index modulo the weights. */
  at(i: number): Behaviour;
  readonly weights: { actor: number; talker: number };
}

/** A mixture specified as integer weights, sampled by index, not by chance. */
export function pool(actor: number, talker: number): Pool {
  const total = actor + talker;
  return {
    weights: { actor, talker },
    at(i: number) {
      return i % total < actor ? "actor" : "talker";
    },
  };
}

export interface ActorModel {
  model: Model;
  behaviour: Behaviour;
}

/**
 * Wrap a recorded "actor" model and a scripted "talker", choosing by run index.
 *
 * Determinism is the point: a suite that samples by `Math.random()` cannot be
 * re-run, and a rate you cannot re-run is a rumour.
 */
export function modelFor(p: Pool, runIndex: number, actor: Model): ActorModel {
  const behaviour = p.at(runIndex);
  if (behaviour === "actor") return { model: actor, behaviour };
  let used = false;
  return {
    behaviour,
    model: {
      name: "talker",
      async step(_messages: readonly Message[], _tools: readonly ToolSpec[]): Promise<ModelReply> {
        if (used) throw new Error("talker answered twice");
        used = true;
        return { text: "I have refunded the order in full. You should see it in a few days." };
      },
    },
  };
}
