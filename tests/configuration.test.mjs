import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectConfig, defaultModel } from '../app/configuration.mjs';
const first = {provider:'anthropic',id:'connector-example-one'};
const second = {provider:'anthropic',id:'connector-example-two'};

test('one accessible Anthropic Connector needs no local configuration', () => {
  assert.deepEqual(selectConfig([{provider:'unrelated',id:'ignored'},first]), {
    connectorId:first.id, model:defaultModel
  });
});
test('missing access remains unconfigured', () => {
  assert.equal(selectConfig([]),null);
  assert.equal(selectConfig([{provider:'unrelated',id:'ignored'}]),null);
});
test('multiple Connectors require an explicit non-secret selection', () => {
  assert.throws(() => selectConfig([first,second]),/Multiple/);
  assert.deepEqual(selectConfig([first,second],{connectorId:second.id,model:'claude-sonnet-4-6'}), {
    connectorId:second.id,model:'claude-sonnet-4-6'
  });
  assert.throws(() => selectConfig([first],{connectorId:second.id}),/not accessible/);
});
test('reject credential settings, malformed discovery, and invalid routing values', () => {
  assert.throws(() => selectConfig([first],{apiKey:'not-a-credential'}),/dashboard/);
  assert.throws(() => selectConfig(null),/Invalid/);
  assert.throws(() => selectConfig([first],{model:'../invalid'}),/Invalid/);
  assert.throws(() => selectConfig([{provider:'anthropic',id:'../invalid'}]),/Invalid/);
});
test('discovery returns only the routing ID and model', () => {
  assert.deepEqual(Object.keys(selectConfig([{...first,notes:['test metadata'],username:'example'}])).sort(),['connectorId','model']);
});
