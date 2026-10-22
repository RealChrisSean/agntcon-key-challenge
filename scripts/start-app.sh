#!/bin/bash
set -euo pipefail
export PATH="$HOME/.local/bin:/.sprite/bin:$PATH"
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
exec node app/server.mjs
