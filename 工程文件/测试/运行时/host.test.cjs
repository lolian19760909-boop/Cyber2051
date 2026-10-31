'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setImmediate: nextTurn } = require('node:timers/promises');
const crypto = require('node:crypto');
const Host = require("../../卡片源码/运行时/host.js");
const Core = require("../../卡片源码/运行时/core.js");
const Controller = require("../../卡片源码/运行时/controller.js");
const Content = require("../../卡片源码/运行时/content.js");
const Tools = require("../../工具/发布/packages.cjs");
const Backup = require("../../卡片源码/运行时/backup.js");
const copy = value => JSON.parse(JSON.stringify(value));
const NAMESPACE = Host.NAMESPACE;
function mvuGenerationHost(provider='api'){
  const fs=require('node:fs'),vm=require('node:vm');let now=0;
  const state={characterKey:'card-a',chatId:'chat-a',extra:true},mvu={isDuringExtraAnalysis:()=>state.extra};
  const api={SillyTavern:{getContext:()=>({getCurrentChatId:()=>state.chatId,onlineStatus:state.online})},getCurrentCharacterId:()=>state.characterKey,builtin:{duringGenerating:()=>state.nativeBusy===true}};
  const root={module:{exports:{}},require:require('node:module').createRequire(require.resolve('../../卡片源码/运行时/host.js')),Date:class extends Date{static now(){return now;}},parent:{},fetch(){throw Error('No network expected');}};
  if(provider==='parent')root.parent.Mvu=mvu;else api.Mvu=mvu;
  vm.runInNewContext(fs.readFileSync(require.resolve("../../卡片源码/运行时/host.js"),'utf8'),root);
  const host=root.module.exports.create({api,core:{canonical:JSON.stringify},fetch:root.fetch});now=3000;
  function requested(id,config={user_input:'遵循<must>指令',generation_id:id},kind='generate'){host.mvuGenerationRequested?.(id,kind,config);host.generationStarted(id);}
  return {host,api,root,state,mvu,requested,tick:ms=>{now+=ms;}};
}
test('disconnected native early return releases only its own latch after a quiet interval',()=>{
  const f=mvuGenerationHost();f.state.extra=false;f.state.online='no_connection';f.state.nativeBusy=true;f.host.generationStarted('native');f.tick(5000);assert.equal(f.host.getContext().busy,true);
  f.state.nativeBusy=false;assert.equal(f.host.getContext().busy,true);f.tick(2001);assert.equal(f.host.getContext().busy,false);
  f.host.generationStarted('foreign');f.host.generationStarted('native');f.host.getContext();f.tick(2001);assert.equal(f.host.getContext().busy,true);f.host.generationEnded('foreign');f.tick(2001);assert.equal(f.host.getContext().busy,false);
  f.state.online='connected';f.host.generationStarted('native');f.tick(5000);assert.equal(f.host.getContext().busy,true,'connected prompt preparation still protected');
});
test('matched failed MVU helper IDs release only after the public busy flag is false and a fresh quiet period',()=>{
  const f=mvuGenerationHost();for(const id of ['mvu-1','mvu-2','mvu-3'])f.requested(id);
  f.tick(10000);assert.equal(f.host.getContext().busy,true);f.state.extra=false;
  assert.equal(f.host.getContext().busy,true);f.tick(1999);assert.equal(f.host.getContext().busy,true);f.tick(2);assert.equal(f.host.getContext().busy,false);
  f.tick(5000);assert.equal(f.host.getContext().busy,false,'repeated reads must not restart the quiet period');
});
test('a successful helper end remains busy while the public MVU extra-analysis flag is true',()=>{
  const f=mvuGenerationHost('parent');for(const id of ['mvu-1','mvu-2','mvu-3'])f.requested(id);f.host.generationEnded('mvu-3');
  f.tick(5000);assert.equal(f.host.getContext().busy,true);f.state.extra=false;assert.equal(f.host.getContext().busy,true);f.tick(2001);assert.equal(f.host.getContext().busy,false);
});
test('fixed MVU builtin generateRaw attempts use the same scoped public-busy recovery',()=>{
  const f=mvuGenerationHost('parent');for(const id of ['mvu-raw-1','mvu-raw-2','mvu-raw-3'])f.requested(id,{user_input:'遵循<must>指令',generation_id:id},'generateRaw');
  f.tick(5000);assert.equal(f.host.getContext().busy,true);f.state.extra=false;assert.equal(f.host.getContext().busy,true);f.tick(2001);assert.equal(f.host.getContext().busy,false);
});
test('MVU recovery preserves unrelated helper and native generation IDs',()=>{
  const f=mvuGenerationHost();f.requested('mvu-own');f.host.generationStarted('foreign');f.host.generationStarted('native');f.state.extra=false;f.host.getContext();f.tick(2001);
  assert.equal(f.host.getContext().busy,true);f.host.generationEnded('foreign');f.tick(2001);assert.equal(f.host.getContext().busy,true);f.host.generationEnded('native');f.tick(2001);assert.equal(f.host.getContext().busy,false);
});
test('only the fixed MVU requested signature qualifies, without reading any private config field',()=>{
  for(const [id,kind,config] of [['a','other',{user_input:'遵循<must>指令',generation_id:'a'}],['a','generate',{user_input:'其他请求',generation_id:'a'}],['a','generate',{user_input:'遵循<must>指令',generation_id:'different'}],['native','generate',{user_input:'遵循<must>指令',generation_id:'native'}]]){
    const f=mvuGenerationHost();f.requested(id,config,kind);f.state.extra=false;f.tick(5000);assert.equal(f.host.getContext().busy,true);
  }
  const f=mvuGenerationHost(),config={user_input:'遵循<must>指令',generation_id:'own'};Object.defineProperty(config,'custom_api',{enumerable:true,get(){throw Error('Private config must not be read');}});
  f.requested('own',config);f.state.extra=false;f.host.getContext();f.tick(2001);assert.equal(f.host.getContext().busy,false);
});
test('missing, unknown or replaced MVU provider cannot release a tracked failed generation',()=>{
  const f=mvuGenerationHost();f.requested('own');f.state.extra=undefined;f.tick(5000);assert.equal(f.host.getContext().busy,true);
  delete f.api.Mvu;assert.equal(f.host.getContext().busy,true);f.api.Mvu={isDuringExtraAnalysis:()=>false};assert.equal(f.host.getContext().busy,true);
  f.api.Mvu=f.mvu;f.state.extra=false;f.host.getContext();f.tick(2001);assert.equal(f.host.getContext().busy,false);
});
test('a tracked old-chat request is never released by checking the next chat or character',()=>{
  for(const field of ['chatId','characterKey']){const f=mvuGenerationHost();f.requested('old');f.state[field]='next';f.state.extra=false;f.tick(5000);assert.equal(f.host.getContext().busy,true);}
});

