'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const Rows = require(path.join(root, '卡片源码/数据/rows.js'));

function terminal() {
  return {
    wallet: { id: 'wallet', yen: 120 },
    quests: {},
    roster: { schema: 1, present: ['player', 'wb_118'] },
    ensemble: {
      actors: {
        player: {
          actorId: 'player', name: '玩家', controllable: true,
          wallet: { yen: 900 },
          gameplay: {
            schema: 1,
            numeric: { hp: 55, fatigue: 12, attack: 7 },
            sanity: 88,
            inventory: { medkit: { quantity: 2, quality: 'fine' } },
            equipment: { cyber_face_1: { itemId: 'npc_face', definitionRef: { id: 'npc_face', part: 'face' } } },
            itemDefinitions: {
              npc_face: { name: '义眼', category: 'cyberware', price: 3000, description: '高精度微距光学义眼', numericEffects: [{ text: '夜间可视' }] },
              medkit: { name: '急救包', category: 'consumable', price: 120 },
            },
          },
        },
        wb_118: {
          actorId: 'wb_118', name: '牛込里美', controllable: false, worldbookUid: 118,
          gameplay: {
            schema: 1,
            numeric: { hp: 80 },
            inventory: { npc_118_face: { quantity: 1 } },
            equipment: {},
            itemDefinitions: { npc_118_face: { name: '牛込里美·档案视觉装配', category: 'cyberware' } },
          },
        },
      },
    },
  };
}

test('角色档案表：每个 actor 一行，可操作角色算主角', () => {
  const rows = Rows.actorRows(terminal(), 3);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.actor_key), ['player', 'wb_118']);
  assert.equal(rows[0].kind, '主角');
  assert.equal(rows[1].kind, '中立');
  assert.equal(rows[0].status, '未知');
  assert.equal(rows[1].updated_turn, 3);
});

test('数值表：hp/理智/疲劳/金钱落到列上，其余进 extra_json', () => {
  const rows = Rows.statRows(terminal(), 3);
  const player = rows.find(r => r.actor_key === 'player');
  assert.equal(player.hp, 55);
  assert.equal(player.sanity, 88);
  assert.equal(player.fatigue, 12);
  assert.equal(player.yen, 900);
  assert.deepEqual(JSON.parse(player.extra_json), { attack: 7 });
  const npc = rows.find(r => r.actor_key === 'wb_118');
  assert.equal(npc.yen, 120, '没钱包的角色回落到全局钱包');
  assert.equal(npc.extra_json, null);
});

test('背包表：definitionRef.id 优先于槽位键，数量至少 1，品质按枚举归一', () => {
  const rows = Rows.inventoryRows(terminal(), 5);
  assert.equal(rows.length, 2);
  const med = rows.find(r => r.actor_key === 'player');
  assert.equal(med.item_key, 'medkit');
  assert.equal(med.count, 2);
  assert.equal(med.quality, '精良');
  assert.equal(med.note, null);
  assert.equal(rows.find(r => r.actor_key === 'wb_118').count, 1);
});

test('装备表：保留真实槽键，itemId 优先', () => {
  const rows = Rows.equipmentRows(terminal(), 6);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actor_key, 'player');
  assert.equal(rows[0].slot, 'cyber_face_1');
  assert.equal(rows[0].item_key, 'npc_face');
  assert.equal(rows[0].installed, 1);
});

test('实际卸装产生null空槽，投影不造装备且保留其余槽位', async () => {
  const {cardModule,cardRuleChain}=await import('../../网页独立版/src/reuse/card.mjs');
  const {createRulesEngine}=await import('../../网页独立版/src/rules/engine.mjs');
  const identity=cardModule('运行时/identity.js'),setup=identity.snapshot('street','',identity.initialSetup('street'));
  setup.setupToken='data-rows-unequip';
  const state=cardModule('运行时/player-operations.js').plan(createRulesEngine({chain:cardRuleChain()}).emptyRoot(),{action:'initialize'},{identity:setup,newChat:true});
  const before=Rows.equipmentRows(state.terminal,1),actor=state.terminal.ensemble.actors.wb_4;
  assert.ok(actor.gameplay.equipment.weapon_1);
  actor.gameplay=cardModule('运行时/loadout.js').applyEvents(actor.gameplay,[{id:'data_rows_unequip',kind:'item-unequip',slot:'weapon_1',reason:'本轮已卸下武器'}]);
  assert.equal(actor.gameplay.equipment.weapon_1,null);
  const after=Rows.equipmentRows(state.terminal,1);
  assert.deepEqual(after,before.filter(row=>!(row.actor_key==='wb_4'&&row.slot==='weapon_1')));
});

