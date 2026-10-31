'use strict';
// 旧版续玩导出小工具：产出的文件必须能被卡内 Backup.parse 接受
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, randomUUID } = require('node:crypto');
const Core = require('../../卡片源码/运行时/core.js');
const Backup = require('../../卡片源码/运行时/backup.js');

const here = path.resolve(__dirname);
const engine = path.resolve(here, '../..');
const toolPath = path.join(engine, '工具/旧版续玩导出/旧版续玩导出.html');

function tool() {
  const html = fs.readFileSync(toolPath, 'utf8');
  const start = html.indexOf('<script>') + '<script>'.length;
  const end = html.indexOf('</script>', start);
  const source = html.slice(start, end);
  const sandbox = { TextEncoder, console, crypto: { subtle: webcrypto.subtle } };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: '旧版续玩导出.html' });
  return sandbox.CxxLegacySave;
}

function client() {
  const host = {
    getContext: () => ({ cardId: 'cyber2051', characterKey: '东京都2051 V2.3.18.png', chatId: 'chat', busy: false }),
    readState: () => ({}),
    async withLock(work) { return work(); },
    assertContext() {},
    ready: async () => {},
  };
  return Backup.create({ core: Core, host, adapters: {}, crypto: { subtle: webcrypto.subtle, randomUUID }, wait: async () => {} });
}

function sample({ statData = true, metadata = true } = {}) {
  const header = { user_name: '玩家', character_name: '丰川祥子', chat_metadata: metadata ? { variables: { playerMemo: 'keep', __cxx_content_pins: { story: '1.0.0' } } } : null, unknownHeader: { keep: 'header' } };
  const branch = (yen) => ({ schema: { type: 'object', properties: {} }, stat_data: statData ? { terminal: { wallet: { yen } }, affection: 400 } : undefined, display_data: { yen } });
  const rows = [
    header,
    { name: '玩家', is_user: true, mes: '整理一下今天的账。', variables: [branch(0)] },
    { name: '丰川祥子', is_user: false, mes: '先把欠条收好。', swipes: ['先把欠条收好。', '先回家。'], swipe_id: 0, variables: [branch(12345), branch(999)] },
  ];
  return rows.map((row) => JSON.stringify(row)).join('\n');
}

test('tool produces a progress backup the card accepts, with the chosen branch', async () => {
  const api = tool();
  const text = sample();
  const parsed = api.readExport(text);
  assert.equal(parsed.messages.length, 2);
  const list = api.candidates(parsed);
  assert.equal(list.length, 3);
  assert.equal(JSON.stringify(list.map((item) => [item.floor, item.swipe])), '[[0,0],[1,0],[1,1]]');

  const out = await api.build({ text, cardName: '东京都2051 V2.3.18', subtle: webcrypto.subtle, now: Date.UTC(2026, 9, 24, 12) });
  assert.equal(out.doc.format, 1);
  assert.equal(out.doc.type, 'cyber2051.local-backup');
  assert.equal(out.doc.kind, 'progress');
  assert.equal(out.doc.context.cardId, 'cyber2051');
  assert.equal(out.doc.context.characterKey, '东京都2051 V2.3.18.png');
  assert.equal(out.doc.payload.floor, 1);
  // 默认取“最后一层里 swipe_id 指向的那条分支”（样本为 0）
  assert.equal(out.doc.payload.swipe, 0);
  assert.equal(out.doc.payload.variables.stat_data.terminal.wallet.yen, 12345);
  assert.equal(JSON.stringify(out.doc.payload.header.chat_metadata), JSON.stringify(parsed.header.chat_metadata));
  assert.equal(JSON.stringify(out.doc.payload.updateState.registry.packages), '{}');

  const unsigned = JSON.parse(JSON.stringify(out.doc));
  const digest = unsigned.sha256;
  delete unsigned.sha256;
  assert.equal(digest, await Core.sha256(unsigned));

  const accepted = await client().parse(out.text);
  assert.equal(JSON.stringify(accepted), JSON.stringify(out.doc));
});

test('the chosen branch is what gets exported, not always the last one', async () => {
  const api = tool();
  const text = sample();
  const list = api.candidates(api.readExport(text));
  const out = await api.build({ text, branch: list[1], cardName: '东京都2051 V2.3.18', subtle: webcrypto.subtle });
  assert.equal(out.doc.payload.swipe, 0);
  const second = await api.build({ text, branch: list[2], cardName: '东京都2051 V2.3.18', subtle: webcrypto.subtle });
  assert.equal(second.doc.payload.floor, 1);
  assert.equal(second.doc.payload.swipe, 1);
  assert.equal(second.doc.payload.variables.stat_data.terminal.wallet.yen, 999);
  await client().parse(second.text);
});

test('a chat without MVU variables says so instead of inventing data', async () => {
  const api = tool();
  const text = sample({ statData: false });
  const parsed = api.readExport(text);
  assert.equal(api.candidates(parsed).length, 0);
  await assert.rejects(api.build({ text, cardName: '东京都2051 V2.3.18', subtle: webcrypto.subtle }), /没有任何一层带 MVU 变量/);
});

test('a file that is not a raw chat export is refused with a readable reason', () => {
  const api = tool();
  assert.throws(() => api.readExport('{"spec":"chara_card_v2","data":{}}'), /chat_metadata|原始聊天/);
  assert.throws(() => api.readExport(''), /是空的/);
  assert.throws(() => api.readExport('not json'), /第一行/);
});

test('a single-object variable table (older shape) is treated as one branch', async () => {
  const api = tool();
  const header = JSON.stringify({ user_name: '玩家', chat_metadata: { variables: {} } });
  const row = JSON.stringify({ name: '丰川祥子', mes: '旧格式。', variables: { stat_data: { terminal: { wallet: { yen: 7 } } } } });
  const parsed = api.readExport([header, row].join('\n'));
  const list = api.candidates(parsed);
  assert.equal(JSON.stringify(list.map((item) => [item.floor, item.swipe])), '[[0,0]]');
  const out = await api.build({ text: [header, row].join('\n'), cardName: '东京都2051 V2.3.18', subtle: webcrypto.subtle });
  assert.equal(out.doc.payload.variables.stat_data.terminal.wallet.yen, 7);
  await client().parse(out.text);
});