// A transaction-scheduled IndexedDB fixture, with isolated working copies and
// rollback. It exercises the actual host adapter's request/event flow.
function memoryIndexedDB() {
  const databases = new Map();
  const later = callback => setImmediate(callback);
  function connect(db) {
    return {
      objectStoreNames: { contains: name => db.stores.has(name) },
      createObjectStore(name, options = {}) { db.stores.set(name, { keyPath: options.keyPath, records: new Map() }); },
      close() {},
      transaction(name, mode = 'readonly') {
        const tx = { error: null, oncomplete: null, onabort: null, onerror: null }, operations = [];
        let working, started = false, ended = false, scheduled = false;
        function abort(reason) {
          if (ended) return; ended = true; tx.error = reason || Error('Aborted');
          later(() => { tx.onabort?.({ target: tx }); db.busy = false; pump(); });
        }
        tx.abort = () => abort();
        function finishIfEmpty() {
          if (ended || operations.length) return run();
          ended = true;
          if (mode === 'readwrite') db.stores.get(name).records = working;
          tx.oncomplete?.({ target: tx }); db.busy = false; pump();
        }
        function run() {
          if (!started || ended || scheduled) return; scheduled = true;
          later(() => {
            scheduled = false; if (ended) return;
            const operation = operations.shift();
            if (!operation) return finishIfEmpty();
            try { operation.request.result = operation.work(); operation.request.onsuccess?.({ target: operation.request }); }
            catch (cause) { operation.request.error = cause; operation.request.onerror?.({ target: operation.request, preventDefault() {} }); return abort(cause); }
            // Await continuations of onsuccess get one turn to enqueue writes.
            later(finishIfEmpty);
          });
        }
        function request(work) {
          const req = { result: undefined, error: null, onsuccess: null, onerror: null };
          if (ended) throw Error('TransactionInactiveError');
          operations.push({ request: req, work }); run(); return req;
        }
        tx.objectStore = storeName => {
          assert.equal(storeName, name);
          const key = (value, explicit) => explicit === undefined ? value[db.stores.get(name).keyPath] : explicit;
          return {
            get: id => request(() => working.has(id) ? copy(working.get(id)) : undefined),
            put: (value, explicit) => request(() => { const id = key(value, explicit); working.set(id, copy(value)); return id; }),
            add: (value, explicit) => request(() => { const id = key(value, explicit); if (working.has(id)) { const e = Error('ConstraintError'); e.name = 'ConstraintError'; throw e; } working.set(id, copy(value)); return id; }),
            delete: id => request(() => { working.delete(id); }),
          };
        };
        db.queue.push(() => {
          if (ended) { db.busy = false; pump(); return; }
          const original = db.stores.get(name);
          if (!original) return abort(Error('NotFoundError'));
          working = new Map([...original.records].map(([key, value]) => [key, copy(value)])); started = true; run();
        });
        pump(); return tx;
        function pump() { if (!db.busy && db.queue.length) { db.busy = true; later(db.queue.shift()); } }
      },
    };
  }
  return {
    open(name, version = 1) {
      const req = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      later(() => {
        let db = databases.get(name), fresh = false;
        if (!db) { db = { version, stores: new Map(), queue: [], busy: false }; databases.set(name, db); fresh = true; }
        req.result = connect(db); if (fresh) req.onupgradeneeded?.({ target: req, oldVersion: 0, newVersion: version }); req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}

function runtimeEntry(content = 'old') {
  return { uid: 1, name: '条目', enabled: true, content,
    strategy: { type: 'selective', keys: ['trigger'], keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
    position: { type: 'after_character_definition', role: 'system', depth: 4, order: 100 },
    recursion: { prevent_incoming: false, prevent_outgoing: false, delay_until: null },
    probability: 100, effect: { sticky: null, cooldown: null, delay: null }, extra: {} };
}
function runtimeRegex() {
  return { id: 'regex-a', script_name: 'regex-a', enabled: true, find_regex: 'old', replace_string: 'old', trim_strings: [],
    source: { user_input: false, ai_output: true, slash_command: false, world_info: false, reasoning: false },
    destination: { display: true, prompt: false }, run_on_edit: false, min_depth: null, max_depth: null };
}
function runtimeScript() { return { type: 'script', id: 'script-a', name: '脚本', content: 'old', enabled: true, info: '', data: { selectedImage: 'player-choice' }, button: { enabled: true, buttons: [] }, export_with: { data: true, button: true } }; }
function rawEntry(runtime = runtimeEntry()) { return { ...Host.mergeRawEntry(null, null, runtime, 0), authorUnknown: { retained: true }, lineEndingHint: 'CRLF' }; }
test('retained historical entry and new definitions read back in the planned display order', () => {
  const old={...runtimeEntry('old acquired item'),uid:29},raw={...rawEntry(old),displayIndex:28};
  const rows=[Host.mergeRawEntry(raw,old,old,26),Host.mergeRawEntry(null,null,{...runtimeEntry('new slot'),uid:37},27),Host.mergeRawEntry(null,null,{...runtimeEntry('new resource'),uid:38},28)];
  assert.deepEqual([...rows].sort((a,b)=>a.displayIndex-b.displayIndex).map(e=>e.uid),[29,37,38]);
  assert.deepEqual({...rows[0],displayIndex:raw.displayIndex},raw,'all content and unknown raw fields survive');
});
function rawToRuntime(raw) {
  const key=value=>{const m=value.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);if(!m||/(^|[^\\])\//.test(m[1]))return value;try{return new RegExp(m[1].replace('\\/','/'),m[2]);}catch{return value;}};
  return { uid: raw.uid, name: raw.comment, enabled: !raw.disable, content: raw.content,
    strategy: { type: raw.constant ? 'constant' : raw.vectorized ? 'vectorized' : 'selective', keys: (raw.key || []).map(key), keys_secondary: { logic: ['and_any', 'not_all', 'not_any', 'and_all'][raw.selectiveLogic || 0], keys: (raw.keysecondary || []).map(key) }, scan_depth: raw.scanDepth ?? 'same_as_global' },
    position: { type: ['before_character_definition', 'after_character_definition', 'before_author_note', 'after_author_note', 'at_depth', 'before_example_messages', 'after_example_messages', 'outlet'][raw.position], role: ['system', 'user', 'assistant'][raw.role], depth: raw.depth, order: raw.order },
    recursion: { prevent_incoming: !!raw.excludeRecursion, prevent_outgoing: !!raw.preventRecursion, delay_until: raw.delayUntilRecursion || null },
    probability: raw.useProbability === false ? 100 : raw.probability ?? 100,
    effect: { sticky: raw.sticky ?? null, cooldown: raw.cooldown ?? null, delay: raw.delay ?? null }, extra: copy(raw.extra || {}) };
}
function fakeBackend(t, config = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1700000000000 });
  const initialState = { cardId: 'cyber2051', instanceId: 'test-instance', registry: { format: 1, packages: {} }, installed: { 'official.core': { version: '1.0.0' } } };
  const character = { name: '卡', character_version: '1.0.0', extensions: { world: 'world 1.0.0', regex_scripts: Host.toRawRegexes([runtimeRegex()]), tavern_helper: { scripts: [runtimeScript()], variables: { existingPlayerVar: { untouched: true }, [NAMESPACE]: initialState } } } };
  const state = { avatar: 'card-a.png', chatId: 'save-a', generation: false, runtimeRegex: [runtimeRegex()], raw: copy(character), disk: copy(character), pending: null, readsSinceSave: 0, characterReads: 0, events: [], rawBooks: new Map([['world 1.0.0', { entries: { '1': rawEntry() }, worldUnknown: 'keep' }]]), runtimeBooks: new Map([['world 1.0.0', [runtimeEntry()]]]), worldNames: ['world 1.0.0', 'player-book'], additional: ['player-book'], binding: 'world 1.0.0', chatBinding: null, diskChatBinding: null,
    chatVariables: { playerMemo: 'keep' }, messageFloors: [{ mes: '历史对话', stat_data: { yen: 1800, affection: 37, terminal: { quests: {} } } }] };
  function queueSave() { state.pending = copy(state.raw); state.readsSinceSave = 0; }
  function flushCharacter() {
    if (state.pending) {
      const previousScripts = state.disk.extensions.tavern_helper.scripts,previousBook=state.disk.character_book;
      state.disk = copy(state.pending); state.pending = null;
      if (config.delayScripts) state.disk.extensions.tavern_helper.scripts = previousScripts;
      if (config.regenerateEmbeddedBook) state.disk.character_book = JSON.stringify(previousScripts)!==JSON.stringify(state.disk.extensions.tavern_helper.scripts)?require('../../卡片源码/运行时/character-comparison.js').embeddedBook(state.binding,state.rawBooks.get(state.binding).entries):copy(previousBook);
    }
    if (config.corruptDiskBinding) state.disk.extensions.world = 'world 1.0.0';
  }
  let cacheRecord;const liveCharacter=()=>{if(cacheRecord?.data!==state.raw)cacheRecord={data:state.raw};return cacheRecord;};
  const api = {
    SillyTavern: { getContext: () => ({ characterId: 0, characters:[liveCharacter()], getCurrentChatId: () => state.chatId, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
      async unshallowCharacter() { if (config.onUnshallow) await config.onUnshallow(state); },
      async getOneCharacter(avatar) { assert.equal(avatar, state.avatar); state.raw = copy(state.disk); state.events.push('character-cache-refreshed'); },
      async writeExtensionField(characterId, key, value) { assert.equal(characterId, 0); assert.equal(key, 'world'); state.binding = value; state.raw.extensions.world = value; queueSave(); state.events.push('narrow-world-binding'); },
      async updateWorldInfoList() { state.worldNames = [...state.rawBooks.keys(), 'player-book']; state.events.push('worldbook-list-refreshed'); },
      async saveWorldInfo(name, book) { state.runtimeBooks.set(name, Object.values(book.entries || {}).map(rawToRuntime)); state.events.push('cache:' + name); },
    }) },
    builtin: { duringGenerating: () => state.generation },
    getCurrentCharacterId: () => state.avatar,
    getCharData: liveCharacter,
    getVariables(option) { return copy(option.type === 'chat' ? state.chatVariables : option.type === 'message' ? state.messageFloors[option.message_id] || {} : state.raw.extensions.tavern_helper.variables); },
    getLastMessageId: () => state.messageFloors.length - 1,
    async updateVariablesWith(update, option) {
      if (option.type === 'chat') { state.chatVariables = copy(await update(copy(state.chatVariables))); return; }
      assert.deepEqual(option, { type: 'character' }); state.raw.extensions.tavern_helper.variables = copy(await update(copy(state.raw.extensions.tavern_helper.variables))); state.events.push('state-helper-returned'); queueSave();
    },
    getCharWorldbookNames: () => ({ primary: state.binding, additional: copy(state.additional) }),
    async rebindCharWorldbooks(_character, names) { assert.ok(!names.primary || state.worldNames.includes(names.primary), 'helper cannot bind a book absent from its refreshed list'); state.binding = names.primary; state.additional = copy(names.additional); state.raw.extensions.world = names.primary; queueSave(); if (config.recreateOpeningOnRebind) state.messageFloors = [{ mes: 'regenerated opening', stat_data: {} }]; },
    getChatWorldbookName: () => state.chatBinding,
    async rebindChatWorldbook(_chat, name) { assert.ok(!name || state.worldNames.includes(name), 'helper cannot bind a book absent from its refreshed list'); state.chatBinding = name; state.diskChatBinding = name; },
    getWorldbookNames: () => copy(state.worldNames),
    async getWorldbook(name) { return state.runtimeBooks.get(name) || []; },
    getTavernRegexes: () => copy(state.runtimeRegex),
    async replaceTavernRegexes(regexes) { state.runtimeRegex = copy(regexes); state.raw.extensions.regex_scripts = Host.toRawRegexes(regexes); state.events.push('regex-helper-returned'); queueSave(); },
    getScriptTrees: () => copy(state.raw.extensions.tavern_helper.scripts),
    replaceScriptTrees(trees) { state.raw.extensions.tavern_helper.scripts = copy(trees); state.events.push('scripts-helper-returned'); queueSave(); },
    getTavernVersion: () => '1.19.0', getTavernHelperVersion: () => '4.11.2',
  };
  async function fetch(url, options) {
    const endpoint = new URL(url).pathname, body = JSON.parse(options.body);
    assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'same-origin');
    if (config.beforeFetch) await config.beforeFetch(endpoint, body, state);
    let data;
    if (endpoint === '/api/characters/get') {
      assert.equal(body.avatar_url, state.avatar); state.characterReads++; state.readsSinceSave++;
      if (!config.neverSave && state.readsSinceSave >= (config.persistAfterReads || 1)) { flushCharacter(); state.events.push('character-persisted'); }
      data = { json_data: JSON.stringify({ spec: 'chara_card_v2', data: copy(state.disk) }) };
    } else if (endpoint === '/api/chats/get') {
      assert.equal(body.avatar_url, state.avatar); assert.equal(body.file_name, state.chatId);
      data = [{ chat_metadata: { world_info: state.diskChatBinding } }];
    } else if (endpoint === '/api/worldinfo/get') data = copy(state.rawBooks.get(body.name) || { entries: {} });
    else if (endpoint === '/api/worldinfo/edit') {
      assert.ok(body.data && body.data.entries);
      state.rawBooks.set(body.name, copy(body.data)); state.events.push('worldbook-persisted:' + body.name); data = { ok: true };
    } else throw Error('unexpected endpoint: ' + endpoint);
    if (config.afterFetch) await config.afterFetch(endpoint, body, state);
    return { ok: true, status: 200, async json() { return copy(data); } };
  }
  const active = new Set();
  const locks = { async request(name, options, callback) {
    assert.equal(options.mode, 'exclusive');
    assert.ok(options.ifAvailable === true || options.ifAvailable === undefined && options.signal instanceof AbortSignal);
    if (active.has(name)) return callback(null);
    active.add(name); try { return await callback({ name }); } finally { active.delete(name); }
  } };
  const indexedDB = memoryIndexedDB();
  const worldField = { type: 'hidden', value: state.binding }, document = { getElementById: id => id === 'character_world' ? worldField : null };
  // This fixture exercises the Helper writer (including delayed ACKs). The
  // independent character-state tests exercise the native narrow-write API.
  const createHost = () => Host.create({ core: Core, api, fetch, locks, indexedDB, document, stateStore:{create:()=>null}, hostOrigin: 'http://localhost:8000' });
  const host = createHost(); t.mock.timers.tick(2500);
  return { host, api, state, fetch, locks, indexedDB, createHost, flushCharacter, queueSave };
}
function independentCacheTab(backend) {
  const cache = copy(backend.state.disk);
  const api = { ...backend.api,
    getCharData: () => ({ data: copy(cache) }),
    getVariables: options => options.type === 'character' ? copy(cache.extensions.tavern_helper.variables) : backend.api.getVariables(options),
    getScriptTrees: () => copy(cache.extensions.tavern_helper.scripts),
    async updateVariablesWith(update, options) {
      assert.equal(options.type, 'character');
      cache.extensions.tavern_helper.variables = copy(await update(copy(cache.extensions.tavern_helper.variables)));
      backend.state.pending = copy(cache); backend.state.readsSinceSave = 0;
    },
  };
  return { cache, host: Host.create({ core: Core, api, fetch: backend.fetch, locks: backend.locks, indexedDB: backend.indexedDB, stateStore:{create:()=>null}, hostOrigin: 'http://localhost:8000' }) };
}
async function finish(t, promise, maxTurns = 240) {
  let done = false;
  promise.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < maxTurns && !done; i++) { await nextTurn(); t.mock.timers.tick(10000); }
  assert.equal(done, true, 'host operation did not settle with simulated time');
  return promise;
}
function installedCommit(after) { return { installed: { 'official.core': { version: '1.0.1' } }, baseline: { format: 1 }, conflicts: [], scope: 'character', registry: after.registry }; }

test('own script save regenerates the embedded book; exact raw-book proof refreshes that cache only',async t=>{
 const h=fakeBackend(t,{regenerateEmbeddedBook:true}),C=require('../../卡片源码/运行时/character-comparison.js');
 const book=C.embeddedBook(h.state.binding,h.state.rawBooks.get(h.state.binding).entries);h.state.raw.character_book=copy(book);h.state.disk.character_book=copy(book);
 const before=await h.host.snapshot(),after=copy(before);after.worldbook.entries[0].content='new official rule';after.scripts.trees[0].content='new script';
 await finish(t,h.host.withLock(()=>Core.execute({host:h.host,storage:h.host.createStorage(),key:'journal',expectedContext:h.host.getContext(),before,after,installed:installedCommit(after)})));
 await finish(t,h.host.withLock(()=>Core.recover({host:h.host,storage:h.host.createStorage(),key:'journal'})));
 assert(!h.state.events.includes('character-cache-refreshed'),'must not use asynchronous whole-character refresh');assert.equal(h.state.raw.character_book.entries[0].content,'new official rule');
 assert.deepEqual(h.state.raw.character_book,h.state.disk.character_book);
});
for(const field of ['character_book','description'])test('active install still rejects a foreign disk edit to '+field,async t=>{
 const h=fakeBackend(t,{regenerateEmbeddedBook:true}),C=require('../../卡片源码/运行时/character-comparison.js');
 const book=C.embeddedBook(h.state.binding,h.state.rawBooks.get(h.state.binding).entries);h.state.raw.character_book=copy(book);h.state.disk.character_book=copy(book);
 const before=await h.host.snapshot(),after=copy(before);after.worldbook.entries[0].content='new official rule';after.scripts.trees[0].content='new script';
 await finish(t,h.host.withLock(()=>Core.execute({host:h.host,storage:h.host.createStorage(),key:'journal',expectedContext:h.host.getContext(),before,after,installed:installedCommit(after)})));
 h.flushCharacter();if(field==='character_book')h.state.disk.character_book.entries[0].content='foreign edit';else h.state.disk.description='foreign edit';
 await assert.rejects(finish(t,h.host.withLock(()=>Core.recover({host:h.host,storage:h.host.createStorage(),key:'journal'}))),{code:'stale-character-cache'});
 assert(!h.state.events.includes('character-cache-refreshed'));
});

test('current card scripts pass the character save guard unchanged', async t => {
  const fs = require('node:fs'), path = require('node:path');
  const card = JSON.parse(fs.readFileSync(process.env.CXX_TEST_CARD || path.join(__dirname, '../../.cache/build/赛博小祥2051-V2.3.0.json')));
  const scripts = card.data.extensions.tavern_helper.scripts, h = fakeBackend(t);
  h.state.raw.extensions.tavern_helper.scripts = copy(scripts);
  h.state.disk.extensions.tavern_helper.scripts = copy(scripts);
  const desired = { ...h.host.readState(), openingChecked: true };
  await finish(t, h.host.withLock(() => h.host.saveState(desired)));
  assert.deepEqual(h.state.disk.extensions.tavern_helper.scripts, scripts);
  assert.deepEqual(h.state.disk.extensions.tavern_helper.variables[NAMESPACE], desired);
  assert.deepEqual(h.state.disk.extensions.tavern_helper.variables.existingPlayerVar, { untouched: true });
});

test('save comparison tolerates CRLF in scripts and player strings without rewriting them', async t => {
  const h = fakeBackend(t);
  for (const data of [h.state.raw, h.state.disk]) {
    data.extensions.tavern_helper.scripts[0].content = 'first\r\nsecond';
    data.extensions.tavern_helper.variables.playerText = 'keep\r\nmy text';
  }
  const scripts = copy(h.state.disk.extensions.tavern_helper.scripts), desired = { ...h.host.readState(), openingChecked: true };
  await finish(t, h.host.withLock(() => h.host.saveState(desired)));
  assert.deepEqual(h.state.disk.extensions.tavern_helper.scripts, scripts);
  assert.equal(h.state.disk.extensions.tavern_helper.variables.playerText, 'keep\r\nmy text');
});

test('read-only recovery compares CRLF journal snapshots but still refuses a write across the pending change', async t => {
  const h = fakeBackend(t);
  for (const data of [h.state.raw,h.state.disk]) data.extensions.tavern_helper.scripts[0].content='old\r\nscript';
  const before=await h.host.snapshot(),after=copy(before);after.scripts.trees[0].content='new\r\nscript';
  const journal={format:1,id:'crlf-read',context:h.host.getContext(),before,after,stages:['scripts'],attempted:['scripts'],completed:[],installed:installedCommit(after),status:'prepared'};
  await finish(t,h.host.withLock(()=>h.host.createStorage().claim('journal',journal)));
  h.state.raw.extensions.tavern_helper.scripts=copy(after.scripts.trees);
  await finish(t,h.host.withLock(()=>h.host.snapshot()));
  assert.deepEqual(h.state.disk.extensions.tavern_helper.scripts,before.scripts.trees);
  await assert.rejects(finish(t,h.host.withLock(()=>h.host.saveState(h.host.readState()))),{code:'stale-character-cache'});
});

test('complete installation ownership survives a real Host storage commit and a fresh cache reload', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot();
  const ledger = { 'optional.fixture': { version: '1.0.0', owners: { worldbook: [], regex: [], scripts: [] }, futureField: { retained: [0, false, 'player'] } } };
  const target = { ...installedCommit(before), componentPackages: ledger };
  const players = copy({ chat: h.state.chatVariables, floors: h.state.messageFloors });
  await finish(t, h.host.withLock(() => Core.execute({ host: h.host, storage: h.host.createStorage(), key: 'journal', expectedContext: h.host.getContext(), before, after: before, installed: target })));
  const restarted = h.createHost(); t.mock.timers.tick(2500);
  const result = await finish(t, restarted.withLock(() => Core.recover({ host: restarted, storage: restarted.createStorage(), key: 'journal' })));
  assert.equal(result.status, 'committed'); h.state.raw = copy(h.state.disk);
  assert.deepEqual(await h.createHost().createStorage().get('journal:installed'), target);
  assert.deepEqual(h.state.disk.extensions.tavern_helper.variables.existingPlayerVar, { untouched: true });
  assert.deepEqual({ chat: h.state.chatVariables, floors: h.state.messageFloors }, players);
});

test('Host rejects malformed component ledgers before writing character variables', async t => {
  const h = fakeBackend(t), before = copy(h.state.raw);
  for (const componentPackages of [null, [], { fixture: null }, { fixture: new Date() }, { fixture: { invalid: undefined } }]) {
    await assert.rejects(h.host.saveState({ ...h.host.readState(), componentPackages }), { code: 'invalid-component-ledger' });
  }
  assert.deepEqual(h.state.raw, before); assert.equal(h.state.events.includes('state-helper-returned'), false);
});

test('Host refuses an incomplete, changed or foreign installation target without replacing its ledger', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot(), target = { ...installedCommit(before), componentPackages: { fixture: { version: '1.0.0' } } };
  await finish(t, h.host.withLock(() => Core.execute({ host: h.host, storage: h.host.createStorage(), key: 'journal', expectedContext: h.host.getContext(), before, after: before, installed: target })));
  await finish(t, h.host.withLock(async () => {
    const storage = h.host.createStorage(), journal = await storage.get('journal'), state = copy(h.state.raw);
    const missing = copy(target); delete missing.registry;
    const changed = copy(target); changed.componentPackages.fixture.version = '2.0.0';
    for (const [value, code, owner] of [[missing, 'installed-target-mismatch', journal.id], [changed, 'component-ledger-mismatch', journal.id],
      [{ ...target, playerNote: 'must not copy whole state' }, 'installed-target-mismatch', journal.id], [target, 'stale-journal', 'another-owner']]) {
      await assert.rejects(storage.set('journal:installed', value, { expectedId: owner }), { code });
      assert.deepEqual(h.state.raw, state);
    }
    assert.equal((await storage.get('journal')).id, journal.id);
  }));
});
test('ready uses operation capabilities across version labels and preserves missing-interface errors', async t => {
  const h = fakeBackend(t); assert.deepEqual(await h.host.ready(), { st: '1.19.0', helper: '4.11.2' });
  for(const [st,helper] of [['1.18.0','4.9.5'],['2.0.0','5.0.0'],['unknown','unknown']]){
    h.api.getTavernVersion=()=>st;h.api.getTavernHelperVersion=()=>helper;
    assert.deepEqual(await h.host.ready(),{st,helper});
  }
  for(const invalid of [true,'available',{}]){h.api.builtin.duringGenerating=invalid;assert.equal(h.host.capabilities('export').ok,false);await assert.rejects(h.host.ready('export'),e=>e.code==='capability-missing');}
  h.api.builtin.duringGenerating=()=>false;
  delete h.api.replaceScriptTrees;
  assert.deepEqual(h.host.capabilities('install').missing,['replaceScriptTrees']);
  await assert.rejects(h.host.ready(),e=>e.code==='capability-missing'&&e.details.missing.includes('replaceScriptTrees'));
  assert.equal(h.host.capabilities('export').ok,true);
  await h.host.ready('export');
});