test('物品定义表：跨角色去重，类别归一，效果取第一条摘要', () => {
  const rows = Rows.itemDefRows(terminal());
  const keys = rows.map(r => r.item_key);
  assert.deepEqual(keys.sort(), ['medkit', 'npc_118_face', 'npc_face']);
  const face = rows.find(r => r.item_key === 'npc_face');
  assert.equal(face.category, '义体');
  assert.equal(face.effect, '夜间可视');
  assert.equal(face.price, 3000);
  assert.ok(face.note.length <= 120);
});

test('project 一次给出五张表的行数与事实行形状', () => {
  const projected = Rows.project(terminal(), 7);
  assert.deepEqual(Rows.counts(projected), {
    cxx_actor: 2, cxx_actor_stat: 2, cxx_inventory: 2, cxx_equipment: 1, cxx_item_def: 3,
  });
  const fact = Rows.factRow(terminal(), 7, '其他', { x: 1 }, 'f7');
  assert.equal(fact.fact_key, 'f7');
  assert.equal(fact.turn_no, 7);
  assert.equal(fact.payload, '{"x":1}');
});

// ── 追加：其余状态表的行映射（整库 17 张可读表，pending_tx 由 write.js 独占） ──
function rich() {
  return {
    wallet: { yen: 500, earned: 900, spent: 400 },
    roster: { present: ['player'], lastSeen: { player: { floor: 7, story: '雨夜' }, wb_118: { floor: 5, story: '天台' } } },
    opening: { schemaVersion: 1, token: 'tk' },
    gameplay: { location: { mapId: 'm_akihabara', placeId: 'p_bar' } },
    clock: '2051-03-04 23:10',
    flags: { player: { drunk: true, alias: '小祥' } },
    effects: { eff_1: { target: 'player', magnitude: 2, left_turns: 3 } },
    prefs: { theme: 'dark', font: 'lg' },
    battle: { b_1: { enemy: '暴徒', hp_left: 12, ammo: 6 } },
    tactical: { t_1: { deploy: '后撤', overclock: true, order_no: 2 } },
    quests: {
      q_chip_night: {
        ownerActorId: 'player', state: '进行中', objective: '摸进机房', agreedYen: 5000, paidYen: 1000,
        rank: '无损交付', knownFacts: '门禁六码', refundedYen: 0, settled: false, deadlineAt: '2051-03-10', chapter: 'q1',
      },
    },
    turns: [{ turn_no: 7, summary: '摸了机房', entities: ['player', 'wb_118'] }],
    ensemble: {
      actors: {
        player: {
          actorId: 'player', name: '玩家', controllable: true,
          flags: { marked: 1 },
          wallet: { yen: 900, earned: 900, spent: 0 },
          gameplay: { numeric: { hp: 55, conditions: { bleed: { magnitude: 1, turns: 2 } } }, sanity: 88 },
        },
      },
    },
  };
}

test('projectAll 给出 17 张可读表的行数组，pending_tx 不在里面', () => {
  const all = Rows.projectAll(rich(), 5);
  assert.deepEqual(Object.keys(all).sort(), Rows.FULL_TABLES.slice().sort());
  assert.equal(all.cxx_fact.length, 0, '事实流水要由写入方显式传入');
  assert.deepEqual(Rows.projectAll(rich(), 5, { facts: [{ fact_key: 'f1' }] }).cxx_fact, [{ fact_key: 'f1' }]);
  assert.equal(all.cxx_actor.length, 1);
  assert.equal(all.cxx_actor[0].updated_turn, 5);
});

test('钱包表同时给 chat 行和人物行，scope_key 分开', () => {
  const rows = Rows.walletRows(rich(), 5);
  assert.deepEqual(rows.map(row => row.scope_key).sort(), ['chat', 'player']);
  const chat = rows.find(row => row.scope_key === 'chat');
  assert.equal(chat.yen, 500);
  assert.equal(chat.earned, 900);
  assert.equal(chat.spent, 400);
  assert.equal(rows.find(row => row.scope_key === 'player').yen, 900);
  assert.equal(Rows.walletRows({}, 1).length, 0, '没有钱包就不写行');
});

