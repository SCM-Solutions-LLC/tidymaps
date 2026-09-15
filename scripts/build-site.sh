#!/usr/bin/env bash
# Copies only what a visitor's browser reaches into a deploy-ready directory,
# leaving node_modules, tests, docs and migrations out of the Pages artifact.
# js/telemetry.js imports ../supabase/functions/_shared/telemetryEvents.js by
# that relative path, so it is the one file kept outside the top-level asset
# directories, and it keeps the same path here.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${1:-_site}"
rm -rf "$OUT"
mkdir -p "$OUT"
cp -r *.html assets css data js media vendor "$OUT"/
mkdir -p "$OUT/supabase/functions/_shared"
cp supabase/functions/_shared/telemetryEvents.js "$OUT/supabase/functions/_shared/"
node scripts/inline-critical-css.mjs "$OUT"
