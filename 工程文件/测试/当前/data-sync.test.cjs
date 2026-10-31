'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const Sync = require(path.join(root, '卡片源码/数据/sync.js'));
const Rows = require(path.join(root, '卡片源码/数据/rows.js'));

// 假仓库：按逻辑表存数组，行为与 CxxDataStore 一致（read/insert/remove/ensureSchema/refresh）
function fakeStore(failOn) {
  const data = {};
  const calls = { refresh: 0, insert: 0, remove: 0 };
  return {
    data,
    calls,
    async ensureSchema() { return { ok: true }; },
    async refresh() { calls.refresh += 1; return { ok: true }; },
    async read(table) {
      if (failOn === table) return { ok: false, reason: '表不存在' };
      const rows = data[table] || [];
      return { ok: true, rows: rows.map((cells, index) => ({ index, cells })) };
    },
    async insert(table, row) {
      calls.insert += 1;
      data[table] = data[table] || [];
      data[table].push([String(data[table].length + 1), ...Object.values(row).map(value => (value == null ? '' : String(value)))]);
      return { ok: true };
    },
    async remove(table, index) {
      calls.remove += 1;
      data[table].splice(index, 1);
      return { ok: true };
    },
  };
}

const terminal = () => ({
  ensemble: {
    actors: {
      player: {
        actorId: 'player', name: '玩家', controllable: true,
        wallet: { yen: 500 },
        gameplay: {
          numeric: { hp: 60, fatigue: 5 }, sanity: 77,
          inventory: { medkit: { quantity: 2 } },
          equipment: { slot_a: { itemId: 'npc_face', definitionRef: { id: 'npc_face', part: 'face' } } },
          itemDefinitions: { medkit: { name: '急救包', category: 'consumable' }, npc_face: { name: '义眼', category: 'cyberware' } },
        },
      },
    },
  },
});

test('push 把五张表整表写进去并刷新一次', async () => {
  const store = fakeStore();
  const sync = Sync.create({ store, rows: Rows });
  const result = await sync.push(terminal(), 4);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(result.results.map(item => item.table), Sync.TABLES);
  assert.deepEqual(sync.status().counts, {
    cxx_actor: 1, cxx_actor_stat: 1, cxx_inventory: 1, cxx_equipment: 1, cxx_item_def: 2,
  });
  assert.equal(sync.status().turn, 4);
  assert.equal(store.calls.refresh, 1);
});

test('重复 push 是替换不是追加', async () => {
  const store = fakeStore();
  const sync = Sync.create({ store, rows: Rows });
  await sync.push(terminal(), 4);
  await sync.push(terminal(), 5);
  assert.equal(store.data.cxx_actor.length, 1);
  assert.equal(store.data.cxx_item_def.length, 2);
  assert.equal(store.calls.remove, 6, '第一轮写进去的 6 行被删掉（角色/数值/背包/装备各 1，物品定义 2）');
});

test('任一表读不到就整体报失败并带上表名', async () => {
  const store = fakeStore('cxx_equipment');
  const sync = Sync.create({ store, rows: Rows });
  const result = await sync.push(terminal(), 2);
  assert.equal(result.ok, false);
  assert.match(result.reason, /cxx_equipment/);
  assert.equal(sync.status().turn, -1, '失败不更新状态');
});

test('pull 从表读回 terminal 形状', async () => {
  const store = fakeStore();
  const sync = Sync.create({ store, rows: Rows });
  await sync.push(terminal(), 1);
  const pulled = await sync.pull();
  assert.equal(pulled.ok, true, pulled.reason);
  assert.deepEqual(Object.keys(pulled.terminal.ensemble.actors), ['player']);
  const player = pulled.terminal.ensemble.actors.player;
  assert.equal(player.name, '玩家');
  assert.equal(player.controllable, true);
  assert.equal(player.gameplay.numeric.hp, 60);
  assert.equal(player.gameplay.sanity, 77);
  assert.equal(player.gameplay.inventory[0].item_key, 'medkit');
  assert.equal(player.gameplay.equipment[0].slot, 'slot_a');
  assert.equal(player.wallet.yen, 500);
  assert.equal(pulled.definitions, 2);
});

test('缺依赖时给出可读原因', () => {
  assert.throws(() => Sync.create({ rows: Rows }), /CxxDataStore/);
  assert.throws(() => Sync.create({ store: fakeStore() }), /CxxDataRows/);
});

