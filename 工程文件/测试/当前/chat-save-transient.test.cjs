'use strict';
// 1) 宿主只存内存的元数据字段（chat_id_hash / pick_reroll_seed）不该被判成差异；
// 2) 保存时与 stat_data 完全相同的 display_data 副本要剔除，有差异的必须保留。
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const Guard = require(path.join(process.env.CXX_SAVE_SOURCE_ROOT || path.resolve(__dirname, '../../卡片源码'), '运行时/chat-save-guard.js'));
const copy = v => JSON.parse(JSON.stringify(v));

function acquire({ diskMetadata, memoryMetadata, diskRows }) {
  const rows = diskRows || [{ chat_metadata: copy(diskMetadata) }, { mes: '雨停之前，我们得先决定往哪边走。' }];
  const memory = { messages: copy(rows.slice(1)), metadata: copy(memoryMetadata) };
  const win = {
    location: { href: 'http://127.0.0.1:8000/' },
    navigator: { locks: { request: (_key, _options, fn) => fn() } },
    toastr: { error() {} },
    document: { createElement: () => ({ remove() {}, style: {} }), head: { append() {} } },
    fetch: async () => ({ ok: true, status: 200, text: async () => rows.map(row => JSON.stringify(row)).join('\n'), json: async () => ({}) })
  };
  const api = {
    getCurrentCharacterId: () => '东京都2051 V2.3.24.png',
    SillyTavern: {
      getContext: () => ({
        getCurrentChatId: () => 'story',
        chat: copy(memory.messages),
        chatMetadata: memory.metadata,
        extensionSettings: {},
        getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
        ensureMessageMediaIsArray() {}
      })
    }
  };
  return Guard.acquire({ win, api });
}

async function open(options) {
  const guard = acquire(options);
  try { await guard.reset(); guard.release?.(); return null; } catch (error) { guard.release?.(); return error; }
}

const plain = { integrity: 'one' };
const withHash = { integrity: 'one', chat_id_hash: 128992430727446 };
const withSeed = { integrity: 'one', chat_id_hash: 128992430727446, pick_reroll_seed: 7 };

test('macros 首次用到 {{pick::}} 时算出来的 chat_id_hash 不算内容变化', async () => {
  assert.equal(await open({ diskMetadata: plain, memoryMetadata: withHash }), null);
  assert.equal(await open({ diskMetadata: plain, memoryMetadata: withSeed }), null);
});

test('真实内容差异仍然拒绝', async () => {
  const error = await open({ diskMetadata: plain, memoryMetadata: { integrity: 'two' } });
  assert.equal(error?.code, 'chat-save-conflict');
  assert.ok(error.details.differences.some(x => x.path === '/metadata/integrity'));
});

// 保存瘦身：直接测模块内部的 slimChat，用一个最小桩把 updateScriptTreesWith 之外的接口补齐。
test('保存时剔除与 stat_data 完全相同的 display_data，有差异的保留', () => {
  const stat = { terminal: { wallet: { yen: 120 } } };
  const same = { stat_data: copy(stat), display_data: copy(stat), schema: { type: 'object' } };
  const differ = { stat_data: copy(stat), display_data: { terminal: { wallet: { yen: 999 } } } };
  const rows = [{ chat_metadata: {} }, { mes: 'a', variables: { 0: same } }, { mes: 'b', variables: { 0: differ } }];
  const out = Guard.slimChat(rows);
  assert.notStrictEqual(out, rows, '应产生瘦身后的副本');
  const first = out[1].variables['0'], second = out[2].variables['0'];
  assert.equal(first.display_data, undefined, '完全相同的 display_data 应被剔除');
  assert.deepEqual(first.stat_data, stat, 'stat_data 必须保留');
  assert.deepEqual(first.schema, { type: 'object' }, 'schema 不受影响');
  assert.ok(second.display_data, '有差异的 display_data 必须保留');
  assert.strictEqual(rows[1].variables['0'].display_data !== undefined, true, '原始对象不应被就地修改');
});

test('没有可剔除副本时原样返回同一个数组', () => {
  const rows = [{ chat_metadata: {} }, { mes: 'a', variables: { 0: { stat_data: { a: 1 } } } }];
  assert.strictEqual(Guard.slimChat(rows), rows);
});
