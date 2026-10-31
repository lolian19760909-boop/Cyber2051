'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Compact = require('../../配套扩展/tavern-runtime-suite/context/core/compact.js');
const Requests = require('../../配套扩展/tavern-runtime-suite/context/core/requests.js');

function frame() {
  const parent = {};
  const context = vm.createContext({ parent });
  for (const file of ['context-requests.js', 'context-compact.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../卡片源码/运行时', file), 'utf8'), context);
  }
  return { parent, context };
}

test('card boots without a suite and resumes after its common core becomes available', async () => {
  const { parent, context } = frame();
  const state = { schema: 1, revision: 0, enabled: false, compactions: [], receipts: [] };
  const original = [{ mes: '保留原文' }];
  const service = context.CxxContextCompact.create({
    source: { capture: () => ({ scope: { chat: 'fixture' } }), validSource: () => true },
    store: { read: () => structuredClone(state), update: async fn => fn(state) },
    requests: { run: () => assert.fail('Disabled compaction must not call a model') },
    countTokens: async value => value.length,
    project: async () => ({ rows: [], nativeRows: original, actorId: 'player', contextSize: 32000, outputTokens: 2000 })
  });
  assert.equal(service.status().busy, false);
  assert.match(service.status().error, /Tavern Runtime Suite/);
  assert.equal(service.records().length, 0);
  assert.throws(() => service.before({}), /Tavern Runtime Suite/);
  parent.TavernContext = { core: { Compact, Requests } };
  const result = await service.before({});
  assert.deepEqual(result.rows, original);
  assert.equal(service.status().error, '');
  assert.equal(state.compactions.length, 0);
});

test('an iframe request service disposed before suite activation cannot restart later', () => {
  const { parent, context } = frame();
  const service = context.CxxContextRequests.create({});
  assert.equal(service.status().pending, 0);
  assert.throws(() => service.run({ purpose: 'compact' }), /Tavern Runtime Suite/);
  service.destroy();
  parent.TavernContext = { core: { Compact, Requests } };
  assert.throws(() => service.run({ purpose: 'compact' }), /已关闭/);
  assert.equal(service.status().pending, 0);
});
