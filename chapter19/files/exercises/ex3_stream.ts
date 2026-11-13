// Exercise 3, file 1 of 3 — the stream, with no ledger.
//
// Six pieces, three tokens each. The generator checks the signal before it
// produces a piece, and it knows nothing about tools, ledgers or reports.
//
// This file can be tested by aborting after two pieces and counting what came
// out, which is the seam the other two files rely on.

export interface Piece {
  text: string;
  tokens: number;
}

export const PIECES: Piece[] = [
  { text: "I ", tokens: 3 },
  { text: "checked ", tokens: 3 },
  { text: "the ", tokens: 3 },
  { text: "order. ", tokens: 3 },
  { text: "It ", tokens: 3 },
  { text: "is within the window.", tokens: 3 },
];

/** Six pieces, produced only while the signal is clear. */
export async function* pieces(signal: AbortSignal): AsyncGenerator<Piece> {
  for (const piece of PIECES) {
    if (signal.aborted) throw new DOMException("the customer hung up", "AbortError");
    yield piece;
    await Promise.resolve();
  }
}
