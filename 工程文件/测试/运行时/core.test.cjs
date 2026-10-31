'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require("../../卡片源码/运行时/core.js");
const copy = value => JSON.parse(JSON.stringify(value));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sig = { algorithm: 'Ed25519', keyId: 'test-key', value: Buffer.alloc(64).toString('base64') };
const context = () => ({ cardId: 'cyber2051', characterKey: 'card-a.png', chatId: 'save-a', busy: false });
const world = (uid, content) => ({ uid, name: '条目' + uid, enabled: true, content, strategy: { type: 'selective', keys: ['触发词'], keys_secondary: { logic: 'and_any', keys: [] } }, position: { type: 'after_character_definition' }, effect: {}, recursion: {}, extra: {} });
const regex = (id, replacement) => ({ id, script_name: id, enabled: true, find_regex: 'old', replace_string: replacement, source: { ai_output: true }, destination: { display: true } });
const script = (id, content) => ({ type: 'script', id, name: id, enabled: true, content, data: {}, button: { enabled: true, buttons: [{ name: '设置', visible: true }] } });
function components() {
  return { worldbook: { internalName: '世界书 1.0.0', entries: [world(1, 'old')] }, regex: { scripts: [regex('regex-a', 'old')] }, scripts: { trees: [script('script-a', 'old')] } };
}
function snapshot() { return { ...components(), registry: { format: 1, packages: {} } }; }
function nextSnapshot() {
  const after = snapshot(); after.worldbook.internalName = '世界书 1.0.1'; after.worldbook.entries[0].content = 'new'; after.regex.scripts[0].replace_string = 'new'; after.scripts.trees[0].content = 'new';
  after.registry.packages.base = { version: '1.0.0', optional: false, content: { quests: [], gallery: [], worldbook: [] }, history: {} }; return after;
}
function quest(id = 'quest-a') { return { id, title: '委托', fixer: '中间人', district: '街区', type: '调查', difficulty: '普通', brief: '找到线索', goal: '返回报告', pay: 100 }; }
function contentPackage(overrides = {}) {
  return { format: 3, cardId: 'cyber2051', id: 'official.story', version: '1.0.0', kind: 'content', optional: false, requires: { engine: '1.0.0', packages: [] }, content: { quests: [quest()], gallery: [{ id: 'sakiko-default', characterId: 'sakiko', category: 'standard', url: 'https://cyber2051.top/img/sakiko-v1.png' }], worldbook: [] }, signature: sig, ...overrides };
}
function corePackage() { return { format: 3, cardId: 'cyber2051', id: 'official.core', version: '1.0.0', kind: 'core', optional: false, requires: { engine: '1.0.0', packages: [] }, components: components(), signature: sig }; }
function catalog(packages) {
  return { format: 3, cardId: 'cyber2051', engineVersion: '1.0.0', signature: sig, packages: packages.map(pack => ({ id: pack.id, version: pack.version, kind: pack.kind, optional: pack.optional, requires: pack.requires, url: 'https://cyber2051.top/updates/v3/packages/' + pack.id + '/' + pack.version + '.json', sha256: 'a'.repeat(64), bytes: 50 })) };
}
function harness(before = snapshot(), hooks = {}) {
  const store = new Map(), writes = [], state = { snapshot: copy(before), context: context() };
  const storage = {
    async get(key) { if (hooks.get) await hooks.get(key, state); return store.has(key) ? copy(store.get(key)) : null; },
    async claim(key, value) { if (store.has(key)) return false; store.set(key, copy(value)); return true; },
    async set(key, value, options) {
      if (hooks.set) await hooks.set(key, value, state);
      const ownedKey = key.endsWith(':installed') ? 'journal' : key;
      if (options && options.expectedId && (!store.has(ownedKey) || store.get(ownedKey).id !== options.expectedId)) return false;
      store.set(key, copy(value));
    },
    async remove(key, options) { if (options?.expectedId && store.get(key)?.id !== options.expectedId) return false; return store.delete(key); },
  };
  const host = {
    async getContext() { if (hooks.context) await hooks.context(state); return copy(state.context); },
    async snapshot() { if (hooks.snapshot) await hooks.snapshot(state); return copy(state.snapshot); },
    async writeStage(stage, value, expected) {
      if (hooks.beforeWrite) await hooks.beforeWrite(stage, state);
      if (core.canonical(state.snapshot) !== core.canonical(expected)) { const error = Error('CAS failed'); error.code = 'snapshot-changed'; throw error; }
      if (hooks.failBefore === stage) throw Error('API failed before write');
      // This hook models the host checking context after its own asynchronous reads.
      if (state.context.characterKey !== expectedContext.characterKey || state.context.chatId !== expectedContext.chatId || state.context.busy) { const error = Error('Host context changed'); error.code = 'context-changed'; throw error; }
      writes.push(stage); state.snapshot[stage] = copy(value);
      if (hooks.afterWrite) await hooks.afterWrite(stage, state);
      if (hooks.failAfter === stage) throw Error('iframe destroyed after write');
    },
  };
  const expectedContext = context();
  return { state, storage, host, store, writes, execute: (after = nextSnapshot(), extra = {}) => core.execute({ host, storage, key: 'journal', id: 'transaction-a', expectedContext, before: copy(before), after, installed: { coreVersion: '1.0.1' }, ...extra }), recover: (extra = {}) => core.recover({ host, storage, key: 'journal', ...extra }) };
}