for (const type of ['worldbook', 'regex', 'scripts']) test(type + ' component ownership survives Host restart and guarded uninstall without touching messages', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot(), original = copy({ messages: h.state.messageFloors, chat: h.state.chatVariables });
  const state = { ...h.host.readState(), baseline: await Core.fingerprints(before) };
  const parts = { worldbook: { entries: [{ ...Host.normalizeEntry(runtimeEntry('component text')), uid: 900, name: '隔离组件' }] },
    regex: { scripts: [{ ...runtimeRegex(), id: 'component.regex' }] }, scripts: { trees: [{ ...runtimeScript(), id: 'component.script', data: {} }] } };
  const keys = crypto.generateKeyPairSync('ed25519'), pack = Tools.signDocument(Tools.createComponentPackage({ id: 'optional.fixture', version: '1.0.0', optional: true, requires: { engine: '1.1.0', packages: [] }, components: { [type]: parts[type] } }), keys.privateKey, 'test-publisher');
  await Controller.verifyDocument(pack, { 'test-publisher': keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') }, Core, crypto.webcrypto);
  const plan = await Core.planComponentInstall({ pack, sha256: crypto.createHash('sha256').update(Tools.canonical(pack)).digest('hex'), before, state });
  if (type === 'worldbook') plan.after.worldbook.internalName = 'component fixture';
  const target = { installed: plan.installed, baseline: state.baseline, conflicts: plan.conflicts, scope: 'character', registry: plan.after.registry, componentPackages: plan.componentPackages };
  await finish(t, h.host.withLock(() => Core.execute({ host: h.host, storage: h.host.createStorage(), key: 'journal', expectedContext: h.host.getContext(), before, after: plan.after, installed: target })));
  const restarted = h.createHost(); t.mock.timers.tick(2500);
  assert.equal((await finish(t, restarted.withLock(() => Core.recover({ host: restarted, storage: restarted.createStorage(), key: 'journal' })))).status, 'committed');
  h.state.raw = copy(h.state.disk);
  assert.deepEqual(await restarted.createStorage().get('journal:installed'), target);
  const saved = restarted.readState(), record = saved.componentPackages['optional.fixture'];
  const removal = await Core.planComponentUninstall({ packageId: 'optional.fixture', version: record.version, sha256: record.sha256, before: await restarted.snapshot(), state: saved });
  assert.equal(removal.complete, true); if (type === 'worldbook') removal.after.worldbook.internalName = 'component removed';
  const removed = { ...target, installed: removal.installed, componentPackages: removal.componentPackages, conflicts: removal.conflicts };
  await finish(t, restarted.withLock(async () => {
    await Core.execute({ host: restarted, storage: restarted.createStorage(), key: 'journal', expectedContext: restarted.getContext(), before: removal.before, after: removal.after, installed: removed });
    assert.equal((await Core.recover({ host: restarted, storage: restarted.createStorage(), key: 'journal' })).status, 'committed');
  }));
  assert.deepEqual(restarted.readState().componentPackages, {});
  assert.deepEqual({ messages: h.state.messageFloors, chat: h.state.chatVariables }, original);
  for (const other of ['worldbook', 'regex', 'scripts'].filter(x => x !== type)) assert.deepEqual((await restarted.snapshot())[other], before[other]);
});
test('character preflight waits for an in-flight local helper save without writing', async t => {
  const h = fakeBackend(t, { persistAfterReads: 3 });
  h.state.raw.extensions.tavern_helper.scripts[0].data.selectedImage = 'new-local-choice'; h.queueSave();
  const players = copy({ chat: h.state.chatVariables, floors: h.state.messageFloors });
  let called = false;
  await finish(t, h.host.withLock(() => {
    called = true; assert.deepEqual(h.state.disk, h.state.raw);
  }));
  assert.equal(called, true); assert.equal(h.state.characterReads, 3);
  assert.deepEqual(h.state.events, ['character-persisted']);
  assert.deepEqual({ chat: h.state.chatVariables, floors: h.state.messageFloors }, players);
});
test('character preflight stops after bounded read-only waits if a local save never reaches disk', async t => {
  const h = fakeBackend(t, { neverSave: true }), disk = copy(h.state.disk);
  h.state.raw.extensions.tavern_helper.scripts[0].data.selectedImage = 'unsaved-choice'; h.queueSave();
  let called = false;
  await assert.rejects(finish(t, h.host.withLock(() => { called = true; })), { code: 'stale-character-cache' });
  assert.equal(called, false); assert.equal(h.state.characterReads, 4);
  assert.deepEqual(h.state.events, []); assert.deepEqual(h.state.disk, disk);
  assert.equal(h.state.raw.extensions.tavern_helper.scripts[0].data.selectedImage, 'unsaved-choice');
});
test('character preflight rejects a second cache edit even if the new edit reaches disk', async t => {
  const h = fakeBackend(t, { persistAfterReads: 3, afterFetch(endpoint, body, state) {
    if (endpoint === '/api/characters/get' && state.characterReads === 2) {
      state.raw.extensions.tavern_helper.scripts[0].data.selectedImage = 'second-local-choice';
      state.disk = copy(state.raw); state.pending = null;
    }
  } });
  h.state.raw.extensions.tavern_helper.scripts[0].data.selectedImage = 'first-local-choice'; h.queueSave();
  let called = false;
  await assert.rejects(finish(t, h.host.withLock(() => { called = true; })), { code: 'stale-character-cache' });
  assert.equal(called, false); assert.equal(h.state.characterReads, 2); assert.deepEqual(h.state.events, []);
  assert.equal(h.state.disk.extensions.tavern_helper.scripts[0].data.selectedImage, 'second-local-choice');
});
test('character preflight stops if the chat switches during its save wait', async t => {
  const h = fakeBackend(t, { persistAfterReads: 3, afterFetch(endpoint, body, state) {
    if (endpoint === '/api/characters/get' && state.characterReads === 2) state.chatId = 'other-chat';
  } });
  h.state.raw.extensions.tavern_helper.scripts[0].data.selectedImage = 'local-choice'; h.queueSave();
  let called = false;
  await assert.rejects(finish(t, h.host.withLock(() => { called = true; })), { code: 'context-changed' });
  assert.equal(called, false); assert.deepEqual(h.state.events, []);
});
test('a generation started during character save convergence still blocks the locked action', async t => {
  const h = fakeBackend(t, { persistAfterReads: 2, afterFetch(endpoint, body, state) {
    if (endpoint === '/api/characters/get' && state.characterReads === 2) state.generation = true;
  } });
  h.state.raw.extensions.tavern_helper.scripts[0].data.selectedImage = 'local-choice'; h.queueSave();
  let called = false;
  await assert.rejects(finish(t, h.host.withLock(() => { called = true; })), { code: 'host-busy' });
  assert.equal(called, false); assert.deepEqual(h.state.events, ['character-persisted']);
});
test('saveState waits for a character disk readback beyond the helper return ACK', async t => {
  const h = fakeBackend(t, { persistAfterReads: 3 }), desired = { ...h.host.readState(), subscriptions: { dlc: true } };
  let complete = false; const operation = h.host.saveState(desired).then(() => { complete = true; });
  await nextTurn(); assert.equal(complete, false); assert.equal(h.state.events.includes('state-helper-returned'), true);
  assert.equal(h.state.disk.extensions.tavern_helper.variables[NAMESPACE].subscriptions, undefined);
  await finish(t, operation); assert.equal(h.state.characterReads, 4);
  assert.deepEqual(h.state.disk.extensions.tavern_helper.variables[NAMESPACE], desired);
  assert.deepEqual(h.state.disk.extensions.tavern_helper.variables.existingPlayerVar, { untouched: true });
});
test('an unacknowledged character disk save is rejected instead of reported installed', async t => {
  const h = fakeBackend(t, { neverSave: true });
  await assert.rejects(finish(t, h.host.saveState({ ...h.host.readState(), updated: true })), { code: 'save-not-confirmed' });
  assert.equal(h.state.disk.extensions.tavern_helper.variables[NAMESPACE].updated, undefined);
});
test('unsupported raw regex fields and macro modes stop before the helper changes anything', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot(), next = copy(before.regex); next.scripts[0].replace_string = 'new';
  h.state.raw.extensions.regex_scripts[0].playerCustomFlag = true; h.state.disk = copy(h.state.raw);
  await assert.rejects(h.host.withLock(() => h.host.writeStage('regex', next, before)), { code: 'unsupported-raw-field' });
  assert.equal(h.state.events.includes('regex-helper-returned'), false);
  delete h.state.raw.extensions.regex_scripts[0].playerCustomFlag; h.state.raw.extensions.regex_scripts[0].substituteRegex = 1; h.state.disk = copy(h.state.raw);
  await assert.rejects(h.host.withLock(() => h.host.writeStage('regex', next, before)), { code: 'unsupported-regex-mode' });
  assert.equal(h.state.runtimeRegex[0].replace_string, 'old');
});
test('guardRaw rejects unknown placement numbers rather than translating them away', () => {
  const data = { extensions: { regex_scripts: [{ ...Host.toRawRegexes([runtimeRegex()])[0], placement: [2, 99] }] } };
  assert.throws(() => Host.guardRaw(data, 'regex'));
});

