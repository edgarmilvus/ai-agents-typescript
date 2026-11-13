// Chapter 19 — one run, six phases, and a signal that has to reach all of them.
//
// The agent's work is a sequence: start, stream a turn, run a tool, stream a
// second turn, write a summary, write the ledger. A customer who hangs up
// during any phase is asking for the rest to stop, and the three modes differ
// in how far that request travels.
//
// `leak` never listens. `signal` listens at the phase boundaries and inside the
// model stream, which is where an HTTP handler usually checks. `chain` threads
// the signal into the tool, the retry and the ledger, and treats an early
// consumer return as a cancellation too.

export type Mode = "leak" | "signal" | "chain";

export type Phase = "start" | "chunk" | "tool" | "turn2" | "backoff" | "summary";

export interface Scenario {
  /** The phase during which the customer hangs up. */
  abortAt?: Phase;
  /** For `chunk`: how many chunks arrive before the hang-up. */
  after?: number;
  /** For a consumer that stops reading without aborting. */
  stopAfter?: number;
  /** The first model call fails, so the run has to decide whether to retry. */
  failFirst?: boolean;
}

export type LedgerStatus = "open" | "complete" | "cancelled";

export interface Env {
  mode: Mode;
  /** The text the customer saw. */
  out: string;
  chunks: number;
  modelCalls: number;
  toolRuns: number;
  /** Side effects a tool committed. */
  effects: string[];
  summary?: string;
  ledger: LedgerStatus;
  /** Tokens billed, counted as they are produced. */
  spent: number;
  retries: number;
}

export interface Chunk {
  text: string;
  tokens: number;
}

/** Eight chunks, three tokens each. The whole answer costs 24 tokens. */
export const SCRIPT: Chunk[] = [
  { text: "I ", tokens: 3 },
  { text: "checked ", tokens: 3 },
  { text: "the ", tokens: 3 },
  { text: "order. ", tokens: 3 },
  { text: "It ", tokens: 3 },
  { text: "is ", tokens: 3 },
  { text: "within ", tokens: 3 },
  { text: "the window.", tokens: 3 },
];

export function makeEnv(mode: Mode): Env {
  return {
    mode,
    out: "",
    chunks: 0,
    modelCalls: 0,
    toolRuns: 0,
    effects: [],
    ledger: "open",
    spent: 0,
    retries: 0,
  };
}

function aborted(): DOMException {
  return new DOMException("the customer hung up", "AbortError");
}

/**
 * The model stream.
 *
 * Every chunk is billed when it is produced, not when it is delivered, which is
 * why a cancelled run still costs something: those tokens were generated. The
 * check before each chunk is the first place a signal has to arrive, and the
 * only place `signal` mode checks during a turn.
 */
export async function* streamModel(env: Env, signal: AbortSignal): AsyncGenerator<Chunk> {
  for (const chunk of SCRIPT) {
    if (env.mode !== "leak" && signal.aborted) throw aborted();
    env.spent += chunk.tokens;
    yield chunk;
    await Promise.resolve();
  }
}

/**
 * The refund tool, in three steps.
 *
 * The steps are the window in which a hang-up can arrive, and the `checks`
 * flag is the difference between a tool that knows about the signal and one
 * that does not. A tool that commits on its last step can be interrupted on the
 * first; a tool that commits on its first cannot be stopped at all, which is a
 * property of the tool and not of the cancellation.
 */
export async function refundTool(env: Env, signal: AbortSignal, checks: boolean): Promise<"done" | "aborted"> {
  env.toolRuns += 1;
  for (let step = 0; step < 3; step += 1) {
    if (checks && signal.aborted) return "aborted";
    await Promise.resolve();
  }
  env.effects.push("refund:A-1");
  return "done";
}

async function turn(
  env: Env,
  signal: AbortSignal,
  scenario: Scenario,
  abort: () => void,
): Promise<"done" | "aborted" | "stopped"> {
  env.modelCalls += 1;
  let seen = 0;

  try {
    for await (const chunk of streamModel(env, signal)) {
      seen += 1;
      env.chunks += 1;
      env.out += chunk.text;
      if (scenario.abortAt === "chunk" && seen === (scenario.after ?? 3)) abort();
      if (scenario.stopAfter !== undefined && seen >= scenario.stopAfter) return "stopped";
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") return "aborted";
    throw error;
  }
  return "done";
}

function finish(env: Env, cancelled: boolean): Env {
  env.ledger = env.mode === "chain" && cancelled ? "cancelled" : "complete";
  return env;
}

/**
 * One conversation, from connect to ledger.
 *
 * The `stop()` predicate is the whole design in one function: `leak` says no,
 * `signal` says yes at boundaries, and `chain` also says yes after an early
 * consumer return. Each phase then asks the same question, which is what makes
 * the behaviour auditable rather than incidental.
 */
export async function run(env: Env, scenario: Scenario = {}): Promise<Env> {
  const controller = new AbortController();
  let cancelled = false;

  const abort = () => {
    cancelled = true;
    controller.abort();
  };
  const stop = () => env.mode !== "leak" && (controller.signal.aborted || cancelled);

  if (scenario.abortAt === "start") abort();
  if (stop()) return finish(env, cancelled);

  if (scenario.failFirst) {
    // The first call failed before producing anything. The retry is a distinct
    // decision, and it is the one a backoff makes easy to forget.
    env.modelCalls += 1;
    if (scenario.abortAt === "backoff") abort();
    if (env.mode === "chain" && controller.signal.aborted) return finish(env, cancelled);
    env.retries += 1;
  }

  const first = await turn(env, controller.signal, scenario, abort);
  if (first === "stopped" && env.mode === "chain") cancelled = true;
  if (stop()) return finish(env, cancelled);

  if (scenario.abortAt === "tool") abort();
  await refundTool(env, controller.signal, env.mode === "chain");
  if (stop()) return finish(env, cancelled);

  if (scenario.abortAt === "turn2") abort();
  if (stop()) return finish(env, cancelled);
  await turn(env, controller.signal, scenario, abort);
  if (stop()) return finish(env, cancelled);

  if (scenario.abortAt === "summary") abort();
  if (stop()) return finish(env, cancelled);
  env.summary = env.out.trim();

  return finish(env, cancelled);
}