test('browser UMD exposes the same pure API without a Node dependency', () => {
  const browser = { TextEncoder, URL, crypto: crypto.webcrypto };
  vm.runInNewContext(fs.readFileSync(require.resolve("../../卡片源码/运行时/core.js"), 'utf8'), browser);
  assert.equal(browser.CxxUpdateCore.ENGINE_VERSION, '1.4.0');
  assert.equal(vm.runInNewContext('CxxUpdateCore.canonical({ b: 2, a: 1 })', browser), '{"a":1,"b":2}');
});
test('canonical sorting is stable and SHA256 agrees with Node for Unicode', async () => {
  const value = { z: ['祥子', { b: 2, a: 1 }], a: true };
  assert.equal(core.canonical(value), '{"a":true,"z":["祥子",{"a":1,"b":2}]}');
  assert.equal(await core.sha256(value, digest), digest(Buffer.from(core.canonical(value))));
  assert.equal(await core.sha256(value, bytes => crypto.webcrypto.subtle.digest('SHA-256', bytes)), await core.sha256(value, digest));
});

test('canonical accepts plain parent-window JSON while rejecting foreign class instances', () => {
  const foreign = vm.runInNewContext('({ z: [{ value: "旧存档" }], a: 1 })');
  assert.notEqual(Object.getPrototypeOf(foreign), Object.prototype);
  assert.equal(core.canonical(foreign), '{"a":1,"z":[{"value":"旧存档"}]}');
  for (const code of ['new Date()', 'new (class Record { constructor(){ this.value=1; } })()', 'Object.create({ inherited: true })']) {
    assert.throws(()=>core.canonical(vm.runInNewContext(code)),{code:'invalid-json'});
  }
  assert.throws(()=>core.canonical(vm.runInNewContext('JSON.parse(\'{"__proto__":{"polluted":true}}\')')),{code:'invalid-json'});
  const fakeProto=Object.create(null);fakeProto.constructor=Object;fakeProto.inherited=true;
  assert.throws(()=>core.canonical(Object.assign(Object.create(fakeProto),{a:1})),{code:'invalid-json'});
});
test('canonical rejects unrepresentable JSON and prototype pollution', () => {
  const cycle = {}; cycle.next = cycle;
  const sparse = []; sparse.length = 1;
  const extra = [1]; extra.x = 2;
  for (const value of [undefined, NaN, Infinity, 1n, cycle, sparse, extra, new Date(), { value: undefined }, JSON.parse('{"__proto__":{}}')]) assert.throws(() => core.canonical(value), { code: 'invalid-json' });
});
test('version comparison handles numeric and prerelease order', () => {
  assert.equal(core.compareVersions('1.10.0', '1.2.9'), 1);
  assert.equal(core.compareVersions('1.0.0-alpha.9', '1.0.0-alpha.10'), -1);
  assert.equal(core.compareVersions('1.0.0-rc.1', '1.0.0'), -1);
  assert.equal(core.compareVersions('1.0.0', '1.0.0'), 0);
  for (const value of ['1.0', '01.0.0', '1.0.0-01', 'v1.0.0']) assert.throws(() => core.compareVersions(value, '1.0.0'), { code: 'invalid-version' });
});
test('received format 3 packages require signature structure and correct identity', () => {
  assert.equal(core.validatePackage(corePackage()).id, 'official.core');
  const missing = corePackage(); delete missing.signature;
  assert.throws(() => core.validatePackage(missing), { code: 'invalid-signature' });
  assert.throws(() => core.validatePackage({ ...corePackage(), cardId: 'other' }), { code: 'invalid-format' });
  assert.throws(() => core.validatePackage({ ...corePackage(), format: 2 }), { code: 'invalid-format' });
});
test('package validation rejects unsatisfied dependencies and malformed content consumers', () => {
  const dependent = contentPackage({ requires: { engine: '1.0.0', packages: [{ id: 'official.core', version: '1.0.1' }] } });
  assert.throws(() => core.validatePackage(dependent, { installed: { 'official.core': '1.0.0' } }), { code: 'dependency-missing' });
  assert.throws(() => core.validatePackage(contentPackage({ requires: { engine: '2.0.0', packages: [] } })), { code: 'engine-too-old' });
  const unsafe = contentPackage(); unsafe.content.gallery[0].url = 'javascript:alert(1)';
  assert.throws(() => core.validatePackage(unsafe), { code: 'invalid-url' });
  const unknown = contentPackage(); unknown.content.gallery[0].characterId = 'new-npc';
  assert.throws(() => core.validatePackage(unknown), { code: 'invalid-content' });
  const mapped = contentPackage(); Object.assign(mapped.content.quests[0], { mapId: 'tokyo', placeId: 'bar' });
  assert.throws(() => core.validatePackage(mapped), { code: 'invalid-content' });
  core.validatePackage(mapped, { mapIndex: { tokyo: ['bar'] } });
});
test('content worldbook forbids executable templates and permanent persona replacement', () => {
  const pack = contentPackage(); pack.content.worldbook.push(world(33, '<% code() %>'));
  assert.throws(() => core.validatePackage(pack), { code: 'invalid-content' });
  pack.content.worldbook[0].content = 'text'; pack.content.worldbook[0].strategy.type = 'constant';
  assert.throws(() => core.validatePackage(pack), { code: 'invalid-content' });
  pack.content.worldbook[0].strategy.type = 'vectorized';
  assert.throws(() => core.validatePackage(pack), { code: 'invalid-content' });
});
test('catalog checks URL boundaries, dependency cycles and optional subscriptions', () => {
  const a = contentPackage({ id: 'a' }), b = contentPackage({ id: 'b', optional: true });
  core.validateCatalog(catalog([a, b]));
  const evil = catalog([a]); evil.packages[0].url = 'https://cyber2051.top.evil/updates/v3/packages/a/1.0.0.json';
  assert.throws(() => core.validateCatalog(evil), { code: 'invalid-url' });
  a.requires.packages = [{ id: 'b', version: '1.0.0' }];
  assert.throws(() => core.validateCatalog(catalog([a, b])), { code: 'invalid-requirements' });
  b.optional = false; b.requires.packages = [{ id: 'a', version: '1.0.0' }];
  assert.throws(() => core.validateCatalog(catalog([a, b])), { code: 'dependency-cycle' });
});
test('field hashes are compact and exclude script data while updating the same script id', async () => {
  const baseline = components(); baseline.regex.scripts[0].replace_string = 'x'.repeat(2000000);
  const local = copy(baseline), incoming = copy(baseline);
  local.scripts.trees[0].data = { userSetting: 42, baseline: { large: 'x'.repeat(10000) } };
  local.scripts.trees[0].enabled = false; local.scripts.trees[0].button.buttons[0].visible = false;
  local.scripts.trees[0].unknownHostField = { preserve: true };
  incoming.scripts.trees[0].content = 'new runtime'; incoming.scripts.trees[0].data = { reset: true };
  const seeds = await core.fingerprints(baseline, digest);
  assert.ok(core.canonical(seeds).length < 10000);
  assert.equal(seeds.scripts.trees.records['string:script-a'].fields.data, undefined);
  const result = await core.mergeComponents(seeds, local, incoming, { digest });
  const updated = result.components.scripts.trees[0];
  assert.equal(updated.content, 'new runtime'); assert.equal(updated.enabled, false);
  assert.deepEqual(updated.data, local.scripts.trees[0].data);
  assert.equal(updated.button.buttons[0].visible, false); assert.deepEqual(updated.unknownHostField, { preserve: true });
  assert.equal(result.conflicts.length, 0);
});
test('three-way merge updates untouched fields and retains dirty nested fields with conflicts', async () => {
  const baseline = components(), local = copy(baseline), incoming = copy(baseline);
  local.worldbook.entries[0].content = 'player rewrite'; local.worldbook.entries[0].position.localNote = 'keep';
  incoming.worldbook.entries[0].content = 'official rewrite'; incoming.worldbook.entries[0].name = 'new title'; incoming.worldbook.entries[0].position.type = 'before_character_definition';
  const result = await core.mergeComponents(baseline, local, incoming, { digest });
  assert.equal(result.components.worldbook.entries[0].content, 'player rewrite');
  assert.equal(result.components.worldbook.entries[0].name, 'new title');
  assert.equal(result.components.worldbook.entries[0].position.type, 'before_character_definition');
  assert.equal(result.components.worldbook.entries[0].position.localNote, 'keep');
  assert.ok(result.conflicts.some(item => item.path === 'content' && item.reason === 'both-changed'));
});
test('upstream removals delete clean items but preserve modifications, disabled state and script data', async () => {
  const baseline = components(), local = copy(baseline), incoming = copy(baseline);
  baseline.worldbook.entries.push(world(2, 'remove'), world(3, 'modified'), world(4, 'disabled'));
  local.worldbook.entries = copy(baseline.worldbook.entries); local.worldbook.entries[2].content = 'local'; local.worldbook.entries[3].enabled = false;
  local.scripts.trees[0].data = { chosenImage: 'custom' };
  incoming.worldbook.entries = []; incoming.scripts.trees = [];
  const result = await core.mergeComponents(baseline, local, incoming, { digest });
  assert.deepEqual(result.components.worldbook.entries.map(item => item.uid), [3, 4]);
  assert.equal(result.components.scripts.trees.length, 1);
  assert.ok(result.counts.deleted >= 2);
});
test('local additions and deletions are respected, colliding new official ids are not adopted', async () => {
  const baseline = components(), local = copy(baseline), incoming = copy(baseline);
  local.worldbook.entries = [world(2, 'my entry')]; incoming.worldbook.entries.push(world(2, 'official collision'), world(3, 'new official'));
  const result = await core.mergeComponents(baseline, local, incoming, { digest });
  assert.deepEqual(result.components.worldbook.entries.map(item => item.uid), [2, 3]);
  assert.equal(result.components.worldbook.entries[0].content, 'my entry');
  assert.ok(result.conflicts.some(item => item.reason === 'unowned-id-collision'));
  assert.ok(result.conflicts.some(item => item.reason === 'local-item-deleted'));
});
test('folder child scripts merge by fixed id and preserve folder settings', async () => {
  const baseline = components(); baseline.scripts.trees = [{ type: 'folder', id: 'folder-a', name: '官方组', enabled: true, scripts: [script('child-a', 'old')] }];
  const local = copy(baseline), incoming = copy(baseline);
  local.scripts.trees[0].name = '我的组'; local.scripts.trees[0].scripts[0].data = { setting: 1 };
  incoming.scripts.trees[0].scripts[0].content = 'new'; incoming.scripts.trees[0].scripts.push(script('child-b', 'added'));
  const result = await core.mergeComponents(baseline, local, incoming, { digest });
  assert.equal(result.components.scripts.trees[0].name, '我的组');
  assert.equal(result.components.scripts.trees[0].scripts[0].content, 'new');
  assert.deepEqual(result.components.scripts.trees[0].scripts[0].data, { setting: 1 });
  assert.equal(result.components.scripts.trees[0].scripts[1].id, 'child-b');
});
test('DLC stays uninstalled until subscribed and registry preserves old quest definitions', () => {
  const pack = contentPackage({ optional: true });
  const skipped = core.mergeRegistry(null, pack); assert.equal(skipped.skipped, true); assert.deepEqual(skipped.registry.packages, {});
  const installed = core.mergeRegistry(null, pack, { subscriptions: [pack.id] }).registry;
  const next = copy(pack); next.version = '1.1.0'; next.content.quests[0].pay = 500;
  const result = core.mergeRegistry(installed, next, { subscriptions: [pack.id] }).registry;
  assert.equal(result.packages[pack.id].content.quests[0].pay, 500);
  assert.equal(result.packages[pack.id].history['1.0.0'].quests[0].pay, 100);
  assert.equal(installed.packages[pack.id].content.quests[0].pay, 100);
  assert.throws(() => core.mergeRegistry(result, pack, { subscriptions: [pack.id] }), { code: 'downgrade' });
  const collision = copy(next); collision.content.quests[0].pay = 900;
  assert.throws(() => core.mergeRegistry(result, collision, { subscriptions: [pack.id] }), { code: 'version-collision' });
});
test('successful install writes scripts last and only verified recovery commits metadata', async () => {
  const h = harness(); const result = await h.execute();
  assert.equal(result.status, 'awaiting-verification'); assert.deepEqual(h.writes, ['worldbook', 'regex', 'registry', 'scripts']);
  assert.equal(h.store.has('journal:installed'), false);
  assert.equal((await h.recover()).status, 'committed'); assert.deepEqual(h.store.get('journal:installed'), { coreVersion: '1.0.1' }); assert.equal(h.store.has('journal'), false);
});