test('primary worldbook binding avoids TH full form save and preserves an untainted opening with accepted quests', async t => {
  const h = fakeBackend(t, { recreateOpeningOnRebind: true }), before = await h.host.snapshot(), after = copy(before);
  h.state.messageFloors[0].stat_data.terminal.quests.q01 = { state: '进行中', definitionRef: { version: '1.0.0' } };
  const messages = copy(h.state.messageFloors); after.worldbook.internalName = 'safe new binding';
  await finish(t, h.host.withLock(() => h.host.writeStage('worldbook', after.worldbook, before)));
  assert.equal(h.state.binding, 'safe new binding'); assert.equal(h.state.disk.extensions.world, 'safe new binding');
  assert.deepEqual(h.state.messageFloors, messages); assert.deepEqual(h.state.additional, ['player-book']);
  assert.ok(h.state.events.includes('narrow-world-binding'));
  assert.ok(h.state.events.includes('character-cache-refreshed'));
  const again = await h.host.snapshot(); await finish(t, h.host.withLock(() => h.host.writeStage('worldbook', again.worldbook, again)));
  assert.equal(h.state.events.filter(x => x === 'narrow-world-binding').length, 1, 'unchanged binding must not save the character form');
});

test('worldbook updates preserve unknown raw fields and additional character bindings', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot(), next = copy(before.worldbook); next.entries[0].content = 'new text';
  await h.host.withLock(() => h.host.writeStage('worldbook', next, before));
  const saved = h.state.rawBooks.get('world 1.0.0');
  assert.deepEqual(saved.entries['1'].authorUnknown, { retained: true }); assert.equal(saved.entries['1'].lineEndingHint, 'CRLF');
  assert.equal(saved.worldUnknown, 'keep'); assert.equal(saved.entries['1'].content, 'new text');
  assert.deepEqual(h.state.additional, ['player-book']);
});
test('a runtime RegExp keyword remains a string regex after a neighbouring strategy change', async t => {
  const h = fakeBackend(t); h.state.runtimeBooks.get('world 1.0.0')[0].strategy.keys = [/foo/i]; h.state.rawBooks.get('world 1.0.0').entries['1'].key = ['/foo/i'];
  const before = await h.host.snapshot(), next = copy(before.worldbook); next.entries[0].strategy.scan_depth = 5;
  await h.host.withLock(() => h.host.writeStage('worldbook', next, before));
  assert.deepEqual(h.state.rawBooks.get('world 1.0.0').entries['1'].key, ['/foo/i']);
});

