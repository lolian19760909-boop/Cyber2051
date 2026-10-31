'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto, randomUUID } = require('node:crypto');
const Core = require("../../卡片源码/运行时/core.js");
const Backup = require(process.env.CXX_BACKUP_SOURCE || "../../卡片源码/运行时/backup.js");
const Content = require("../../卡片源码/运行时/content.js");
const copy = value => JSON.parse(JSON.stringify(value));
const context = () => ({ cardId: 'cyber2051', characterKey: 'isolated-test.png', chatId: 'original-test', busy: false });
function variables(yen, questId = 'old-q') {
  return { initialized_lorebooks: { 'original-book': [15] }, schema: { type: 'object', foreign: 'schema-keep', properties: {} },
    stat_data: { terminal: { wallet: { yen, extra: 'wallet-keep' }, quests: { [questId]: { state: '进行中', definitionRef: { packageId: 'story', version: '1.0.0', questId } } } }, affection: 400 },
    display_data: { yen }, delta_data: {}, unknownVariable: { nested: 'keep' } };
}
const quest = id => ({ id, title: id, pay: 30000 });
const oldContent = () => ({ quests: [quest('old-q')], gallery: [], worldbook: [] });
function fixture(hooks = {}, extra = {}) {
  const state = {
    currentContext: context(),
    live: { messages: [
      { name: 'Character', is_user: false, mes: 'selected first', swipes: ['selected first', 'unselected first'], swipe_id: 0,
        variables: [variables(98765), variables(22222)], swipe_info: [{ extra: { first: 1 } }, { extra: { secretBranch: 'keep' } }], unknownMessage: { keep: true } },
      { name: 'User', is_user: true, mes: 'second floor', variables: [variables(33333)], unknownMessage: { second: true } },
    ], metadata: { integrity: 'old-integrity', foreignMetadata: { keep: true }, variables: { playerMemo: 'keep', __cxx_content_pins: { story: '1.0.0' } } },
    updateState: { cardId: 'cyber2051', installed: { story: { version: '2.0.0' } }, registry: { format: 1, packages: {
      story: { version: '2.0.0', content: { quests: [quest('new-q')], gallery: [], worldbook: [] }, history: { '1.0.0': oldContent() } },
    } }, policy: { basic: false }, unknownState: { keep: true } }, versions: { st: '1.19.0', helper: '4.11.2' } },
    events: [], copies: new Map(), locked: false,
  };
  const header = { user_name: 'unused', character_name: 'unused', unknownHeader: { keep: 'header' }, chat_metadata: copy(state.live.metadata) };
  state.originalRows = [copy(header), ...copy(state.live.messages)];
  state.originalJSONL = state.originalRows.map(JSON.stringify).join('\n');
  const host = {
    getContext: () => copy(state.currentContext),
    assertContext(expected) { if (!['cardId', 'characterKey', 'chatId'].every(k => expected[k] === state.currentContext[k])) throw Object.assign(new Error('switched'), { code: 'context-changed' }); if (state.currentContext.busy) throw Object.assign(new Error('busy'), { code: 'host-busy' }); },
    readState: () => copy(state.live.updateState),
    async withLock(work) { if (state.locked) throw new Error('nested-lock'); state.events.push('lock'); state.locked = true; try { return await work(); } finally { state.locked = false; state.events.push('unlock'); } },
  };
  const adapters = {
    snapshot: () => copy(state.live),
    async readCurrent(expected) { state.events.push('read-source'); await hooks.readCurrent?.(state); return { header: copy(header), jsonl: state.originalJSONL }; },
    async readCopy(expected, id) { state.events.push('read-copy:' + id); await hooks.readCopy?.(state, id); return copy(state.copies.get(id) || []); },
    async writeCopy(expected, id, rows) { assert.equal(state.locked, true); state.events.push('write-copy:' + id); await hooks.writeCopy?.(state, id, rows); if (!hooks.skipWrite) state.copies.set(id, copy(rows)); },
  };
  const client = Backup.create({ core: Core, host, adapters, crypto: { subtle: webcrypto.subtle, randomUUID }, wait: async ms => { state.events.push('readonly-wait:' + ms); await hooks.wait?.(state, ms); }, ...extra });
  return { state, host, adapters, client };
}
test('browser IIFE only exposes the backup module and performs no automatic work', () => {
  const realm = vm.createContext({}); vm.runInContext(fs.readFileSync(require.resolve("../../卡片源码/运行时/backup.js"), 'utf8'), realm);
  assert.equal(typeof realm.CxxUpdateBackup.create, 'function'); assert.deepEqual(Object.keys(realm), ['CxxUpdateBackup']);
});
test('full backup captures all floors, every unselected branch and foreign JSON fields', async () => {
  const h = fixture(), before = copy(h.state.live), doc = await h.client.captureFull();
  assert.equal(doc.kind, 'chat'); assert.deepEqual(doc.payload.messages, before.messages);
  assert.equal(doc.payload.messages[0].variables[1].stat_data.terminal.wallet.yen, 22222);
  assert.equal(doc.payload.messages[0].variables[1].schema.foreign, 'schema-keep');
  assert.deepEqual(doc.payload.header.unknownHeader, { keep: 'header' }); assert.deepEqual(doc.payload.header.chat_metadata, before.metadata);
  assert.deepEqual(doc.payload.updateState, before.updateState); assert.equal(doc.payload.diskJSONL, h.state.originalJSONL);
  assert.deepEqual(h.state.live, before); assert.equal(h.state.copies.size, 0); assert.deepEqual(await h.client.parse(JSON.stringify(doc)), doc);
});

