// Exercise 4 — depth, fan-out, and a budget that survives the tree.
//
// A delegation tree is cheap to draw and expensive to run: every child is a
// model call, and a child that keeps the whole budget believes it can spend it.
// This exercise is the arithmetic that keeps a tree inside a budget: how many
// agents a fan-out of f at depth d creates, how a step budget splits, and when
// a task no longer fits.

export interface Shape {
  fanOut: number;
  depth: number;
  levels: number[];
  nodes: number;
  leaves: number;
}

export function shape(fanOut: number, depth: number): Shape {
  const levels = Array.from({ length: depth + 1 }, (_, i) => fanOut ** i);
  return { fanOut, depth, levels, nodes: levels.reduce((a, b) => a + b, 0), leaves: fanOut ** depth };
}

/** Split a budget across `n` children, remainder to the first. */
export function split(budget: number, n: number): number[] {
  if (n <= 0) throw new Error("no children");
  const each = Math.floor(budget / n);
  const out = Array.from({ length: n }, () => each);
  out[0] += budget - each * n;
  return out;
}

/**
 * Does a task still fit?
 *
 * Every agent needs at least one step to think and one to answer, so a budget
 * smaller than twice the number of nodes cannot finish the tree. The check is
 * deliberately crude: a tree that only just fits is a tree one retry away from
 * dead.
 */
export function fits(budget: number, shape: Shape): boolean {
  return budget >= shape.nodes * 2;
}

export function demo() {
  const sizes = [
    [2, 1],
    [2, 2],
    [3, 2],
    [3, 3],
    [4, 3],
  ] as const;
  return sizes.map(([f, d]) => {
    const s = shape(f, d);
    return { ...s, split: split(20, f), fits20: fits(20, s), fits60: fits(60, s) };
  });
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# trees, budgets, and the point where they stop fitting\n");
  console.log("  fan-out  depth  nodes  leaves  split of 20   fits 20  fits 60");
  for (const row of rows) {
    console.log(
      `  ${String(row.fanOut).padStart(7)}  ${String(row.depth).padStart(5)}  ${String(row.nodes).padStart(5)}  ` +
        `${String(row.leaves).padStart(6)}  ${row.split.join("+").padEnd(12)}  ${(row.fits20 ? "yes" : "no").padStart(7)}  ${(row.fits60 ? "yes" : "no").padStart(7)}`,
    );
  }
  console.log("\n  four children at depth three is eighty-five agents, and a budget of");
  console.log("  sixty cannot give each of them two steps. The table is not a warning");
  console.log("  about fan-out; it is the reason the depth limit is an integer at the");
  console.log("  tool rather than a sentence in a prompt.");
}

if (import.meta.main) report(demo());
