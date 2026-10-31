'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { create, createHost } = require("../../卡片源码/Gal/opening-session.js");
const root = path.resolve(__dirname, "../../卡片源码/Gal");
const chosen = Object.freeze({ identityId: 'corpo', eraId: '2050-12', customDescription: '' });
const copy = value => structuredClone(value);
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function authored() {
  return {
    version: 'test-only-opening-v1',
    identities: ['corpo', 'street', 'student', 'custom'].map(id => ({ id, label: id, body: '工程测试通用开场，不是正式文案。' })),
    timelines: [
      { id: '2050-12', label: '较早时间测试', initialState: { story: { date: '2050-12', time: '00:00', location: null, phase: 0 } }, timelineEvents: [] },
      { id: '2051-04', label: '较晚时间测试', initialState: { story: { date: '2051-04', location: null } }, timelineEvents: [{ taskId: 'q01', state: 'skipped', outcome: '仅为工程夹具中的作者背景。' }] },
    ],
  };
}
function fixture(options = {}) {
  let active = 'A', processing = false, groupId = null, avatar = 'test-card.png';
  const initial = { outsideSentinel: { preserved: true }, stat_data: { sentinel: { untouched: ['a', 0] }, 丰川祥子: { 好感度: 100 },
    terminal: { wallet: { id: 'wallet', yen: 123, earned: 456, spent: 333 }, quests: { q01: { state: '进行中', acceptedFloor: 0, unknown: true } }, unknownTerminal: 42 } } };
  const chats = Object.fromEntries(['A', 'B'].map(id => [id, { messages: [{ mes: '测试开场', is_user: false, swipe_id: 0 }], variables: [copy(initial)] }]));
  const writes = [], reads = [];
  const deps = {
    getContext: () => ({ characterId: 0, characters: [{ avatar }], groupId, chat: chats[active].messages, getCurrentChatId: () => active }),
    getLastMessageId: () => chats[active].messages.length - 1,
    getVariables(scope) { reads.push(copy(scope)); assert.equal(scope.type, 'message'); return copy(chats[active].variables[scope.message_id] || {}); },
    updateVariablesWith(update, scope) {
      assert.deepEqual(scope, { type: 'message', message_id: 0 });
      const target = active, next = copy(chats[target].variables[scope.message_id] || {});
      options.beforeUpdate?.();
      const updated = update(next);
      assert.equal(typeof updated?.then, 'undefined', 'the actual updater stays synchronous');
      chats[target].variables[scope.message_id] = updated; writes.push({ chat: target, scope: copy(scope) });
      return updated;
    },
    busy: () => processing,
  };
  const host = createHost(deps);
  return { host, deps, chats, initial, writes, reads,
    setChat: id => { active = id; }, setBusy: value => { processing = value; },
    setGroup: value => { groupId = value; }, setAvatar: value => { avatar = value; },
    session: (manifest = authored(), overrides = {}) => create({ manifest, ...host, ...overrides }),
  };
}
function gateFirstRead(host) {
  let release, first = true;
  return { readContext() {
    const value = host.readContext();
    if (!first) return value;
    first = false; return new Promise(resolve => { release = () => resolve(value); });
  }, release: () => release() };
}

test('missing official manuscript stays readable but cannot start or reach a write', async () => {
  const f = fixture(), session = f.session({ version: 'pending-authored-content', identities: [], timelines: [] });
  assert.equal((await session.inspect(chosen)).code, 'missing-body');
  assert.equal((await session.start(chosen)).ok, false);
  assert.equal(f.writes.length, 0); assert.equal(f.reads.length, 0);
});

test('missing initial state and missing explicit event list retain separate M18 reasons', async () => {
  for (const [field, code] of [['initialState', 'missing-state'], ['timelineEvents', 'missing-events']]) {
    const f = fixture(), manifest = authored(); delete manifest.timelines[0][field];
    const session = f.session(manifest), inspected = await session.inspect(chosen);
    assert.equal(inspected.code, code); assert.equal(inspected.canStart, false);
    assert.equal(inspected.opening.body, manifest.identities[0].body);
    assert.equal((await session.start(chosen)).code, code); assert.equal(f.writes.length, 0);
  }
});

test('both era selections reuse the same authored prose while keeping independent state and events', async () => {
  const f = fixture(), manifest = freeze(authored()), before = JSON.stringify(manifest), session = f.session(manifest);
  const early = await session.inspect(chosen), late = await session.inspect({ ...chosen, eraId: '2051-04' });
  assert.equal(early.code, 'ready'); assert.equal(late.code, 'ready');
  assert.equal(early.opening.body, late.opening.body);
  assert.equal(early.opening.timelineId, '2050-12'); assert.equal(late.opening.timelineId, '2051-04');
  assert.equal(early.initialState.story.phase, 0); assert.equal(early.initialState.story.location, null);
  assert.deepEqual(early.timelineEvents, []); assert.equal(late.timelineEvents[0].state, 'skipped');
  assert.equal(JSON.stringify(manifest), before); assert.equal(f.writes.length, 0);
});

