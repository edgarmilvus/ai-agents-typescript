// Chapter 14 — what the agent keeps, and when it stops being true.
//
// A memory is a record with a kind, a subject and a source. Three of those
// fields do the work: `kind` decides what a summary is allowed to drop, `about`
// decides what retrieval can find, and `source` decides whether the fact can be
// trusted on the way back out.
//
// Two rules turn a pile of notes into a memory: a record can be superseded by a
// newer one, and a record can expire. Both are the difference between a log and
// a memory — a log only grows, and a memory that only grows is a context window
// with no budget.

export type Kind = "fact" | "decision" | "preference";
export type Source = "principal" | "tool" | "system";

export interface Memory {
  id: string;
  text: string;
  kind: Kind;
  /** The order, customer or topic this is about. Retrieval leans on it. */
  about: string;
  source: Source;
  createdAt: number;
  /** When this stops being true. Absent means it does not expire on its own. */
  expiresAt?: number;
  /** The id of the record this one replaces. */
  supersedes?: string;
  /** Set when a human or a trusted check confirmed a tool-sourced memory. */
  verifiedAt?: number;
}

export interface Store {
  records: Memory[];
  /** Ids that were deleted, kept so a deletion can be audited. */
  deleted: { id: string; at: number }[];
}

export function createStore(records: Memory[] = []): Store {
  return { records: [...records], deleted: [] };
}

/** Four characters to a token, the same estimate the rest of the book uses. */
export function tokensOf(memory: Memory): number {
  return Math.ceil(memory.text.length / 4);
}

export function write(store: Store, record: Memory): Memory {
  const existing = store.records.find((m) => m.id === record.id);
  if (existing) throw new Error(`memory ${record.id} already exists; use a new id and supersede`);
  store.records.push(record);
  return record;
}

/** The id that replaced this one, if any. */
export function replacedBy(store: Store, id: string): string | undefined {
  return store.records.find((m) => m.supersedes === id)?.id;
}

/**
 * The records that are still true at `now`.
 *
 * A record is dead when it has expired, when something newer supersedes it, or
 * when it was deleted. Retrieval only ever sees the live set; the dead ones stay
 * in the store for the audit.
 */
export function live(store: Store, now: number): Memory[] {
  const superseded = new Set(store.records.map((m) => m.supersedes).filter((id): id is string => id !== undefined));
  const deleted = new Set(store.deleted.map((d) => d.id));
  return store.records.filter(
    (m) => !superseded.has(m.id) && !deleted.has(m.id) && (m.expiresAt === undefined || m.expiresAt > now),
  );
}

/** Remove a record from the live set, keeping the fact that it was removed. */
export function forget(store: Store, id: string, at: number): void {
  if (!store.records.some((m) => m.id === id)) throw new Error(`no memory ${id}`);
  store.deleted.push({ id, at });
}

/** Replace a fact with a newer one. The old record stays for the audit. */
export function supersede(store: Store, oldId: string, record: Omit<Memory, "supersedes">): Memory {
  const old = store.records.find((m) => m.id === oldId);
  if (!old) throw new Error(`no memory ${oldId}`);
  return write(store, { ...record, supersedes: oldId, about: record.about || old.about });
}

/**
 * Is this memory safe to act on?
 *
 * A memory that arrived from a tool is a claim by whoever wrote the tool. It
 * becomes usable when somebody confirms it, and until then it is a note the
 * agent may quote and must not act on — the same rule chapter 12 applied to a
 * tool result, applied one layer later.
 */
export function trusted(memory: Memory): boolean {
  return memory.source !== "tool" || memory.verifiedAt !== undefined;
}

/** Confirm a tool-sourced memory, after somebody read it. */
export function confirm(store: Store, id: string, at: number): Memory {
  const memory = store.records.find((m) => m.id === id);
  if (!memory) throw new Error(`no memory ${id}`);
  memory.verifiedAt = at;
  return memory;
}

/** Live records that are also safe to act on. What a retriever should see. */
export function usable(store: Store, now: number): Memory[] {
  return live(store, now).filter(trusted);
}

/** The store's size, in records and in tokens, which is what a budget sees. */
export function size(store: Store, now: number): { records: number; tokens: number } {
  const alive = live(store, now);
  return { records: alive.length, tokens: alive.reduce((sum, m) => sum + tokensOf(m), 0) };
}
