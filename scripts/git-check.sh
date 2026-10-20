#!/usr/bin/env bash
set -euo pipefail

if ! node_binary="$(git config --local --get kswitch.nodePath)" \
  || ! npm_cli="$(git config --local --get kswitch.npmPath)"; then
  echo 'Git hook tools are not configured. Select the project Node version and run npm run hooks:install.' >&2
  exit 1
fi
if [[ ! -x "$node_binary" || ! -r "$npm_cli" ]]; then
  echo 'Configured Node/npm is unavailable. Select the project Node version and rerun npm run hooks:install.' >&2
  exit 1
fi

export PATH="$(dirname "$node_binary"):$PWD/.venv/bin:$PATH"
if [[ "${1:-}" == '--staged' ]]; then
  exec "$node_binary" scripts/check-staged.ts "$npm_cli"
fi
exec "$node_binary" "$npm_cli" run check
