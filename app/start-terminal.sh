#!/bin/bash
set -eu

# ttyd may append one URL argument. It selects a fixed mode, never shell code.
if [ "$#" -gt 1 ] || { [ "${1-}" != '' ] && [ "${1-}" != 'claude' ]; }; then
  printf 'Unknown terminal mode.\n' >&2
  exit 64
fi
mode=${1-}
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
printf '\nagntcon-key-challenge · sudo available\n'

if [ "$mode" = 'claude' ]; then
  printf 'Starting Claude Code. Exit Claude to return to the shell.\n\n'
  # Let Ctrl-C stop Claude without terminating the surrounding terminal session.
  trap ':' INT
  agent_status=0
  python3 claude-booth.py || agent_status=$?
  trap - INT
  printf '\nClaude Code exited (%s). Full Sprite shell ready.\n\n' "$agent_status"
fi
exec /bin/bash --noprofile --norc -i
