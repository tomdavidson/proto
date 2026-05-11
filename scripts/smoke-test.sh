#!/usr/bin/env bash
# Usage:
#   ./scripts/smoke-test.sh                            # test all plugins
#   ./scripts/smoke-test.sh taplo                      # test one plugin
#   ./scripts/smoke-test.sh taplo gh                   # test multiple plugins
#   ./scripts/smoke-test.sh $CHANGED                   # from an env var
#   bash scripts/smoke-test.sh ${{ steps.targets.outputs.ids }}  # from CI step output
#
# Expects to run from the repo root with proto on PATH.
set -euo pipefail

fail() {
  echo "  FAIL: $*"
  exit 1
}

if [ $# -gt 0 ]; then
  targets="$*"
else
  targets=$(for p in plugins/*; do
    [ -f "$p" ] || continue
    name="${p##*/}"
    printf '%s\n' "${name%.*}"
  done)
fi

while IFS= read -r id; do
  [ -z "$id" ] && continue

  echo "--- $id ---"

  bin=$(proto locate "$id") ||
    fail "proto locate exited non-zero"

  [[ $bin == *"/.proto/tools/$id/"* ]] ||
    fail "resolved outside .proto/tools: $bin"

  [ -f "$bin" ] || fail "file missing at $bin"
  [ -x "$bin" ] || fail "not executable at $bin"

  echo "  OK: $bin"

done <<< "$targets"
