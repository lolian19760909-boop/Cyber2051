'use strict';
// 载入比对必须放行“内存里多出来的空扩展命名空间”，同时继续拒绝真实内容差异。
// 生产路径是 Guard.acquire（create() 的默认 normalize 是恒等函数，测不到白名单）。
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const Guard = require(path.join(process.env.CXX_SAVE_SOURCE_ROOT || path.resolve(__dirname, '../../卡片源码'), '运行时/chat-save-guard.js'));
const copy = v => JSON.parse(JSON.stringify(v));

function acquire({ diskMetadata, memoryMetadata }) {
  const diskRows = [{ chat_metadata: copy(diskMetadata) }, { mes: '雨停之前，我们得先决定往哪边走。' }];
  const memory = { messages: copy(diskRows.slice(1)), metadata: copy(memoryMetadata) };
  const win = {
    location: { href: 'http://127.0.0.1:8000/' },
    navigator: { locks: { request: (_key, _options, fn) => fn() } },
    toastr: { error() {} },
    document: { createElement: () => ({ remove() {}, style: {} }), head: { append() {} } },
    fetch: async () => ({ ok: true, status: 200, text: async () => diskRows.map(row => JSON.stringify(row)).join('\n'), json: async () => ({}) })
  };
  const api = {
    getCurrentCharacterId: () => '东京都2051 V2.3.15.png',
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
const shell = { integrity: 'one', extensions: { LittleWhiteBox: { storySummary: {} } } };
const content = { integrity: 'one', extensions: { LittleWhiteBox: { storySummary: { enabled: true, turns: [1, 2] } } } };

test('an empty extension namespace created after load is not a content change', async () => {
  assert.equal(await open({ diskMetadata: plain, memoryMetadata: shell }), null);
});
test('matching metadata on both sides still loads', async () => {
  assert.equal(await open({ diskMetadata: plain, memoryMetadata: plain }), null);
  assert.equal(await open({ diskMetadata: shell, memoryMetadata: shell }), null);
});
test('a namespace carrying real data still refuses the load', async () => {
  for (const options of [{ diskMetadata: plain, memoryMetadata: content }, { diskMetadata: shell, memoryMetadata: content }]) {
    const error = await open(options);
    assert.equal(error?.code, 'chat-save-conflict');
    assert.equal(error?.details?.phase, 'load');
    assert.ok(error.details.differences.some(x => x.path.startsWith('/metadata/extensions')));
  }
});
test('a removed namespace on the memory side is still a conflict', async () => {
  const error = await open({ diskMetadata: content, memoryMetadata: plain });
  assert.equal(error?.code, 'chat-save-conflict');
  assert.ok(error.details.differences.some(x => x.path === '/metadata/extensions'));
});