test('recovery compares raw regex keywords using the installed host flag normalization', async t => {
  const h = fakeBackend(t), raw = h.state.rawBooks.get('world 1.0.0').entries['1'];
  raw.key = ['/probe/ig', '/unsupported/d', '/unescaped/slash/i', '/duplicate/ii']; raw.keysecondary = ['/path\\/part/mi'];
  const runtime = h.state.runtimeBooks.get('world 1.0.0')[0];
  runtime.strategy.keys = [/probe/gi, '/unsupported/d', '/unescaped/slash/i', '/duplicate/ii']; runtime.strategy.keys_secondary.keys = [/path\/part/im];
  const before = await h.host.snapshot(), after = copy(before); after.scripts.trees[0].content = 'updated script';
  assert.equal(before.worldbook.entries[0].strategy.keys[0], '/probe/gi');
  await finish(t, h.host.withLock(() => Core.execute({ host: h.host, storage: h.host.createStorage(), key: 'journal', expectedContext: h.host.getContext(), before, after, installed: installedCommit(after) })));
  h.flushCharacter(); h.state.raw = copy(h.state.disk);
  const restarted = h.createHost(); t.mock.timers.tick(2500);
  const result = await finish(t, restarted.withLock(() => Core.recover({ host: restarted, storage: restarted.createStorage(), key: 'journal' })));
  assert.equal(result.status, 'committed'); assert.equal(restarted.readState().installed['official.core'].version, '1.0.1');
  assert.deepEqual(raw.key, ['/probe/ig', '/unsupported/d', '/unescaped/slash/i', '/duplicate/ii']);
  assert.deepEqual(raw.keysecondary, ['/path\\/part/mi']);
});
test('switching chat while the worldbook request is pending prevents disk and binding writes', async t => {
  const h = fakeBackend(t, { afterFetch(endpoint, _body, state) { if (endpoint === '/api/worldinfo/get') state.chatId = 'save-b'; } });
  const before = await h.host.snapshot(), next = copy(before.worldbook); next.entries[0].content = 'new';
  await assert.rejects(h.host.withLock(() => h.host.writeStage('worldbook', next, before)), { code: 'context-changed' });
  assert.equal(h.state.rawBooks.get('world 1.0.0').entries['1'].content, 'old');
  assert.equal(h.state.events.some(value => value.startsWith('worldbook-persisted:')), false);
});
test('helper snapshot asynchronously detects a character switch before replacement', async t => {
  const h = fakeBackend(t); const before = await h.host.snapshot(), next = copy(before.regex);
  next.scripts[0].replace_string = 'new'; h.api.SillyTavern.getContext().unshallowCharacter;
  const originalContext = h.api.SillyTavern.getContext;
  h.api.SillyTavern.getContext = () => ({ ...originalContext(), async unshallowCharacter() { h.state.avatar = 'card-b.png'; } });
  await assert.rejects(h.host.withLock(() => h.host.writeStage('regex', next, before)), { code: 'context-changed' });
  assert.equal(h.state.events.includes('regex-helper-returned'), false);
});
test('script data survives core merge, host replacement and a fresh host instance', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot(), incoming = copy(before); incoming.scripts.trees[0].content = 'new'; incoming.scripts.trees[0].data = {};
  const merged = await Core.mergeComponents(before, before, incoming);
  await h.host.withLock(() => h.host.writeStage('scripts', merged.components.scripts, before));
  h.flushCharacter(); h.state.raw = copy(h.state.disk);
  const restarted = h.createHost(); t.mock.timers.tick(2500);
  assert.equal((await restarted.snapshot()).scripts.trees[0].content, 'new');
  assert.deepEqual((await restarted.snapshot()).scripts.trees[0].data, { selectedImage: 'player-choice' });
});
test('worldinfo backup is durable before pointer persistence and recoverable after reload', async t => {
  const h = fakeBackend(t, { persistAfterReads: 2 }), before = await h.host.snapshot(), after = copy(before);
  after.worldbook.entries[0].content = 'new'; after.scripts.trees[0].content = 'new';
  await finish(t, h.host.withLock(async () => {
    const storage = h.host.createStorage();
    const result = await Core.execute({ host: h.host, storage, key: 'journal', expectedContext: h.host.getContext(), before, after, installed: installedCommit(after) });
    assert.equal(result.status, 'awaiting-verification');
  }));
  const diskState = h.state.disk.extensions.tavern_helper.variables[NAMESPACE];
  assert.ok(diskState.journalName); assert.ok(h.state.rawBooks.get(diskState.journalName).extensions.__cxx_update_journals[diskState.instanceId].active.journal.before);
  assert.ok(h.state.events.indexOf('worldbook-persisted:' + diskState.journalName) < h.state.events.indexOf('state-helper-returned'));
  h.flushCharacter(); h.state.raw = copy(h.state.disk);
  const restarted = h.createHost(); t.mock.timers.tick(2500);
  const recovered = await finish(t, restarted.withLock(() => Core.recover({ host: restarted, storage: restarted.createStorage(), key: 'journal' })));
  assert.equal(recovered.status, 'committed');
  assert.equal(restarted.readState().journalName, undefined);
  assert.equal(restarted.readState().installed['official.core'].version, '1.0.1');
});
test('a second updater receives no installation lock while the first is held', async t => {
  const h = fakeBackend(t), second = h.createHost(); t.mock.timers.tick(2500);
  let release; const gate = new Promise(resolve => { release = resolve; });
  const first = h.host.withLock(() => gate);
  await assert.rejects(second.withLock(() => Promise.resolve()), { code: 'update-already-running' });
  release(); await first;
});
test('serial updater locks reject a second tab with an independent stale character cache', async t => {
  const backend = fakeBackend(t), a = independentCacheTab(backend), b = independentCacheTab(backend); t.mock.timers.tick(2500);
  a.cache.extensions.tavern_helper.variables.existingPlayerVar.latestSelection = 'chosen-in-window-a';
  backend.state.disk.extensions.tavern_helper.variables.existingPlayerVar.latestSelection = 'chosen-in-window-a';
  const next = a.host.readState(); next.installed['official.core'].version = '1.0.2'; next.otherWindowOnly = 'newer player setting';
  await finish(t, a.host.withLock(() => a.host.saveState(next)));
  assert.equal(b.host.readState().installed['official.core'].version, '1.0.0');
  await assert.rejects(finish(t, b.host.withLock(() => b.host.saveState({ ...b.host.readState(), panelOpened: true }))), { code: 'stale-character-cache' });
  const variables = backend.state.disk.extensions.tavern_helper.variables;
  assert.equal(variables[NAMESPACE].installed['official.core'].version, '1.0.2'); assert.equal(variables[NAMESPACE].otherWindowOnly, 'newer player setting');
  assert.equal(variables.existingPlayerVar.latestSelection, 'chosen-in-window-a');
});
test('a server character edit during an acquired lock blocks the next namespace write', async t => {
  const h = fakeBackend(t), desired = { ...h.host.readState(), panelOpened: true };
  await h.host.withLock(async () => {
    h.state.disk.extensions.playerNewSetting = { keep: true };
    await assert.rejects(finish(t, h.host.saveState(desired)), { code: 'stale-character-cache' });
  });
  assert.deepEqual(h.state.disk.extensions.playerNewSetting, { keep: true });
  assert.equal(h.state.events.includes('state-helper-returned'), false);
});
test('character preflight refuses prompt and foreign fields the real helper save would drop', async t => {
  const h = fakeBackend(t), initial = copy(h.state.raw);
  for (const [field, mutate] of [
    ['system_prompt', data => { data.system_prompt = 'player system prompt'; }],
    ['post_history_instructions', data => { data.post_history_instructions = 'player instruction'; }],
    ['foreignData', data => { data.foreignData = { keep: true }; }],
    ['character_book.scan_depth', data => { data.character_book = { name: 'book', entries: [], scan_depth: 77 }; }],
    ['character_book.entries.1.playerLabel', data => { data.character_book = { name: 'book', entries: [{ id: 1, playerLabel: 'keep', use_regex: true }] }; }],
  ]) {
    h.state.raw = copy(initial); mutate(h.state.raw); h.state.disk = copy(h.state.raw);
    let called = false;
    await assert.rejects(h.host.withLock(async () => { called = true; await h.host.saveState({ ...h.host.readState(), updated: true }); }), error => error.code === 'unsupported-character-field' && error.message.includes(field));
    assert.equal(called, false); assert.equal(h.state.events.includes('state-helper-returned'), false);
  }
});
test('an embedded book foreign extension survives only if the bound raw book can regenerate it', async t => {
  const h = fakeBackend(t);
  h.state.raw.character_book = { name: 'world 1.0.0', entries: [{ id: 1, use_regex: true, extensions: { cfSortKey: 'player-order' } }] };
  h.state.disk = copy(h.state.raw);
  await assert.rejects(h.host.withLock(() => Promise.resolve()), { code: 'unsupported-character-field' });
  h.state.rawBooks.get('world 1.0.0').entries['1'].extensions = { cfSortKey: 'player-order' };
  await h.host.withLock(() => Promise.resolve());
  for (const data of [h.state.raw,h.state.disk]) data.character_book.entries[0].extensions.playerNote = 'keep\r\noriginal';
  h.state.rawBooks.get('world 1.0.0').entries['1'].extensions.playerNote = 'keep\r\noriginal';
  await h.host.withLock(() => Promise.resolve());
  assert.equal(h.state.raw.character_book.entries[0].extensions.playerNote, 'keep\r\noriginal');
  h.state.rawBooks.get('world 1.0.0').entries['1'].extensions.playerNote = 'changed';
  await assert.rejects(h.host.withLock(() => Promise.resolve()), { code: 'unsupported-character-field' });
});
test('full V2 data comparison ignores runtime wrapper metadata and normalizes helper tuple settings', async t => {
  const h = fakeBackend(t), getRaw = h.api.getCharData;
  h.api.getCharData = () => { const raw = copy(getRaw()); raw.avatar = 'runtime-only'; raw.date_added = 123; raw.data.extensions.tavern_helper = Object.entries(raw.data.extensions.tavern_helper); return raw; };
  await h.host.withLock(() => Promise.resolve());
});
test('character comparison treats FormData CRLF as equivalent without changing cached text', async t => {
  const h = fakeBackend(t); h.state.raw.alternate_greetings = ['first\nsecond']; h.state.disk.alternate_greetings = ['first\r\nsecond'];
  await h.host.withLock(() => Promise.resolve()); assert.equal(h.state.raw.alternate_greetings[0], 'first\nsecond');
});
test('only changing embedded worldbook text or enabled state still makes a tab stale', async t => {
  const h = fakeBackend(t); h.state.raw.character_book = { name: 'world 1.0.0', entries: [{ id: 1, content: 'old book text', enabled: true, use_regex: true }] };
  h.state.disk = copy(h.state.raw); h.state.disk.character_book.entries[0].content = 'new player book text';
  let called = false;
  await assert.rejects(finish(t, h.host.withLock(() => { called = true; })), { code: 'stale-character-cache' }); assert.equal(called, false);
  h.state.disk.character_book.entries[0].content = 'old book text'; h.state.disk.character_book.entries[0].enabled = false;
  await assert.rejects(finish(t, h.host.withLock(() => Promise.resolve())), { code: 'stale-character-cache' });
});

