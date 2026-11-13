// Exercise 1 — price a call, and price a loop.
//
// Two multiplications and a sum. The exercise is small because the arithmetic
// is small, and it is worth doing by hand once: the numbers that surprise
// people are the ones where output dominates, and the ones where the loop's
// growth dominates the price list.

export interface Model {
  name: string;
  inputPerMTok: number;
  outputPerMTok: number;
}

export const MODELS: Record<string, Model> = {
  small: { name: "small", inputPerMTok: 0.1, outputPerMTok: 0.4 },
  medium: { name: "medium", inputPerMTok: 0.4, outputPerMTok: 1.6 },
  large: { name: "large", inputPerMTok: 1.25, outputPerMTok: 5 },
};

export function call(model: Model, promptTokens: number, outputTokens: number): number {
  return (promptTokens * model.inputPerMTok + outputTokens * model.outputPerMTok) / 1_000_000;
}

export interface Shape {
  base: number;
  perTurn: number;
  output: number;
}

export const SHAPE: Shape = { base: 250, perTurn: 85, output: 44 };

/** A loop's cost, with the prompt growing by `perTurn` every turn. */
export function loop(model: Model, turns: number, shape = SHAPE): { prompt: number; output: number; usd: number } {
  let prompt = 0;
  for (let i = 0; i < turns; i += 1) prompt += shape.base + shape.perTurn * i;
  const output = turns * shape.output;
  return { prompt, output, usd: call(model, prompt, output) };
}

export const LOOP_SIZES = [2, 4, 8];

export function demo() {
  return Object.values(MODELS).flatMap((model) =>
    LOOP_SIZES.map((turns) => ({ model: model.name, turns, ...loop(model, turns) })),
  );
}

const micro = (usd: number) => Math.round(usd * 1_000_000);

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# nine prices\n");
  console.log("  model   turns  prompt  output     cost   per turn");
  for (const row of rows) {
    console.log(
      `  ${row.model.padEnd(7)} ${String(row.turns).padStart(5)} ${String(row.prompt).padStart(7)} ${String(row.output).padStart(7)} ${String(micro(row.usd)).padStart(7)} µ$ ${String(Math.round(micro(row.usd / row.turns))).padStart(10)} µ$`,
    );
  }
  console.log("\n  the small model at eight turns (579 µ$) costs more than the medium model");
  console.log("  at two (375 µ$), because the loop grows and the price list does not. A");
  console.log("  model change multiplies every call by a constant; a loop change");
  console.log("  multiplies the number of calls and the size of each one.");
}

if (import.meta.main) report(demo());
