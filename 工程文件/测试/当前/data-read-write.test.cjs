'use strict';
/*! 数据读/写适配器的假宿主回归：不连真插件，只验证形状还原、缺依赖报原因、票据幂等。 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const Read = require(path.join(root, '卡片源码/数据/read.js'));
const Write = require(path.join(root, '卡片源码/数据/write.js'));

function fakeStore(tables) {
  const data = {};
  for (const [key, rows] of Object.entries(tables)) data[key] = rows.map(row => ({ ...row }));
  const calls = { refresh: 0, updateCell: [] };
  return {
    calls,
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
      rows.forEach((row, index) => data[key].push({ ...row, row_id: data[key].length + 1 + index }));
      return { ok: true, count: rows.length };
    },
    updateCell(pairs, rowIndex, column, value) {
      calls.updateCell.push([pairs[0][0], rowIndex, column, value]);
      const rows = data[pairs[0][0]] || [];
      const target = rows.find(row => row.row_id === rowIndex);
      if (target) target[column] = value;
      return { ok: true };
    },
    refresh() { calls.refresh += 1; return { ok: true }; },
  };
}

const fixture = {
  cxx_actor: [{ row_id: 1, actor_key: 'wb_118', display_name: '布川奏', role: '公司员工', gender: '女', origin: '赤羽', archetype: '近战', look: '浅蓝', extra_json: '{"nick":"阿奏"}' }],
  cxx_actor_stat: [{ row_id: 1, actor_key: 'wb_118', hp: 80, sanity: 70, fatigue: 5, yen: 4200, extra_json: '{}', updated_turn: 1 }],
  cxx_inventory: [
    { row_id: 1, actor_key: 'wb_118', item_key: 'medkit', display_name: '急救包', count: 2, extra_json: '{}' },
    { row_id: 2, actor_key: 'wb_118', item_key: 'chips', display_name: '芯片', count: 5, extra_json: '{}' },
  ],
  cxx_equipment: [{ row_id: 1, actor_key: 'wb_118', slot: 'weapon', item_key: 'katana', display_name: '太刀', extra_json: '{}' }],
  cxx_item_def: [{ row_id: 1, item_key: 'medkit', extra_json: '{"weight":0.3}' }],
  cxx_fact: [],
  cxx_pending_tx: [],
};

test('读侧把 5 张表还原成 terminal 形状', () => {
  const store = fakeStore(fixture);
  const read = Read.create({ store });
  const snapshot = read.snapshot();
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.empty, false);
  const actor = snapshot.terminal.ensemble.actors.wb_118;
  assert.equal(actor.name, '布川奏');
  assert.deepEqual(actor.stat, [80, 70, 5, 4200]);
  assert.equal(actor.inventory.medkit.count, 2);
  assert.deepEqual(actor.inventory.medkit.definition, { weight: 0.3 });
  assert.equal(actor.equipment.weapon.item, 'katana');
  assert.equal(actor.extra.nick, '阿奏');
});

test('读侧在空表时给出 empty 标记而不是报错', () => {
  const read = Read.create({ store: fakeStore({ cxx_actor: [], cxx_actor_stat: [], cxx_inventory: [], cxx_equipment: [], cxx_item_def: [] }) });
  const snapshot = read.snapshot();
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.empty, true);
  assert.deepEqual(Object.keys(snapshot.terminal.ensemble.actors), []);
});

test('读侧缺仓库时说清原因', () => {
  const read = Read.create({});
  assert.equal(read.snapshot().ok, false);
  assert.match(read.snapshot().reason, /CxxDataStore/);
});

test('写侧第一次落表并标记 applied，第二次同票据算重复', async () => {
  const store = fakeStore(fixture);
  const write = Write.create({ store });
  const first = await write.apply({ receipt: 'cxxr-1', kind: 'fact', turn: 3, fact: { fact_key: 'f-1', kind: '购买', payload: '买了急救包' } });
  assert.equal(first.ok, true);
  assert.equal(first.state, 'applied');
  assert.equal(store.data.cxx_fact.length, 1);
  assert.equal(store.data.cxx_fact[0].payload, '买了急救包');
  assert.equal(store.calls.refresh, 1);
  const second = await write.apply({ receipt: 'cxxr-1', kind: 'fact', turn: 3, fact: { fact_key: 'f-1', kind: '购买', payload: '买了急救包' } });
  assert.equal(second.state, 'duplicate');
  assert.equal(store.data.cxx_fact.length, 1, '重复票据不能再写一行');
});

test('写侧没票据直接拒绝，且不写任何表', async () => {
  const store = fakeStore(fixture);
  const write = Write.create({ store });
  const out = await write.apply({ kind: 'fact', fact: { fact_key: 'f-2' } });
  assert.equal(out.ok, false);
  assert.match(out.reason, /receipt/);
  assert.equal(store.data.cxx_fact.length, 0);
  assert.equal(store.data.cxx_pending_tx.length, 0);
});

test('写侧能查到票据状态', async () => {
  const store = fakeStore(fixture);
  const write = Write.create({ store });
  assert.equal(write.state('cxxr-1').state, null);
  await write.apply({ receipt: 'cxxr-1', turn: 1, fact: { fact_key: 'f-1' } });
  assert.equal(write.state('cxxr-1').state, 'applied');
});

// ── 追加：16 表读回 + 票据 status/state 双写 + 同票据连带写别的表 ──
function wide() {
  return {
    ...fixture,
    cxx_wallet: [{ row_id: 1, scope_key: 'chat', yen: 500, earned: 900, spent: 400, updated_turn: 7 }],
    cxx_roster: [{ row_id: 1, actor_key: 'wb_118', present: 1, last_floor: 5, last_story: '天台', updated_turn: 7 }],
    cxx_scene: [{ row_id: 1, scope_key: 'chat', opening: '{"token":"tk"}', area: 'm_akihabara/p_bar', clock: '2051-03-04 23:10', updated_turn: 7 }],
    cxx_actor_flag: [{ row_id: 1, actor_key: 'wb_118', flag_key: 'drunk', flag_value: 'true', updated_turn: 7 }],
    cxx_effect: [{ row_id: 1, effect_key: 'eff_1', target_key: 'wb_118', magnitude: 2, left_turns: 3, updated_turn: 7 }],
    cxx_pref: [{ row_id: 1, pref_key: 'theme', pref_value: 'dark', updated_turn: 7 }],
    cxx_battle: [{ row_id: 1, battle_key: 'b_1', enemy: '暴徒', hp_left: 12, ammo: 6, updated_turn: 7 }],
    cxx_tactical: [{ row_id: 1, tac_key: 't_1', deploy: '后撤', overclock: 1, order_no: 2, updated_turn: 7 }],
    cxx_quest: [{ row_id: 1, quest_key: 'q_chip_night', owner_key: 'player', state: '进行中', objective: '摸进机房', agree_yen: 5000, paid_yen: 1000, updated_turn: 7 }],
    cxx_quest_meta: [{ row_id: 1, quest_key: 'q_chip_night', rank: '无损交付', known_facts: '门禁六码', refunded_yen: 0, extra_json: '{"deadlineAt":"2051-03-10","settled":false}', updated_turn: 7 }],
    cxx_turn_index: [{ row_id: 1, turn_no: 7, summary: '摸了机房', entities: 'player、wb_118' }],
  };
}

test('读侧把钱包/名册/场景/标记/效果/偏好/战斗/战术/委托/回合表一起还原', () => {
  const read = Read.create({ store: fakeStore(wide()) });
  const snap = read.snapshot();
  assert.equal(snap.ok, true, JSON.stringify(snap));
  assert.deepEqual(snap.terminal.wallet, { id: 'wallet', yen: 500, earned: 900, spent: 400 });
  assert.deepEqual(snap.terminal.roster.present, ['wb_118']);
  assert.equal(snap.terminal.roster.lastSeen.wb_118.story, '天台');
  assert.deepEqual(snap.terminal.opening, { token: 'tk' });
  assert.deepEqual(snap.terminal.gameplay.location, { mapId: 'm_akihabara', placeId: 'p_bar' });
  assert.equal(snap.terminal.clock, '2051-03-04 23:10');
  assert.equal(snap.terminal.ensemble.actors.wb_118.flags.drunk, 'true');
  assert.equal(snap.terminal.effects.eff_1.left_turns, 3);
  assert.equal(snap.terminal.prefs.theme, 'dark');
  assert.equal(snap.terminal.battle.b_1.hp_left, 12);
  assert.equal(snap.terminal.tactical.t_1.overclock, true);
  const quest = snap.terminal.quests.q_chip_night;
  assert.equal(quest.state, '进行中');
  assert.equal(quest.agreedYen, 5000);
  assert.equal(quest.rank, '无损交付');
  assert.equal(quest.deadlineAt, '2051-03-10');
  assert.equal(quest.settled, false);
  assert.equal(snap.terminal.turns[0].entities, 'player、wb_118');
});

test('票据行同时写 status 与 state，两个键都读得到', async () => {
  const store = fakeStore(fixture);
  const write = Write.create({ store });
  await write.apply({ receipt: 'cxxr-9', turn: 3 });
  const row = store.data.cxx_pending_tx[0];
  assert.ok(Object.prototype.hasOwnProperty.call(row, 'status'), '模板列叫 status，必须写');
  assert.ok(Object.prototype.hasOwnProperty.call(row, 'state'), '代码语义叫 state，也要写');
  assert.equal(row.status, 'applied', '标记生效时两列一起改，避免一列 applied 一列 pending');
  assert.equal(row.state, 'applied');
  assert.equal(write.state('cxxr-9').state, 'applied');
});

test('缺少状态更新能力时保留pending，不追加相同唯一tx_key伪造成功', async () => {
  const base = fakeStore(fixture);
  const store = { ...base, updateCell: undefined };
  const write = Write.create({ store });
  const first = await write.apply({ receipt: 'cxxr-7', turn: 2 });
  assert.equal(first.ok, false); assert.equal(first.state, 'pending');
  assert.equal(store.data.cxx_pending_tx.length, 1, 'tx_key唯一，不能追加第二同键');
  const second = await write.apply({ receipt: 'cxxr-7', turn: 2 });
  assert.equal(second.ok, false); assert.equal(second.state, 'pending');
  assert.equal(store.data.cxx_pending_tx.length, 1, '失败重试仍保留同一票据');
});

test('同票据可以连带写别的表（委托 + 钱包）', async () => {
  const store = fakeStore(fixture);
  const write = Write.create({ store });
  const result = await write.apply({
    receipt: 'cxxr-11',
    kind: 'quest',
    turn: 8,
    fact: { fact_key: 'f-11', kind: '委托', payload: '接单' },
    rows: [
      { table: 'cxx_quest', values: { quest_key: 'q_chip_night', owner_key: 'player', state: '已接取', agree_yen: 5000, paid_yen: 0 } },
      { table: 'cxx_wallet', values: { scope_key: 'chat', yen: 500, earned: 900, spent: 400 } },
    ],
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.rows, 2);
  assert.equal(store.data.cxx_quest.length, 1);
  assert.equal(store.data.cxx_quest[0].state, '已接取');
  assert.equal(store.data.cxx_wallet.length, 1);
  assert.equal(store.data.cxx_fact.length, 1);
});

