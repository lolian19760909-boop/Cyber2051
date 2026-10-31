'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), { webcrypto } = require('node:crypto');
const Core = require("../../卡片源码/运行时/core.js"), Backup = require("../../卡片源码/运行时/backup.js"), Content = require("../../卡片源码/运行时/content.js"), Controller = require("../../卡片源码/运行时/controller.js");
const clone = v => JSON.parse(JSON.stringify(v));
const quest = (id = 'q01', pay = 30) => ({ id, pay, title: '任务', fixer: '中间人', district: '区域', type: '委托', difficulty: '低', brief: '旧定义', goal: '完成目标' });
const content = (q = quest()) => ({ quests: [q], gallery: [], worldbook: [] });
const reg = () => ({ format: 1, packages: { story: { version: '1.0.0', optional: true, activation: 'opt_in', content: content(), history: {} } } });
function fixture(build = 'old', accepts = [], hooks = {}) {
  const ctx = { cardId: 'cyber2051', characterKey: build + '.png', chatId: build + '-chat', busy: false };
  const vars = value => ({ initialized_lorebooks: { 'old-book': [1] }, stat_data: { money: value, affection: 55, terminal: { quests: { q01: { state: '进行中', definitionRef: { packageId: 'story', version: '1.0.0', questId: 'q01' } }, q02: { state: '已完成' } } } }, unknownMVU: { preserved: [1, 2] } });
  const f = { ctx, state: { cardId: 'cyber2051', instanceId: build + '-instance', installed: { core: { version: '2.0.0' } }, baseline: { keep: 'target' }, registry: reg(), initialContent: content(quest('q02')), subscriptions: { story: true }, policy: { basic: false }, trustedUnknown: 'keep' },
    header: { user_name: 'User', character_name: 'Old', other: { keep: true }, chat_metadata: { integrity: 'old', world_info: 'old-chat-book', variables: { __cxx_content_pins: { story: '1.0.0' }, playerChoice: 'keep' } } },
    messages: [{ name: 'Old', is_user: false, mes: 'first branch', swipes: ['first branch', 'alternative'], swipe_id: 0, variables: [vars(90), vars(40)], swipe_info: [{ x: 1 }, { y: 2 }], unknownMessage: true }], copies: new Map(), writes: 0, locked: false };
  f.seed = { cardId: 'cyber2051', baseVersion: '1.0.0', baseline: { build }, initialContent: clone(f.state.initialContent), migration: { buildId: build, saveSchema: 1, accepts: accepts.map(buildId => ({ buildId, saveSchema: 1 })), playerStores: [] } };
  f.disk = () => [clone(f.header), ...clone(f.messages)];
  const host = { getContext: () => clone(ctx), assertContext(expected) { if (ctx.busy) throw Object.assign(Error('busy'), { code: 'host-busy' }); if (['characterKey', 'chatId'].some(k => ctx[k] !== expected[k])) throw Object.assign(Error('switched'), { code: 'context-changed' }); },
    readState: () => clone(f.state), async saveState(s) { f.state = clone(s); await hooks.saveState?.(f); },
    async withLock(fn) { if (f.locked) throw Object.assign(Error('busy'), { code: 'locked' }); f.locked = true; try { return await fn(); } finally { f.locked = false; } } };
  const adapters = { snapshot: () => ({ messages: clone(f.messages), metadata: clone(f.header.chat_metadata), updateState: clone(f.state), versions: {} }),
    readCurrent: async () => { await hooks.readCurrent?.(f); const rows = f.disk(); return { header: rows[0], jsonl: rows.map(JSON.stringify).join('\n') }; },
    initializationBooks: async () => [build + '-book', 'global-book'],
    copyExists: async (_, id) => f.copies.has(id), readCopy: async (_, id) => { await hooks.readCopy?.(f, id); return clone(f.copies.get(id) || []); },
    writeCopy: async (_, id, rows) => { f.writes++; if (!hooks.skipWrite) f.copies.set(id, clone(rows)); await hooks.writeCopy?.(f, id); } };
  f.adapters = adapters; f.host = host;
  f.client = Backup.create({ host, core: Core, crypto: webcrypto, adapters, seed: f.seed, wait: async () => {} });
  return f;
}
const exported = async f => (await f.client.captureMigration()).document;

