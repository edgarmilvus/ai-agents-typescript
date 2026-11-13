// Exercise 1 — the walk.
//
// A closure is a set and a rule: start at the roots, follow the edges, stop
// when nothing new is reachable. This exercise builds the pure version over
// eight nodes and prints which of them a row filter would miss.
//
// No stores, no tenants, no deletion. The graph is the whole subject.

export interface Node {
  id: string;
  /** Ids this node was computed from. An empty list means the writer recorded nothing. */
  from: string[];
}

export const ROOTS = ["a-order", "a-note", "a-cache"];

export const NODES: Node[] = [
  { id: "a-order", from: [] },
  { id: "a-note", from: [] },
  { id: "a-cache", from: [] },
  { id: "a-summary", from: ["a-note"] },
  { id: "a-transcript", from: ["a-order", "a-note"] },
  { id: "a-fixture", from: ["a-transcript"] },
  { id: "a-backup", from: [] },
  { id: "a-paraphrase", from: [] },
];

/**
 * Everything reachable from the roots, including the roots.
 *
 * An edge that names a node outside the list is an error rather than a silent
 * stop: a broken edge is the difference between "nothing is derived" and "the
 * derivation table is incomplete", and those need different fixes.
 */
export function closure(nodes: Node[], roots: string[]): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    for (const parent of node.from) {
      if (!byId.has(parent)) throw new Error(`${node.id} derives from unknown ${parent}`);
    }
  }
  for (const root of roots) {
    if (!byId.has(root)) throw new Error(`root ${root} is not a node`);
  }

  // Invert the table once: from an input to everything computed from it.
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    for (const parent of node.from) {
      const list = children.get(parent) ?? [];
      list.push(node.id);
      children.set(parent, list);
    }
  }

  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const child of children.get(id) ?? []) {
      if (!seen.has(child)) queue.push(child);
    }
  }
  return [...seen];
}

/** Nodes that no root can reach: the copies with no path from the deletion. */
export function unreachable(nodes: Node[], roots: string[]): string[] {
  const reachable = new Set(closure(nodes, roots));
  return nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id);
}

export function demo(): { id: string; from: string; reachable: boolean }[] {
  const reachable = new Set(closure(NODES, ROOTS));
  return NODES.map((node) => ({
    id: node.id,
    from: node.from.length === 0 ? "(none)" : node.from.join(", "),
    reachable: reachable.has(node.id),
  }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# eight nodes, three roots\n");
  console.log("  node           from                 in closure");
  for (const row of rows) {
    console.log(`  ${row.id.padEnd(14)} ${row.from.padEnd(20)} ${row.reachable ? "yes" : "no"}`);
  }
  const found = rows.filter((r) => r.reachable).length;
  console.log(`\n  ${found} of ${rows.length} nodes are reachable from ${ROOTS.length} roots.`);
  console.log("");
  console.log("  the two unreachable copies are not a bug in the walk. They are writes");
  console.log("  that never named an input, so the graph has no edge to follow. A row");
  console.log("  filter would remove the three roots and stop, leaving five artefacts,");
  console.log("  two of which nothing on the record can find.");
}

if (import.meta.main) report(demo());