test('first namespace initialization stops before helper parsing can strip raw script fields', async t => {
  const h = fakeBackend(t), originalTrees = h.api.getScriptTrees;
  h.state.raw.extensions.tavern_helper.scripts[0].playerFlag = { keep: true }; h.state.disk = copy(h.state.raw);
  h.api.getScriptTrees = () => originalTrees().map(script => { delete script.playerFlag; return script; });
  await assert.rejects(h.host.saveState({ cardId: 'cyber2051' }), { code: 'unsupported-raw-field' });
  assert.deepEqual(h.state.disk.extensions.tavern_helper.scripts[0].playerFlag, { keep: true });
  assert.equal(h.state.events.includes('state-helper-returned'), false);
});
test('first namespace save refuses unsupported helper settings and coerced script data', async t => {
  const h = fakeBackend(t); h.state.raw.extensions.tavern_helper.playerFlag = true; h.state.disk = copy(h.state.raw);
  await assert.rejects(h.host.saveState({ cardId: 'cyber2051' }), { code: 'unsupported-character-field' });
  delete h.state.raw.extensions.tavern_helper.playerFlag;
  h.state.raw.extensions.tavern_helper.scripts[0].name = 7; h.state.disk = copy(h.state.raw);
  const trees = h.api.getScriptTrees; h.api.getScriptTrees = () => trees().map(script => ({ ...script, name: String(script.name) }));
  await assert.rejects(h.host.saveState({ cardId: 'cyber2051' }), { code: 'unsupported-character-field' });
  assert.equal(h.state.events.includes('state-helper-returned'), false);
});
test('foreign fields outside V2 data are refused before the full-card helper save', async t => {
  const h = fakeBackend(t), raw = h.api.getCharData;
  h.api.getCharData = () => ({ ...raw(), json_data: JSON.stringify({ spec: 'chara_card_v2', data: copy(h.state.raw), playerOuterMetadata: 'keep' }) });
  await assert.rejects(h.host.saveState({ cardId: 'cyber2051' }), error => error.code === 'unsupported-character-field' && error.message.includes('playerOuterMetadata'));
  assert.equal(h.state.events.includes('state-helper-returned'), false);
});
test('legacy json_data still supplies raw data for preservation checks', () => {
  const raw = { name: 'legacy', extensions: { regex_scripts: [] } };
  assert.deepEqual(Host.rawData({ json_data: JSON.stringify(raw) }), raw);
});
test('a chat switch between the caller context check and writeStage is rejected by the captured lock context', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot(), next = copy(before.regex); next.scripts[0].replace_string = 'new';
  await assert.rejects(h.host.withLock(async () => {
    h.state.chatId = 'save-b';
    await h.host.writeStage('regex', next, before);
  }), { code: 'context-changed' });
  assert.equal(h.state.events.includes('regex-helper-returned'), false);
});
test('recovery cannot commit when the disk worldbook has changed keywords despite matching cached content', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot(), after = copy(before); after.worldbook.entries[0].content = 'new';
  await h.host.withLock(() => Core.execute({ host: h.host, storage: h.host.createStorage(), key: 'journal', expectedContext: h.host.getContext(), before, after, installed: installedCommit(after) }));
  h.state.rawBooks.get('world 1.0.0').entries['1'].key = ['player-changed-key'];
  await assert.rejects(h.host.withLock(() => Core.recover({ host: h.host, storage: h.host.createStorage(), key: 'journal' })), { code: 'worldbook-not-persisted' });
  assert.equal(h.host.readState().installed['official.core'].version, '1.0.0');
});
test('the IndexedDB mirror rejects another owner and cannot resurrect an archived journal', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot();
  const journal = { format: 1, id: 'owner-a', context: h.host.getContext(), before, after: copy(before), stages: [], attempted: [], completed: [], installed: installedCommit(before), status: 'prepared' };
  await finish(t, h.host.withLock(async () => {
    const storage = h.host.createStorage(); assert.equal(await storage.claim('journal', journal), true);
    assert.equal(await storage.set('journal', { ...journal, id: 'owner-b' }, { expectedId: 'owner-b' }), false);
    assert.equal((await storage.get('journal')).id, 'owner-a');
    assert.equal(await storage.remove('journal', { expectedId: 'owner-a' }), true);
    assert.equal(await storage.set('journal', journal, { expectedId: 'owner-a' }), false);
    assert.equal(await storage.get('journal'), null);
    assert.equal(h.host.readState().journalName, undefined);
    const next = { ...journal, id: 'owner-c' };
    assert.equal(await storage.claim('journal', next), true); assert.equal((await storage.get('journal')).id, 'owner-c');
  }));
});
test('a reimported instance is not blocked by the previous instance mirror; returning to it still finds the journal',async t=>{
  const h=fakeBackend(t),before=await h.host.snapshot(),original=copy(h.host.readState());
  const journal={format:1,id:'prior-instance',context:h.host.getContext(),before,after:copy(before),stages:[],attempted:[],completed:[],installed:installedCommit(before),status:'prepared'};
  await finish(t,h.host.withLock(()=>h.host.createStorage().claim('journal',journal)));
  const pending=copy(h.host.readState());const fresh={...original,instanceId:'fresh-import',characterKey:h.state.avatar};
  h.state.raw.extensions.tavern_helper.variables[NAMESPACE]=copy(fresh);h.state.disk=copy(h.state.raw);h.state.pending=null;
  const next=h.createHost();t.mock.timers.tick(2500);await next.assertPlayerWritable(next.getContext());assert.equal((await next.inspectInstall()).kind,'none');
  h.state.raw.extensions.tavern_helper.variables[NAMESPACE]=pending;h.state.disk=copy(h.state.raw);h.state.pending=null;
  const resumed=h.createHost();t.mock.timers.tick(2500);assert.equal((await resumed.inspectInstall()).kind,'pending');
});

