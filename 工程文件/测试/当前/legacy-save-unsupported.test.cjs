'use strict';
/*! 旧档不接管：MVU 时代的 variables[*].stat_data 当只读，写入前明确报错。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, '卡片源码/运行时/player-host.js'), 'utf8');

test('player-host 里有旧档判定与错误码', () => {
  assert.ok(source.includes('assertNotLegacy236'), '应存在旧档判定函数');
  assert.ok(source.includes("error.code='legacy-save-unsupported'"), '应带 legacy-save-unsupported 错误码');
  assert.ok(source.includes('旧版本存档'), '报错要说人话');
});

test('判定函数按 variables[*].stat_data.terminal 识别旧档', () => {
  assert.ok(source.includes('function legacySave236(row)'), '应存在 legacySave236');
  assert.ok(source.includes('item.stat_data.terminal'), '判定依据是 stat_data.terminal');
});

test('判定只认 stat_data.terminal，空档与空 metadata 不算', () => {
  const legacySave236 = row => {
    const list = Array.isArray(row && row.variables) ? row.variables : [];
    return list.some(item => item && item.stat_data && item.stat_data.terminal);
  };
  assert.equal(legacySave236({ variables: [{}] }), false);
  assert.equal(legacySave236({ variables: [{ stat_data: {} }] }), false);
  assert.equal(legacySave236({ variables: [{ stat_data: { terminal: {} } }] }), true);
  assert.equal(legacySave236({}), false);
});
