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

for id in $targets; do
  [ -z "$id" ] && continue

  # find the plugin file
  plugin_file=""
  for ext in toml yaml yml; do
    [ -f "plugins/$id.$ext" ] && plugin_file="plugins/$id.$ext" && break
  done

  # skip library tools that have no binary
  if [ -n "$plugin_file" ] && grep -q 'no-bin\s*=\s*true' "$plugin_file"; then
    echo "--- $id (skipped: no-bin) ---"
    continue
  fi

  echo "--- $id ---"

  bin=$(proto bin "$id") ||
    fail "proto bin exited non-zero"

  [[ $bin == *"/.proto/tools/$id/"* ]] ||
    fail "resolved outside .proto/tools: $bin"

  [ -f "$bin" ] || fail "file missing at $bin"
  [ -x "$bin" ] || fail "not executable at $bin"

  echo "  OK: $bin"

done
