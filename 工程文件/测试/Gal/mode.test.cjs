'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { create } = require("../../卡片源码/Gal/mode.js");
const KEY = '__cxx_gal_mode';

function fixture(initial = {}) {
  let variables = structuredClone(initial), scope = 'card/chat-a';
  const calls = { reads: 0, writes: 0, updates: 0 };
  const deps = {
    readScope: () => scope,
    getVariables(options) {
      assert.deepEqual(options, { type: 'chat' }); calls.reads++;
      return structuredClone(variables);
    },
    updateVariablesWith(updater, options) {
      assert.deepEqual(options, { type: 'chat' }); calls.updates++;
      const next = updater(structuredClone(variables));
      assert.equal(next?.then, undefined, 'the actual updater must stay synchronous');
      variables = next; calls.writes++;
      return next;
    },
  };
  return { deps, calls, mode: create(deps),
    scope(value) { scope = value; }, replace(value) { variables = value; },
    get variables() { return variables; } };
}

test('missing preference defaults off without initializing or saving the chat', () => {
  const f = fixture({ sentinel: { preserved: true } });
  assert.deepEqual(f.mode.read('card/chat-a'), { ok: true, enabled: false });
  assert.deepEqual(f.variables, { sentinel: { preserved: true } });
  assert.equal(f.calls.updates, 0); assert.equal(f.calls.writes, 0);
});

test('enable and disable only update the owned record while preserving all chat fields and record extras', () => {
  const initial = {
    stat_data: { terminal: { opening: { token: 'keep' }, wallet: 1000 } },
    __cxx_content_pins: { active: ['world-a'] }, sentinel: [1, { opaque: true }],
    [KEY]: { schemaVersion: 1, enabled: false, futureExtra: { keep: ['x'] } },
  };
  const f = fixture(initial);
  for (const enabled of [true, false]) {
    const result = f.mode.setEnabled('card/chat-a', enabled);
    assert.deepEqual(result, { ok: true, enabled });
    assert.equal(result?.then, undefined);
    assert.deepEqual(f.variables, { ...initial, [KEY]: { ...initial[KEY], enabled } });
  }
  assert.deepEqual(initial[KEY], { schemaVersion: 1, enabled: false, futureExtra: { keep: ['x'] } });
  assert.equal(f.calls.writes, 2);
});

test('fresh enable creates only the documented schema and uses the latest updater snapshot', () => {
  const f = fixture({ sentinel: 'old' });
  f.mode.read('card/chat-a');
  f.replace({ sentinel: 'new', anotherExtension: { value: 7 } });
  assert.deepEqual(f.mode.setEnabled('card/chat-a', true), { ok: true, enabled: true });
  assert.deepEqual(f.variables, { sentinel: 'new', anotherExtension: { value: 7 }, [KEY]: { schemaVersion: 1, enabled: true } });
});

test('foreign-realm and null-prototype plain records are valid while class instances are not', () => {
  const foreign = vm.runInNewContext('({ extra: 5, __cxx_gal_mode: {schemaVersion: 1, enabled: true, label: "keep"} })');
  let current = foreign;
  const mode = create({ readScope: () => 'chat', getVariables: () => current,
    updateVariablesWith: updater => (current = updater(current)) });
  assert.deepEqual(mode.read('chat'), { ok: true, enabled: true });
  assert.deepEqual(mode.setEnabled('chat', false), { ok: true, enabled: false });
  assert.equal(current.extra, 5); assert.equal(current[KEY].label, 'keep');
  const nullRecord = Object.assign(Object.create(null), { schemaVersion: 1, enabled: true });
  current = Object.assign(Object.create(null), { [KEY]: nullRecord });
  assert.deepEqual(mode.read('chat'), { ok: true, enabled: true });
  class Record { constructor() { this.schemaVersion = 1; this.enabled = true; } }
  current = { [KEY]: new Record() };
  assert.equal(mode.read('chat').code, 'invalid-state');
  assert.equal(mode.setEnabled('chat', false).code, 'invalid-state');
  current = Object.assign(Object.create({ constructor: Object, inherited: true }), { sentinel: 'custom prototype' });
  assert.equal(mode.read('chat').code, 'invalid-state');
  assert.equal(mode.setEnabled('chat', true).code, 'invalid-state');
});

test('damaged tables and records are rejected without replacement', () => {
  const cases = [null, [], 'bad', 1, new Date(),
    { [KEY]: null }, { [KEY]: [] }, { [KEY]: true }, { [KEY]: {} },
    { [KEY]: { schemaVersion: 1 } }, { [KEY]: { schemaVersion: 1, enabled: 'true' } }];
  for (const value of cases) {
    const f = fixture(); f.replace(value);
    assert.deepEqual(f.mode.read('card/chat-a'), { ok: false, enabled: false, code: 'invalid-state' });
    assert.deepEqual(f.mode.setEnabled('card/chat-a', true), { ok: false, enabled: false, code: 'invalid-state' });
    assert.equal(f.calls.writes, 0); assert.equal(f.variables, value);
  }
});

