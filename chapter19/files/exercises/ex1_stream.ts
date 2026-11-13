// Exercise 1 — a stream that stops.
//
// An async generator is a producer that runs only as fast as its consumer
// pulls. That sounds like cancellation for free, and it is not: the consumer
// can stop pulling while the producer's work has already been scheduled, and a
// generator that never checks the signal will finish its script for nobody.
//
// This exercise measures the produced chunks, not the delivered ones.

export const SCRIPT = ["one ", "two ", "three ", "four ", "five "];

/**
 * The producer. The check is before the chunk is produced, because a chunk
 * produced after the abort is a chunk that was paid for and never read.
 */
export async function* chunks(signal: AbortSignal): AsyncGenerator<string> {
  for (const text of SCRIPT) {
    if (signal.aborted) throw new DOMException("stopped", "AbortError");
    yield text;
    await Promise.resolve();
  }
}

export interface Result {
  /** How many chunks the consumer read. */
  chunks: number;
  text: string;
  /** True when the run stopped because the signal fired. */
  cancelled: boolean;
}

export async function collect(abortAfter: number): Promise<Result> {
  const controller = new AbortController();
  const out: string[] = [];
  let cancelled = false;

  if (abortAfter === 0) controller.abort();

  try {
    for await (const chunk of chunks(controller.signal)) {
      out.push(chunk);
      if (out.length >= abortAfter) controller.abort();
    }
  } catch (error) {
    if ((error as Error).name !== "AbortError") throw error;
    cancelled = true;
  }

  return { chunks: out.length, text: out.join(""), cancelled };
}

export async function demo(): Promise<Result[]> {
  const rows: Result[] = [];
  for (let n = 0; n <= SCRIPT.length; n += 1) rows.push(await collect(n));
  return rows;
}

export function report(rows: Result[]): void {
  console.log("# a stream that stops\n");
  console.log("  abort after  chunks  cancelled  text");
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    console.log(`  ${String(i).padEnd(12)} ${String(row.chunks).padEnd(7)} ${(row.cancelled ? "yes" : "no").padEnd(10)} "${row.text}"`);
  }
  console.log("\n  the run that stops after zero produces nothing; the run that stops after");
  console.log("  five produces all five and is not cancelled, because there was no next");
  console.log("  chunk to ask for. The count is of produced chunks, and that is the");
  console.log("  number the bill uses.");
}

if (import.meta.main) report(await demo());