test('a ledger-only transaction preserves the complete target including unknown nested fields', async () => {
  const before = snapshot(), h = harness(before);
  const target = { installed: {}, baseline: { format: 1 }, conflicts: [], scope: 'character', registry: before.registry,
    componentPackages: { fixture: { version: '1.0.0', future: { values: [0, false, 'keep'] } } } };
  await h.execute(before, { installed: target });
  assert.deepEqual(h.writes, []); assert.equal(h.store.get('journal').commitAttempted, false);
  assert.deepEqual((await h.recover()).installed, target);
  assert.deepEqual(h.store.get('journal:installed'), target);
});

test('incomplete ledger readback retains the transaction and cannot report success', async () => {
  const h = harness(); await h.execute(nextSnapshot(), { installed: { componentPackages: { fixture: { version: '1.0.0' } } } });
  const set = h.storage.set;
  h.storage.set = async (key, value, options) => { await set(key, value, options); if (key.endsWith(':installed')) delete h.store.get(key).componentPackages; };
  assert.deepEqual(await h.recover(), { status: 'needs-review', reason: 'installed-readback-mismatch' });
  assert.equal(h.store.get('journal').commitAttempted, true);
  assert.deepEqual(h.state.snapshot, nextSnapshot());
});

test('a lost ledger save reply followed by component changes never rolls back a committed installation', async () => {
  const h = harness(); await h.execute();
  const set = h.storage.set;
  h.storage.set = async (key, value, options) => { await set(key, value, options); if (key.endsWith(':installed')) throw Error('saved but reply lost'); };
  await assert.rejects(h.recover(), /reply lost/);
  assert.deepEqual(h.store.get('journal:installed'), { coreVersion: '1.0.1' });
  h.state.snapshot.worldbook.entries[0].content = 'player edit after save'; const before = copy(h.state.snapshot), writes = h.writes.length;
  assert.deepEqual(await h.recover(), { status: 'needs-review', reason: 'components-changed-after-commit-attempt' });
  assert.equal(h.writes.length, writes); assert.deepEqual(h.state.snapshot, before); assert.ok(h.store.has('journal'));
});

