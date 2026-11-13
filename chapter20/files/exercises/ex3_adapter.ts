// Exercise 3, file 2 of 3 — the adapters.
//
// An adapter owns two things the port does not: the wire and the capabilities.
// `alpha` and `beta` send the same answer in different shapes, and a caller can
// see which one it is holding without reading either shape.
//
// `beta` also declares that it cannot stream. The port does not care; the
// capability is there for the caller that does.

import type { Event, Raw } from "./ex3_port.ts";
import { read } from "./ex3_port.ts";

export interface Capabilities {
  tools: boolean;
  streaming: boolean;
}

export interface Adapter {
  name: string;
  capabilities: Capabilities;
  raw(): Raw[];
  events(): Event[];
}

export function makeAdapter(name: string, capabilities: Capabilities, raw: () => Raw[]): Adapter {
  return {
    name,
    capabilities,
    raw,
    events: () => read(raw()),
  };
}

export const alpha: Adapter = makeAdapter(
  "alpha",
  { tools: true, streaming: true },
  () => [
    { type: "delta", text: "Hello " },
    { type: "delta", text: "world" },
    { type: "end", reason: "stop" },
  ],
);

export const beta: Adapter = makeAdapter(
  "beta",
  { tools: true, streaming: false },
  () => [
    { type: "text", text: "Hello " },
    { type: "text", text: "world" },
    { type: "end", reason: "end_turn" },
  ],
);
