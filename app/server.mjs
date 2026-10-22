import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readConfig, requestModel, sseEvents } from './connector.mjs';
import { handleTerminal, attachTerminal } from './terminal.mjs';

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8080);
let active = 0;
const json = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
};
const emit = (res, event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const server = http.createServer(async (req, res) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    if (handleTerminal(req, res)) return;
    if (req.method === 'GET' && req.url === '/') {
      const html = await readFile(new URL('./public/index.html', import.meta.url));
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(html);
    }
    if (req.method === 'GET' && req.url === '/fly-logo.png') {
      const logo = await readFile(new URL('./public/fly-logo.png', import.meta.url));
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' });
      return res.end(logo);
    }
    if (req.method === 'GET' && req.url === '/healthz') return json(res, 200, { ok: true });
    if (req.method === 'GET' && req.url === '/api/status') {
      let config;
      try { config = await readConfig(); } catch { config = null; }
      return json(res, 200, { ready: !!config, model: config?.model || null,
        reason: config ? 'Configured; a successful response verifies live access.' : 'Operator setup pending: dedicated model Connector.' });
    }
    if (req.method !== 'POST' || req.url !== '/api/chat') return json(res, 404, { error: 'Not found' });
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return json(res, 403, { error: 'Use this app’s own prompt form.' });
    if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Expected JSON' });
    if (active >= 2) return json(res, 429, { error: 'The booth is busy. Try again in a moment.' });
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) return json(res, 413, { error: 'Conversation is too large.' });
      chunks.push(chunk);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json(res, 400, { error: 'Expected a conversation object.' });
    }
    let messages = 'messages' in body ? body.messages : [{ role: 'user', content: body.prompt }];
    if (!Array.isArray(messages) || !messages.length || messages.some(message =>
      !message || !['user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string' || !message.content.trim() ||
      message.content.length > (message.role === 'user' ? 6000 : 32768))) {
      return json(res, 400, { error: 'Send nonempty user or assistant messages: up to 6,000 characters per user message and 32,768 per assistant message.' });
    }
    if (messages[0].role !== 'user' || messages.at(-1).role !== 'user') {
      return json(res, 400, { error: 'The conversation must start and end with a user message.' });
    }
    messages = messages.map(({ role, content }) => ({ role, content }));
    if (!('messages' in body)) messages[0].content = messages[0].content.trim();
    let config;
    try { config = await readConfig(); } catch { config = null; }
    if (!config) return json(res, 503, { error: 'Live model setup is pending. No response has been generated.' });
    if (active >= 2) return json(res, 429, { error: 'The booth is busy. Try again in a moment.' });
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 110000);
    res.on('close', () => abort.abort());
    active++;
    try {
      const upstream = await requestModel(config, messages, abort.signal);
      if (!upstream.ok) {
        await upstream.body?.cancel();
        return json(res, 502, { error: `Model request failed (upstream ${upstream.status}). Ask the operator to check access and provider limits.` });
      }
      if (!upstream.headers.get('content-type')?.includes('text/event-stream')) {
        await upstream.body?.cancel();
        return json(res, 502, { error: 'The model did not return a response stream.' });
      }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' });
      res.flushHeaders();
      emit(res, 'meta', { model: config.model });
      let stopped = false;
      let usage = {};
      for await (const event of sseEvents(upstream.body)) {
        if (event.type === 'error') throw new Error('Upstream stream error');
        if (event.type === 'message_start') usage = event.message?.usage || {};
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') emit(res, 'delta', { text: event.delta.text });
        if (event.type === 'message_delta') usage = { ...usage, ...event.usage };
        if (event.type === 'message_stop') { stopped = true; break; }
      }
      if (!stopped) throw new Error('Incomplete stream');
      emit(res, 'done', { usage });
      res.end();
    } catch {
      if (!res.destroyed) {
        const message = 'The model stream was interrupted. Try again or ask the operator to check the Connector.';
        if (res.headersSent) { emit(res, 'error', { message }); res.end(); }
        else json(res, 502, { error: message });
      }
    } finally { clearTimeout(timeout); active--; }
  } catch {
    if (!res.headersSent) json(res, 500, { error: 'The demo needs operator attention.' });
    else res.end();
  }
});
server.requestTimeout = 15000;
attachTerminal(server);
server.listen(port, host, () => console.log(`Booth app listening on ${host}:${server.address().port}`));
