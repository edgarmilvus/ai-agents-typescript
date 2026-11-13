// Exercise 1 — a key you cannot forge.
//
// A tenant id is a key to every store, so it has to be unforgeable. This
// exercise builds one out of an object with a private symbol and a registry,
// and then tries the three forgeries: a string, a copy, and an id from before a
// restart.

const KEY = Symbol("tenant");

export type TenantId = { readonly name: string; readonly [KEY]: true };

const REGISTRY = new Set<TenantId>();

export function mint(name: string): TenantId {
  if ([...REGISTRY].some((id) => id.name === name)) throw new Error(`tenant ${name} exists`);
  const id = { name, [KEY]: true } as TenantId;
  REGISTRY.add(id);
  return id;
}

export function isTenantId(value: unknown): value is TenantId {
  return typeof value === "object" && value !== null && REGISTRY.has(value as TenantId);
}

export function reset(): void {
  REGISTRY.clear();
}

function fresh(name: string): TenantId {
  reset();
  return mint(name);
}

export const CASES: { id: string; note: string; check: () => boolean }[] = [
  { id: "c1-minted", note: "an id from the registry", check: () => isTenantId(fresh("acme")) },
  { id: "c2-string", note: "the same text as the label", check: () => {
    fresh("acme");
    return !isTenantId("acme");
  } },
  { id: "c3-copy", note: "a spread copy of a real id", check: () => !isTenantId({ ...fresh("globex") }) },
  { id: "c4-clone", note: "a structuredClone of a real id", check: () => !isTenantId(structuredClone(fresh("initech"))) },
  { id: "c5-stale", note: "an id from before the registry was cleared", check: () => {
    const id = fresh("umbrella");
    reset();
    return !isTenantId(id);
  } },
];

export function demo() {
  return CASES.map((c) => ({ ...c, ok: c.check() }));
}

export function report(rows: ReturnType<typeof demo>): void {
  console.log("# five forgeries\n");
  for (const row of rows) console.log(`  ${row.id.padEnd(10)} ${(row.ok ? "as expected" : "WRONG").padEnd(12)} ${row.note}`);
  console.log("\n  one acceptance and four refusals, which is the shape a key needs: the");
  console.log("  registry holds objects, not names, so only the mint can produce one. The");
  console.log("  mint is a function call that no config file can reach.");
  console.log("");
  console.log("  structuredClone is the interesting case: it copies own enumerable");
  console.log("  properties and drops the symbol, so the copy looks like an id and is a");
  console.log("  plain object. That is why the check is identity and not a shape.");
}

if (import.meta.main) report(demo());
