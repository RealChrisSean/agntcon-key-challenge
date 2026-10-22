// This is the complete provider request. No provider credential is read here.
export { readConfig } from './configuration.mjs';

export async function requestModel(config, messages, signal) {
  return fetch(`https://api.sprites.dev/v1/gateway/anthropic/${config.connectorId}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1024,
      stream: true,
      messages
    }),
    redirect: 'error',
    signal
  });
}

// Parse SSE across arbitrary network/UTF-8 chunk boundaries.
export async function* sseEvents(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  let data = [];
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, end).replace(/\r$/, '');
      buffer = buffer.slice(end + 1);
      if (line === '') {
        if (data.length) yield JSON.parse(data.join('\n'));
        data = [];
      } else if (line.startsWith('data:')) {
        data.push(line.slice(5).replace(/^ /, ''));
      }
    }
    if (buffer.length > 1024 * 1024) throw new Error('Oversized upstream event');
  }
}
