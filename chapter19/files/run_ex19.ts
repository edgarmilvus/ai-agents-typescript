// Chapter 19 harness.
//
//   node chapter19/files/run_ex19.ts
//
// Offline: the model is a script of eight chunks and the clock is a microtask.

import { makeEnv, run, SCRIPT } from "../stream.ts";
import { measure, probeIds } from "../probes.ts";

let checks = 0;
let failures = 0;

function check_(name: string, ok: boolean, detail?: unknown): void {
  checks += 1;
  if (ok) console.log(`PASS ${name}`);
  else {
    failures += 1;
    console.log(`FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check_(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

// 1 — a finished run
{
  const env = await run(makeEnv("chain"), {});
  equal("a full run makes two model calls", env.modelCalls, 2);
  equal("and streams both turns", env.chunks, SCRIPT.length * 2);
  equal("and bills every chunk", env.spent, 48);
  equal("and writes the refund", env.effects, ["refund:A-1"]);
  equal("and writes a summary of what it said", env.summary, env.out.trim());
  check_("the summary is not empty", (env.summary ?? "").length > 20);
  equal("and records a complete ledger", env.ledger, "complete");
}

// 2 — a hang-up mid-stream
{
  const chain = await run(makeEnv("chain"), { abortAt: "chunk", after: 3 });
  equal("the chain stops after three chunks", chain.chunks, 3);
  equal("and bills nine tokens", chain.spent, 9);
  equal("and records cancellation", chain.ledger, "cancelled");
  equal("and writes no summary", chain.summary, undefined);
  equal("and never reaches the tool", chain.effects.length, 0);

  const signal = await run(makeEnv("signal"), { abortAt: "chunk", after: 3 });
  equal("the boundary signal also stops the stream", signal.chunks, 3);
  equal("but still records completion", signal.ledger, "complete");
  equal("and the partial text is what the customer saw", signal.out, "I checked the ");
}

// 3 — a consumer that stops reading
{
  const chain = await run(makeEnv("chain"), { stopAfter: 3 });
  equal("a consumer return is a cancellation in the chain", chain.ledger, "cancelled");
  equal("and no summary is written", chain.summary, undefined);
  const signal = await run(makeEnv("signal"), { stopAfter: 3 });
  equal("the boundary signal misses the consumer return", signal.summary !== undefined, true);
  equal("and records completion", signal.ledger, "complete");
}

// 4 — a hang-up during the tool
{
  const chain = await run(makeEnv("chain"), { abortAt: "tool" });
  equal("the chain writes no refund", chain.effects, []);
  equal("and still bills the turn it streamed", chain.spent, 24);
  equal("and records cancellation", chain.ledger, "cancelled");
  const signal = await run(makeEnv("signal"), { abortAt: "tool" });
  equal("the boundary signal writes the refund", signal.effects, ["refund:A-1"]);
  equal("and records completion", signal.ledger, "complete");
}

// 5 — a hang-up during the backoff
{
  const chain = await run(makeEnv("chain"), { failFirst: true, abortAt: "backoff" });
  equal("the chain does not retry", chain.retries, 0);
  equal("and stops after the failed call", chain.modelCalls, 1);
  const signal = await run(makeEnv("signal"), { failFirst: true, abortAt: "backoff" });
  equal("the boundary signal retries", signal.retries, 1);
  equal("which is a model call it did not need", signal.modelCalls, 2);
}

// 6 — a hang-up before the start
{
  const chain = await run(makeEnv("chain"), { abortAt: "start" });
  equal("nothing is called when the tab closes first", chain.modelCalls, 0);
  equal("and nothing is billed", chain.spent, 0);
  equal("and the ledger is cancelled", chain.ledger, "cancelled");
}

// 7 — the matrix
{
  const leak = await measure("leak");
  const signal = await measure("signal");
  const chain = await measure("chain");
  equal("eight probes", probeIds().length, 8);
  equal("the leak leaks everywhere", [leak.leaked, leak.clean], [8, 0]);
  equal("the boundary signal fixes four", [signal.leaked, signal.clean], [4, 4]);
  equal("the chain fixes all eight", [chain.leaked, chain.clean], [0, 8]);
  equal(
    "the boundary signal misses tool, return, backoff, ledger",
    signal.rows.filter((row) => row.leaked).map((row) => row.probe),
    ["p3-tool-effect", "p5-consumer-return", "p6-backoff", "p8-ledger"],
  );
  check_("every probe names a link", chain.rows.every((row) => row.link.length > 3));
}

// 8 — the three ledger rows
{
  const finished = await run(makeEnv("chain"), {});
  const cancelled = await run(makeEnv("chain"), { abortAt: "chunk", after: 3 });
  const boundary = await run(makeEnv("signal"), { abortAt: "chunk", after: 3 });
  equal("finished: complete", finished.ledger, "complete");
  equal("cancelled: cancelled", cancelled.ledger, "cancelled");
  equal("boundary: complete", boundary.ledger, "complete");
  equal("two cancelled runs cost the same", [cancelled.spent, boundary.spent], [9, 9]);
  check_("the finished run costs more", finished.spent > cancelled.spent);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
