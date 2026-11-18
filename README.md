# AI Agents in TypeScript — the code

The runnable companion to *AI Agents in TypeScript*. Twenty chapters, no
dependencies, Node's own TypeScript support, and recorded model turns so the
whole suite runs offline in about fifteen seconds.

This repository is the code, not the book. The prose, diagrams and exercises
live in the book itself; here you get the modules, the demos, the harnesses and
the exercise solutions that the text discusses.

For the book itself — description, sample chapters and the full table of
contents — see **[AI Agents in TypeScript](https://tiny.cc/TypescriptAgents)**.

## The twenty chapters

Each chapter number and title links to its directory in this repository.

| # | title | what the code shows |
| --- | --- | --- |
| [1](chapter1/) | [The Loop, the State, the Tool Surface](chapter1/) | the agent loop, a tool registry, replay |
| [2](chapter2/) | [Contracts — Schemas, Descriptions and the Repair Loop](chapter2/) | schema validation and repair |
| [3](chapter3/) | [The Protocol Boundary — Discovering, Scoping and Surviving MCP Tools](chapter3/) | an MCP client and server |
| [4](chapter4/) | [Recordings — Making a Test Mean Something](chapter4/) | recording, replay, divergence |
| [5](chapter5/) | [Grading — What "Right" Means When the Model Varies](chapter5/) | rubrics and graders |
| [6](chapter6/) | [Statistics — How Often, and How Much of That Number Is Noise](chapter6/) | intervals and streaks |
| [7](chapter7/) | [The Judge Is a Model — Auditing Renders When the Grader Has a Variance](chapter7/) | model judges, audits |
| [8](chapter8/) | [Which Part Moved — Attributing a Failed Run to the Component That Caused It](chapter8/) | run attribution and traces |
| [9](chapter9/) | [Who Tests the Tests — Mutation, Survivors and a Gate That Can Fail](chapter9/) | mutation testing |
| [10](chapter10/) | [The Traffic You Did Not Write — Shadow Runs, Drift and a Canary That Rolls Back](chapter10/) | shadow traffic, drift, canary |
| [11](chapter11/) | [The Handoff — What Crosses the Seam When One Agent Calls Another](chapter11/) | agent-to-agent handoff |
| [12](chapter12/) | [The Tool Is an Attack Surface — Injections, Taint and the Policy at the Boundary](chapter12/) | taint tracking and policy |
| [13](chapter13/) | [The Human Boundary — Approvals, Durable Runs and Doing It Exactly Once](chapter13/) | approvals, durable runs |
| [14](chapter14/) | [What the Agent Keeps — Memory, Retrieval and the Cost of Remembering](chapter14/) | memory and retrieval |
| [15](chapter15/) | [The Budget Is a Design Constraint — Routing, Caching and What the Loop Costs](chapter15/) | routing, caching, budgets |
| [16](chapter16/) | [The Loop That Does Not Close — Incidents, Fixtures and Continuous Evaluation](chapter16/) | incidents, fixtures, the book's ledger |
| [17](chapter17/) | [One Agent, Many Customers — Tenancy and the Leak You Cannot See](chapter17/) | tenant ids, scoped stores, probes |
| [18](chapter18/) | [The Customer Who Left — Deletion and the Data That Outlives It](chapter18/) | lineage, closures, tombstones |
| [19](chapter19/) | [The Customer Who Hung Up — Streaming, Cancellation and the Cost of Silence](chapter19/) | signal propagation, partial billing |
| [20](chapter20/) | [The Model That Changed Underneath — Portability and the Contract at the Boundary](chapter20/) | ports, adapters, conformance |

## Requirements

- **Node 24 or later.** The code uses type stripping and `import.meta.main`, so
  there is no build step and no `tsconfig.json`.
- No `npm install`. Nothing is vendored except the recorded fixtures.

## Run the offline suite

```bash
./run_offline.sh              # every chapter: demos, then harnesses
./run_offline.sh 7            # chapter 7 only
```

This is the normal run and it never touches the network. Each chapter's agent
executes and prints the transcript the book reads, then its harness asserts on
the same modules. Output is saved under `chapterN/output/`.

Expected shape:

```
== chapter 1
  01_the_loop.ts                   10 lines
  02_tool_surface.ts               13 lines
  03_support_triage_run.ts         25 lines
== chapter 2
  ...
103 demo(s), 39 harness(es), all ok
```

The script exits non-zero on the first demo or harness that fails and prints its
last twenty lines.

## Demos and the gate

```bash
./run_offline.sh --demos      # every chapter: demos only
./run_offline.sh --no-demos   # every chapter: harnesses only
```

The harnesses are the separate gate. They are also real code: each `run_exN.ts`
imports the chapter's modules and asserts on their state. The demos show what
the code does; the harnesses decide whether it is correct.

`--all` is accepted as an explicit spelling of the default. The runner skips the
recording and live-model files (`*_record*`, `*live*`); those run only in the
live pass below. A single demo is just a file:

```bash
node chapter7/files/01_first_audit.ts
node chapter17/files/02_probes.ts
node chapter20/files/03_matrix.ts
```

## Run everything live

`run_everything.sh` is the only entry point that calls a provider. It runs
**every** runnable program — every `chapterN/files/NN_*.ts` (demos, recorders,
live programs, the render generator), every
`chapterN/files/exercises/ex*.ts` solution — and then the harnesses.

```bash
export OPENAI_COMPATIBLE_API_KEY=your-key
./run_everything.sh            # fresh recordings, every program, then harnesses
./run_everything.sh --keep     # do not delete existing recordings
```

It saves the committed fixtures before the live pass and restores them before
the harness, so live behaviour does not rewrite the gate. Destructive by design:
run it on a copy. Defaults are OpenRouter and
`~deepseek/deepseek-flash-latest`; a full pass takes 10–20 minutes.

## Offline by default

`run_offline.sh` exports `AGENTLAB_REPLAY=1`, which makes `lib/scenario.ts` answer
from `fixtures/*.json` instead of calling a model. The same applies to the
chapter recordings in `chapter4/recordings/` and the saved runs in
`chapter8/runs/`, `chapter11/runs/`, `chapter12/runs/`, `chapter13/runs/` and
`chapter14/runs/`.

There is no provider selector. The adapter sends the same chat-completions
request to whatever these three variables name:

```bash
export OPENAI_COMPATIBLE_BASE_URL=https://openrouter.ai/api/v1   # default
export OPENAI_COMPATIBLE_MODEL=~deepseek/deepseek-flash-latest   # default
export OPENAI_COMPATIBLE_API_KEY=your-key
```

The key is the only variable a normal live run needs. Change the base URL and
model only to point at another OpenAI-compatible endpoint.

## When something does not start

| message | what it means |
| --- | --- |
| `node: command not found` | Node is not installed, or not on `PATH`. Check `node -v`; you need 24 or later. |
| `Unknown file extension ".ts"` | The Node you are running is older than 24 and cannot strip types. Install Node 24 and check again. |
| `ERR_MODULE_NOT_FOUND` on `lib/…` or `fixtures/…` | You ran the file from inside `files/`. Run it from the repository root, or use `./run_offline.sh N`. |
| `permission denied: ./run_offline.sh` | `chmod +x run_offline.sh run_everything.sh`, once. |
| `fetch failed` / `ECONNREFUSED` during the offline suite | Something ran without `AGENTLAB_REPLAY=1`. Use the script, or export the variable yourself. |
| `OPENAI_COMPATIBLE_API_KEY` unset | Only the live pass needs it. The offline suite never reads it. |

## Windows and PowerShell

The TypeScript code is portable; `run_offline.sh` and `run_everything.sh` are POSIX shell scripts, so Windows has three workable setups.

**WSL 2 (recommended).** Install Node 24 inside the Linux distribution, then work from the mounted repository:

```bash
cd /mnt/c/Users/YOU/ai-agents-typescript
./run_offline.sh
```

**Git Bash.** Install Git for Windows, put Node on `PATH`, open Git Bash in the repository, and run the same commands as on macOS or Linux.

**PowerShell directly, without the `.sh` scripts.** Every script is a convenience around `node`. Run programs and harnesses directly:

```powershell
cd $HOME\ai-agents-typescript
node chapter1\files\01_the_loop.ts
node chapter1\files\run_ex1.ts
node chapter1\files\exercises\run_exercises.ts
```

Every harness in the repository:

```powershell
Get-ChildItem chapter*\files\run_ex*.ts, chapter*\files\exercises\run_exercises.ts |
  ForEach-Object { node $_.FullName }
```

PowerShell environment variables use a different syntax:

```powershell
$env:OPENAI_COMPATIBLE_API_KEY = "your-key"
$env:OPENAI_COMPATIBLE_BASE_URL = "https://openrouter.ai/api/v1"
$env:OPENAI_COMPATIBLE_MODEL = "~deepseek/deepseek-flash-latest"
```

Copying and removing a live copy:

```powershell
Copy-Item -Recurse ai-agents-typescript ai-agents-typescript-live
Remove-Item -Recurse -Force ai-agents-typescript-live
```

`run_everything.sh` is destructive by design; run it on a copy, never on the copy you keep. If a script reports `Permission denied` under WSL or Git Bash, make it executable once:

```bash
chmod +x run_offline.sh run_everything.sh
```

## What is where

```text
chapter1/ … chapter20/
  <module>.ts            the mechanism the chapter is about
  files/                 the demos, plus run_exN.ts
  files/exercises/       five exercise solutions and run_exercises.ts
  recordings/ runs/      chapter-specific saved responses, where the chapter has them
  spec.yaml              the chapter's contract and gate strings
fixtures/                recorded model turns shared by the early chapters
lib/                     the OpenAI-compatible adapter and record/replay helper
run_offline.sh            the offline runner described above
run_everything.sh        the live pass described above
```

Every chapter is self-contained except for the shared `lib/` and `fixtures/`,
and for the deliberate imports where a later chapter reuses an earlier
chapter's module (chapter 18 imports chapter 17's tenant, for example). There is
no package graph to install.

## A note on the numbers

Every number the book quotes comes from one of these runs or from the fixtures
those runs produced. If you change a demo, run its chapter harness: the
assertions are the reason the prose can be specific.

## License

MIT. See `LICENSE`.
