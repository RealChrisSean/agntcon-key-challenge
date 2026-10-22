#!/bin/bash
# Run inside a fresh, disposable Sprite. No account tokens are accepted here.
set -euo pipefail
export PATH="$HOME/.local/bin:/.sprite/bin:$PATH"
demo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$demo_root"
if [ ! -S /.sprite/api.sock ] || ! command -v sprite-env >/dev/null; then
  printf 'Run this setup inside a disposable Sprite.\n' >&2
  exit 1
fi
case "$demo_root" in *','*|*$'\n'*) printf 'Clone into a path without commas or newlines.\n' >&2; exit 1;; esac
command -v node >/dev/null
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'
command -v python3 >/dev/null
if ! command -v ttyd >/dev/null; then
  sudo apt-get update
  sudo apt-get install -y ttyd curl ca-certificates
fi
# This version was used by the original demo. No subscription login is needed.
claude_version=2.1.251
if ! command -v claude >/dev/null || [[ "$(claude --version)" != "$claude_version "* ]]; then
  installer=$(mktemp)
  trap 'rm -f "$installer"' EXIT
  curl -fsSL https://claude.ai/install.sh -o "$installer"
  bash "$installer" "$claude_version"
fi
python3 - "$demo_root" "$claude_version" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
profile = root / '.runtime' / 'claude'
profile.mkdir(parents=True, exist_ok=True, mode=0o700)
if (profile / '.credentials.json').exists():
    raise SystemExit('A personal Claude login exists in the demo profile. Use a clean demo profile before continuing.')
settings = profile / 'settings.json'
if not settings.exists():
    settings.write_text(json.dumps({'theme': 'dark'}) + '\n')
state = profile / '.claude.json'
if not state.exists():
    state.write_text(json.dumps({
        'hasCompletedOnboarding': True,
        'lastOnboardingVersion': sys.argv[2],
        'projects': {str(root / 'app'): {
            'hasTrustDialogAccepted': True,
            'hasCompletedProjectOnboarding': True
        }}
    }) + '\n')
    state.chmod(0o600)
PY
register_service() {
  local service=$1 script=$2
  shift 2
  if sprite-env services get "$service" >/dev/null 2>&1; then
    # Refuse to take over a service belonging to a different checkout.
    sprite-env services get "$service" | python3 -c \
      'import json,sys; s=json.load(sys.stdin); assert s.get("cmd")=="/bin/bash" and s.get("args")==[sys.argv[1]], "Service name already belongs to another installation"' "$script"
    sprite-env services restart "$service"
  else
    sprite-env services create "$service" --cmd /bin/bash --args "$script" --no-stream "$@"
  fi
}
register_service booth-terminal "$demo_root/scripts/start-ttyd.sh"
register_service booth-app "$demo_root/scripts/start-app.sh" --needs booth-terminal --http-port 8080
printf '\nApp and terminal installed. Add an Anthropic Connector in the Sprites dashboard and grant this Sprite access.\n'
printf 'The app and Claude discover it automatically. Check with: node scripts/doctor.mjs\n'
printf 'After setup, run the optional billable rehearsal: node scripts/doctor.mjs --live\n'
