// 20.4 — a rate limit is not a string.
//
// The provider returns the same fact to all three builds: the request was rate
// limited, and it should be retried after two seconds. The difference is what
// the agent can do with that fact.
//
// A crash is not a retry policy, and `unknown` is not a taxonomy. The contract
// build is the only one that can branch without parsing a message.

import { beta } from "../adapters.ts";
import { runBuild } from "../agent.ts";
import type { Build } from "../agent.ts";

const builds: Build[] = ["hardcoded", "thin", "contract"];

console.log("# a rate limit is not a string\n");
console.log("  the provider says: 429 rate_limit, retry after 2s\n");

for (const build of builds) {
  const outcome = await runBuild(build, beta, "rate");
  if (outcome.ok) {
    console.log(`  ${build.padEnd(10)} ok — it should not have been`);
  } else if (outcome.error.kind === "rate_limit") {
    console.log(`  ${build.padEnd(10)} rate_limit, retry after ${outcome.error.retryAfter}s`);
  } else {
    console.log(`  ${build.padEnd(10)} ${outcome.error.kind}${outcome.error.message ? ` — ${outcome.error.message}` : ""}`);
  }
}

console.log("\n  the contract build can schedule the retry because the number is a field.");
console.log("  The thin build has to parse a message it deliberately did not keep, and");
console.log("  the hardcoded build has already thrown away the run.");
