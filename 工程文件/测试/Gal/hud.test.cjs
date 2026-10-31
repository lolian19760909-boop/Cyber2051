'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { read } = require("../../卡片源码/Gal/hud.js");

const values = model => model.fields.map(field => field.value);
const snapshot = stat_data => ({ stat_data });
function from(stat_data, options = {}) {
  return read({ messageId: 4, characterId: 'Saki', getVariables: () => snapshot(stat_data), ...options });
}

test('does not coerce strings, booleans, null, arrays or nonfinite numbers to recorded values', () => {
  for (const invalid of ['', '0', null, undefined, true, false, NaN, Infinity, -Infinity, [0, '说明']]) {
    const model = from({ 丰川祥子: { 好感度: invalid }, terminal: { wallet: { yen: invalid } } });
    assert.deepEqual(values(model), ['未记录', '待更新', '未记录', '未记录']);
  }
});

test('scene character order and legacy relationship values do not change the HUD', () => {
  const scene = { characters: [{ name: '丰川祥子' }] };
  for (const characterId of [undefined, '', '祥子', 'constructor', '__proto__']) {
    const model = from({ 丰川祥子: { 好感度: 100 } }, { scene, characterId });
    assert.deepEqual(model.fields.map(x=>x.label), ['钱包', '委托', '等级 / 成长', 'SAN']);
  }
});

test('legacy affinity for all ten characters is absent from rendered fields and details', () => {
  const names = { Tomorin: '高松灯', Anon: '千早爱音', Soyo: '长崎素世', Taki: '椎名立希', Rana: '要乐奈',
    Saki: '丰川祥子', Uika: '三角初华', Mutsumi: '若叶睦', Umiri: '八幡海铃', Nyamu: '祐天寺若麦' };
  for (const [characterId, name] of Object.entries(names)) {
    const before={ [name]: { 好感度: 349, custom:'保留' } },snapshot=structuredClone(before);
    assert.doesNotMatch(JSON.stringify(from(before, { characterId })),/好感|349/);
    assert.deepEqual(before,snapshot);
  }
});

test('HUD details preserve recorded zero, unknown people and all quest states from that same floor', () => {
  const model = from({ 丰川祥子: { 好感度: 0 }, terminal: { wallet: { yen: 20, earned: 30, spent: 10 },
    quests: { $meta: {}, 'A<test>': { state: '已发布' }, B: { state: '失败' }, C: { state: '搁置' } } } });
  assert.deepEqual(model.details[0].items.map(item => item.value), ['20 日元', '30 日元', '10 日元']);
  assert.equal(model.details.length, 3);
  assert.deepEqual(model.details[1].items.map(item => item.value), ['已发布', '失败', '搁置']);
  assert.equal(model.details[1].items[0].label, 'A<test>');
});