test('same-instance legacy mirror survives upgrade, but its tombstone cannot resurrect it',async t=>{
  const h=fakeBackend(t),before=await h.host.snapshot(),journal={format:1,id:'legacy-mirror',context:h.host.getContext(),before,after:copy(before),stages:[],attempted:[],completed:[],installed:installedCommit(before),status:'prepared'};
  await finish(t,h.host.withLock(()=>h.host.createStorage().claim('journal',journal)));
  const req=h.indexedDB.open('cxx-update-transactions',1),db=await new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=no;});
  const key=JSON.stringify([h.state.avatar,'test-instance']);await new Promise((ok,no)=>{const tx=db.transaction('journals','readwrite'),store=tx.objectStore('journals'),read=store.get(key);read.onsuccess=()=>{store.put(read.result,h.state.avatar);store.delete(key);};tx.oncomplete=ok;tx.onerror=no;});
  const resumed=h.createHost();t.mock.timers.tick(2500);assert.equal((await resumed.inspectInstall()).kind,'pending');
  await finish(t,resumed.withLock(()=>resumed.createStorage().remove('journal',{expectedId:journal.id})));assert.equal((await resumed.inspectInstall()).kind,'none');
});

test('a mirror and backend backup recover even when the character journal pointer never reached disk', async t => {
  const config = { neverSave: true }, h = fakeBackend(t, config), before = await h.host.snapshot();
  const journal = { format: 1, id: 'owner-a', context: h.host.getContext(), before, after: copy(before), stages: [], attempted: [], completed: [], installed: installedCommit(before), status: 'prepared' };
  await assert.rejects(finish(t, h.host.withLock(() => h.host.createStorage().claim('journal', journal))), { code: 'save-not-confirmed' });
  assert.equal(h.state.disk.extensions.tavern_helper.variables[NAMESPACE].journalName, undefined);
  h.state.raw = copy(h.state.disk); h.state.pending = null; config.neverSave = false;
  const restarted = h.createHost(); t.mock.timers.tick(2500);
  await assert.rejects(restarted.assertNoPendingInstall(), { code: 'migration-pending-install' });
  const recovered = await finish(t, restarted.withLock(() => Core.recover({ host: restarted, storage: restarted.createStorage(), key: 'journal' })));
  assert.equal(recovered.status, 'committed'); assert.equal(restarted.readState().installed['official.core'].version, '1.0.1');
  assert.equal(restarted.readState().journalName, undefined);
  await restarted.assertNoPendingInstall();
});
test('recovery rejects a stale character worldbook binding even when every component body matches', async t => {
  const h = fakeBackend(t, { corruptDiskBinding: true }), before = await h.host.snapshot(), after = copy(before);
  after.worldbook.internalName = 'world 1.0.1'; after.worldbook.entries[0].content = 'new';
  await finish(t, h.host.withLock(() => Core.execute({ host: h.host, storage: h.host.createStorage(), key: 'journal', expectedContext: h.host.getContext(), before, after, installed: installedCommit(after) })));
  await assert.rejects(finish(t, h.host.withLock(() => Core.recover({ host: h.host, storage: h.host.createStorage(), key: 'journal' }))), { code: 'binding-not-persisted' });
  assert.equal(h.host.readState().installed['official.core'].version, '1.0.0');
});
test('missing IndexedDB keeps reads available but refuses any installation lock', async t => {
  const h = fakeBackend(t), host = Host.create({ core: Core, api: h.api, fetch: h.fetch, locks: h.locks, indexedDB: {}, hostOrigin: 'http://localhost:8000' });
  t.mock.timers.tick(2500); await host.ready(); assert.equal((await host.snapshot()).worldbook.entries[0].content, 'old');
  await assert.rejects(host.withLock(() => Promise.resolve()), { code: 'storage-unavailable' });
});
test('an existing empty worldbook name is still an ownership collision', async t => {
  const h = fakeBackend(t); h.state.rawBooks.set('existing empty', { entries: {} }); h.state.worldNames.push('existing empty');
  const before = await h.host.snapshot(), after = copy(before.worldbook); after.internalName = 'existing empty';
  await assert.rejects(h.host.withLock(() => h.host.writeStage('worldbook', after, before)), { code: 'worldbook-name-collision' });
  assert.deepEqual(h.state.rawBooks.get('existing empty'), { entries: {} });
});
test('captured lock context protects saveState, journal get and remove after a chat switch', async t => {
  const h = fakeBackend(t), before = await h.host.snapshot(), journal = { format: 1, id: 'owner-a', context: h.host.getContext(), before, after: copy(before), stages: [], attempted: [], completed: [], installed: installedCommit(before), status: 'prepared' };
  await finish(t, h.host.withLock(() => h.host.createStorage().claim('journal', journal)));
  const storage = h.host.createStorage(), pointer = h.host.readState().journalName, desired = { ...h.host.readState(), wrongChatFlag: true };
  await h.host.withLock(async () => {
    h.state.chatId = 'save-b';
    await assert.rejects(h.host.saveState(desired), { code: 'context-changed' });
    await assert.rejects(storage.get('journal'), { code: 'context-changed' });
    await assert.rejects(storage.remove('journal'), { code: 'context-changed' });
  });
  assert.equal(h.host.readState().wrongChatFlag, undefined); assert.equal(h.host.readState().journalName, pointer);
});
test('chat-scope worldbook recovery restores its original scope and leaves the character book bound', async t => {
  const h = fakeBackend(t); h.host.setScope('chat');
  const before = await h.host.snapshot(), after = copy(before); after.worldbook = { internalName: 'chat update', entries: [Host.normalizeEntry(runtimeEntry('chat content'))] };
  const installed = { ...installedCommit(after), scope: 'chat' };
  await finish(t, h.host.withLock(() => Core.execute({ host: h.host, storage: h.host.createStorage(), key: 'journal', expectedContext: h.host.getContext(), before, after, installed })));
  const restarted = h.createHost(); t.mock.timers.tick(2500);
  const result = await finish(t, restarted.withLock(async () => {
    const storage = restarted.createStorage(), journal = await storage.get('journal'); restarted.setScope(journal.installed.scope);
    return Core.recover({ host: restarted, storage, key: 'journal' });
  }));
  assert.equal(result.status, 'committed'); assert.equal(restarted.getScope(), 'chat');
  assert.equal(h.state.diskChatBinding, 'chat update'); assert.equal(h.state.binding, 'world 1.0.0');
});
test('a script helper ACK cannot commit until delayed script content reaches character disk', async t => {
  const config = { delayScripts: true }, h = fakeBackend(t, config), before = await h.host.snapshot(), after = copy(before); after.scripts.trees[0].content = 'new script';
  await finish(t, h.host.withLock(() => Core.execute({ host: h.host, storage: h.host.createStorage(), key: 'journal', expectedContext: h.host.getContext(), before, after, installed: installedCommit(after) })));
  await assert.rejects(finish(t, h.host.withLock(() => Core.recover({ host: h.host, storage: h.host.createStorage(), key: 'journal' }))), { code: 'components-not-persisted' });
  assert.equal(h.host.readState().installed['official.core'].version, '1.0.0'); assert.ok(h.host.readState().journalName);
  config.delayScripts = false; h.queueSave(); h.flushCharacter();
  const recovered = await finish(t, h.host.withLock(() => Core.recover({ host: h.host, storage: h.host.createStorage(), key: 'journal' })));
  assert.equal(recovered.status, 'committed'); assert.equal(h.host.readState().installed['official.core'].version, '1.0.1');
});



