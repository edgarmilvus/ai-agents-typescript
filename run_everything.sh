#!/bin/sh
# Run every runnable program in this repository, live, then every harness.
#
#   ./run_everything.sh                 # fresh recordings, every program, harnesses
#   ./run_everything.sh --keep          # keep existing recordings
#
# There are no exceptions in the program pass:
#   - every chapterN/files/NN_*.ts, including recorders, live demos, renderers;
#   - every chapterN/files/exercises/ex*.ts solution;
#   - every harness.
#
# This is destructive by design: without --keep it deletes fixtures, recordings
# and saved runs before running. Run it on a copy, never on the copy you keep.
#
# Provider: any OpenAI-compatible endpoint. Defaults are OpenRouter and
# ~deepseek/deepseek-flash-latest; set OPENAI_COMPATIBLE_API_KEY first, and
# change OPENAI_COMPATIBLE_BASE_URL / OPENAI_COMPATIBLE_MODEL for another one.

set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"

KEEP=0
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    -h|--help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "run_everything.sh: unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [ -z "${OPENAI_COMPATIBLE_API_KEY:-}" ]; then
  echo "no key: set OPENAI_COMPATIBLE_API_KEY before a live run" >&2
  exit 1
fi

# This is the live pass: clear any replay flag inherited from the shell.
unset AGENTLAB_REPLAY

echo "== provider"
node -e '
import("./lib/model.ts").then((m) => {
  console.log("  base URL:", m.modelBaseUrl());
  console.log("  model   :", m.modelName());
});
'

run() {
  printf '\n== %s\n' "$*"
  "$@"
}

BACKUP=".live_backup"
rm -rf "$BACKUP"
mkdir -p "$BACKUP"
cp -R fixtures "$BACKUP/fixtures" 2>/dev/null || true
cp -R chapter4/recordings "$BACKUP/recordings" 2>/dev/null || true
cp -R chapter8/runs "$BACKUP/runs8" 2>/dev/null || true
for n in 11 12 13 14; do cp -R chapter$n/runs "$BACKUP/runs$n" 2>/dev/null || true; done

if [ "$KEEP" -eq 0 ]; then
  echo
  echo "== fresh recordings"
  rm -f fixtures/*.json
  rm -f chapter4/recordings/*.json
  rm -f chapter8/runs/*.json
  for n in 11 12 13 14; do rm -f chapter$n/runs/*.json; done
  echo "  fixtures and recordings cleared"
fi

echo
echo "== every chapter program"
for n in $(seq 1 20); do
  for f in chapter$n/files/[0-9][0-9]_*.ts; do
    [ -f "$f" ] || continue
    run node "$f"
  done
done

echo
echo "== every exercise program"
for n in $(seq 1 20); do
  for f in chapter$n/files/exercises/ex*.ts; do
    [ -f "$f" ] || continue
    run node "$f"
  done
done

echo
echo "== restoring the committed recordings for the gate"
rm -rf fixtures chapter4/recordings chapter8/runs
cp -R "$BACKUP/fixtures" fixtures
cp -R "$BACKUP/recordings" chapter4/recordings
cp -R "$BACKUP/runs8" chapter8/runs
for n in 11 12 13 14; do rm -rf chapter$n/runs; cp -R "$BACKUP/runs$n" chapter$n/runs; done

echo
echo "== every harness"
export AGENTLAB_REPLAY=1
for n in $(seq 1 20); do
  h="chapter$n/files/run_ex$n.ts"
  [ -f "$h" ] && run node "$h"
  e="chapter$n/files/exercises/run_exercises.ts"
  [ -f "$e" ] && run node "$e"
done
unset AGENTLAB_REPLAY

printf '\nevery program ran and every harness is green\n'
