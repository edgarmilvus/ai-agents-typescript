#!/bin/sh
# Run the code for AI Agents in TypeScript, offline.
#
#   ./run_offline.sh              every chapter: demos and harnesses
#   ./run_offline.sh 7            chapter 7: demos and harnesses
#   ./run_offline.sh --demos      demos only
#   ./run_offline.sh --no-demos   harnesses only
#   ./run_offline.sh --all        same as the default, spelled out
#
# The demos execute the chapter's agent and print the transcripts the book
# reads; their output is saved under chapterN/output/. The harnesses are the
# separate gate. Both run offline: AGENTLAB_REPLAY=1 makes the recorded
# fixtures answer, and this script never calls a provider. The live pass is
# run_everything.sh.

set -u

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"

ONLY=""
DEMOS=1
CHECKS=1

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --demos) DEMOS=1; CHECKS=0 ;;
    --all) DEMOS=1; CHECKS=1 ;;
    --checks) DEMOS=0; CHECKS=1 ;;
    --no-demos) DEMOS=0; CHECKS=1 ;;
    -h|--help) usage; exit 0 ;;
    *[!0-9]*) echo "run_offline.sh: unknown argument: $arg" >&2; usage >&2; exit 2 ;;
    *) ONLY="$arg" ;;
  esac
done

if [ -n "$ONLY" ]; then
  case "$ONLY" in
    1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20) ;;
    *) echo "run_offline.sh: no chapter $ONLY (1-20)" >&2; exit 2 ;;
  esac
fi

export AGENTLAB_REPLAY=1

fail=0
ran=0
demos_ran=0

run_check() {
  label=$1
  shift
  ran=$((ran + 1))
  output=$("$@" 2>&1)
  status=$?
  last=$(printf '%s\n' "$output" | tail -n 1)
  if [ "$status" -eq 0 ]; then
    printf '%-34s %s\n' "$label" "$last"
  else
    printf '%-34s FAILED\n' "$label"
    printf '%s\n' "$output" | tail -n 20
    fail=1
  fi
}

run_demos() {
  n=$1
  outdir="chapter${n}/output"
  mkdir -p "$outdir"
  for file in "chapter${n}/files"/[0-9][0-9]_*.ts; do
    [ -f "$file" ] || continue
    base=$(basename "$file")
    case "$base" in
      *_record*|*live*|00_*) continue ;;
    esac
    stem=${file%.ts}
    [ -f "${stem}_run.ts" ] && continue
    log="$outdir/${base%.ts}.log"
    if node "$file" >"$log" 2>&1; then
      lines=$(wc -l <"$log" | tr -d ' ')
      printf '  %-32s %s lines\n' "$base" "$lines"
      demos_ran=$((demos_ran + 1))
    else
      printf '  %-32s FAILED (see %s)\n' "$base" "$log"
      tail -n 20 "$log"
      fail=1
    fi
  done
}

chapters() {
  if [ -n "$ONLY" ]; then
    printf '%s\n' "$ONLY"
  else
    seq 1 20
  fi
}

for n in $(chapters); do
  echo "== chapter $n"

  if [ "$DEMOS" -eq 1 ]; then
    run_demos "$n"
  fi

  if [ "$CHECKS" -eq 1 ]; then
    harness="chapter${n}/files/run_ex${n}.ts"
    if [ -f "$harness" ]; then
      run_check "chapter${n} harness" node "$harness"
    fi

    exercises="chapter${n}/files/exercises/run_exercises.ts"
    if [ -f "$exercises" ]; then
      run_check "chapter${n} exercises" node "$exercises"
    fi
  fi
done

printf '\n%s demo(s), %s harness(es), %s\n' "$demos_ran" "$ran" "$([ "$fail" -eq 0 ] && echo 'all ok' || echo 'failures above')"
exit "$fail"