test('direct migration export refreshes hand-edited user text before taking the archive lock',async()=>{
 const f=fixture();let refreshed=0;
 const api={parent:{CxxStoryProfile:{async selected(){assert.equal(f.locked,false);refreshed++;f.header.chat_metadata.__cxx_story_profile={schema:1,id:'profile_test',name:'人物',binding:{schema:4,worldbook:'original',entryUid:9,routeId:'route'},worldbookContent:'世界书内最新手改正文'};}}}};
 const client=Backup.create({api,host:f.host,core:Core,crypto:webcrypto,adapters:f.adapters,seed:f.seed,wait:async()=>{}});
 const doc=(await client.captureMigration()).document;assert.equal(refreshed,1);assert.equal(doc.payload.header.chat_metadata.__cxx_story_profile.worldbookContent,'世界书内最新手改正文');
 api.parent.CxxStoryProfile.selected=async()=>{throw Error('原书读取失败');};const writes=f.writes;await assert.rejects(client.captureMigration(),/原书读取失败/);assert.equal(f.writes,writes);
});
test('fresh card without updater instance can preview and import a complete story',async()=>{const f=fixture();delete f.state.instanceId;const doc=await exported(f),preview=await f.client.previewMigration(doc);assert.ok(preview.planHash);const result=await f.client.importMigration(doc,{preview,confirm:'migrate-copy'});assert.ok(f.copies.has(result.chatId));});
test('gameplay assets retain their historical definitions and missing definitions block migration',async()=>{
  const f=fixture(),definition={schema:1,items:[{id:'old_item',name:'Old item',description:'Isolated definition'}]};
  f.state.registry.packages.story.content.gameplay=definition;
  f.messages[0].variables[0].stat_data.terminal.gameplay={schema:1,inventory:{old_item:{quantity:2,definitionRef:{packageId:'story',version:'1.0.0',kind:'items',id:'old_item'}}}};
  const doc=await exported(f);assert.equal(doc.payload.archive.packages.story.content.gameplay.items[0].id,'old_item');
  delete f.state.registry.packages.story.content.gameplay;await assert.rejects(exported(f),{code:'migration-definitions-missing'});
});
const importTo = async (f, doc) => f.client.importMigration(doc, { preview: await f.client.previewMigration(doc), confirm: 'migrate-copy' });
test('migration preserves implicit compatible content selection without enabling unused optional content',async()=>{
  const source=fixture(),target=fixture('new',['old']),old={version:'1.0.0',optional:false,activation:'compatible',content:{quests:[],gallery:[],worldbook:[],gameplay:{schema:1,items:[{id:'old_item',name:'Old',description:'Test'}],shops:[{id:'shop',name:'Shop',description:'Test',offers:[{id:'offer',kind:'items',targetId:'old_item',price:1}]}]}},history:{}};
  old.content.gameplay.shops[0].location={mapId:'test-map',placeId:'test-place'};
  source.seed.mapIndex=target.seed.mapIndex={'test-map':['test-place']};
  source.state.registry.packages.base=clone(old);source.state.registry.packages.unused={...clone(old),optional:true};
  target.state.registry.packages.base={...clone(old),version:'2.0.0',content:{quests:[],gallery:[],worldbook:[]}};
  const doc=await exported(source),original=clone(doc),result=await importTo(target,doc),vars=target.copies.get(result.chatId)[0].chat_metadata.variables;
  assert.equal(vars.__cxx_content_pins.base,'1.0.0');assert.equal(vars.__cxx_content_pins.story,'1.0.0');assert.equal(vars.__cxx_content_pins.unused,undefined);
  const effective=Content.withMigration(target.state,vars),G=require("../../卡片源码/运行时/gameplay.js"),catalog=G.catalogue(effective.registry,{subscriptions:effective.subscriptions,pins:vars.__cxx_content_pins,mapIndex:target.seed.mapIndex});
  assert.equal(catalog.get('shops','shop').definitionRef.version,'1.0.0');assert.equal(target.state.registry.packages.base.version,'2.0.0');assert.deepEqual(doc,original);assert.equal(source.header.chat_metadata.variables.__cxx_content_pins.base,undefined);
});
test('selected workshop origin migrates its exact original definition and refuses a missing source',async()=>{
  const f=fixture(),entry={uid:701,name:'Isolated origin',content:'Test only',enabled:true,strategy:{type:'selective',keys:['Isolated'],keys_secondary:{keys:[]}},position:{},effect:{},recursion:{},extra:{__cxx_player_start:{format:1,name:'Isolated',opening:'Opening',background:'Background'}}};
  f.state.registry.packages.story.content.worldbook=[entry];
  f.messages[0].variables[0].stat_data.terminal.gameplay={schema:1,origin:{definitionRef:{packageId:'story',version:'1.0.0',kind:'worldbook',uid:701}}};
  const doc=await exported(f);assert.deepEqual(doc.payload.archive.packages.story.content.worldbook[0],entry);
  f.state.registry.packages.story.content.worldbook=[];await assert.rejects(exported(f),{code:'migration-definitions-missing'});
});
async function reseal(doc) { delete doc.sha256; doc.sha256 = await Core.sha256(doc); return doc; }
function withoutTechnical(rows) {
  rows = clone(rows);
  for (const m of rows.slice(1)) { delete m.is_ejs_processed; delete m.variables_initialized; }
  for (const m of rows.slice(1)) for (const v of Object.values(m.variables || {})) for (const name of Object.keys(v.initialized_lorebooks || {})) if (name !== 'old-book') delete v.initialized_lorebooks[name];
  return rows.slice(1);
}
test('migration exports every branch, unknown field and historical definition with a durable local backup, without old code/ledger', async () => {
  const f = fixture(), before = clone(f.messages), { document: doc, backup } = await f.client.captureMigration();
  assert.deepEqual(doc.payload.messages, before); assert.ok(f.copies.has(backup.backupId));
  assert.equal(doc.type, Backup.MIGRATION_TYPE); assert.equal(doc.payload.updateState, undefined); assert.equal(doc.payload.archive.packages.story.content.quests[0].pay, 30);
  assert.equal(doc.payload.archive.legacyQuests[0].id, 'q02'); assert.deepEqual(await f.client.parseMigration(JSON.stringify(doc)), doc);
  assert.deepEqual(f.messages, before);
});
test('target copy changes only declared technical fields; code, trust, installs and original chats stay intact', async () => {
  const source = fixture(), target = fixture('new', ['old']), doc = await exported(source), before = clone(target.state), messages = clone(target.messages);
  const preview = await target.client.previewMigration(doc); assert.deepEqual(preview.counts, { floors: 1, branches: 2 }); assert.deepEqual(preview.missing, []);
  const result = await target.client.importMigration(doc, { preview, confirm: 'migrate-copy' }), rows = target.copies.get(result.chatId);
  assert.deepEqual(withoutTechnical(rows), doc.payload.messages); assert.deepEqual(target.messages, messages);
  for (const v of rows[1].variables) { assert.deepEqual(v.initialized_lorebooks['new-book'], []); assert.deepEqual(v.initialized_lorebooks['global-book'], []); assert.deepEqual(v.initialized_lorebooks['old-book'], [1]); }
  assert.equal(rows[0].chat_metadata.world_info, undefined); assert.equal(rows[0].chat_metadata.variables.__cxx_content_origin.newChat, false);
  const state = clone(target.state); delete state.migrations; assert.deepEqual(state, before); assert.equal(result.opened, false);
  assert.equal(source.copies.size, 1);
});
test('cancel or absent confirmation never creates a copy', async () => {
  const target = fixture('new', ['old']), doc = await exported(fixture());
  await target.client.previewMigration(doc); assert.equal(target.copies.size, 0);
  await assert.rejects(target.client.importMigration(doc, { confirm: true }), { code: 'migration-confirmation-required' }); assert.equal(target.writes, 0);
});

