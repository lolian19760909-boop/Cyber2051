'use strict';
// Appended regression cases: Tauri Tavern returns the exported file body itself (no {result} wrapper).
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path'), zlib = require('node:zlib');
const G = require(path.join(process.env.CXX_SAVE_SOURCE_ROOT || path.resolve(__dirname, '../../卡片源码'), '运行时/chat-save-guard.js'));
const copy = v => JSON.parse(JSON.stringify(v));
const initial = () => [{ chat_metadata: { integrity: 'one' }, legacyHeader: 'keep' }, { mes: 'old', extra: { custom: 1 } }];
function mutex() { let tail = Promise.resolve(); return { request(_k, _o, fn) { const p = tail.catch(() => {}).then(fn); tail = p; return p; } }; }

async function fixture({ exportBody, listing = [] }) {
  let disk = initial(), writes = 0; const live = copy(disk), locks = mutex();
  async function fetcher(input, init) {
    const req = new Request(typeof input?.clone === 'function' ? input.clone() : new URL(String(input), 'https://host.test'), init);
    let bytes = Buffer.from(await req.arrayBuffer());
    if (req.headers.get('content-encoding') === 'gzip') bytes = zlib.gunzipSync(bytes);
    const payload = JSON.parse(bytes.toString() || '{}');
    const url = new URL(req.url).pathname;
    if (url === '/api/chats/export') return typeof exportBody === 'function' ? exportBody(disk) : exportBody;
    if (url === '/api/chats/save') { disk = copy(payload.chat); writes++; return Response.json({}); }
    if (url === '/api/characters/chats') return Array.isArray(listing) ? Response.json(listing) : Response.json(listing);
    return Response.json([]);
  }
  const win = { fetch: fetcher, document: {}, location: new URL('https://host.test/'), navigator: { locks }, Request, Response, Blob, TextDecoder, DecompressionStream, URL };
  win.__TAURI_INTERNALS__ = {};
  const ctx = { chat: live.slice(1), chatMetadata: live[0].chat_metadata, getCurrentChatId: () => 'story', getRequestHeaders: () => ({ 'Content-Type': 'application/json' }) };
  const api = { getCurrentCharacterId: () => 'card.png', SillyTavern: { getContext: () => ctx } };
  return { win, live, ctx, service: G.acquire({ win, api }), get disk() { return disk; }, setDisk(v) { disk = v; }, writes: () => writes };
}

test('a raw JSONL export body (Tauri Tavern shape) is read without the {result} wrapper', async () => {
  const f = await fixture({ exportBody: disk => new Response(disk.map(JSON.stringify).join('\n'), { status: 200, headers: { 'Content-Type': 'application/jsonl' } }) });
  assert.equal(await f.service.guard.ready().then(() => 'ok'), 'ok');
  assert.equal(f.service.guard.status().error, null);
  f.live[1].mes = 'tauri written';
  await f.service.guard.commit({ characterKey: 'card.png', chatId: 'story' }, copy(f.live), async () => { f.setDisk(copy(f.live)); return { ok: true }; });
  assert.equal(f.disk[1].mes, 'tauri written');
});

test('an unreadable export on a chat the listing does not know yet counts as an empty story', async () => {
  const f = await fixture({ exportBody: new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }), listing: [] });
  await f.service.guard.ready();
  assert.equal(f.service.guard.status().error, null);
  assert.equal(f.service.guard.status().phase, 'load-ready');
});

test('an unreadable export keeps blocking when the listing does know this chat', async () => {
  const f = await fixture({ exportBody: new Response('<!doctype html><html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }), listing: [{ file_name: 'story.jsonl', mes: 'x' }] });
  await assert.rejects(f.service.guard.ready(), { code: 'chat-save-read' });
  assert.equal(f.service.guard.status().error, 'chat-save-read');
});
