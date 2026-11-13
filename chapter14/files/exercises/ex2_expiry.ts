// Exercise 2 — facts that expire and facts that are replaced.
//
// Two operations separate a memory from a log: a record can stop being true at
// a known time, and a record can be replaced by a better one. This exercise
// builds both and prints the live set at three moments, because the moment is
// the thing an expiry test has to vary.

export interface Record {
  id: string;
  text: string;
  createdAt: number;
  expiresAt?: number;
  replaces?: string;
}

export interface Store {
  records: Record[];
  removed: string[];
}

export function store(records: Record[] = []): Store {
  return { records: [...records], removed: [] };
}

export function isLive(record: Record, now: number, replaced: Set<string>, removed: Set<string>): boolean {
  if (removed.has(record.id)) return false;
  if (replaced.has(record.id)) return false;
  return record.expiresAt === undefined || record.expiresAt > now;
}

export function live(s: Store, now: number): Record[] {
  // A record that has not been written yet cannot replace anything yet.
  const existing = s.records.filter((r) => r.createdAt <= now);
  const replaced = new Set(existing.map((r) => r.replaces).filter((id): id is string => id !== undefined));
  const removed = new Set(s.removed);
  return existing.filter((r) => isLive(r, now, replaced, removed));
}

export function replace(s: Store, oldId: string, next: Omit<Record, "replaces">): Record {
  if (!s.records.some((r) => r.id === oldId)) throw new Error(`no record ${oldId}`);
  const record: Record = { ...next, replaces: oldId };
  s.records.push(record);
  return record;
}

export function remove(s: Store, id: string): void {
  if (!s.records.some((r) => r.id === id)) throw new Error(`no record ${id}`);
  s.removed.push(id);
}

export const RECORDS: Record[] = [
  { id: "r1", text: "ceiling is 500", createdAt: 1 },
  { id: "r2", text: "temporary exception until Friday", createdAt: 2, expiresAt: 10 },
  { id: "r3", text: "ceiling is 400", createdAt: 3 },
  { id: "r4", text: "courier is Northwind", createdAt: 4, expiresAt: 20 },
];

export function demo() {
  const s = store(RECORDS);
  // r5 replaces r3 at tick 5: the ceiling changed to 450.
  replace(s, "r3", { id: "r5", text: "ceiling is 450", createdAt: 5 });
  const at = (now: number) => live(s, now).map((r) => r.id);
  return [
    { now: 4, live: at(4) },
    { now: 6, live: at(6) },
    { now: 12, live: at(12) },
    { now: 21, live: at(21) },
  ];
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# the live set at four moments\n");
  console.log("  tick  live");
  for (const row of rows) console.log(`  ${String(row.now).padEnd(4)}  ${row.live.join(", ")}`);
  console.log("\n  r2 disappears at 10 and r4 at 20: an expiry is a fact with a clock.");
  console.log("  r3 disappears at 5 and r5 takes its place: a replacement is a fact with");
  console.log("  an author, and the store still holds r3 so the audit can show what was");
  console.log("  believed before and why it changed.");
}

if (import.meta.main) report(demo());
