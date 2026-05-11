#!/usr/bin/env bash
# Usage:
#   ./scripts/smoke-test.sh                  # test all plugins
#   ./scripts/smoke-test.sh taplo            # test one plugin
#   ./scripts/smoke-test.sh taplo gh         # test multiple plugins
#   TARGETS="taplo gh" ./scripts/smoke-test.sh   # via env var (CI-friendly)
#
# Expects proto on PATH.  Can be run from any working directory.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

fail() {
  echo "  FAIL: $*"
  exit 1
}

# Arg priority: positional args > TARGETS env var > all plugins
if [ $# -gt 0 ]; then
  targets="$*"
elif [ -n "${TARGETS:-}" ]; then
  targets="$TARGETS"
else
  targets=$(for p in "$REPO_ROOT/plugins/"*; do
    [ -f "$p" ] || continue
    name="${p##*/}"
    printf '%s\n' "${name%.*}"
  done)
fi

for id in $targets; do
  [ -z "$id" ] && continue

  # Locate plugin file relative to repo root, not cwd
  plugin_file=""
  for ext in toml yaml yml; do
    candidate="$REPO_ROOT/plugins/$id.$ext"
    [ -f "$candidate" ] && plugin_file="$candidate" && break
  done

  # Skip library tools that have no binary
  if [ -n "$plugin_file" ] && grep -qF 'no-bin = true' "$plugin_file"; then
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
