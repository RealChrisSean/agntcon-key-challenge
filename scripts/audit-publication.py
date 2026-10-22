#!/usr/bin/env python3
"""Scan the exact Git index without printing suspected secret values."""
import pathlib, re, subprocess, sys

root = pathlib.Path(__file__).resolve().parent.parent
listed = subprocess.check_output(['git','ls-files','--cached','-z'],cwd=root).split(b'\0')
paths = [entry.decode() for entry in listed if entry]
if not paths:
    raise SystemExit('Stage the intended source files before running the publication audit.')
patterns = {
    'private key': rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
    'provider credential': rb'(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sk-or-v1-[A-Fa-f0-9]{30,})',
    'GitHub credential': rb'(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})',
    'cloud access key': rb'AKIA[A-Z0-9]{16}',
    'credential assignment': rb'''(?i)(?:api[_-]?key|password|secret|access[_-]?token)\s*[=:]\s*["']([A-Za-z0-9_+/=-]{20,})["']''',
    'personal computer path': rb'/Users/[A-Za-z0-9_.-]+/'
}
blocked = {'.env','.sprite','.claude.json','config.json','history.jsonl','AGENTS.md','CLAUDE.md'}
findings = []
for name in paths:
    path = pathlib.PurePosixPath(name)
    if path.name in blocked or any(part in {'.runtime','.operator','.claude','.codex','node_modules'} for part in path.parts) or name.endswith(('.zip','.tar','.tar.gz','.jpg','.log','.jsonl','.key','.pem')):
        findings.append((name,'excluded local or private artifact'))
        continue
    data = subprocess.check_output(['git','show',':'+name],cwd=root)
    if name == 'app/public/fly-logo.png':
        if not data.startswith(b'\x89PNG\r\n\x1a\n'): findings.append((name,'invalid image'))
        continue
    if b'\0' in data:
        findings.append((name,'unexpected binary file'))
        continue
    for label, pattern in patterns.items():
        if re.search(pattern,data): findings.append((name,label))
if findings:
    for name,label in findings: print(f'{name}: {label}',file=sys.stderr)
    raise SystemExit(1)
print(f'Publication audit passed for {len(paths)} staged files. No credential patterns or excluded artifacts detected.')