test('component changes during ledger readback stop cleanup and preserve the player edit', async () => {
  const h = harness(); await h.execute();
  const get = h.storage.get;
  h.storage.get = async key => { const value = await get(key); if (key.endsWith(':installed')) h.state.snapshot.scripts.trees[0].data.player = 'new'; return value; };
  assert.deepEqual(await h.recover(), { status: 'needs-review', reason: 'components-changed-after-ledger-write' });
  assert.equal(h.state.snapshot.scripts.trees[0].data.player, 'new'); assert.ok(h.store.has('journal'));
});

test('legacy unmarked partial transactions remain reviewable while fully matching legacy installs can finish', async () => {
  const partial = harness(snapshot(), { failBefore: 'regex' }); await partial.execute();
  partial.store.get('journal').format = 1; delete partial.store.get('journal').commitAttempted;
  const writes = partial.writes.length, before = copy(partial.state.snapshot);
  assert.deepEqual(await partial.recover(), { status: 'needs-review', reason: 'legacy-unmarked-commit-status' });
  assert.equal(partial.writes.length, writes); assert.deepEqual(partial.state.snapshot, before);
  const complete = harness(); await complete.execute(); complete.store.get('journal').format = 1; delete complete.store.get('journal').commitAttempted;
  assert.equal((await complete.recover()).status, 'committed');
});

