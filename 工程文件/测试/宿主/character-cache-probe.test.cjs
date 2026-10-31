'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const Probe = require('./character-cache-probe.js');
const clone = value => JSON.parse(JSON.stringify(value));
function fixture({ pending = false, changeScope = false, changeCache = false } = {}) {
  const original = { name: '测试', extensions: { tavern_helper: { scripts: [], variables: { playerMemo: '玩家原文' } } }, character_book: { name: '书', entries: [{ id: 1, content: '本地文本', use_regex: false }] } };
  let disk = clone(original), cache = clone(original), chat = 'story', calls = [];
  disk.character_book.entries[0].content = '磁盘新文本';
  const api = { SillyTavern: { getContext: () => ({ characterId: 0, characters: [{ avatar: 'card.png' }], getCurrentChatId: () => chat, getRequestHeaders: () => ({}) }) },
    getCharData: () => ({ data: clone(cache), json_data: JSON.stringify({ spec: 'chara_card_v2', data: cache }) }), getTavernVersion: () => '1.18.0',
    fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); assert.equal(options.method, 'POST'); return { ok: true, json: async () => ({ data: clone(disk), json_data: JSON.stringify({ data: disk }) }) }; } };
  const wait = async () => { if (pending) disk = clone(original); if (changeScope) chat = 'new'; if (changeCache) cache.extensions.tavern_helper.variables.playerMemo = '新本地文字'; };
  return { api, win: { location: { origin: 'http://tauri.localhost' } }, wait, calls, original };
}
test('probe identifies exact persistent book difference without copying private text or writing a card/chat', async () => {
  const f = fixture(), result = await Probe.capture(f.win, f.api, { wait: f.wait });
  assert.equal(result.cacheStable, true); assert.equal(result.reads[1].difference.equal, false);
  assert.equal(result.reads[1].difference.changes[0].path, '/character_book/entries/0/content');
  assert.ok(!JSON.stringify(result).includes('玩家原文') && !JSON.stringify(result).includes('本地文本'));
  assert.equal(f.calls.length, 2); assert.ok(f.calls.every(c => c.url.endsWith('/api/characters/get') && c.body.avatar_url === 'card.png'));
});
test('probe distinguishes delayed saves and rejects a scope switch', async () => {
  const f = fixture({ pending: true }), result = await Probe.capture(f.win, f.api, { wait: f.wait });
  assert.match(result.conclusion, /保存延迟/); assert.equal(result.diskChangedDuringWait, true);
  const changed = fixture({ changeScope: true }); await assert.rejects(Probe.capture(changed.win, changed.api, { wait: changed.wait }), /切换/); assert.equal(changed.calls.length, 1);
});
test('probe detects local cache edits and keeps the host CRLF/use_regex comparison semantics', async () => {
  const f = fixture({ changeCache: true }), result = await Probe.capture(f.win, f.api, { wait: f.wait }); assert.equal(result.cacheStable, false);
  const a = { ...f.original, alternate_greetings: ['a\nb'] }, b = clone(a); b.alternate_greetings = ['a\r\nb']; b.character_book.entries[0].use_regex = true;
  assert.equal(Probe.difference(Probe.comparable(a), Probe.comparable(b)).equal, true);
  b.character_book.entries[0].extra = { player: true }; assert.equal(Probe.difference(Probe.comparable(a), Probe.comparable(b)).equal, false);
});
test('a timed out read and an aborted delay do not continue to a second request',async()=>{
  const f=fixture();f.api.fetch=async(url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('AbortError')),{once:true}));
  await assert.rejects(Probe.capture(f.win,f.api,{timeout:5}),/超时/);
  const g=fixture(),controller=new AbortController(),pending=Probe.capture(g.win,g.api,{signal:controller.signal});await new Promise(resolve=>setTimeout(resolve,5));controller.abort();await assert.rejects(pending,/取消/);assert.equal(g.calls.length,1);
});
