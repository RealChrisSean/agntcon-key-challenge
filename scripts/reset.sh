#!/bin/bash
# Run on the operator computer. Keep its Sprites login outside the demo.
set -euo pipefail
if [ -S /.sprite/api.sock ]; then
  printf 'Run reset from the operator computer, outside the Sprite.\n' >&2
  exit 1
fi
if [ "$#" -ne 3 ]; then
  printf 'Usage: bash scripts/reset.sh ORGANIZATION SPRITE CHECKPOINT\n' >&2
  exit 1
fi
for value in "$@"; do
  [[ "$value" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { printf 'Invalid reset target.\n' >&2; exit 1; }
done
org=$1
demo_sprite=$2
checkpoint=$3
printf 'Restore %s / %s to %s. Close attendee browser sessions first.\n' "$org" "$demo_sprite" "$checkpoint"
sprite restore -o "$org" -s "$demo_sprite" "$checkpoint"
sprite exec -o "$org" -s "$demo_sprite" --no-port-forward -- \
  node /home/sprite/agntcon-key-challenge/scripts/doctor.mjs --live
printf 'Restored and verified. Start with a fresh attendee browser session.\n'
