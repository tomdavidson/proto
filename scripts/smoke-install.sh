#!/usr/bin/env bash
set -euo pipefail

bun run scripts/build-prototools.ts
mkdir -p /tmp/proto-smoke
cp .prototools.test /tmp/proto-smoke/.prototools
cd /tmp/proto-smoke
cat .prototools
proto install -y
proto status --json