test('cleanup without a positive owner acknowledgement cannot report commit or rollback success', async () => {
  for (const rollback of [false, true]) for (const acknowledgement of [false, undefined]) {
    const h = harness(snapshot(), rollback ? { failBefore: 'worldbook' } : {}); await h.execute();
    h.storage.remove = async (key, options) => { assert.equal(key, 'journal'); assert.equal(options.expectedId, 'transaction-a'); return acknowledgement; };
    assert.deepEqual(await h.recover(), { status: 'needs-review', reason: 'journal-cleanup-not-confirmed' });
    assert.ok(h.store.has('journal'));
  }
});

test('late cleanup cannot remove another transaction after the installation target was confirmed', async () => {
  const h = harness(); await h.execute(); const remove = h.storage.remove;
  h.storage.remove = async (key, options) => { h.store.set(key, { ...h.store.get(key), id: 'new-owner' }); return remove(key, options); };
  assert.deepEqual(await h.recover(), { status: 'needs-review', reason: 'journal-cleanup-not-confirmed' });
  assert.equal(h.store.get('journal').id, 'new-owner');
});
test('journal is durable before each call, including self-replacing scripts', async () => {
  let h;
  h = harness(snapshot(), { beforeWrite(stage) { const journal = h.store.get('journal'); assert.ok(journal.attempted.includes(stage)); assert.ok(journal.before && journal.after); }, failAfter: 'scripts' });
  const result = await h.execute(); assert.equal(result.status, 'interrupted');
  assert.equal(result.journal.completed.includes('scripts'), false); assert.equal(result.journal.attempted.includes('scripts'), true);
  assert.equal((await h.recover()).status, 'committed');
});
test('API failure after a partial write is detected and safely rolled back', async () => {
  const h = harness(snapshot(), { failAfter: 'worldbook' });
  assert.equal((await h.execute()).status, 'interrupted');
  assert.equal((await h.recover()).status, 'deferred'); // first rollback also models iframe loss
  assert.equal((await h.recover()).status, 'rolled-back');
  assert.deepEqual(h.state.snapshot, snapshot()); assert.equal(h.store.has('journal:installed'), false);
});
test('local edits after interrupted install block rollback instead of being erased', async () => {
  const h = harness(snapshot(), { failBefore: 'regex' }); await h.execute();
  h.state.snapshot.worldbook.entries[0].content = 'new player edit';
  assert.equal((await h.recover()).status, 'needs-review');
  assert.equal(h.state.snapshot.worldbook.entries[0].content, 'new player edit'); assert.equal(h.store.has('journal'), true);
});
test('unrelated stage edits during recovery also block rollback', async () => {
  const h = harness(snapshot(), { failBefore: 'regex' }); const after = snapshot(); after.worldbook.internalName = 'changed'; await h.execute(after);
  h.state.snapshot.scripts.trees[0].data = { playerChange: true };
  assert.equal((await h.recover()).status, 'needs-review'); assert.equal(h.state.snapshot.worldbook.internalName, 'changed');
});
test('two execute calls cannot claim and overwrite the same pending transaction', async () => {
  const h = harness(); const results = await Promise.allSettled([h.execute(), h.execute(nextSnapshot(), { id: 'transaction-b' })]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  const rejected = results.find(item => item.status === 'rejected'); assert.ok(['transaction-raced', 'transaction-pending'].includes(rejected.reason.code));
  assert.equal(h.writes.length, 4);
});
test('preview races are rejected before creating a journal', async () => {
  const h = harness(); h.state.snapshot.worldbook.entries[0].content = 'edited after preview';
  await assert.rejects(h.execute(), { code: 'snapshot-changed' }); assert.equal(h.writes.length, 0); assert.equal(h.store.size, 0);
});
test('context checks distinguish copies of a card and interrupt after an awaited stage', async () => {
  const h = harness(snapshot(), { afterWrite(stage, state) { if (stage === 'worldbook') state.context.characterKey = 'card-b.png'; } });
  const result = await h.execute(); assert.equal(result.errorCode, 'context-changed'); assert.deepEqual(h.writes, ['worldbook']);
  assert.equal((await h.recover()).status, 'deferred'); h.state.context = context();
  assert.equal((await h.recover()).status, 'deferred'); // rollback hook switches card again
  assert.deepEqual(h.state.snapshot, snapshot());
});
test('generation becoming busy while journal persists stops before host writes', async () => {
  const h = harness(snapshot(), { set(key, value, state) { if (value.status === 'applying') state.context.busy = true; } });
  const result = await h.execute(); assert.equal(result.errorCode, 'busy'); assert.equal(h.writes.length, 0);
  assert.equal((await h.recover()).status, 'deferred'); h.state.context.busy = false;
  assert.equal((await h.recover()).status, 'rolled-back');
});
test('host CAS catches a concurrent mutation immediately before its API write', async () => {
  const h = harness(snapshot(), { beforeWrite(stage, state) { if (stage === 'regex') state.snapshot.regex.scripts[0].replace_string = 'another window'; } });
  const result = await h.execute(); assert.equal(result.errorCode, 'snapshot-changed'); assert.deepEqual(h.writes, ['worldbook']);
  assert.equal((await h.recover()).status, 'needs-review'); assert.equal(h.state.snapshot.regex.scripts[0].replace_string, 'another window');
});
test('storage failure before a stage prevents its host write', async () => {
  const h = harness(snapshot(), { set(key, value) { if (value.status === 'applying') throw Error('disk full'); } });
  const result = await h.execute(); assert.equal(result.status, 'interrupted'); assert.equal(h.writes.length, 0);
  assert.equal((await h.recover()).status, 'rolled-back');
});
test('recovery defers when the chat changes while awaiting its initial snapshot', async () => {
  let switchOnSnapshot = false;
  const h = harness(snapshot(), { snapshot(state) { if (switchOnSnapshot) state.context.chatId = 'other-save'; }, failBefore: 'regex' });
  await h.execute(); switchOnSnapshot = true;
  const result = await h.recover(); assert.equal(result.status, 'deferred'); assert.equal(result.errorCode, 'context-changed');
  assert.deepEqual(h.writes, ['worldbook']); assert.equal(h.store.has('journal'), true);
});
test('registry activation is retained per version and cannot mutate at the same version', () => {
  const pack = contentPackage({ activation: 'new_chat' });
  const installed = core.mergeRegistry(null, pack).registry;
  assert.equal(installed.packages[pack.id].activation, 'new_chat');
  assert.throws(() => core.mergeRegistry(installed, { ...pack, activation: 'compatible' }), { code: 'version-collision' });
  const next = core.mergeRegistry(installed, { ...pack, version: '1.1.0', activation: 'opt_in' }).registry;
  assert.equal(next.packages[pack.id].historyActivation['1.0.0'], 'new_chat');
});
test('unsupported gallery domains and unresolved prerequisite ids are rejected', () => {
  const pack = contentPackage(); pack.content.gallery[0].url = 'https://images.example/sakiko.png';
  assert.throws(() => core.validatePackage(pack), { code: 'invalid-url' });
  pack.content.gallery[0].url = 'https://cyber2051.top/img/sakiko.png'; pack.content.quests[0].prerequisites = ['not-installed'];
  assert.throws(() => core.validatePackage(pack), { code: 'invalid-content' });
  core.validatePackage(pack, { questIds: ['not-installed'] });
});
test('a script id cannot silently become a folder id during an update', async () => {
  const baseline = components(), incoming = copy(baseline);
  incoming.scripts.trees[0] = { id: 'script-a', type: 'folder', name: 'group', scripts: [] };
  const result = await core.mergeComponents(baseline, baseline, incoming, { digest });
  assert.equal(result.components.scripts.trees[0].type, 'script');
  assert.ok(result.conflicts.some(item => item.reason === 'script-node-type-changed'));
});
test('a newly started updater can commit before the old iframe returns without resurrecting its journal', async () => {
  let h;
  h = harness(snapshot(), { async afterWrite(stage) { if (stage === 'scripts') assert.equal((await h.recover()).status, 'committed'); } });
  const result = await h.execute(); assert.equal(result.status, 'superseded');
  assert.equal(h.store.has('journal'), false); assert.deepEqual(h.store.get('journal:installed'), { coreVersion: '1.0.1' });
});
test('quest tracks, duplicate prerequisites and same-package prerequisite cycles are rejected', () => {
  const pack = contentPackage(); pack.content.quests[0].track = 'unknown';
  assert.throws(() => core.validatePackage(pack), { code: 'invalid-content' });
  pack.content.quests[0].track = 'side'; pack.content.quests[0].prerequisites = ['q01', 'q01'];
  assert.throws(() => core.validatePackage(pack), { code: 'invalid-content' });
  pack.content.quests[0].prerequisites = ['quest-b']; const second = quest('quest-b'); second.prerequisites = ['quest-a']; pack.content.quests.push(second);
  assert.throws(() => core.validatePackage(pack), { code: 'invalid-content' });
  second.prerequisites = []; core.validatePackage(pack);
});
