'use strict';
// 回归：换卡后角色变量残留上一实例的 journalName 指针时，
// 镜像记录已属另一实例 —— 本故事的人物写入与续玩导出都不能被永久拦住，
// 本实例真实待恢复的安装仍必须拦住。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../..');
const Core = require(path.join(root, '卡片源码/运行时/core.js'));
const hostSource = fs.readFileSync(path.join(root, '卡片源码/运行时/host.js'), 'utf8');

function indexedDBFixture(record) {
  return { open() {
    const request = {};
    queueMicrotask(() => {
      request.result = { transaction() {
        const tx = { objectStore() { return { get() {
          const r = {};
          queueMicrotask(() => { r.result = record(); r.onsuccess(); queueMicrotask(() => tx.oncomplete()); });
          return r;
        } }; } };
        return tx;
      }, close() {} };
      request.onsuccess();
    });
    return request;
  } };
}

function installer(character, record) {
  const context = { cardId: 'cyber2051', characterKey: 'test.png', chatId: 'chat-a', busy: false };
  const c = { characters: [{ avatar: 'test.png', name: '测试卡' }], characterId: 0, getCurrentChatId: () => 'chat-a', getRequestHeaders: () => ({ 'Content-Type': 'application/json' }) };
  const api = {
    SillyTavern: { getContext: () => c },
    getCurrentCharacterId: () => 'test.png',
    builtin: { duringGenerating: () => false },
    getVariables: ({ type } = {}) => type === 'character' ? JSON.parse(JSON.stringify(character)) : {},
  };
  const sandbox = vm.createContext({ module: { exports: {} }, structuredClone, Date, console, URL, crypto: global.crypto,
    require: createRequire(path.join(root, '卡片源码/运行时/host.js')) });
  vm.runInContext(hostSource, sandbox);
  const host = sandbox.module.exports.create({ api, core: Core, hostOrigin: 'http://localhost', context,
    indexedDB: indexedDBFixture(() => record), locks: { request: async (key, options, fn) => fn({}) },
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ entries: {} }) }) });
  return host;
}

const state = extra => ({ cardId: 'cyber2051', characterKey: 'test.png', instanceId: 'instance-a', ...extra });
const record = (instanceId, name) => ({ status: 'active', instanceId, journalName: name });

test('stale journal pointer from a previous instance no longer blocks player writes', async () => {
  const host = installer({ __cxx_update_state: state({ journalName: 'pending-b' }) }, record('instance-b', 'pending-b'));
  // host.create() opens on a short post-generation quiet window.
  await new Promise(r => setTimeout(r, 2200));
  assert.equal((await host.assertPlayerWritable(host.getContext())).kind, 'other-instance');
  const seen = await host.inspectInstall();
  assert.equal(seen.kind, 'foreign');
  await host.assertNoPendingInstall();
});

test('foreign record without a pointer keeps working and stays reported as foreign', async () => {
  const host = installer({ __cxx_update_state: state({}) }, record('instance-b', 'pending-b'));
  // host.create() opens on a short post-generation quiet window.
  await new Promise(r => setTimeout(r, 2200));
  assert.equal((await host.assertPlayerWritable(host.getContext())).kind, 'other-instance');
  assert.equal((await host.inspectInstall()).kind, 'foreign');
  await host.assertNoPendingInstall();
});

test('a real pending installation of this instance still blocks writes and migration', async () => {
  const host = installer({ __cxx_update_state: state({ journalName: 'pending-a' }) }, record('instance-a', 'pending-a'));
  // host.create() opens on a short post-generation quiet window.
  await new Promise(r => setTimeout(r, 2200));
  await assert.rejects(host.assertPlayerWritable(host.getContext()), error => error.code === 'migration-pending-install');
  await assert.rejects(host.assertNoPendingInstall(), error => error.code === 'migration-pending-install');
  assert.notEqual((await host.inspectInstall()).kind, 'foreign');
});

test('pending registry restore stays blocking even when the mirror record belongs elsewhere', async () => {
  const host = installer({ __cxx_update_state: state({ pendingRegistry: { packages: {} } }) }, record('instance-b', 'pending-b'));
  // host.create() opens on a short post-generation quiet window.
  await new Promise(r => setTimeout(r, 2200));
  await assert.rejects(host.assertPlayerWritable(host.getContext()), error => error.code === 'migration-pending-install');
  await assert.rejects(host.assertNoPendingInstall(), error => error.code === 'migration-pending-install');
});

// 救援文件或旧实例导入可能只带回一个 journalName，镜像记录和世界书日志都不在。
// 没有可恢复内容时，指针既不该挡人物保存，也不该挡续玩导出。
test('a pointer whose journal and mirror row are both gone reports orphan and never blocks', async () => {
  const host = installer({ __cxx_update_state: state({ journalName: 'pending-gone' }) }, null);
  await new Promise(r => setTimeout(r, 2200));
  assert.equal((await host.inspectInstall()).kind, 'orphan');
  assert.equal((await host.assertPlayerWritable(host.getContext())).kind, 'ready');
  await host.assertNoPendingInstall();
});