test('in-place journals preserve book data and release rollback across later chat transactions without extra books',async t=>{
 const h=fakeBackend(t),name=h.state.binding,original=copy(h.state.rawBooks.get(name));
 async function commit(version,content,scope='character'){
  h.host.setScope(scope);const before=await h.host.snapshot(),after=copy(before);after.worldbook.entries[0].content=content;
  const installed={...installedCommit(after),installed:{'cyber2051.core':{version}},scope};
  await finish(t,h.host.withLock(async()=>{await Core.execute({host:h.host,storage:h.host.createStorage(),key:'journal',expectedContext:h.host.getContext(),before,after,installed});await Core.recover({host:h.host,storage:h.host.createStorage(),key:'journal'});}));
 }
 await commit('2.2.8','更新内容');const release=await h.host.readReleaseBackup(name);assert.equal(release.journal.before.worldbook.entries[0].content,'old');
 h.state.chatBinding=name;h.state.diskChatBinding=name;
 await commit('2.2.8','剧情内容','chat');await commit('2.2.8','下一次同步','chat');
 assert.equal(h.state.rawBooks.size,1);assert.equal(h.state.rawBooks.get(name).worldUnknown,original.worldUnknown);assert.equal(h.state.rawBooks.get(name).entries['1'].content,'下一次同步');
 assert.deepEqual(await h.host.readReleaseBackup(name),release);assert.equal(h.host.readState().lastReleaseBackup,name);assert.equal(h.host.readState().journalName,undefined);assert.equal(h.host.readState().backupNames,undefined);
 const slot=h.state.rawBooks.get(name).extensions.__cxx_update_journals['test-instance'];assert.deepEqual(Object.keys(slot).sort(),['active','release']);
});

test('journalled lore deletion preserves foreign raw fields across registry save and rollback',async t=>{
 const h=fakeBackend(t),raw=h.state.rawBooks.get('world 1.0.0').entries['1'];raw.extensions={cfSortKey:7,future:{keep:true}};
 h.state.raw.character_book={name:'world 1.0.0',entries:[{id:1,keys:[],content:'old',constant:true,extensions:{cfSortKey:7}}]};h.queueSave();h.flushCharacter();const original=copy(raw),before=await h.host.snapshot(),after=copy(before);after.worldbook.entries=[];after.registry={format:1,packages:{added:{version:'1.0.0',content:{quests:[],gallery:[],worldbook:[]},history:{}}}};
 const storage=h.host.createStorage();await finish(t,h.host.withLock(async()=>{await Core.execute({host:h.host,storage,key:'journal',expectedContext:h.host.getContext(),before,after,installed:installedCommit(after)});const journal=await storage.get('journal');assert.deepEqual(journal.worldbookDeletedRaw['1'],original);await h.host.writeStage('worldbook',before.worldbook,after);}));
 const restored=h.state.rawBooks.get('world 1.0.0').entries['1'];assert.deepEqual(restored.extensions,original.extensions);assert.deepEqual(restored.authorUnknown,original.authorUnknown);assert.equal(restored.lineEndingHint,original.lineEndingHint);
});

// Actual ST cache contract: one checked POST, cache refresh/event, disk verification.
test('worldbook cache refresh uses one acknowledged write and preserves unknown fields',async t=>{
 const h=fakeBackend(t),c=h.api.SillyTavern.getContext(),cache=new Map(),events=[];h.api.SillyTavern.getContext=()=>c;c.eventTypes={WORLDINFO_UPDATED:'world'};c.eventSource={emit:async(...args)=>events.push(args)};
 const host=Host.create({core:Core,api:h.api,fetch:h.fetch,hostOrigin:'http://localhost:8000',loadWorldInfoRuntime:async()=>({saveWorldInfo:c.saveWorldInfo,worldInfoCache:cache})});t.mock.timers.tick(2500);
 const value={entries:{},extensions:{journal:{unknown:[0,false,'keep']}}};await host.writeRawBook('cache-proof',value,host.getContext(),true);
 assert.deepEqual(h.state.rawBooks.get('cache-proof'),value);assert.deepEqual(cache.get('cache-proof'),value);assert.equal(events.length,1);assert.equal(events[0][0],'world');assert.equal(h.state.events.filter(x=>x==='worldbook-persisted:cache-proof').length,1);assert(!h.state.events.includes('cache:cache-proof'));value.extensions.journal.unknown.push('later');assert.equal(cache.get('cache-proof').extensions.journal.unknown.length,3);
});
test('unknown worldbook implementation retains fallback; cache path cannot hide bad acknowledgement or readback',async t=>{
 const h=fakeBackend(t),c=h.api.SillyTavern.getContext(),cache=new Map();h.api.SillyTavern.getContext=()=>c;c.eventTypes={WORLDINFO_UPDATED:'world'};c.eventSource={emit:async()=>{}};let mode='fallback';const host=Host.create({core:Core,api:h.api,hostOrigin:'http://localhost:8000',fetch:async(...args)=>{if(mode==='ack')return {ok:true,json:async()=>({ok:false})};if(mode==='readback'&&new URL(args[0]).pathname.endsWith('/get'))return {ok:true,json:async()=>({entries:{},changed:true})};return h.fetch(...args);},loadWorldInfoRuntime:async()=>({saveWorldInfo:()=>{},worldInfoCache:cache})});t.mock.timers.tick(2500);
 await host.writeRawBook('fallback',{entries:{}},host.getContext(),true);assert(h.state.events.includes('cache:fallback'));assert.equal(cache.size,0);
 mode='ack';await assert.rejects(host.writeRawBook('bad',{entries:{}},host.getContext(),true),{code:'worldbook-not-saved'});assert(!h.state.events.includes('cache:bad'));
 mode='readback';await assert.rejects(host.writeRawBook('bad-read',{entries:{}},host.getContext(),true),{code:'worldbook-readback-mismatch'});
});
