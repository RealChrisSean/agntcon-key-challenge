// Operator check. --live makes billable provider calls; it never starts a challenge.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readConfig, catalogURL } from '../app/configuration.mjs';
const args = process.argv.slice(2);
assert(args.every(arg => arg === '--live'), 'Usage: node scripts/doctor.mjs [--live]');
try {
  const config = await readConfig();
  assert(config, 'Add an Anthropic Connector in the dashboard and grant this Sprite access.');
  const catalog = await (await fetch(catalogURL, {signal:AbortSignal.timeout(10000)})).json();
  const selected = catalog.connections.find(connection => connection.id === config.connectorId);
  console.log(`Anthropic Connector discovered. Model: ${config.model}`);
  if (catalog.connections.length > 1 || selected.access_policy?.allow_all) {
    console.log('Before attendee access: restrict this Connector to the demo Sprite and exclude unrelated Connectors.');
  }
  const base = process.env.DEMO_URL || 'http://127.0.0.1:8080';
  assert.equal((await fetch(base+'/healthz')).status,200,'App service is not healthy.');
  assert.equal((await fetch(base+'/terminal/')).status,200,'Terminal service is not healthy.');
  assert.equal((await (await fetch(base+'/api/status')).json()).ready,true);
  console.log('App, terminal page, and Connector routing are ready.');
  if (args.includes('--live')) {
    const response = await fetch(base+'/api/chat', {
      method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({messages:[{role:'user',content:'Reply with one short greeting.'}]}),
      signal:AbortSignal.timeout(115000)
    });
    assert.equal(response.status,200,'App model request failed.');
    const output = await response.text();
    assert(output.includes('event: delta') && output.includes('event: done') && !output.includes('event: error'));
    const result = spawnSync('python3', [
      fileURLToPath(new URL('../app/claude-booth.py', import.meta.url)),
      '-p','Reply with one short greeting.','--output-format','json',
      '--max-turns','1','--max-budget-usd','0.25','--no-session-persistence'
    ], {encoding:'utf8',timeout:115000});
    assert.equal(result.status,0,'Claude request failed; check the configured model and gateway compatibility.');
    const answer = JSON.parse(result.stdout);
    assert(answer.subtype === 'success' && !answer.is_error && answer.usage?.output_tokens > 0);
    console.log('Real streamed app response and Claude authentication/inference passed.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
