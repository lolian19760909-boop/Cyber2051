/*! 东京都2051 · 数据库读侧（CxxDataRead）
 *  作用：把数据库里的状态表还原成卡内沿用的「terminal 形状」，供面板与提示词读取；
 *        数据库不可用时返回 { ok:false, reason }，调用方自行决定回退（回退由 dataStore 开关控制）。
 *  依据：`.cache/diagnostics/2326-xinghai` 的真机结论（异步落盘、表名拼音、删除要刷新）。
 *  16 表闭环：actor/stat/inventory/equipment/item_def 之外，钱包、名册、场景、标记、效果、
 *  偏好、战斗、战术、委托（含明细）、回合摘要都按同一套 row-key 读回 terminal。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CxxDataRead = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function fail(reason) {
    return { ok: false, reason: reason };
  }

  function num(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function text(value, fallback) {
    return value === undefined || value === null || value === '' ? fallback : String(value);
  }

  function parseExtra(value) {
    if (value === undefined || value === null || value === '') return {};
    if (typeof value === 'object') return value;
    try {
      const parsed = JSON.parse(String(value));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function groupBy(rows, key) {
    const map = new Map();
    for (const row of rows || []) {
      const id = text(row && row[key], '');
      if (!id) continue;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(row);
    }
    return map;
  }

  function create(options) {
    const opts = options || {};
    const store = opts.store;
    const log = typeof opts.report === 'function' ? opts.report : function () {};

    function ready() {
      return !!(store && typeof store.readAll === 'function');
    }

    function pairs() {
      const list = [];
      for (const key of Object.keys(TA)) list.push([TA[key], opts[key]]);
      return list;
    }

    /** 读回 terminal 形状；缺表按空数组处理，接口本身不可用则 ok:false。 */
    function snapshot() {
      if (!ready()) return fail('缺少数据仓库 CxxDataStore');
      const read = store.readAll(pairs());
      if (!read || read.ok === false) return fail((read && read.reason) || '读表失败');
      const tables = read.tables || {};
      const actorRows = tables[TA.actor] || [];
      if (!actorRows.length) {
        return { ok: true, empty: true, terminal: { ensemble: { actors: {} }, scene: {}, wallet: null } };
      }
      const statBy = groupBy(tables[TA.stat], 'actor_key');
      const invBy = groupBy(tables[TA.inventory], 'actor_key');
      const equipBy = groupBy(tables[TA.equipment], 'actor_key');
      const flagBy = groupBy(tables[TA.flag], 'actor_key');
      const walletBy = groupBy(tables[TA.wallet], 'scope_key');
      const defBy = new Map();
      for (const row of tables[TA.itemDef] || []) {
        const id = text(row && row.item_key, '');
        if (id) defBy.set(id, row.extra_json ? parseExtra(row.extra_json) : { name: text(row.name, id), category: text(row.category, ''), effect: text(row.effect, ''), price: num(row.price, 0), note: text(row.note, '') });
      }
      const actors = {};
      for (const row of actorRows) {
        const key = text(row.actor_key, '');
        if (!key) continue;
        const stat = (statBy.get(key) || [])[0] || {};
        const wallet = (walletBy.get(key) || [])[0] || {};
        const flags = {};
        for (const flag of flagBy.get(key) || []) {
          const flagKey = text(flag.flag_key, '');
          if (flagKey) flags[flagKey] = text(flag.flag_value, '');
        }
        const sheet = {
          name: text(row.display_name, text(row.name, key)),
          role: text(row.role, text(row.kind, '')),
          gender: text(row.gender, ''),
          origin: text(row.origin, ''),
          archetype: text(row.archetype, ''),
          look: text(row.look, ''),
          extra: parseExtra(row.extra_json),
          stat: [
            num(stat.hp, 0),
            num(stat.sanity, 0),
            num(stat.fatigue, 0),
            num(stat.yen, 0),
          ],
          flags,
          inventory: {},
          equipment: {},
        };
        if (wallet.scope_key) sheet.wallet = { yen: num(wallet.yen, 0), earned: num(wallet.earned, 0), spent: num(wallet.spent, 0) };
        for (const item of invBy.get(key) || []) {
          const itemKey = text(item.item_key, '');
          if (!itemKey) continue;
          sheet.inventory[itemKey] = {
            count: num(item.count, 0),
            name: text(item.display_name, (defBy.get(itemKey) || {}).name || itemKey),
            definition: defBy.get(itemKey) || {},
          };
        }
        for (const item of equipBy.get(key) || []) {
          const slot = text(item.slot, '');
          const itemKey = text(item.item_key, '');
          if (!slot) continue;
          sheet.equipment[slot] = itemKey ? { item: itemKey, name: text(item.display_name, (defBy.get(itemKey) || {}).name || itemKey), definition: defBy.get(itemKey) || {} } : null;
        }
        actors[key] = sheet;
      }

      const terminal = { ensemble: { actors } };

      const chatWallet = (walletBy.get('chat') || [])[0];
      if (chatWallet) terminal.wallet = { id: 'wallet', yen: num(chatWallet.yen, 0), earned: num(chatWallet.earned, 0), spent: num(chatWallet.spent, 0) };

      const rosterRows = tables[TA.roster] || [];
      if (rosterRows.length) {
        const present = [];
        const lastSeen = {};
        for (const row of rosterRows) {
          const key = text(row.actor_key, '');
          if (!key) continue;
          if (num(row.present, 0) === 1) present.push(key);
          lastSeen[key] = { floor: num(row.last_floor, 0), story: text(row.last_story, null) };
        }
        terminal.roster = { schema: 1, present, lastSeen };
      }

      const scene = (tables[TA.scene] || [])[0];
      if (scene) {
        const opening = parseExtraOrNull(scene.opening);
        if (opening !== null) terminal.opening = opening;
        const area = text(scene.area, '');
        if (area) {
          const parts = area.split('/');
          terminal.gameplay = { ...(terminal.gameplay || {}), location: { mapId: parts[0] || '', placeId: parts[1] || '' } };
        }
        if (scene.clock) terminal.clock = text(scene.clock, '');
      }

      const effects = tables[TA.effect] || [];
      if (effects.length) {
        terminal.effects = {};
        for (const row of effects) {
          const key = text(row.effect_key, '');
          if (!key) continue;
          terminal.effects[key] = { id: key, target: text(row.target_key, ''), magnitude: num(row.magnitude, 0), left_turns: num(row.left_turns, 0) };
        }
      }
      const prefs = tables[TA.pref] || [];
      if (prefs.length) {
        terminal.prefs = {};
        for (const row of prefs) {
          const key = text(row.pref_key, '');
          if (key) terminal.prefs[key] = text(row.pref_value, '');
        }
      }
      const battles = tables[TA.battle] || [];
      if (battles.length) {
        terminal.battle = {};
        for (const row of battles) {
          const key = text(row.battle_key, '');
          if (!key) continue;
          terminal.battle[key] = { id: key, enemy: text(row.enemy, ''), hp_left: num(row.hp_left, 0), ammo: num(row.ammo, 0) };
        }
      }
      const tactical = tables[TA.tactical] || [];
      if (tactical.length) {
        terminal.tactical = {};
        for (const row of tactical) {
          const key = text(row.tac_key, '');
          if (!key) continue;
          terminal.tactical[key] = { id: key, deploy: text(row.deploy, ''), overclock: num(row.overclock, 0) === 1, order_no: num(row.order_no, 0) };
        }
      }

      const questRows = tables[TA.quest] || [];
      if (questRows.length) {
        const metaBy = groupBy(tables[TA.questMeta], 'quest_key');
        terminal.quests = {};
        for (const row of questRows) {
          const key = text(row.quest_key, '');
          if (!key) continue;
          const meta = (metaBy.get(key) || [])[0] || {};
          const record = {
            id: key,
            ownerActorId: text(row.owner_key, 'player'),
            state: text(row.state, '已发布'),
            agreedYen: num(row.agree_yen, 0),
            paidYen: num(row.paid_yen, 0),
            refundedYen: num(meta.refunded_yen, 0),
          };
          if (row.objective) record.objective = text(row.objective, '');
          if (meta.rank) record.rank = text(meta.rank, '');
          if (meta.known_facts) record.knownFacts = text(meta.known_facts, '');
          Object.assign(record, parseExtra(meta.extra_json));
          terminal.quests[key] = record;
        }
      }

      const turns = tables[TA.turnIndex] || [];
      if (turns.length) {
        terminal.turns = turns.map(row => ({ turn_no: num(row.turn_no, 0), summary: text(row.summary, ''), entities: text(row.entities, '') }));
      }

      return { ok: true, empty: false, terminal };
    }

    function parseExtraOrNull(value) {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value === 'object') return value;
      try {
        return JSON.parse(String(value));
      } catch (error) {
        return null;
      }
    }

    /** 只读统计：给面板/自证用，不做形状还原（历史 5 表口径）。 */
    function counts() {
      if (!ready()) return fail('缺少数据仓库 CxxDataStore');
      const read = store.readAll([[TA.actor, opts.actor], [TA.stat, opts.stat], [TA.inventory, opts.inventory], [TA.equipment, opts.equipment], [TA.itemDef, opts.itemDef]]);
      if (!read || read.ok === false) return fail((read && read.reason) || '读表失败');
      const tables = read.tables || {};
      const out = {};
      for (const key of [TA.actor, TA.stat, TA.inventory, TA.equipment, TA.itemDef]) out[key] = (tables[key] || []).length;
      return { ok: true, counts: out };
    }

    /** 16 表口径的行数。 */
    function countsAll() {
      if (!ready()) return fail('缺少数据仓库 CxxDataStore');
      const read = store.readAll(pairs());
      if (!read || read.ok === false) return fail((read && read.reason) || '读表失败');
      const tables = read.tables || {};
      const out = {};
      for (const key of Object.keys(TA)) out[TA[key]] = (tables[TA[key]] || []).length;
      return { ok: true, counts: out };
    }

    return { snapshot, counts, countsAll, ready, log };
  }

  const TA = {
    actor: 'cxx_actor',
    stat: 'cxx_actor_stat',
    inventory: 'cxx_inventory',
    equipment: 'cxx_equipment',
    itemDef: 'cxx_item_def',
    flag: 'cxx_actor_flag',
    wallet: 'cxx_wallet',
    roster: 'cxx_roster',
    scene: 'cxx_scene',
    effect: 'cxx_effect',
    pref: 'cxx_pref',
    battle: 'cxx_battle',
    tactical: 'cxx_tactical',
    quest: 'cxx_quest',
    questMeta: 'cxx_quest_meta',
    turnIndex: 'cxx_turn_index',
  };

  return { create, keys: TA };
});