test('名册表按 present 与 lastSeen 的并集出行', () => {
  const rows = Rows.rosterRows(rich(), 5);
  assert.deepEqual(rows.map(row => row.actor_key).sort(), ['player', 'wb_118']);
  assert.equal(rows.find(row => row.actor_key === 'player').present, 1);
  const npc = rows.find(row => row.actor_key === 'wb_118');
  assert.equal(npc.present, 0);
  assert.equal(npc.last_floor, 5);
  assert.equal(npc.last_story, '天台');
});

test('场景表把 opening、地点与故事时间收进 chat 一行', () => {
  const rows = Rows.sceneRows(rich(), 5);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].scope_key, 'chat');
  assert.deepEqual(JSON.parse(rows[0].opening), { schemaVersion: 1, token: 'tk' });
  assert.equal(rows[0].area, 'm_akihabara/p_bar');
  assert.equal(rows[0].clock, '2051-03-04 23:10');
  assert.equal(Rows.sceneRows({ ensemble: { actors: {} } }, 1).length, 0, '空场景不写行');
});

test('标记表合并容器标记与人物自有标记', () => {
  const rows = Rows.flagRows(rich(), 5);
  assert.deepEqual(rows.map(row => row.actor_key + ':' + row.flag_key).sort(), ['player:alias', 'player:drunk', 'player:marked']);
  assert.equal(rows.find(row => row.flag_key === 'drunk').flag_value, 'true');
  assert.equal(rows.find(row => row.flag_key === 'marked').flag_value, '1');
});

test('效果/偏好/战斗/战术优先读容器', () => {
  assert.deepEqual(Rows.effectRows(rich(), 5)[0], { effect_key: 'eff_1', target_key: 'player', magnitude: 2, left_turns: 3, updated_turn: 5 });
  assert.deepEqual(Rows.prefRows(rich(), 5).map(row => row.pref_key).sort(), ['font', 'theme']);
  assert.equal(Rows.prefRows(rich(), 5).find(row => row.pref_key === 'theme').pref_value, 'dark');
  assert.deepEqual(Rows.battleRows(rich(), 5)[0], { battle_key: 'b_1', enemy: '暴徒', hp_left: 12, ammo: 6, updated_turn: 5 });
  assert.equal(Rows.tacticalRows(rich(), 5)[0].overclock, 1);
  assert.equal(Rows.tacticalRows(rich(), 5)[0].order_no, 2);
});

test('效果表在没有容器时从人物 gameplay 派生', () => {
  const bare = { ensemble: { actors: { player: { actorId: 'player', gameplay: { numeric: { conditions: { bleed: { magnitude: 1, turns: 2 } } } } } } } };
  const rows = Rows.effectRows(bare, 3);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { effect_key: 'bleed', target_key: 'player', magnitude: 1, left_turns: 2, updated_turn: 3 });
  const combat = { ensemble: { actors: { player: { actorId: 'player', gameplay: { numeric: { combat: { id: 'c1', enemies: [{ name: '暴徒' }], player: { hp: 9, ammo: 3 } } } } } } } };
  const battles = Rows.battleRows(combat, 4);
  assert.deepEqual(battles[0], { battle_key: 'c1', enemy: '暴徒', hp_left: 9, ammo: 3, updated_turn: 4 });
});

test('委托主表与明细表拆开，其余字段进 extra_json', () => {
  const main = Rows.questRows(rich(), 5);
  assert.deepEqual(main[0], {
    quest_key: 'q_chip_night', owner_key: 'player', state: '进行中',
    objective: '摸进机房', agree_yen: 5000, paid_yen: 1000, updated_turn: 5,
  });
  const meta = Rows.questMetaRows(rich(), 5)[0];
  assert.equal(meta.quest_key, 'q_chip_night');
  assert.equal(meta.rank, '无损交付');
  assert.equal(meta.known_facts, '门禁六码');
  assert.equal(meta.refunded_yen, 0);
  assert.deepEqual(JSON.parse(meta.extra_json), { settled: false, deadlineAt: '2051-03-10', chapter: 'q1' });
  assert.deepEqual(Rows.questRows({}, 1), [], '$meta 与空委托都不出行');
});

test('回合索引表与 turnIndexRow 落 turn_no/summary/entities', () => {
  const rows = Rows.turnIndexRows(rich(), 7);
  assert.deepEqual(rows[0], { turn_no: 7, summary: '摸了机房', entities: 'player、wb_118' });
  assert.deepEqual(Rows.turnIndexRow(9, '收工', ['player']), { turn_no: 9, summary: '收工', entities: 'player' });
  assert.equal(Rows.turnIndexRow(9, '收工').entities, null);
});