// ── 追加：整库 16 表镜像（pushAll / pullAll） ──
function full() {
  return {
    wallet: { yen: 500, earned: 900, spent: 400 },
    roster: { present: ['player'], lastSeen: { player: { floor: 7, story: '雨夜' }, wb_118: { floor: 5, story: '天台' } } },
    opening: { schemaVersion: 1, token: 'tk' },
    gameplay: { location: { mapId: 'm_akihabara', placeId: 'p_bar' } },
    clock: '2051-03-04 23:10',
    flags: { player: { drunk: true } },
    effects: { eff_1: { target: 'player', magnitude: 2, left_turns: 3 } },
    prefs: { theme: 'dark' },
    battle: { b_1: { enemy: '暴徒', hp_left: 12, ammo: 6 } },
    tactical: { t_1: { deploy: '后撤', overclock: true, order_no: 2 } },
    quests: { q_chip_night: { ownerActorId: 'player', state: '进行中', objective: '摸进机房', agreedYen: 5000, paidYen: 1000, rank: '无损交付', knownFacts: '门禁六码', deadlineAt: '2051-03-10' } },
    turns: [{ turn_no: 7, summary: '摸了机房', entities: ['player'] }],
    ensemble: {
      actors: {
        player: { actorId: 'player', name: '玩家', controllable: true, wallet: { yen: 900, earned: 900, spent: 0 }, gameplay: { numeric: { hp: 55, fatigue: 5 }, sanity: 88 } },
      },
    },
  };
}

test('pushAll 把 16 张状态表写进去，台账表不碰', async () => {
  const store = fakeStore();
  const sync = Sync.create({ store, rows: Rows });
  const result = await sync.pushAll(full(), 7);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.results.map(item => item.table), Sync.MIRROR_TABLES);
  assert.ok(!Sync.MIRROR_TABLES.includes('cxx_fact'), '事实流水不参与整表替换');
  assert.ok(!Sync.MIRROR_TABLES.includes('cxx_pending_tx'), '票据台账不参与整表替换');
  const counts = sync.status().counts;
  assert.equal(counts.cxx_wallet, 2);
  assert.equal(counts.cxx_roster, 2);
  assert.equal(counts.cxx_scene, 1);
  assert.equal(counts.cxx_quest, 1);
  assert.equal(counts.cxx_quest_meta, 1);
  assert.equal(counts.cxx_turn_index, 1);
  assert.equal(store.calls.refresh, 1);
});

test('pullAll 把 16 张表读回 terminal 形状', async () => {
  const store = fakeStore();
  const sync = Sync.create({ store, rows: Rows });
  await sync.pushAll(full(), 7);
  const back = await sync.pullAll();
  assert.equal(back.ok, true, JSON.stringify(back));
  assert.deepEqual(back.terminal.wallet, { id: 'wallet', yen: 500, earned: 900, spent: 400 });
  assert.deepEqual(back.terminal.roster.present, ['player']);
  assert.equal(back.terminal.roster.lastSeen.wb_118.story, '天台');
  assert.deepEqual(back.terminal.opening, { schemaVersion: 1, token: 'tk' });
  assert.deepEqual(back.terminal.gameplay.location, { mapId: 'm_akihabara', placeId: 'p_bar' });
  assert.equal(back.terminal.effects.eff_1.magnitude, 2);
  assert.equal(back.terminal.prefs.theme, 'dark');
  assert.equal(back.terminal.battle.b_1.enemy, '暴徒');
  assert.equal(back.terminal.tactical.t_1.overclock, true);
  const quest = back.terminal.quests.q_chip_night;
  assert.equal(quest.state, '进行中');
  assert.equal(quest.objective, '摸进机房');
  assert.equal(quest.agreedYen, 5000);
  assert.equal(quest.rank, '无损交付');
  assert.equal(quest.deadlineAt, '2051-03-10');
  assert.equal(back.terminal.turns[0].turn_no, 7);
  assert.equal(back.actors, 1);
});

test('pullAll 缺表时整体报失败并带表名', async () => {
  const store = fakeStore('cxx_quest');
  const sync = Sync.create({ store, rows: Rows });
  const back = await sync.pullAll();
  assert.equal(back.ok, false);
  assert.match(back.reason, /cxx_quest/);
});

test('公开批量ACK提交16镜像，拒绝不退回逐行且不更新成功游标', async () => {
  const store = fakeStore(); let calls = 0, refuse = false;
  store.replaceTables = async (projected, tables, options) => {
    calls++; options.assertCurrent(); assert.deepEqual(tables, Sync.MIRROR_TABLES);
    if (refuse) return { ok: false, reason: '真实批量ACK拒绝' };
    return { ok: true, refreshed: true, results: tables.map(table => ({ table, ok: true, rows: projected[table].length })) };
  };
  const sync = Sync.create({ store, rows: Rows });
  assert.equal((await sync.pushAll(full(), 7, { assertCurrent() {} })).ok, true);
  assert.equal(calls, 1); assert.equal(store.calls.insert, 0); assert.equal(store.calls.remove, 0); assert.equal(store.calls.refresh, 0);
  refuse = true;
  const refused = await sync.pushAll(full(), 8, { assertCurrent() {} });
  assert.equal(refused.ok, false); assert.match(refused.reason, /ACK拒绝/); assert.equal(sync.status().turn, 7);
  assert.equal(store.calls.insert, 0);
});