test('future or unrecognized schema never gets downgraded even by an explicit disable', () => {
  for (const schemaVersion of [2, 100, 0, '1', null]) {
    const initial = { [KEY]: { schemaVersion, enabled: true, future: 'retain' }, sentinel: 'keep' };
    const f = fixture(initial);
    assert.equal(f.mode.read('card/chat-a').code, 'unsupported-version');
    assert.equal(f.mode.setEnabled('card/chat-a', false).code, 'unsupported-version');
    assert.deepEqual(f.variables, initial); assert.equal(f.calls.writes, 0);
  }
});

test('a stale or empty expected scope never reads or writes another chat', () => {
  for (const expected of ['card/chat-b', '', null, undefined, 7]) {
    const f = fixture();
    assert.equal(f.mode.read(expected).code, 'scope-changed');
    assert.equal(f.mode.setEnabled(expected, true).code, 'scope-changed');
    assert.deepEqual(f.calls, { reads: 0, writes: 0, updates: 0 });
  }
});

test('scope change inside the host updater aborts by throwing before replacement', () => {
  const f = fixture({ sentinel: 'chat-b' });
  const original = f.deps.updateVariablesWith;
  let aborted = false;
  f.deps.updateVariablesWith = (updater, options) => {
    f.scope('card/chat-b');
    try { return original(updater, options); }
    catch (error) { aborted = true; throw error; }
  };
  const mode = create(f.deps);
  assert.deepEqual(mode.setEnabled('card/chat-a', true), { ok: false, enabled: false, code: 'scope-changed' });
  assert.equal(aborted, true); assert.equal(f.calls.writes, 0);
  assert.deepEqual(f.variables, { sentinel: 'chat-b' });
});

test('scope change during read discards the result instead of restoring an unrelated preference', () => {
  const f = fixture({ [KEY]: { schemaVersion: 1, enabled: true } });
  const read = f.deps.getVariables;
  f.deps.getVariables = options => { const value = read(options); f.scope('card/chat-b'); return value; };
  assert.deepEqual(create(f.deps).read('card/chat-a'), { ok: false, enabled: false, code: 'scope-changed' });
  assert.equal(f.calls.writes, 0);
});

test('a scope change after a completed write never rolls back into the next chat', () => {
  const f = fixture({ sentinel: 'chat-a' });
  const update = f.deps.updateVariablesWith;
  let savedA;
  f.deps.updateVariablesWith = (updater, options) => {
    const value = update(updater, options); savedA = structuredClone(f.variables);
    f.scope('card/chat-b'); f.replace({ sentinel: 'chat-b' });
    return value;
  };
  assert.equal(create(f.deps).setEnabled('card/chat-a', true).code, 'scope-changed');
  assert.deepEqual(savedA, { sentinel: 'chat-a', [KEY]: { schemaVersion: 1, enabled: true } });
  assert.deepEqual(f.variables, { sentinel: 'chat-b' }); assert.equal(f.calls.writes, 1);
});

test('only boolean input is accepted; truthy values cannot silently enable Gal', () => {
  for (const enabled of ['true', 'false', 0, 1, null, undefined, {}, new Boolean(true)]) {
    const f = fixture();
    assert.equal(f.mode.setEnabled('card/chat-a', enabled).code, 'invalid-enabled');
    assert.deepEqual(f.calls, { reads: 0, writes: 0, updates: 0 });
  }
});

test('missing APIs return an explicit volatile result; missing writer still permits reading', () => {
  const f = fixture({ [KEY]: { schemaVersion: 1, enabled: true } });
  assert.equal(create().read('chat').code, 'volatile');
  for (const key of ['readScope', 'getVariables', 'updateVariablesWith']) {
    const deps = { ...f.deps, [key]: undefined }, mode = create(deps);
    assert.equal(mode.setEnabled('card/chat-a', true).code, 'volatile');
    assert.deepEqual(mode.read('card/chat-a'), key === 'updateVariablesWith'
      ? { ok: true, enabled: true } : { ok: false, enabled: false, code: 'volatile' });
  }
  assert.equal(f.calls.writes, 0);
});

test('host exceptions and ineffective writes report failure without fabricating success', () => {
  const f = fixture();
  assert.equal(create({ ...f.deps, getVariables() { throw Error('read unavailable'); } }).read('card/chat-a').code, 'read-failed');
  assert.equal(create({ ...f.deps, updateVariablesWith() { throw Error('write unavailable'); } }).setEnabled('card/chat-a', true).code, 'write-failed');
  assert.equal(create({ ...f.deps, updateVariablesWith: updater => updater({}) }).setEnabled('card/chat-a', true).code, 'write-failed');
  const asyncResult = create({ ...f.deps, updateVariablesWith: () => Promise.resolve({}) }).setEnabled('card/chat-a', true);
  assert.equal(asyncResult.code, 'write-failed'); assert.equal(asyncResult.then, undefined);
  assert.equal(f.calls.writes, 0);
});

test('browser UMD exports the same pure synchronous API without DOM or automatic writes', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../卡片源码/Gal/mode.js"), 'utf8'), sandbox);
  const mode = sandbox.CxxGalMode.create({ readScope: () => 'chat', getVariables: () => ({}) });
  assert.equal(mode.read('chat').enabled, false);
  assert.equal(mode.read('chat').ok, true);
  assert.equal(mode.setEnabled('chat', true).code, 'volatile');
});