function migrationRestoreFixture(archive=true) {
  const h=fixture({}, {content:Content});delete h.state.live.updateState.registry.packages.story.history['1.0.0'];
  if(archive)h.state.live.metadata.variables.__cxx_migration={format:1,archive:{packages:{story:{version:'1.0.0',content:oldContent()}}}};
  const sync=()=>{h.state.originalRows[0].chat_metadata=copy(h.state.live.metadata);h.state.originalJSONL=h.state.originalRows.map(JSON.stringify).join('\n');};sync();
  h.adapters.readCurrent=async()=>({header:copy(h.state.originalRows[0]),jsonl:h.state.originalJSONL});return {...h,sync};
}

test('full restore validates old quest definitions against the current saved migration archive without installing them', async()=>{
  const h=migrationRestoreFixture(),before=copy(h.state.live),doc=await h.client.captureFull(),preview=await h.client.previewRestore(doc),result=await h.client.restoreCopy(doc,{preview,confirm:'restore-copy'});
  assert.deepEqual(h.state.live,before);assert.equal(h.state.live.updateState.registry.packages.story.history['1.0.0'],undefined);
  const restored=h.state.copies.get(result.chatId);assert.deepEqual(restored.slice(1),doc.payload.messages);assert.deepEqual(restored[0].chat_metadata.variables.__cxx_migration,before.metadata.variables.__cxx_migration);assert.equal(h.state.copies.size,2);
});

test('an archive carried only by an imported backup cannot authorize missing definitions in the target chat', async()=>{
  const source=migrationRestoreFixture(),doc=await source.client.captureFull(),target=migrationRestoreFixture(false),before=copy(target.state.live);
  await assert.rejects(target.client.previewRestore(doc),{code:'backup-definition-missing'});assert.deepEqual(target.state.live,before);assert.equal(target.state.copies.size,0);
});

test('restore rechecks a removed live archive after preview before writing either copy', async()=>{
  const h=migrationRestoreFixture(),doc=await h.client.captureFull(),preview=await h.client.previewRestore(doc);delete h.state.live.metadata.variables.__cxx_migration;h.sync();
  const before=copy(h.state.live);await assert.rejects(h.client.restoreCopy(doc,{preview,confirm:'restore-copy'}),{code:'backup-definition-missing'});assert.deepEqual(h.state.live,before);assert.equal(h.state.copies.size,0);
});
test('progress export carries the entire chosen branch table and history, not just stat_data', async () => {
  const h = fixture(), doc = await h.client.captureProgress({ floor: 0, swipe: 1 });
  assert.equal(doc.kind, 'progress'); assert.equal(doc.payload.swipe, 1); assert.equal(doc.payload.variables.stat_data.terminal.wallet.yen, 22222);
  assert.deepEqual(doc.payload.variables, h.state.live.messages[0].variables[1]);
  assert.equal(doc.payload.updateState.registry.packages.story.history['1.0.0'].quests[0].pay, 30000);
  assert.equal(doc.payload.messages, undefined); assert.equal(h.state.copies.size, 0);
});
test('a legacy native header without chat_metadata keeps its foreign fields and captures current metadata', async () => {
  const h = fixture(); h.adapters.readCurrent = async () => ({ header: { user_name: 'legacy', legacyHeader: 'keep' }, jsonl: 'legacy disk text' });
  const doc = await h.client.captureFull(); assert.equal(doc.payload.header.legacyHeader, 'keep');
  assert.deepEqual(doc.payload.header.chat_metadata, h.state.live.metadata);
});
test('tampered JSON and damaged backup fields are refused before any save', async () => {
  const h = fixture(), doc = await h.client.captureFull(); doc.payload.messages[0].variables[1].stat_data.terminal.wallet.yen = 0;
  await assert.rejects(h.client.parse(doc), { code: 'backup-hash-mismatch' });
  await assert.rejects(h.client.parse('{'), { code: 'backup-invalid-json' }); assert.equal(h.state.copies.size, 0);
});

