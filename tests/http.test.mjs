import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { attachTerminal } from '../app/terminal.mjs';

test('local preview exposes only public routes and reports missing Connector honestly', {
  skip: existsSync('/.sprite/api.sock') ? 'Run this offline test outside a Sprite.' : false
}, async t => {
  const child = spawn(process.execPath,['app/server.mjs'], {
    cwd:new URL('..',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']
  });
  t.after(() => child.kill());
  const ready = new Promise((resolve,reject) => {
    const timeout = setTimeout(() => reject(new Error('App startup timed out.')),5000);
    child.stdout.on('data', chunk => {
      const match = chunk.toString().match(/:(\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.once('error', reject);
  });
  const base = `http://127.0.0.1:${await ready}`;
  const html = await (await fetch(base)).text();
  assert.match(html,/We Dare You/);
  assert.match(html,/Cmd \+ Enter to send/);
  assert(!html.includes('localStorage') && !html.includes('sessionStorage'));
  const logo = await fetch(base+'/fly-logo.png');
  assert.equal(logo.headers.get('content-type'),'image/png');
  assert((await logo.arrayBuffer()).byteLength>0);
  assert.equal((await (await fetch(base+'/api/status')).json()).ready,false);
  assert.equal((await fetch(base+'/api/chat',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({prompt:'Hello'})
  })).status,503);
  for (const path of ['/config.json','/configuration.mjs','/api/env','/../../etc/passwd']) {
    assert.equal((await fetch(base+path)).status,404,path);
  }
  assert.equal((await fetch(base+'/terminal/?arg=claude&arg=extra')).status,400);
  assert.equal((await fetch(base+'/api/chat',{
    method:'POST',headers:{'content-type':'application/json',origin:'https://unrelated.invalid'},body:'{}'
  })).status,403);
});

test('terminal same-origin check works on another Sprite hostname', async t => {
  const server = createServer();
  attachTerminal(server);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => server.close());
  async function upgrade(origin,host,path='/terminal/ws') {
    return new Promise((resolve,reject) => {
      const req = request({host:'127.0.0.1',port:server.address().port,path,headers:{
        host,origin,connection:'Upgrade',upgrade:'websocket',
        'sec-websocket-key':randomBytes(16).toString('base64'),'sec-websocket-version':'13'
      }});
      req.once('response', res => { res.resume(); resolve(res.statusCode); });
      req.once('error', error => error.code === 'ECONNRESET' ? resolve('upstream-unavailable') : reject(error));
      req.end();
    });
  }
  assert.equal(await upgrade('https://unrelated.invalid','new-demo-example.sprites.app'),403);
  assert.equal(await upgrade('https://new-demo-example.sprites.app','new-demo-example.sprites.app','/terminal/ws?arg=bad'),400);
  assert.equal(await upgrade('https://new-demo-example.sprites.app','new-demo-example.sprites.app'),'upstream-unavailable');
});
