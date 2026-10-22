import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sseEvents } from '../app/connector.mjs';
for (const ending of ['\n', '\r\n']) {
  test(`Provider SSE handles fragmented UTF-8 (${JSON.stringify(ending)})`, async () => {
    const events = [{type:'content_block_delta',delta:{type:'text_delta',text:'Hello 🌍'}},{type:'message_stop'}];
    const bytes = new TextEncoder().encode(events.map(x=>'data: '+JSON.stringify(x)+ending+ending).join(''));
    async function* chunks() { for (const byte of bytes) yield new Uint8Array([byte]); }
    const actual = [];
    for await (const event of sseEvents(chunks())) actual.push(event);
    assert.deepEqual(actual, events);
  });
}
