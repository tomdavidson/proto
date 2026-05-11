#!/usr/bin/env bash
# Usage:
#   ./scripts/resolve-targets.sh
#
# On a PR:    diffs against the fork point from origin/main
# On main:    diffs against the last successful CI run on main
# Fallback:   tests all plugins if no diff anchor can be found
#
# Writes ids to $GITHUB_OUTPUT when set, always prints to stdout.
# Requires: git, gh (for main branch anchor)
set -euo pipefail

strip_ext() {
  local name="${1##*/}"
  printf '%s\n' "${name%.*}"
}

find_base() {
  local event="${GITHUB_EVENT_NAME:-}"

  if [ "$event" = "pull_request" ]; then
    # PR: diff against fork point from main
    git fetch --no-tags --depth=50 origin main 2> /dev/null || true
    git merge-base --fork-point origin/main HEAD 2> /dev/null ||
      git merge-base origin/main HEAD 2> /dev/null
    return
  fi

  if [ "$event" = "push" ] || [ -z "$event" ]; then
    # Main or local: use last successful CI run on main as anchor
    gh run list \
      --branch main \
      --workflow ci.yml \
      --status success \
      --limit 1 \
      --json headSha \
      --jq '.[0].headSha' 2> /dev/null |
      grep -E '^[0-9a-f]{40}$' &&
      return
  fi

  # Fallback
  git rev-parse HEAD~1
}

base=$(find_base) || base=$(git rev-parse HEAD~1)

echo "base: $base"

ids=""
while IFS= read -r path; do
  [ -z "$path" ] && continue
  ids+="$(strip_ext "$path")"$'\n'
done < <(git diff --name-only --diff-filter=ACMRT "$base"..HEAD -- \
  'plugins/*.toml' 'plugins/*.json' 'plugins/*.yaml' 'plugins/*.yml')

# Fallback: test all plugins if diff finds nothing
if [ -z "$(printf '%s' "$ids" | tr -d '[:space:]')" ]; then
  echo "no plugin changes detected, testing all plugins"
  for p in plugins/*; do
    [ -f "$p" ] || continue
    ids+="$(strip_ext "$p")"$'\n'
  done
fi

ids=$(printf '%s' "$ids" | sort -u | sed '/^$/d')

echo "test targets:"
printf '%s\n' "$ids"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo 'ids<<EOF'
    printf '%s\n' "$ids"
    echo 'EOF'
  } >> "$GITHUB_OUTPUT"
fi
