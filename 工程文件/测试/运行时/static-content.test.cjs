'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Packages = require("../../工具/发布/packages.cjs");
const Core = require("../../卡片源码/运行时/core.js");
const { privateKey } = require('node:crypto').generateKeyPairSync('ed25519'); // 测试内存钥，不写盘。
const runtimeCheck = value => Core.validatePackage(Packages.signDocument(value, privateKey, 'test-only'));
const quest = () => ({ id: 'ugc.contract.1.01', title: '红花街遗失物', fixer: '收件人', district: '红花街', type: '委托', difficulty: '低', brief: '寻找包裹。', goal: '确认收件人。', pay: 2000, track: 'side' });
const pack = () => ({ format: 3, cardId: 'cyber2051', id: 'community.contract.1', version: '1.0.1', kind: 'content', optional: true, activation: 'opt_in', requires: { engine: '1.0.0', packages: [] }, content: { quests: [quest()], gallery: [], worldbook: [] } });
test('quest-to-worldbook path refuses template and script syntax in every consumed text field', () => {
  for (const field of ['title', 'fixer', 'district', 'type', 'difficulty', 'brief', 'goal', 'fixerNote', 'payNote', 'deadline', 'terms', 'risk', 'bonus', 'unlock']) {
    for (const value of ['<%= testOnlyNoExecution %>', '<ScRiPt>testOnlyNoExecution</script>']) {
      const valuePack = pack(); valuePack.content.quests[0][field] = value;
      assert.throws(() => Packages.validatePackage(valuePack), /静态文本/);
      assert.throws(() => runtimeCheck(valuePack), /静态文本/);
    }
  }
});
test('ordinary static story text remains usable without changing the content record', () => {
  const value = pack(), before = JSON.stringify(value);
  Packages.validatePackage(value); runtimeCheck(value);
  assert.equal(JSON.stringify(value), before);
});
test('selective worldbook names and trigger words have the same static boundary', () => {
  for (const field of ['name', 'key', 'secondaryKey']) {
    const value = pack(), entry = { uid: 900001, name: '投稿资料', content: '只读资料。', enabled: true, strategy: { type: 'selective', keys: ['投稿资料'], keys_secondary: { logic: 'and_any', keys: [] } }, position: {}, effect: {}, recursion: {} };
    if (field === 'name') entry.name = '<% noExecution %>';
    if (field === 'key') entry.strategy.keys = ['<% noExecution %>'];
    if (field === 'secondaryKey') entry.strategy.keys_secondary.keys = ['<% noExecution %>'];
    value.content.worldbook.push(entry);
    assert.throws(() => Packages.validatePackage(value), /静态文本/);
    assert.throws(() => runtimeCheck(value), /静态文本/);
  }
});
