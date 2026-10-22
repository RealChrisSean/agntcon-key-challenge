#!/bin/bash
set -euo pipefail
export PATH="$HOME/.local/bin:/.sprite/bin:$PATH"
demo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
exec ttyd -W -O -a -m 4 \
  -t disableLeaveAlert=true -t disableReconnect=true \
  -i 127.0.0.1 -p 7681 -b /terminal \
  /bin/bash "$demo_root/app/start-terminal.sh"