test('settled raw rows can be losslessly deduplicated without dropping branches or foreign fields',async()=>{
  const h=fixture(),before=copy(h.state.live),doc=await h.client.captureFull({compactDisk:true});
  assert.equal(doc.payload.diskMatchesPayload,true);assert.equal(doc.payload.diskJSONL,undefined);
  assert.deepEqual(doc.payload.messages,before.messages);assert.deepEqual(doc.payload.header,h.state.originalRows[0]);
  assert.deepEqual(await h.client.parse(JSON.stringify(doc)),doc);assert.deepEqual(h.state.live,before);
  doc.payload.messages[0].unknownMessage.keep=false;await assert.rejects(h.client.parse(doc),{code:'backup-hash-mismatch'});
});
test('a header newer than the disk file still deduplicates the chat rows', async () => {
  // 酒馆用节流写 chat_metadata，内存头常常比文件头新。旧逻辑要求整行相等才敢去重，
  // 于是一份 40MB 的聊天会被存两遍、直接撞上 64 MiB 上限，玩家连导出都被挡住。
  const h = fixture(), before = copy(h.state.live); h.state.live.metadata.integrity = 'newer-integrity';
  const doc = await h.client.captureFull({ compactDisk: true });
  assert.equal(doc.payload.diskMatchesPayload, true);
  assert.equal(doc.payload.diskJSONL, undefined);
  assert.equal(doc.payload.header.chat_metadata.integrity, 'newer-integrity');
  assert.match(doc.payload.diskHeaderDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(doc.payload.messages, before.messages);
  assert.deepEqual(await h.client.parse(JSON.stringify(doc)), doc);
  assert.equal(JSON.stringify(doc).includes('<background>'), false);
});


test('unsaved differences retain the independent raw disk snapshot',async()=>{
  const h=fixture();h.state.live.messages[0].mes='unsaved change';const doc=await h.client.captureFull({compactDisk:true});
  assert.equal(doc.payload.diskMatchesPayload,undefined);assert.equal(doc.payload.diskJSONL,h.state.originalJSONL);
  assert.equal(doc.payload.messages[0].mes,'unsaved change');assert.deepEqual(await h.client.parse(doc),doc);
});
test('the input limit counts UTF-8 bytes, including multibyte Chinese', async () => {
  const h = fixture(), large = '汉'.repeat(Math.floor(Backup.MAX_IMPORT_BYTES / 3) + 1);
  assert.ok(large.length < Backup.MAX_IMPORT_BYTES);
  await assert.rejects(h.client.parse(large), { code: 'backup-too-large' }); assert.equal(h.state.copies.size, 0);
});
test('content installation prerequisite durably saves a complete backend copy and verifies it', async () => {
  const h = fixture(), before = copy(h.state.live), result = await h.client.beforeContentInstall();
  const saved = h.state.copies.get(result.backupId); assert.match(result.backupId, /^cxx-backup-/);
  assert.deepEqual(saved.slice(1), before.messages); assert.deepEqual(saved[0].unknownHeader, { keep: 'header' });
  assert.notEqual(saved[0].chat_metadata.integrity, before.metadata.integrity);
  assert.deepEqual(saved[0].__cxx_local_backup.updateState, before.updateState);
  assert.equal(await Core.sha256(saved), result.sha256); assert.deepEqual(h.state.live, before);
  assert.deepEqual(h.state.originalRows.slice(1), before.messages); assert.equal(h.state.events[0], 'lock');
});
test('an existing controller lock may be reused without nesting it', async () => {
  const h = fixture(); await h.host.withLock(() => h.client.beforeContentInstall({ alreadyLocked: true }));
  assert.equal(h.state.events.filter(x => x === 'lock').length, 1); assert.equal(h.state.copies.size, 1);
});
test('a newer disk chat from another window blocks content installation without saving the old cache', async () => {
  const h = fixture(), newer = copy(h.state.originalRows); newer[1].variables[1].stat_data.terminal.wallet.yen = 77777;
  h.state.originalJSONL = newer.map(JSON.stringify).join('\n');
  await assert.rejects(h.client.beforeContentInstall(), { code: 'backup-chat-not-persisted' });
  assert.equal(h.state.copies.size, 0); assert.equal(h.state.events.filter(e => e.startsWith('write-copy:')).length, 0);
  assert.deepEqual(JSON.parse(h.state.originalJSONL.split('\n')[1]), newer[1]);
  assert.equal(h.state.live.messages[0].variables[1].stat_data.terminal.wallet.yen, 22222);
});
test('ordinary pending message and metadata debounce can finish during readonly polling', async () => {
  const h = fixture({ wait(state) {
    state.originalJSONL = [{ ...state.originalRows[0], chat_metadata: copy(state.live.metadata) }, ...copy(state.live.messages)].map(JSON.stringify).join('\n');
  } });
  h.state.live.messages[0].variables[1].stat_data.terminal.wallet.yen = 55555;
  h.state.live.metadata.variables.pendingChatFlag = 'player choice';
  const result = await h.client.beforeContentInstall();
  assert.ok(h.state.events.some(e => e.startsWith('readonly-wait:')));
  assert.equal(h.state.copies.get(result.backupId)[1].variables[1].stat_data.terminal.wallet.yen, 55555);
  assert.equal(h.state.copies.get(result.backupId)[0].chat_metadata.variables.pendingChatFlag, 'player choice');
  assert.equal(h.state.events.filter(e => e.startsWith('write-copy:')).length, 1);
});
test('a metadata-only edit in another window also blocks installing over its record', async () => {
  const h = fixture(), rows = copy(h.state.originalRows); rows[0].chat_metadata.foreignMetadata.newMemo = 'other window';
  h.state.originalJSONL = rows.map(JSON.stringify).join('\n');
  await assert.rejects(h.client.beforeContentInstall(), { code: 'backup-chat-not-persisted' }); assert.equal(h.state.copies.size, 0);
});
test('switching chat during the readonly debounce wait stops instead of backing up the new session', async () => {
  const h = fixture({ wait(state) { state.currentContext.chatId = 'other'; } }); h.state.live.metadata.playerNote = 'not persisted';
  await assert.rejects(h.client.beforeContentInstall(), { code: 'context-changed' }); assert.equal(h.state.copies.size, 0);
});
test('source read failure prevents the installation prerequisite from succeeding', async () => {
  const h = fixture({ readCurrent() { throw new Error('disk unavailable'); } });
  await assert.rejects(h.client.beforeContentInstall(), /disk unavailable/); assert.equal(h.state.copies.size, 0);
});
test('a backend copy missing an unselected branch is rejected rather than called durable', async () => {
  const h = fixture({ writeCopy(state, id, rows) { rows[1].variables[1] = {}; } });
  await assert.rejects(h.client.beforeContentInstall(), { code: 'backup-readback-mismatch' });
  assert.equal(h.state.live.messages[0].variables[1].stat_data.terminal.wallet.yen, 22222);
});
test('switching chat during source read prevents creation of a backup in the new chat', async () => {
  const h = fixture({ readCurrent(state) { state.currentContext.chatId = 'another-chat'; } });
  await assert.rejects(h.client.beforeContentInstall(), { code: 'context-changed' }); assert.equal(h.state.copies.size, 0);
});
test('switching character at the awaited target check stops before its save API', async () => {
  const h = fixture({ readCopy(state) { state.currentContext.characterKey = 'other.png'; } });
  await assert.rejects(h.client.beforeContentInstall(), { code: 'context-changed' }); assert.equal(h.state.copies.size, 0);
});
test('a player edit to an unselected branch during export invalidates capture', async () => {
  const h = fixture({ readCurrent(state) { state.live.messages[0].variables[1].unknownVariable.nested = 'player edit'; } });
  await assert.rejects(h.client.beforeContentInstall(), { code: 'backup-source-changed' }); assert.equal(h.state.copies.size, 0);
});
test('an edit after capture but before writing the new copy also stops installation', async () => {
  const h = fixture({ readCopy(state) { state.live.messages[0].variables[1].unknownVariable.nested = 'later edit'; } });
  await assert.rejects(h.client.beforeContentInstall(), { code: 'backup-source-changed' }); assert.equal(h.state.copies.size, 0);
});
test('the module never overwrites an occupied generated name', async () => {
  const id = '00000000-0000-4000-8000-000000000001', h = fixture({}, { crypto: { subtle: webcrypto.subtle, randomUUID: () => id } });
  h.state.copies.set('cxx-backup-' + id, [{ keepExisting: true }]);
  await assert.rejects(h.client.beforeContentInstall(), { code: 'backup-name-collision' });
  assert.deepEqual(h.state.copies.get('cxx-backup-' + id), [{ keepExisting: true }]);
});
test('restoring requires a preview and an explicit restore-copy action', async () => {
  const h = fixture(), doc = await h.client.captureFull();
  await assert.rejects(h.client.restoreCopy(doc, { confirm: true }), { code: 'backup-confirmation-required' }); assert.equal(h.state.copies.size, 0);
});
test('full restore first backs up current data, then creates an unopened copy without changing the original', async () => {
  const h = fixture(), doc = await h.client.captureFull(); h.state.live.messages[0].variables[1].stat_data.terminal.wallet.yen = 55555;
  const current = copy(h.state.live), preview = await h.client.previewRestore(doc), result = await h.client.restoreCopy(doc, { preview, confirm: 'restore-copy' });
  assert.equal(h.state.copies.size, 2); assert.equal(result.opened, false);
  assert.deepEqual(h.state.copies.get(result.preRestoreBackupId).slice(1), current.messages);
  assert.deepEqual(h.state.copies.get(result.chatId).slice(1), doc.payload.messages);
  assert.deepEqual(h.state.live, current); assert.deepEqual(h.state.copies.get(result.chatId)[0].__cxx_local_backup.updateState, doc.payload.updateState);
});
test('changing an unselected branch after preview requires a new preview', async () => {
  const h = fixture(), doc = await h.client.captureFull(), preview = await h.client.previewRestore(doc);
  h.state.live.messages[0].variables[1].unknownVariable.extra = 'player edit';
  await assert.rejects(h.client.restoreCopy(doc, { preview, confirm: 'restore-copy' }), { code: 'backup-preview-stale' }); assert.equal(h.state.copies.size, 0);
});
test('cross-character restore is rejected instead of guessing account or card ownership', async () => {
  const h = fixture(), doc = await h.client.captureFull(); h.state.currentContext.characterKey = 'copy-other.png';
  await assert.rejects(h.client.previewRestore(doc), { code: 'backup-wrong-character' }); assert.equal(h.state.copies.size, 0);
});
test('missing package history blocks restore, with no silent shared-state replacement', async () => {
  const h = fixture(), doc = await h.client.captureFull(); delete h.state.live.updateState.registry.packages.story.history['1.0.0'];
  await assert.rejects(h.client.previewRestore(doc), { code: 'backup-definition-missing' }); assert.equal(h.state.copies.size, 0);
});
test('same-version history with different definitions blocks restore', async () => {
  const h = fixture(), doc = await h.client.captureFull(); h.state.live.updateState.registry.packages.story.history['1.0.0'].quests[0].pay = 999999;
  await assert.rejects(h.client.previewRestore(doc), { code: 'backup-definition-conflict' }); assert.equal(h.state.copies.size, 0);
});
test('references in unselected variables are checked even when they are absent from the archived registry', async () => {
  const h = fixture(); h.state.live.messages[0].variables[1].stat_data.terminal.quests.foreign = { definitionRef: { packageId: 'missing', version: '1.0.0', questId: 'retired' } };
  const doc = await h.client.captureFull(); await assert.rejects(h.client.previewRestore(doc), { code: 'backup-definition-missing' });
});
test('progress restore replaces only the selected destination branch in a new copy, preserving others and schema', async () => {
  const h = fixture(), doc = await h.client.captureProgress({ floor: 0, swipe: 1 });
  h.state.live.messages[0].variables[1] = variables(66666); h.state.live.messages[0].variables[0].unknownVariable.playerEdit = true;
  const current = copy(h.state.live), preview = await h.client.previewRestore(doc, { floor: 0, swipe: 1 });
  const result = await h.client.restoreCopy(doc, { preview, confirm: 'restore-copy' }), rows = h.state.copies.get(result.chatId);
  assert.deepEqual(rows[1].variables[1], doc.payload.variables); assert.deepEqual(rows[1].variables[0], current.messages[0].variables[0]);
  assert.deepEqual(rows[2], current.messages[1]); assert.deepEqual(rows[1].swipes, current.messages[0].swipes);
  assert.deepEqual(h.state.live, current); assert.equal(rows[1].variables[1].schema.foreign, 'schema-keep');
});
test('a failed pre-restore safety backup prevents creating the restored copy', async () => {
  const h = fixture({ writeCopy() { throw new Error('local save failed'); } }), doc = await h.client.captureFull(), preview = await h.client.previewRestore(doc);
  await assert.rejects(h.client.restoreCopy(doc, { preview, confirm: 'restore-copy' }), /local save failed/); assert.equal(h.state.copies.size, 0);
  assert.equal(h.state.events.filter(x => x.startsWith('write-copy:')).length, 1);
});
function nativeFixture() {
  const h = fixture(), requests = [], c = { chat: h.state.live.messages, chatMetadata: h.state.live.metadata, groupId: null, getRequestHeaders: () => ({ 'X-Test-Header-Generation': String(requests.length) }) };
  const api = { SillyTavern: { getContext: () => c }, getTavernVersion: () => '1.19.0', getTavernHelperVersion: () => '4.11.2',
    getChatMessages(range, options) { assert.equal(options.include_swipes, true); return c.chat.map((m, i) => ({ message_id: i, swipe_id: m.swipe_id ?? 0, swipes: m.swipes || [m.mes], swipes_data: (m.swipes || [m.mes]).map((_, j) => copy(m.variables?.[j] || {})) })); } };
  let exported = h.state.originalJSONL;
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body); requests.push({ url, options: { ...options, body } });
    if (url.endsWith('/characters/chats')) { assert.equal(body.simple, true); return { ok: true, json: async () => [...h.state.copies.keys(), h.state.currentContext.chatId].map(id => ({ file_name: id + '.jsonl' })) }; }
    if (url.endsWith('/export')) {
      const id = body.file.replace(/\.jsonl$/, '');
      if (id !== h.state.currentContext.chatId && !h.state.copies.has(id)) return { ok: false, status: 404 };
      return { ok: true, json: async () => ({ result: id === h.state.currentContext.chatId ? exported : h.state.copies.get(id).map(JSON.stringify).join('\n') }) };
    }
    if (url.endsWith('/get')) return { ok: true, json: async () => copy(h.state.copies.get(body.file_name) || []) };
    if (url.endsWith('/save')) { assert.equal(body.force, false); assert.notEqual(body.file_name, h.state.currentContext.chatId); h.state.copies.set(body.file_name, copy(body.chat)); return { ok: true, json: async () => ({ ok: true }) }; }
    throw new Error('unexpected request');
  };
  const adapters = Backup.nativeAdapters({ api, host: h.host, fetch: fetcher, root: { parent: { location: { origin: 'http://127.0.0.1:8000' } } } });
  return { ...h, c, requests, setExport: value => { exported = value; }, client: Backup.create({ core: Core, host: h.host, adapters, crypto: { subtle: webcrypto.subtle, randomUUID } }) };
}
test('native adapter uses raw JSONL, all helper branches, fresh host headers and only local endpoints', async () => {
  const h = nativeFixture(), result = await h.client.beforeContentInstall();
  assert.equal(h.state.copies.get(result.backupId)[1].variables[1].unknownVariable.nested, 'keep');
  assert.deepEqual(h.state.copies.get(result.backupId)[0].unknownHeader, { keep: 'header' });
  assert.ok(h.requests.every(r => r.url.startsWith('http://127.0.0.1:8000/api/') && r.options.credentials === 'same-origin'));
  assert.deepEqual(h.requests.map(r => r.options.headers['X-Test-Header-Generation']), ['0', '1', '2', '3']);
});
test('native raw JSONL corruption is refused, not silently filtered like chats/get', async () => {
  const h = nativeFixture(); h.setExport(h.state.originalJSONL + '\nnot-json');
  await assert.rejects(h.client.beforeContentInstall(), { code: 'backup-disk-invalid' }); assert.equal(h.state.copies.size, 0);
});