test('migration marks every historical branch processed before Prompt Template can replay or clone variables', async () => {
  const source=fixture(), target=fixture('new',['old']);
  source.messages[0].is_ejs_processed=[false,true,false];source.messages[0].variables_initialized=[null,false];
  const original=clone(source.messages),doc=await exported(source),result=await importTo(target,doc),message=target.copies.get(result.chatId)[1];
  assert.deepEqual(message.is_ejs_processed,[true,true,false]);assert.deepEqual(message.variables_initialized,[true,true]);
  assert.deepEqual(source.messages,original);assert.deepEqual(doc.payload.messages,original);
  assert.equal(message.variables[0].stat_data.money,90);assert.equal(message.variables[1].stat_data.money,40);
  const bad=clone(doc);bad.payload.messages[0].variables_initialized={foreign:'unknown'};await reseal(bad);
  await assert.rejects(importTo(fixture('new',['old']),bad),{code:'migration-template-format'});
});
test('same name cannot bypass explicit work/build/schema compatibility', async () => {
  const f = fixture('new', []), doc = await exported(fixture());
  await assert.rejects(f.client.previewMigration(doc), { code: 'migration-incompatible' });
  doc.source.workId = 'other'; await reseal(doc); await assert.rejects(f.client.previewMigration(doc), { code: 'migration-work-mismatch' });
  doc.source.workId = 'cyber2051'; doc.source.saveSchema = 99; await reseal(doc); await assert.rejects(f.client.previewMigration(doc), { code: 'migration-incompatible' }); assert.equal(f.writes, 0);
});
test('corrupted JSON, changed amount and unsupported format never create copies', async () => {
  const f = fixture('new', ['old']), doc = await exported(fixture());
  await assert.rejects(f.client.parseMigration('{'), { code: 'migration-invalid-json' });
  doc.payload.messages[0].variables[1].stat_data.money = 0; await assert.rejects(f.client.previewMigration(doc), { code: 'migration-hash-mismatch' });
  doc.format = 9; await reseal(doc); await assert.rejects(f.client.previewMigration(doc), { code: 'migration-format' }); assert.equal(f.writes, 0);
});
test('missing accepted quest, pinned version or inconsistent dependency list fails closed', async () => {
  const f = fixture('new', ['old']), doc = await exported(fixture());
  let bad = clone(doc); bad.payload.archive.packages.story.content.quests[0].id = 'other'; await reseal(bad); await assert.rejects(f.client.previewMigration(bad), { code: 'migration-definitions-missing' });
  bad = clone(doc); bad.payload.header.chat_metadata.variables.__cxx_content_pins.story = '9.0.0'; await reseal(bad); await assert.rejects(f.client.previewMigration(bad), { code: 'migration-dependency-missing' });
  bad = clone(doc); bad.payload.dependencies = []; await reseal(bad); await assert.rejects(f.client.previewMigration(bad), { code: 'migration-dependency-missing' });
});
test('executable content is rejected even with a valid local checksum', async () => {
  const f = fixture('new', ['old']), doc = await exported(fixture()); doc.payload.archive.packages.story.content.quests[0].brief = '<% execute() %>'; await reseal(doc);
  await assert.rejects(f.client.previewMigration(doc), { code: 'invalid-content' }); assert.equal(f.writes, 0);
});
test('unfinished installs and unsaved chat block export or import', async () => {
  const f = fixture(); f.state.journalName = 'pending'; await assert.rejects(f.client.captureMigration(), { code: 'migration-pending-install' });
  delete f.state.journalName; const rows = f.disk(); f.disk = () => rows; f.messages[0].mes = 'changed';
  await assert.rejects(f.client.captureMigration(), { code: 'backup-chat-not-persisted' }); assert.equal(f.writes, 0);
  const target = fixture('new', ['old']); target.state.pendingRegistry = {}; await assert.rejects(target.client.previewMigration(await exported(fixture())), { code: 'migration-pending-install' });
});
test('a new target never silently reinterprets a same-version old definition', async () => {
  const f = fixture('new', ['old']); f.state.registry.packages.story.content.quests[0].pay = 1;
  await assert.rejects(f.client.previewMigration(await exported(fixture())), { code: 'migration-definition-conflict' }); assert.equal(f.writes, 0);
});
test('post-save lost acknowledgement is resolved by exact disk readback', async () => {
  const f = fixture('new', ['old'], { writeCopy() { throw Error('response lost'); } });
  const result = await importTo(f, await exported(fixture())); assert.equal(result.status, 'complete'); assert.equal(f.writes, 1);
});
test('write-before failure leaves one resumable record and retry uses its original copy ID', async () => {
  const hooks = { skipWrite: true, writeCopy() { throw Error('offline'); } }, f = fixture('new', ['old'], hooks), doc = await exported(fixture());
  await assert.rejects(importTo(f, doc), /offline/); const record = Object.values(f.state.migrations)[0]; assert.equal(record.status, 'pending');
  hooks.skipWrite = false; delete hooks.writeCopy; const result = await importTo(f, doc); assert.equal(result.chatId, record.chatId); assert.equal(f.copies.size, 1);
});
test('record acknowledgement loss and script restart resume with the same persisted record', async () => {
  const hooks = { saveState() { throw Error('record response lost'); } }, f = fixture('new', ['old'], hooks), doc = await exported(fixture());
  await assert.rejects(importTo(f, doc), /record response lost/); assert.equal(f.writes, 0); const id = Object.values(f.state.migrations)[0].chatId;
  delete hooks.saveState; f.client = Backup.create({ host: f.host, core: Core, crypto: webcrypto, seed: f.seed, adapters: f.adapters });
  assert.equal((await importTo(f, doc)).chatId, id); assert.equal(f.copies.size, 1);
});
test('duplicate clicks and retries neither overwrite a changed copy nor create a second one', async () => {
  const f = fixture('new', ['old']), doc = await exported(fixture()), preview = await f.client.previewMigration(doc);
  const results = await Promise.allSettled([f.client.importMigration(doc, { preview, confirm: 'migrate-copy' }), f.client.importMigration(doc, { preview, confirm: 'migrate-copy' })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); const first = results.find(r => r.status === 'fulfilled').value;
  assert.equal((await importTo(f, doc)).chatId, first.chatId); assert.equal(f.writes, 1);
  f.copies.get(first.chatId)[1].mes = 'player continued'; await assert.rejects(importTo(f, doc), { code: 'migration-copy-changed' }); assert.equal(f.copies.size, 1);
});
test('truncated saved branches are never reported as successful', async () => {
  const f = fixture('new', ['old'], { writeCopy(f, id) { f.copies.get(id)[1].variables.pop(); } });
  await assert.rejects(importTo(f, await exported(fixture())), { code: 'migration-save-unconfirmed' });
  assert.equal(Object.values(f.state.migrations)[0].status, 'pending');
});
test('changing chat or a branch after preview blocks the stale request', async () => {
  const f = fixture('new', ['old']), doc = await exported(fixture()), preview = await f.client.previewMigration(doc);
  f.ctx.chatId = 'switched'; await assert.rejects(f.client.importMigration(doc, { preview, confirm: 'migrate-copy' }), { code: 'migration-preview-stale' });
  f.ctx.chatId = 'new-chat'; f.messages[0].variables[1].stat_data.money = 100; await assert.rejects(f.client.importMigration(doc, { preview, confirm: 'migrate-copy' }), { code: 'migration-preview-stale' }); assert.equal(f.writes, 0);
});
test('busy host and missing MVU/init capabilities stop rather than guessing', async () => {
  const f = fixture('new', ['old']), doc = await exported(fixture()); f.ctx.busy = true;
  await assert.rejects(f.client.previewMigration(doc), { code: 'host-busy' }); f.ctx.busy = false;
  f.adapters.initializationBooks = async () => []; await assert.rejects(f.client.previewMigration(doc), { code: 'migration-init-unavailable' });
});
test('registered external stores cannot be silently omitted', async () => {
  const f = fixture(); f.seed.migration.playerStores = [{ id: 'player', scope: 'character', key: 'player' }];
  await assert.rejects(f.client.captureMigration(), { code: 'migration-store-adapter-missing' }); assert.equal(f.writes, 0);
});
test('preview shows the selected reply state, not a hidden alternative', async () => {
  const target = fixture('new', ['old']), doc = await exported(fixture());
  assert.equal((await target.client.previewMigration(doc)).playerState.money, 90);
  doc.payload.messages[0].swipe_id = 1; await reseal(doc);
  assert.equal((await target.client.previewMigration(doc)).playerState.money, 40);
});
test('an interrupted install without a character pointer still blocks migration', async () => {
  const source = fixture(), target = fixture('new', ['old']), doc = await exported(source);
  const blocked = async () => { throw Object.assign(Error('pending browser journal'), { code: 'migration-pending-install' }); };
  source.host.assertNoPendingInstall = blocked; target.host.assertNoPendingInstall = blocked;
  await assert.rejects(source.client.captureMigration(), { code: 'migration-pending-install' });
  await assert.rejects(target.client.previewMigration(doc), { code: 'migration-pending-install' });
  assert.equal(target.writes, 0);
});
test('sequential migrations and skipping a version preserve all gameplay and inherited history', async () => {
  const a = fixture(), b = fixture('v2', ['old']), c = fixture('v3', ['old', 'v2']), original = await exported(a);
  const first = await importTo(b, original), rows = b.copies.get(first.chatId); b.header = clone(rows[0]); b.messages = clone(rows.slice(1));
  const next = await exported(b); assert.equal(next.source.buildId, 'v2');
  const second = await importTo(c, next); assert.deepEqual(withoutTechnical(c.copies.get(second.chatId)), original.payload.messages);
  const direct = fixture('v3', ['old', 'v2']), skipped = await importTo(direct, original); assert.deepEqual(withoutTechnical(direct.copies.get(skipped.chatId)), original.payload.messages);
});
test('chat archive feeds old accepted and legacy quests without modifying the target registry', async () => {
  const f = fixture('new', ['old']), doc = await exported(fixture()), result = await importTo(f, doc), vars = f.copies.get(result.chatId)[0].chat_metadata.variables;
  const base = clone(f.state); base.registry.packages.story = { ...base.registry.packages.story, version: '2.0.0', content: content(quest('q01', 900)) };
  const before = clone(base), effective = Content.withMigration(base, vars);
  const view = Content.view({ quests: [quest('q02', 999)], gallery: { characters: [] } }, effective.registry, doc.payload.messages[0].variables[0].stat_data.terminal.quests, { pins: vars.__cxx_content_pins, subscriptions: effective.subscriptions });
  assert.equal(view.quests.find(q => q.id === 'q01').pay, 30); assert.equal(view.quests.find(q => q.id === 'q02').pay, 30); assert.deepEqual(base, before);
});
test('manual cumulative release allows core; content-only mode does not silently install executable dependencies', () => {
  const entry = (id, kind) => ({ id, kind, version: '2.0.0', optional: false, requires: { packages: [] } });
  const state = { installed: {}, policy: { basic: true, basicConsent: true } }, catalog = { packages: [entry('code', 'core'), entry('plugin', 'component'), entry('story', 'content')] };
  assert.deepEqual(Controller.selection(catalog, state, Core).map(p => p.id), ['code', 'story']);
  assert.deepEqual(Controller.selection(catalog, state, Core, 'content-manual').map(p => p.id), ['story']);
  catalog.packages[2].requires.packages.push({ id: 'code', version: '2.0.0' }); assert.throws(() => Controller.selection(catalog, state, Core, 'content-manual'), { code: 'version-consent-needed' });
  catalog.packages[2].requires.packages = [{ id: 'plugin', version: '2.0.0' }]; assert.throws(() => Controller.selection(catalog, state, Core), { code: 'card-upgrade-required' });
});
test('a later install cannot reinterpret an archived version in a previously migrated chat', () => {
  const f = fixture(), archived = clone(f.state.registry.packages.story), incoming = clone(f.state);
  incoming.registry.packages.story.content.quests[0].pay = 999;
  let view = Content.withMigration(incoming, { __cxx_migration: { format: 1, archive: { packages: { story: archived }, legacyQuests: [] } } });
  assert.equal(Content.packageContent(view.registry.packages.story, '1.0.0').quests[0].pay, 30);
  incoming.registry.packages.story.version = '2.0.0'; incoming.registry.packages.story.history['1.0.0'] = content(quest('q01', 777));
  view = Content.withMigration(incoming, { __cxx_migration: { format: 1, archive: { packages: { story: archived }, legacyQuests: [] } } });
  assert.equal(Content.packageContent(view.registry.packages.story, '1.0.0').quests[0].pay, 30);
  assert.equal(view.registry.packages.story.content.quests[0].pay, 999);
});
