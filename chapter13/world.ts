// Chapter 13 — the world, and why an approval has to survive a crash.
//
// Approvals are about the moment between a decision and an effect. That moment
// is where a process dies, and a process that dies after the refund has left
// the desk and before the run has recorded it will refund again on restart
// unless the effect itself carries a key.
//
// So the world is an append-only list of effects, each with the key of the
// action that produced it, and `apply` is idempotent on that key. Exactly-once
// is not a property of the run; it is a property of the pair.

export interface Effect {
  /** `runId/actionHash`, so two runs doing the same thing are still two effects. */
  key: string;
  tool: string;
  args: Record<string, unknown>;
  at: number;
}

export interface World {
  effects: Effect[];
}

export function createWorld(): World {
  return { effects: [] };
}

export interface Applied {
  applied: boolean;
  effect?: Effect;
}

/** Apply an effect once per key; a second call is a no-op that says so. */
export function apply(world: World, key: string, tool: string, args: Record<string, unknown>, at: number): Applied {
  const existing = world.effects.find((effect) => effect.key === key);
  if (existing) return { applied: false, effect: existing };
  const effect: Effect = { key, tool, args, at };
  world.effects.push(effect);
  return { applied: true, effect };
}

/** What the desk did, in order, for the audit. */
export function ledger(world: World): string[] {
  return world.effects.map((effect) => `${effect.tool} ${JSON.stringify(effect.args)} at ${effect.at}`);
}
