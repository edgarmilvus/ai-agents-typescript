// Exercise 3, file 1 of 3 — the closure, with no store.
//
// A node names its inputs. The closure starts at the roots and follows the
// inverted edges forward, which is the direction a deletion needs: from what
// the tenant owns, to what was computed from it.
//
// This file has no tenant, no store and no deletion. It is the graph and the
// two errors a broken graph can make.

export interface Node {
  id: string;
  from: string[];
}

/** Validate every edge before walking any of them. */
export function validate(nodes: Node[]): void {
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length) throw new Error("duplicate node id");
  for (const node of nodes) {
    for (const parent of node.from) {
      if (!ids.has(parent)) throw new Error(`${node.id} derives from unknown ${parent}`);
    }
  }
}

/** The roots and everything derived from them, transitively. */
export function closure(nodes: Node[], roots: string[]): string[] {
  validate(nodes);
  const ids = new Set(nodes.map((node) => node.id));
  for (const root of roots) if (!ids.has(root)) throw new Error(`root ${root} is not a node`);

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
    for (const child of children.get(id) ?? []) if (!seen.has(child)) queue.push(child);
  }
  return [...seen];
}

/** Nodes no root can reach, in table order. */
export function unreachable(nodes: Node[], roots: string[]): string[] {
  const reachable = new Set(closure(nodes, roots));
  return nodes.filter((node) => !reachable.has(node.id)).map((node) => node.id);
}