test('custom description remains separate from authored prose and is validated by M18', async () => {
  const f = fixture(), session = f.session();
  const model = await session.inspect({ identityId: 'custom', eraId: '2050-12', customDescription: '工程测试身份说明。' });
  assert.equal(model.canStart, true); assert.equal(model.opening.customDescription, '工程测试身份说明。');
  assert.equal(model.opening.body, authored().identities[0].body);
  assert.equal((await session.inspect({ ...chosen, customDescription: '不能替换内置身份' })).code, 'invalid');
  assert.equal((await session.inspect({ identityId: 'custom', eraId: '2050-12', customDescription: '<script>bad()</script>' })).code, 'invalid');
  assert.equal((await session.inspect({ ...chosen, eraId: '2099-01' })).code, 'invalid');
  assert.equal(f.writes.length, 0);
});

test('completion or reward fields cannot masquerade as authored skipped events', async () => {
  for (const event of [{ taskId: 'q01', state: '完成' }, { taskId: 'q01', state: 'skipped', reward: 999 }]) {
    const f = fixture(), manifest = authored(); manifest.timelines[0].timelineEvents = [event];
    const result = await f.session(manifest).start(chosen);
    assert.equal(result.ok, false); assert.equal(result.code, 'invalid'); assert.equal(f.writes.length, 0);
  }
});

test('destroy while inspection is pending prevents a later commit', async () => {
  const f = fixture(), gate = gateFirstRead(f.host), session = f.session(authored(), { readContext: gate.readContext });
  const pending = session.start(chosen); session.destroy(); gate.release();
  assert.equal((await pending).code, 'destroyed'); assert.equal(f.writes.length, 0);
  assert.equal((await session.inspect(chosen)).code, 'destroyed');
  assert.equal((await session.start(chosen)).code, 'destroyed'); assert.equal(session.status().phase, 'closed');
});

test('chat, swipe, edited message or epoch changes between inspection and confirmation reject the write', async () => {
  for (const change of [f => f.setChat('B'), f => { f.chats.A.messages[0].swipe_id++; },
    f => { f.chats.A.messages[0].mes = '已修改开场'; }, f => f.host.changed()]) {
    const f = fixture(), gate = gateFirstRead(f.host), session = f.session(authored(), { readContext: gate.readContext });
    const pending = session.start(chosen); change(f); gate.release();
    const result = await pending;
    assert.equal(result.ok, false); assert.equal(result.code, 'context-changed'); assert.equal(f.writes.length, 0);
    assert.deepEqual(f.chats.A.variables[0], f.initial); assert.deepEqual(f.chats.B.variables[0], f.initial);
  }
});

test('new busy state is checked at both confirmation and actual write callback', async () => {
  const first = fixture(); first.setBusy(true);
  assert.equal(first.host.readContext().busy, true);
  assert.equal((await first.session().start(chosen)).code, 'busy'); assert.equal(first.writes.length, 0);
  const second = fixture({ beforeUpdate: () => second.setBusy(true) });
  assert.equal((await second.session().start(chosen)).ok, false); assert.equal(second.writes.length, 0);
  assert.deepEqual(second.chats.A.variables[0], second.initial);
});

test('missing capabilities and unknown busy status preserve preview but refuse mutation', async () => {
  for (const name of ['getContext', 'getLastMessageId', 'getVariables', 'updateVariablesWith', 'busy']) {
    const f = fixture(), deps = { ...f.deps }; delete deps[name];
    const host = createHost(deps), session = create({ manifest: authored(), ...host });
    const model = await session.inspect(chosen);
    assert.equal(model.code, 'capability-unavailable'); assert.match(model.reason, new RegExp(name));
    assert.equal(model.opening.body, authored().identities[0].body);
    assert.equal((await session.start(chosen)).ok, false); assert.equal(f.writes.length, 0);
  }
  const f = fixture(), host = createHost({ ...f.deps, busy: () => undefined });
  assert.equal((await create({ manifest: authored(), ...host }).start(chosen)).code, 'context-unavailable');
  assert.equal(f.writes.length, 0);
});

test('existing chats, groups and another character never receive an opening write', async () => {
  for (const change of [f => f.chats.A.messages.push({ is_user: true, mes: '已经开始' }),
    f => f.setGroup('test-group'), f => f.setAvatar('different-card.png')]) {
    const f = fixture(); change(f);
    assert.equal((await f.session().start(chosen)).ok, false); assert.equal(f.writes.length, 0);
  }
});

