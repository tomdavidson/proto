#!/usr/bin/env bash
set -euo pipefail

mkdir -p site
cp -r web/. site/
cp -r schema site/
for f in plugins/*.toml plugins/*.json plugins/*.yaml plugins/*.yml; do
  [ -f "$f" ] && cp "$f" site/
done
touch site/.nojekyll
ls -la site site/schema
