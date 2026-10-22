#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
for script in app/*.mjs scripts/*.mjs; do node --check "$script"; done
for script in app/*.sh scripts/*.sh; do bash -n "$script"; done
python3 - <<'PY'
import ast, pathlib
for path in [*pathlib.Path('app').glob('*.py'), *pathlib.Path('scripts').glob('*.py')]:
    ast.parse(path.read_text(), filename=str(path))
PY
npm test
