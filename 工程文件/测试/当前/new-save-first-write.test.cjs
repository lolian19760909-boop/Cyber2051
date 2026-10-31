'use strict';
/*! 新开局的第一次数据库写入必须成功：空表 + 新档 → 票据 applied、cxx_fact 落 1 行。
    旧档拒绝只作用在「表里还没有这份状态」的写入路径上，这里同时锁住那条门的条件，
    避免以后有人把判定放宽或收紧，把自己锁死在空表上。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const Write = require(path.join(root, '卡片源码/数据/write.js'));
const core = fs.readFileSync(path.join(root, '卡片源码/装配/启动脚本/cxx-business-core-241.js'), 'utf8');

function emptyStore() {
  const data = { cxx_fact: [], cxx_pending_tx: [] };
  return {
    data,
    readAll(pairs) {
      const out = {};
      for (const [key, alias] of pairs) out[alias || key] = (data[key] || []).map(row => ({ ...row }));
      return { ok: true, tables: out };
    },
    read(pairs) {
      const rows = {};
      for (const [key] of pairs) rows[key] = (data[key] || []).map(row => ({ ...row }));
      return { ok: true, rows };
    },
    insert(pairs, rowsList) {
      const key = pairs[0][0];
      const rows = rowsList[0] || [];
      if (!data[key]) data[key] = [];
      rows.forEach(row => data[key].push({ ...row, row_id: data[key].length + 1 }));
      return { ok: true, count: rows.length };
    },
    updateCell(pairs, rowIndex, column, value) {
      const target = (data[pairs[0][0]] || []).find(row => row.row_id === rowIndex);
      if (target) target[column] = value;
      return { ok: true };
    },
    refresh() { return { ok: true }; },
  };
}

test('空表 + 新开局首次写入落表并标记 applied', async () => {
  const store = emptyStore();
  const write = Write.create({ store });
  const out = await write.apply({ receipt: 'cxxr-new-1', kind: 'fact', turn: 1, payload: '开局', fact: { fact_key: 'cxxr-new-1', kind: '开局', payload: '开局' } });
  assert.equal(out.ok, true);
  assert.equal(out.state, 'applied');
  assert.equal(store.data.cxx_fact.length, 1, 'cxx_fact 必须落 1 行');
  assert.equal(store.data.cxx_pending_tx.length, 1, 'cxx_pending_tx 必须留 1 行票据');
  assert.equal(store.data.cxx_pending_tx[0].state, 'applied', '票据必须标成 applied');
  assert.equal(write.state('cxxr-new-1').state, 'applied');
});

test('旧档拒绝的门必须同时要求「聊天带旧 stat_data」和「表里没有行」', () => {
  assert.match(core, /function legacyChat236\(\)/, '旧档判定函数要留着，面板与写入共用同一口径');
  assert.match(core, /function legacyRefusal236\(\)/, '拒绝要收在一个函数里，便于门禁与人工核对');
  assert.match(core, /if\(!legacyChat236\(\)\|\|!table\.empty\)return null;/, '空表以外的写入不受旧档判定影响');
  assert.match(core, /state:'legacy-save-unsupported'/, '拒绝要带可读错误码');
  const call = core.indexOf('const legacy=legacyRefusal236();');
  const write = core.indexOf('write236.apply(');
  assert.ok(call > 0 && write > call, '判定必须发生在落表之前');
});

test('空表时新档（没有 stat_data）不会被判成旧档', () => {
  const decide = (chatHasStatData, tableEmpty) => !(!chatHasStatData || !tableEmpty);
  assert.equal(decide(false, true), false, '新档 + 空表：放行，必须能写');
  assert.equal(decide(true, true), true, '旧档 + 空表：拒绝，避免两处各写一份');
  assert.equal(decide(true, false), false, '表里已有状态：按表继续写，不再拒绝');
});
