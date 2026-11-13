// Exercise 3, file 2 of 3 — the runner, the tool and the ledger.
//
// The stream produces pieces; the runner decides what to do when it stops. A
// run that stopped early has no complete answer, so it must not run the tool
// that assumes one and must not write a complete ledger.
//
// The tool here is a placeholder with one job: to prove that the ledger and the
// side effect agree about whether the conversation finished.

import type { Piece } from "./ex3_stream.ts";
import { PIECES, pieces } from "./ex3_stream.ts";

export type Ledger = "complete" | "cancelled";

export interface Outcome {
  chunks: number;
  tokens: number;
  text: string;
  /** True only when the run finished and the tool committed. */
  tool: boolean;
  ledger: Ledger;
}

/**
 * Consume the stream, stopping after `stopAfter` pieces if given.
 *
 * The controller is aborted and the loop is allowed to ask for one more piece,
 * which is what makes the generator throw: a cancellation is observed by the
 * next pull, not by the break that caused it.
 */
export async function go(stopAfter?: number): Promise<Outcome> {
  const controller = new AbortController();
  const out: Piece[] = [];
  let aborted = false;

  try {
    for await (const piece of pieces(controller.signal)) {
      out.push(piece);
      if (stopAfter !== undefined && out.length >= stopAfter) controller.abort();
    }
  } catch (error) {
    if ((error as Error).name !== "AbortError") throw error;
    aborted = true;
  }

  const finished = !aborted && out.length === PIECES.length;
  return {
    chunks: out.length,
    tokens: out.reduce((n, piece) => n + piece.tokens, 0),
    text: out.map((piece) => piece.text).join(""),
    tool: finished,
    ledger: aborted ? "cancelled" : "complete",
  };
}