test('native complete export compares Date metadata in its saved JSON representation',async()=>{
  const h=nativeFixture(),date=new Date('2026-10-15T03:04:05.000Z');
  h.c.chat[0].swipe_info[0].gen_started=date;h.c.chat[0].swipe_info[1].gen_finished=date;
  h.c.saveChat=async()=>h.setExport([h.state.originalRows[0],...h.c.chat].map(JSON.stringify).join('\n'));
  const full=await h.client.captureFull({completeDisk:true});
  assert.equal(full.payload.messages[0].swipe_info[0].gen_started,date.toISOString());
  assert.equal(full.payload.messages[0].swipe_info[1].gen_finished,date.toISOString());
  assert.equal(h.c.chat[0].swipe_info[0].gen_started,date);
  assert.equal(full.payload.messages[0].variables[1].unknownVariable.nested,'keep');
});

test('native complete export still rejects genuinely changed Date metadata',async()=>{
  const h=nativeFixture();h.c.chat[0].swipe_info[1].gen_finished=new Date('2026-10-15T03:04:05.000Z');
  h.c.saveChat=async()=>{const rows=copy([h.state.originalRows[0],...h.c.chat]);rows[1].swipe_info[1].gen_finished='2026-10-15T03:04:06.000Z';h.setExport(rows.map(JSON.stringify).join('\n'));};
  await assert.rejects(h.client.captureFull({completeDisk:true}),{code:'backup-branches-incomplete'});
});
test('native preflight refuses an existing empty copy file even though chats/get would return []', async () => {
  const h = nativeFixture(), expected = h.host.getContext(); h.state.copies.set('empty-existing', []);
  const adapters = Backup.nativeAdapters({ api: { SillyTavern: { getContext: () => h.c } }, host: h.host,
    fetch: async () => ({ ok: true, json: async () => [{ file_name: 'empty-existing.jsonl' }] }), root: { parent: { location: { origin: 'http://127.0.0.1:8000' } } } });
  assert.equal(await adapters.copyExists(expected, 'empty-existing'), true);
});
test('TT missing-file export 500 never blocks a confirmed absent import target', async () => {
  const h = nativeFixture(), expected = h.host.getContext(), calls = [];
  const adapters = Backup.nativeAdapters({ api: { SillyTavern: { getContext: () => h.c } }, host: h.host,
    fetch: async (url, options) => { calls.push(url); const body = JSON.parse(options.body); assert.equal(body.avatar_url, expected.characterKey);
      if (url.endsWith('/characters/chats')) { assert.equal(body.simple, true); return { ok: true, json: async () => [{ file_name: 'damaged-existing.jsonl' }] }; }
      return { ok: false, status: 500, json: async () => ({ message: 'Failed to export chat: Entity not found' }) }; },
    root: { parent: { location: { origin: 'http://tauri.localhost' } } } });
  assert.equal(await adapters.copyExists(expected, 'new-import'), false);
  assert.equal(await adapters.copyExists(expected, 'damaged-existing'), true);
  assert.ok(calls.every(url => url.endsWith('/api/characters/chats')));
});
test('failed or malformed filename listings do not grant permission to write a copy', async () => {
  const h = nativeFixture(), expected = h.host.getContext();
  for (const result of [{ error: true }, {}, [{ file_name: '' }], [{ file_id: 'only-id' }], null]) {
    const a = Backup.nativeAdapters({ api: { SillyTavern: { getContext: () => h.c } }, host: h.host,
      fetch: async () => ({ ok: true, json: async () => result }), root: { parent: { location: { origin: 'http://tauri.localhost' } } } });
    await assert.rejects(a.copyExists(expected, 'new-import'), { code: 'backup-existence-unconfirmed' });
  }
  const a = Backup.nativeAdapters({ api: { SillyTavern: { getContext: () => h.c } }, host: h.host,
    fetch: async () => ({ ok: false, status: 500, json: async () => ({ error: 'Failed to read chat directory', details: 'Permission denied' }) }),
    root: { parent: { location: { origin: 'http://tauri.localhost' } } } });
  await assert.rejects(a.copyExists(expected, 'new-import'), e => e.code === 'backup-host-http-error' && e.message.includes('Permission denied'));
  assert.equal(h.state.copies.size, 0);
});
test('native adapter rejects a group and mismatching branch projection', async () => {
  const h = nativeFixture(); h.c.groupId = 'group'; await assert.rejects(h.client.captureFull(), { code: 'backup-capability' });
  h.c.groupId = null; h.c.chat[0].swipe_id = 8; await assert.rejects(h.client.captureFull(), { code: 'backup-invalid-chat' });
});
test('export requests a local Blob download without any upload', async () => {
  let blob, clicked = false, removed = false, revoked = false;
  const a = { click() { clicked = true; }, remove() { removed = true; } };
  const h = fixture({}, { document: { createElement: () => a, body: { append: value => assert.equal(value, a) } },
    urlAPI: { createObjectURL(value) { blob = value; return 'blob:local-only'; }, revokeObjectURL() { revoked = true; } }, Blob });
  const doc = await h.client.captureFull(), result = await h.client.exportFile(doc);
  assert.equal(result.downloadRequested, true); assert.equal(clicked, true); assert.equal(removed, true); assert.equal(a.href, 'blob:local-only');
  assert.deepEqual(JSON.parse(await blob.text()), doc); assert.equal(h.state.copies.size, 0);
  await new Promise(resolve => setTimeout(resolve, 1100)); assert.equal(revoked, true);
});

