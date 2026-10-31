'use strict';
const assert = require('assert');
const Cap = require('../../工具/发布/capabilities.cjs');

const loaded = Cap.load();
assert(loaded.required.length > 10, 'capabilities 清单为空');
assert(loaded.forbidden.includes('jsdelivr.net'), '禁止项缺少退役远端依赖');

const ok = Cap.check(loaded.required.map((m) => `x${m}y`).join('\n'));
assert.deepStrictEqual(ok.missing, []);
assert.deepStrictEqual(ok.leaking, []);
assert.strictEqual(ok.ok, true);

const missing = Cap.check('nothing here');
assert(missing.missing.length === loaded.required.length);
assert.strictEqual(missing.ok, false);

const leaking = Cap.check('jsdelivr.net 共享模块 CxxUpdateCore 缺失');
assert.deepStrictEqual(leaking.leaking.sort(), ['jsdelivr.net', '共享模块 CxxUpdateCore 缺失'].sort());

// 真实卡必须满足清单：防止源码改了但清单没跟上时悄悄放过。
const fs = require('fs');
const path = require('path');
const cardFile = path.join(__dirname, '../../.cache/build/东京都2051-V2.3.32.json');
if (fs.existsSync(cardFile)) {
  const card = JSON.parse(fs.readFileSync(cardFile, 'utf8'));
  const scripts = (card?.data?.extensions?.tavern_helper?.scripts || []).map((s) => s.content || s.value || '').join('\n');
  const result = Cap.check(scripts);
  assert.strictEqual(result.ok, true, '成卡缺少清单能力：' + result.missing.join('、'));
}
console.log('capabilities ok');
