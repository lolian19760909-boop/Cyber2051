'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const H = require('../../卡片源码/运行时/player-host.js');
const O = require('../../卡片源码/运行时/player-operations.js');

// 2.3.24：MVU 只在「首个聊天初始化完成后」才注册 CHAT_CHANGED 监听。
// 在初始化窗口里新建的聊天永远不会被 MVU 初始化，旧代码只能等 10 秒报错。
// 这里覆盖三条路径：补初始化成功、已初始化不重复补、无 Mvu 接口时报告事实。
function fixture({ initialized = false, timeout = 800 } = {}) {
  const initial = { stat_data: { terminal: { wallet: { yen: 500 } }, 人物: { 好感度: 100 } } };
  const row = {
    mes: '<OpeningForm/>',
    swipe_id: 0,
    swipes: Array.from({ length: 12 }, (_, i) => (i ? '<OpeningPage id="' + i + '"/>' : '<OpeningForm/>')),
    variables: initialized ? Array.from({ length: 12 }, () => structuredClone(initial)) : [{}]
  };
  const ctx = { chat: [row], characters: [{ avatar: 'fixture.png' }], characterId: 0, getCurrentChatId: () => 'A', chatMetadata: { variables: {} }, async saveChat() {} };
  let reloads = 0;
  if (global.Mvu) delete global.Mvu;
  global.Mvu = {
    getCurrentMvuData: () => ({}),
    reloadInitVar: async () => { reloads++; row.variables = row.swipes.map(() => structuredClone(initial)); }
  };
  const api = {
    SillyTavern: { getContext: () => ctx },
    getVariables: () => ctx.chatMetadata.variables,
    builtin: { duringGenerating: () => false },
    async updateVariablesWith(fn) { ctx.chatMetadata.variables = fn(ctx.chatMetadata.variables || {}); },
    async setChatMessages() {},
    eventOn() { return () => {}; }, eventRemoveListener() {}
  };
  const read = H.createReader({ api, readDisk: async () => structuredClone([{ chat_metadata: ctx.chatMetadata }, ...ctx.chat]) });
  global.Cxx236VariableGuard = { validateProgram: (a, b, o) => O.validate(a, b, o.engineOperation) };
  const player = H.create({ api, host: { assertPlayerWritable: async () => {} }, read, operations: O, identities: require('../../卡片源码/运行时/identity.js'), ui: {}, saveTimeout: 100, openingReadyTimeout: timeout });
  return { row, player, reloads: () => reloads, cleanup: () => { player.stop(); delete global.Mvu; } };
}

test('an uninitialized greeting is re-initialized through the MVU public API', async () => {
  const f = fixture();
  try {
    assert.equal(await f.player.prepareOpening(undefined, 1), true);
    assert.equal(f.reloads(), 1, 'MVU 只应被调用一次');
    assert.ok(f.row.variables[1]?.stat_data?.terminal, '补初始化后目标分支应有基础变量');
  } finally { f.cleanup(); }
});

test('an initialized chat never triggers another initvar reload', async () => {
  const f = fixture({ initialized: true });
  try {
    assert.equal(await f.player.prepareOpening(undefined, 2), true);
    assert.equal(f.reloads(), 0, '已有基础变量时不应重放 initvar');
  } finally { f.cleanup(); }
});

test('a missing Mvu interface is reported instead of silently waiting', async () => {
  const f = fixture({ timeout: 300 });
  delete global.Mvu;
  try {
    await assert.rejects(f.player.prepareOpening(undefined, 1), error => {
      assert.match(error.message, /开局状态尚未就绪/);
      assert.match(error.message, /Mvu 接口未加载/);
      assert.match(error.message, /本地状态 未就绪/);
      assert.match(error.message, /补初始化 (guard-missing|mvu-missing|local-failed)/);
      assert.match(error.message, /已初始化分支 0\/1 条/);
      return true;
    });
  } finally { f.cleanup(); }
});

test('without any Mvu interface the card-local guard initialises the opening itself', async () => {
  const f = fixture({ timeout: 800 });
  delete global.Mvu;
  let settled = 0;
  global.Cxx236VariableGuard = {
    validateProgram: (a, b, o) => O.validate(a, b, o.engineOperation),
    localState: () => (settled ? { terminal: { wallet: { yen: 500 } } } : null),
    settle: async () => { settled++; return { ok: true, status: 'applied' }; }
  };
  try {
    assert.equal(await f.player.prepareOpening(undefined, 1), true, '本地结算后应通过开局就绪');
    assert.equal(settled, 1, '无 Mvu 时应调用卡内 settle 补初始化一次');
  } finally { f.cleanup(); }
});
