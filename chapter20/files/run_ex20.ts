// Chapter 20 harness.
//
//   node chapter20/files/run_ex20.ts
//
// Offline: three adapters over static wires, one port and nine probes.

import { alpha, beta, gamma } from "../adapters.ts";
import { runBuild } from "../agent.ts";
import { measure, probeIds } from "../probes.ts";
import { complete, finishOf, mapError, WireError } from "../port.ts";

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

const request = { system: "refund policy v3", messages: ["refund A-1"], tools: [], maxTokens: 200 };

// 1 — the port
{
  const alphaText = await complete(alpha, { ...request, tools: ["issue_refund"] }, "text");
  equal("alpha assembles the answer", alphaText.text, "The refund is within the window.");
  equal("alpha reports thirty tokens", alphaText.usage.input + alphaText.usage.output, 30);
  equal("alpha finishes with stop", alphaText.finish, "stop");

  const betaText = await complete(beta, { ...request, tools: ["issue_refund"] }, "text");
  equal("beta assembles the same answer plus the policy", betaText.text, "The refund is within the window. Policy applies.");
  equal("beta reports thirty tokens too", betaText.usage.input + betaText.usage.output, 30);
  equal("beta's end_turn becomes stop", betaText.finish, "stop");

  const betaTool = await complete(beta, { ...request, tools: ["issue_refund"] }, "tool");
  equal("beta's arguments are an object", betaTool.toolCalls[0]?.args, { orderId: "A-1" });
  equal("beta's call id is preserved", betaTool.callId, "call_1");
  equal("beta's tool finish is tool_call", betaTool.finish, "tool_call");
}

// 2 — the finish vocabulary
{
  equal("stop is stop", finishOf("stop"), "stop");
  equal("end_turn is stop", finishOf("end_turn"), "stop");
  equal("tool_use is tool_call", finishOf("tool_use"), "tool_call");
  equal("max_tokens is length", finishOf("max_tokens"), "length");
  equal("an unknown reason is not a crash", finishOf("something_new"), "stop");
}

// 3 — the error vocabulary
{
  const rate = mapError(new WireError("rate_limit", 2));
  equal("a rate limit is typed", rate.kind, "rate_limit");
  equal("and keeps the delay", rate.retryAfter, 2);
  equal("a context overflow is typed", mapError(new WireError("context_length_exceeded")).kind, "context");
  equal("anything else is wire", mapError(new WireError("server_error")).kind, "wire");
}

// 4 — capability
{
  equal("alpha can call tools", alpha.capabilities.tools, true);
  equal("gamma cannot", gamma.capabilities.tools, false);
  equal("gamma is the same port", gamma.name, "gamma");
  let refused = false;
  try {
    await complete(gamma, { ...request, tools: ["issue_refund"] }, "tool");
  } catch (error) {
    refused = (error as Error).name === "Unsupported";
  }
  check_("complete refuses tools on gamma", refused);
}

// 5 — the builds
{
  const hardAlpha = await runBuild("hardcoded", alpha, "text");
  check_("hardcoded works on alpha", hardAlpha.ok);
  const hardBeta = await runBuild("hardcoded", beta, "text");
  equal("hardcoded crashes on beta", hardBeta.ok, false);
  if (!hardBeta.ok) equal("with the provider's message", hardBeta.error.message, "max_output_tokens is required");

  const thinRate = await runBuild("thin", beta, "rate");
  equal("thin has no error vocabulary", thinRate.ok ? "ok" : thinRate.error.kind, "unknown");

  const contractRate = await runBuild("contract", beta, "rate");
  check_("contract types the rate limit", !contractRate.ok && contractRate.error.kind === "rate_limit");
  if (!contractRate.ok) equal("and keeps the delay", contractRate.error.retryAfter, 2);

  const contractGamma = await runBuild("contract", gamma, "tool");
  check_("contract refuses a model without tools", !contractGamma.ok && contractGamma.error.kind === "unsupported");

  const thinGamma = await runBuild("thin", gamma, "tool");
  check_("thin answers without noticing", thinGamma.ok && thinGamma.result.toolCalls.length === 0);
}

// 6 — the matrix
{
  const hard = await measure("hardcoded");
  const thin = await measure("thin");
  const contract = await measure("contract");
  equal("nine probes", probeIds().length, 9);
  equal("hardcoded passes none", hard.passed, 0);
  equal("thin passes six", thin.passed, 6);
  equal("contract passes all nine", contract.passed, 9);
  equal("thin fails errors and capability", thin.rows.filter((row) => !row.pass).map((row) => row.probe), [
    "p6-rate-limit",
    "p7-context",
    "p9-capability",
  ]);
  equal("hardcoded fails every behaviour", hard.rows.filter((row) => !row.pass).length, 9);
  check_("contract fails nothing", contract.rows.every((row) => row.pass));
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) process.exit(1);
