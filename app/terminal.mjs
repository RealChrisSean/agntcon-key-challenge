// Browser <-> this Sprite's HTTP server <-> ttyd on this same Sprite.
// There is no connection to an operator shell, filesystem, or Sprites API token.
import http from 'node:http';

const destination = { hostname: '127.0.0.1', port: 7681 };
const allowedHeaders = ['host', 'origin', 'accept', 'accept-encoding', 'content-type',
  'upgrade', 'connection', 'sec-websocket-key', 'sec-websocket-version',
  'sec-websocket-protocol', 'sec-websocket-extensions'];

function headers(req) {
  // In particular, do not forward cookies or Authorization to the terminal.
  return Object.fromEntries(allowedHeaders.filter(key => req.headers[key] !== undefined)
    .map(key => [key, req.headers[key]]));
}

function sameOrigin(req) {
  try {
    const origin = new URL(req.headers.origin);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    return origin.host === req.headers.host &&
      (origin.protocol === 'https:' || (local && origin.protocol === 'http:'));
  } catch { return false; }
}

function sessionQuery(req) {
  const index = (req.url || '').indexOf('?');
  return index < 0 ? '' : req.url.slice(index);
}

function allowedSessionQuery(req) {
  // ttyd -a forwards arg= as argv. Only our fixed Claude mode may be selected.
  const query = sessionQuery(req);
  return query === '' || query === '?arg=claude';
}

export function handleTerminal(req, res) {
  const path = (req.url || '').split('?')[0];
  if (path !== '/terminal' && !path.startsWith('/terminal/')) return false;
  if (!['GET', 'HEAD'].includes(req.method) || (req.headers.origin && !sameOrigin(req))) {
    res.writeHead(403); res.end('Terminal request denied.'); return true;
  }
  if (!allowedSessionQuery(req)) {
    res.writeHead(400); res.end('Unknown terminal mode.'); return true;
  }
  if (path === '/terminal') {
    res.writeHead(302, { location: '/terminal/' + sessionQuery(req) });
    res.end();
    return true;
  }
  // ttyd bundles its frontend; its frame is allowed only within this app origin.
  res.setHeader('content-security-policy', "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  res.setHeader('cache-control', 'no-store');
  const upstream = http.request({ ...destination, path: req.url, method: req.method, headers: headers(req) }, reply => {
    const safeHeaders = Object.fromEntries(Object.entries(reply.headers)
      .filter(([key]) => ['content-type', 'content-encoding', 'content-length'].includes(key)));
    res.writeHead(reply.statusCode, safeHeaders);
    reply.pipe(res);
  });
  upstream.setTimeout(10000, () => upstream.destroy());
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(503, { 'content-type': 'text/plain' });
    res.end('The terminal is restarting. Reconnect to try again.');
  });
  res.on('close', () => upstream.destroy());
  upstream.end();
  return true;
}

export function attachTerminal(server) {
  server.on('upgrade', (req, socket, head) => {
    const path = (req.url || '').split('?')[0];
    if (path !== '/terminal/ws' || !sameOrigin(req)) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    if (!allowedSessionQuery(req)) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      return;
    }
    const upstream = http.request({ ...destination, path: req.url, headers: headers(req) });
    let terminal;
    const timeout = setTimeout(() => upstream.destroy(), 10000);
    upstream.on('upgrade', (reply, remote, remoteHead) => {
      clearTimeout(timeout);
      terminal = remote;
      const lines = ['HTTP/1.1 101 Switching Protocols'];
      for (const [key, value] of Object.entries(reply.headers)) {
        if (['upgrade','connection','sec-websocket-accept','sec-websocket-protocol','sec-websocket-extensions'].includes(key)) {
          lines.push(`${key}: ${value}`);
        }
      }
      socket.write(lines.join('\r\n') + '\r\n\r\n');
      if (remoteHead.length) socket.write(remoteHead);
      if (head.length) remote.write(head);
      remote.on('error', () => socket.destroy());
      remote.on('close', () => socket.destroy());
      socket.pipe(remote).pipe(socket);
    });
    upstream.on('response', reply => {
      clearTimeout(timeout);
      reply.resume();
      socket.end(`HTTP/1.1 ${reply.statusCode} Terminal Unavailable\r\nConnection: close\r\n\r\n`);
    });
    upstream.on('error', () => { clearTimeout(timeout); socket.destroy(); });
    socket.on('error', () => terminal?.destroy());
    socket.on('close', () => { clearTimeout(timeout); upstream.destroy(); terminal?.destroy(); });
    upstream.end();
  });
}
