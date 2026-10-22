// Launch-mode tests use a local stand-in for python3; no provider request occurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'booth-launch-mode-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await copyFile(new URL('../app/start-terminal.sh', import.meta.url), join(root, 'start-terminal.sh'));
  await writeFile(join(root, 'python3'), '#!/bin/bash\nprintf "AGENT_ARG=%s\\n" "$@"\nexit "${TEST_AGENT_EXIT:-0}"\n', { mode: 0o755 });
  return (args = [], exitCode = 0) => spawnSync('/bin/bash', [join(root, 'start-terminal.sh'), ...args], {
    cwd: root,
    env: { PATH: root + ':/usr/bin:/bin', HOME: root, TERM: 'xterm', TEST_AGENT_EXIT: String(exitCode) },
    input: 'printf "FULL_SHELL_%s\\n" READY\nexit\n',
    encoding: 'utf8',
    timeout: 5000,
  });
}

test('ordinary terminal starts a shell without invoking Claude', async t => {
  const run = await fixture(t);
  for (const args of [[], ['']]) {
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /FULL_SHELL_READY/);
    assert.doesNotMatch(result.stdout, /AGENT_ARG=/);
  }
});

test('Claude mode invokes the fixed launcher then returns to a full shell', async t => {
  const run = await fixture(t);
  for (const exitCode of [0, 7, 130]) {
    const result = run(['claude'], exitCode);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /AGENT_ARG=claude-booth\.py/);
    assert.match(result.stdout, new RegExp(`Claude Code exited \\(${exitCode}\\)`));
    assert.match(result.stdout, /FULL_SHELL_READY/);
  }
});

test('extra arguments and command text are rejected before launching anything', async t => {
  const run = await fixture(t);
  for (const args of [['bash'], ['claude', 'extra'], ['claude; printf INJECTED'], ['$(printf INJECTED)']]) {
    const result = run(args);
    assert.equal(result.status, 64);
    assert.match(result.stderr, /Unknown terminal mode/);
    assert.equal(result.stdout, '');
  }
});
