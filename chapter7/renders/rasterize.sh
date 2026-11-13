#!/bin/sh
# SVG -> PNG, the one step Node cannot do without a dependency.
#
#   sh chapter7/renders/rasterize.sh
#
# rsvg-convert comes with librsvg (`brew install librsvg`). Production would
# screenshot a real page with a headless browser; this chapter needs a render
# that is deterministic, diffable, and cheap to regenerate, so it draws SVG.
set -eu
DIR=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$DIR/small"
for svg in "$DIR"/*.svg; do
  png="${svg%.svg}.png"
  rsvg-convert -w 480 -h 640 "$svg" -o "$png"
  rsvg-convert -w 240 -h 320 "$svg" -o "$DIR/small/$(basename "$png")"
  printf '  %-12s %s\n' "$(basename "$png")" "$(wc -c <"$png" | tr -d ' ') bytes"
done
