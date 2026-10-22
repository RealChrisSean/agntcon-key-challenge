#!/usr/bin/env python3
"""Launch Claude through the Sprite's Anthropic Connector without a provider key."""
import json, os, pathlib, shutil, subprocess, sys

root = pathlib.Path(__file__).resolve().parent
node = shutil.which('node') or '/.sprite/bin/node'
resolved = subprocess.run([node, str(root / 'resolve-config.mjs')], capture_output=True, text=True)
if resolved.returncode:
    sys.exit(resolved.stderr.strip() or 'Configure an Anthropic Connector in the Sprites dashboard.')
config = json.loads(resolved.stdout)
connector = config.get('connectorId')
model = config.get('model')
if not connector or not model:
    sys.exit('Operator setup pending: configure the Connector and model. Direct terminal inspection is available.')

# Foundry-compatible Messages transport supports gateways with platform auth.
# Skip provider login only; normal Claude tool permissions remain enabled.
env = {key: value for key, value in os.environ.items()
       if not any(part in key.upper() for part in ('TOKEN', 'SECRET', 'API_KEY', 'ANTHROPIC', 'CLAUDE_CODE', 'AZURE', 'AWS_'))}
env.update({
    'CLAUDE_CONFIG_DIR': str(root.parent / '.runtime' / 'claude'),
    'CLAUDE_CODE_USE_FOUNDRY': '1',
    'CLAUDE_CODE_SKIP_FOUNDRY_AUTH': '1',
    'ANTHROPIC_FOUNDRY_BASE_URL': f'https://api.sprites.dev/v1/gateway/anthropic/{connector}',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL': model,
    'ANTHROPIC_DEFAULT_SONNET_MODEL': model,
    'ANTHROPIC_DEFAULT_OPUS_MODEL': model,
    'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC': '1',
    'DISABLE_AUTOUPDATER': '1',
})
os.chdir(root)
args = sys.argv[1:]
os.execvpe('claude', ['claude', '--bare', '--strict-mcp-config', '--no-chrome', '--model', model, *args], env)
