#!/usr/bin/env bash
# Usage:
#   ./scripts/schema-check.sh                          # check all plugins
#   ./scripts/schema-check.sh taplo                    # check one plugin
#   ./scripts/schema-check.sh taplo gh                 # check multiple plugins
#   ./scripts/schema-check.sh $CHANGED                 # from an env var
#   bash scripts/schema-check.sh ${{ steps.targets.outputs.ids }}  # from CI step output
#
# Expects to run from the repo root with taplo and jsonschema on PATH.
set -euo pipefail

SCHEMA_URL="file://$(pwd)/schema/proto-plugin.schema.json"
SCHEMA_PATH="schema/proto-plugin.schema.json"

if [ $# -gt 0 ]; then
  targets="$*"
else
  targets=$(for p in plugins/*; do
    [ -f "$p" ] || continue
    name="${p##*/}"
    printf '%s\n' "${name%.*}"
  done)
fi

files=()
while IFS= read -r id; do
  [ -z "$id" ] && continue
  for ext in toml yaml yml; do
    [ -f "plugins/$id.$ext" ] && files+=("plugins/$id.$ext")
  done
done <<< "$targets"

if [ ${#files[@]} -eq 0 ]; then
  echo "--- schema check: no targets ---"
  exit 0
fi

echo "--- schema check: ${#files[@]} file(s) ---"

failed=0
for f in "${files[@]}"; do
  case "$f" in
    *.toml)
      if taplo check --schema "$SCHEMA_URL" "$f" 2> /dev/null; then
        echo "  OK: $f"
      else
        taplo check --schema "$SCHEMA_URL" "$f"
        echo "  FAIL: $f"
        failed=1
      fi
      ;;
    *.yaml | *.yml)
      if jsonschema -d 2020 "$SCHEMA_PATH" -i "$f"; then
        echo "  OK: $f"
      else
        echo "  FAIL: $f"
        failed=1
      fi
      ;;
  esac
done

exit "$failed"