test('a prepared download validates the document and keeps its URL until explicitly released',async()=>{
  let blob,created=0,revoked=0;
  const h=fixture({}, {urlAPI:{createObjectURL(value){blob=value;created++;return 'blob:prepared';},revokeObjectURL(url){assert.equal(url,'blob:prepared');revoked++;}},Blob});
  const doc=await h.client.captureFull(),file=await h.client.prepareExportFile(doc);
  assert.equal(file.url,'blob:prepared');assert.deepEqual(JSON.parse(await blob.text()),doc);assert.equal(revoked,0);
  await assert.rejects(h.client.prepareExportFile({...doc,createdAt:'tampered'}),{code:'backup-hash-mismatch'});assert.equal(created,1);
  file.revoke();assert.equal(revoked,1);assert.equal(h.state.copies.size,0);
});

test('file import preserves significant UTF-8 bytes, escapes and unknown fields across chunk boundaries',async()=>{
  const prefix=' '.repeat(256*1024-5),text=prefix+'{ "甲" : "汉字 😀 \\" \\\\ \\u4E2D \\n", "foreign" : { "x" : [1, true, null] } }';
  const file=new Blob([text]),compact=await Backup.readImportFile(file);
  assert.equal(compact,'{"甲":"汉字 😀 \\" \\\\ \\u4E2D \\n","foreign":{"x":[1,true,null]}}');
  assert.deepEqual(JSON.parse(compact),JSON.parse(text));
  const chunk=256*1024;
  for(const at of [chunk-1,chunk,chunk+1])for(const token of ['\\\"','\\\\','\\u4e2d']){
    const value='{"x":"'+'a'.repeat(at-6)+token+'汉字\\\\尾"}';
    assert.equal(await Backup.readImportFile(new Blob([value])),value);
  }
});

