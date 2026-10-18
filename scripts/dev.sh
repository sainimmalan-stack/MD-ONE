#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
MDP_NODE_BIN="$(command -v node || true)"
if [ -z "$MDP_NODE_BIN" ]; then MDP_NODE_BIN="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"; fi
if [ ! -x "$MDP_NODE_BIN" ]; then echo 'Install Node.js 24 LTS, then run pnpm install.'; exit 1; fi
"$MDP_NODE_BIN" scripts/init-demo.mjs
export NEXT_TELEMETRY_DISABLED=1
exec "$MDP_NODE_BIN" node_modules/next/dist/bin/next dev --hostname 127.0.0.1
