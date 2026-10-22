import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

export const catalogURL = 'https://api.sprites.dev/v1/gateway/list';
export const defaultModel = 'claude-sonnet-4-6';

// Keep only non-secret routing settings. Never save the gateway's full catalog.
export function selectConfig(connections, settings = {}) {
  if (!Array.isArray(connections)) throw new Error('Invalid Connector discovery response.');
  if (Object.keys(settings).some(key => !['connectorId', 'model'].includes(key))) {
    throw new Error('config.json accepts only connectorId and model; put provider credentials in the dashboard.');
  }
  const model = settings.model || defaultModel;
  if (typeof model !== 'string' || !/^claude-[A-Za-z0-9._-]+$/.test(model)) throw new Error('Invalid model setting.');
  const available = connections.filter(connection => connection.provider === 'anthropic');
  let connector;
  if (settings.connectorId) {
    if (!/^[A-Za-z0-9_-]{10,80}$/.test(settings.connectorId)) throw new Error('Invalid Connector ID setting.');
    connector = available.find(connection => connection.id === settings.connectorId);
    if (!connector) throw new Error('The selected Anthropic Connector is not accessible from this Sprite.');
  } else {
    if (available.length > 1) throw new Error('Multiple Anthropic Connectors are accessible. Set connectorId in app/config.json to choose one.');
    connector = available[0];
  }
  if (!connector) return null;
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(connector.id)) throw new Error('Invalid Connector discovery response.');
  return { connectorId: connector.id, model };
}

let pending;
let cached;
let expires = 0;
export async function readConfig() {
  // Local previews stay unconfigured; the gateway authenticates the Sprite.
  if (!existsSync('/.sprite/api.sock')) return null;
  let settings = {};
  try { settings = JSON.parse(await readFile(new URL('./config.json', import.meta.url), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Invalid config.json.');
  if (Date.now() >= expires) {
    if (!pending) pending = (async () => {
      const response = await fetch(catalogURL, { signal: AbortSignal.timeout(10000), redirect:'error' });
      if (!response.ok) throw new Error('Connector discovery is available inside an authorized Sprite.');
      const catalog = await response.json();
      if (!Array.isArray(catalog.connections)) throw new Error('Invalid Connector discovery response.');
      cached = catalog.connections.map(({id, provider}) => ({id, provider}));
      expires = Date.now() + 5000;
    })().finally(() => { pending = null; });
    await pending;
  }
  return selectConfig(cached, settings);
}