test('compacting an imported file never repairs invalid JSON and preserves File.text BOM handling',async()=>{
  assert.equal(await Backup.readImportFile(new Blob(['\uFEFF { "x" : 1 }'])),'{"x":1}');
  for(const text of ['[1 2]','[tru e]','[- 1]','[1 .2]','[1e +2]','[nul l]','{"x":true false}','{"x":"a\nb"}',' \uFEFF{"x":1}','\uFEFF\uFEFF{"x":1}']){
    assert.throws(()=>JSON.parse(text));
    const compact=await Backup.readImportFile(new Blob([text]));
    assert.throws(()=>JSON.parse(compact),text);
  }
  await assert.rejects(Backup.readImportFile(new Blob([new Uint8Array([123,34,120,34,58,34,0xe4,0xb8,34,125])])),{code:'backup-invalid-json'});
});

test('file import bounds meaningful UTF-8 bytes and never reads the full file at once',async()=>{
  const chunk=256*1024,part=Buffer.from('汉'.repeat(Math.floor(chunk/3))),limit=Backup.MAX_IMPORT_BYTES;
  let largest=0,read=0;
  const file={size:limit+2*chunk,slice(start,end){largest=Math.max(largest,end-start);return {async arrayBuffer(){read+=end-start;const bytes=Buffer.alloc(end-start,32);if(start===0)bytes[0]=34;for(let i=start===0?1:0;i+part.length<=bytes.length;i+=part.length)part.copy(bytes,i);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}};}};
  await assert.rejects(Backup.readImportFile(file),{code:'backup-too-large'});
  assert.equal(largest,chunk);assert.ok(read<=limit+chunk);
});
