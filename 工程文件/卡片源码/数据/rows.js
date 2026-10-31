(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxDataRows = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 把 MVU 的 terminal 快照映射成数据库行；只做「读方向」的纯函数，不写聊天。
  const CATEGORY = {
    weapon: '武器', armor: '防具', cyberware: '义体', consumable: '消耗品', material: '材料',
  };
  const QUALITY = { broken: '破损', normal: '普通', fine: '精良', rare: '稀有', legend: '传说' };

  function pick(object, path, fallback) {
    let cursor = object;
    for (const key of path) {
      if (cursor == null) return fallback;
      cursor = cursor[key];
    }
    return cursor === undefined || cursor === null ? fallback : cursor;
  }
  const num = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
  const text = value => (typeof value === 'string' ? value : value == null ? '' : String(value));

  function actorsOf(terminal) {
    const actors = pick(terminal, ['ensemble', 'actors'], {});
    return actors && typeof actors === 'object' ? Object.entries(actors) : [];
  }

  function actorRows(terminal, turn = 0) {
    return actorsOf(terminal).map(([key, actor]) => ({
      actor_key: text(actor?.actorId || key),
      name: text(actor?.name || key),
      kind: actor?.controllable ? '主角' : '中立',
      location: text(pick(actor, ['sourceRef', 'location'], '')),
      chapter: text(pick(actor, ['sourceRef', 'chapter'], '')),
      status: '未知',
      updated_turn: turn,
    }));
  }

  function statRows(terminal, turn = 0) {
    return actorsOf(terminal).map(([key, actor]) => {
      const numeric = pick(actor, ['gameplay', 'numeric'], {});
      const yen = num(pick(actor, ['wallet', 'yen'], pick(terminal, ['wallet', 'yen'], 0)), 0);
      const extra = {};
      for (const field of ['attack', 'defense', 'reflex', 'growth']) {
        if (numeric?.[field] !== undefined) extra[field] = numeric[field];
      }
      if (pick(actor, ['gameplay', 'loadout']) !== undefined) extra.loadout = pick(actor, ['gameplay', 'loadout']);
      return {
        actor_key: text(actor?.actorId || key),
        hp: Math.round(num(numeric?.hp, 80)),
        sanity: Math.round(num(pick(actor, ['gameplay', 'sanity']), num(numeric?.sanity, 100))),
        fatigue: Math.round(num(numeric?.fatigue, 0)),
        yen: Math.round(yen),
        extra_json: Object.keys(extra).length ? JSON.stringify(extra) : null,
        updated_turn: turn,
      };
    });
  }

  function inventoryRows(terminal, turn = 0) {
    const rows = [];
    for (const [key, actor] of actorsOf(terminal)) {
      const bag = pick(actor, ['gameplay', 'inventory'], {});
      if (!bag || typeof bag !== 'object') continue;
      for (const [slot, entry] of Object.entries(bag)) {
        const itemKey = text(pick(entry, ['definitionRef', 'id'], slot));
        rows.push({
          actor_key: text(actor?.actorId || key),
          item_key: itemKey,
          count: Math.max(1, Math.round(num(entry?.quantity, 1))),
          quality: QUALITY[text(entry?.quality)] || '普通',
          acquired_turn: turn,
          note: entry?.note ? text(entry.note).slice(0, 120) : null,
        });
      }
    }
    return rows;
  }

  function equipmentRows(terminal, turn = 0) {
    const rows = [];
    for (const [key, actor] of actorsOf(terminal)) {
      const gear = pick(actor, ['gameplay', 'equipment'], {});
      if (!gear || typeof gear !== 'object') continue;
      for (const [slotKey, entry] of Object.entries(gear)) {
        if (entry == null) continue;
        const slot = slotKey;
        rows.push({
          actor_key: text(actor?.actorId || key),
          slot,
          item_key: text(entry?.itemId || pick(entry, ['definitionRef', 'id'], slotKey)),
          installed: entry?.installed === false ? 0 : 1,
          updated_turn: turn,
        });
      }
    }
    return rows;
  }

  function itemDefRows(terminal) {
    const seen = new Map();
    for (const [, actor] of actorsOf(terminal)) {
      const defs = pick(actor, ['gameplay', 'itemDefinitions'], {});
      if (!defs || typeof defs !== 'object') continue;
      for (const [key, def] of Object.entries(defs)) {
        if (seen.has(key)) continue;
        const effect = pick(def, ['numericEffects', 0, 'text'], '');
        seen.set(key, {
          item_key: text(def?.id || key),
          name: text(def?.name || key),
          category: CATEGORY[text(def?.category)] || '杂项',
          effect: effect ? text(effect).slice(0, 80) : null,
          price: Math.round(num(def?.price, 0)),
          note: def?.description ? text(def.description).slice(0, 120) : null,
        });
      }
    }
    return [...seen.values()];
  }

  function factRow(terminal, turn, kind, payload, stamp) {
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    return {
      fact_key: text(stamp || 'f' + turn),
      turn_no: turn,
      kind,
      payload: body.slice(0, 200),
    };
  }

  // 一次算出 5 张「人物/物品」表的既有投影（sync.TABLES 的默认集合，别扩大：外部按此断言行数）
  function project(terminal, turn = 0) {
    return {
      cxx_actor: actorRows(terminal, turn),
      cxx_actor_stat: statRows(terminal, turn),
      cxx_inventory: inventoryRows(terminal, turn),
      cxx_equipment: equipmentRows(terminal, turn),
      cxx_item_def: itemDefRows(terminal),
    };
  }

  // ── 其余状态表（钱包/名册/场景/效果/偏好/战斗/战术/标记/委托） ──────────────
  // 真机 MVU 只在 terminal 上有一等公民的，就直接读它（wallet / roster / opening /
  // gameplay.location / quests）；没有一等公民的（标记/效果/偏好/战斗/战术/回合摘要）
  // 先认 terminal 上的同名容器，容器不在时再从人物 gameplay 里派生，两处都没有就是空表。
  const CHAT = 'chat';
  const clip = (value, limit) => text(value).slice(0, limit);

  function container(terminal, keys) {
    for (const key of keys) {
      const value = pick(terminal, [key], null);
      if (value && typeof value === 'object') return value;
    }
    return null;
  }

  function entriesOf(value) {
    if (!value || typeof value !== 'object') return [];
    return Array.isArray(value) ? value.map((item, index) => [String(index), item]) : Object.entries(value);
  }

  function flagRows(terminal, turn = 0) {
    const rows = [];
    const shared = container(terminal, ['flags']);
    for (const [key, actor] of actorsOf(terminal)) {
      const actorId = text(actor?.actorId || key);
      const fromShared = shared && shared[actorId] && typeof shared[actorId] === 'object' ? shared[actorId] : {};
      const fromActor = actor?.flags && typeof actor.flags === 'object' ? actor.flags : {};
      const own = { ...fromShared, ...fromActor };
      for (const [flagKey, value] of entriesOf(own)) {
        if (flagKey === '$meta' || value === undefined) continue;
        rows.push({
          actor_key: actorId,
          flag_key: text(flagKey),
          flag_value: clip(value && typeof value === 'object' ? JSON.stringify(value) : value, 120),
          updated_turn: turn,
        });
      }
    }
    return rows;
  }

  function walletRows(terminal, turn = 0) {
    const rows = [];
    const chat = pick(terminal, ['wallet'], null);
    if (chat && typeof chat === 'object') {
      rows.push({
        scope_key: CHAT,
        yen: Math.round(num(chat.yen, 0)),
        earned: Math.round(num(chat.earned, 0)),
        spent: Math.round(num(chat.spent, 0)),
        updated_turn: turn,
      });
    }
    for (const [key, actor] of actorsOf(terminal)) {
      const wallet = actor?.wallet;
      if (!wallet || typeof wallet !== 'object') continue;
      rows.push({
        scope_key: text(actor?.actorId || key),
        yen: Math.round(num(wallet.yen, 0)),
        earned: Math.round(num(wallet.earned, 0)),
        spent: Math.round(num(wallet.spent, 0)),
        updated_turn: turn,
      });
    }
    return rows;
  }

  function rosterRows(terminal, turn = 0) {
    const roster = container(terminal, ['roster']);
    const present = new Set(Array.isArray(roster?.present) ? roster.present.map(item => text(item)) : []);
    const lastSeen = roster?.lastSeen && typeof roster.lastSeen === 'object' ? roster.lastSeen : {};
    const keys = new Set([...actorsOf(terminal).map(([key]) => text(key)), ...present, ...Object.keys(lastSeen)]);
    const rows = [];
    for (const key of keys) {
      if (!key) continue;
      const seen = lastSeen[key] && typeof lastSeen[key] === 'object' ? lastSeen[key] : {};
      rows.push({
        actor_key: key,
        present: present.has(key) ? 1 : 0,
        last_floor: Math.round(num(seen.floor, num(pick(seen, ['source', 'floor'], 0), 0))),
        last_story: seen.story ? clip(seen.story, 200) : (pick(seen, ['source', 'story'], '') ? clip(pick(seen, ['source', 'story'], ''), 200) : null),
        updated_turn: turn,
      });
    }
    return rows;
  }

  function sceneRows(terminal, turn = 0) {
    const opening = pick(terminal, ['opening'], null);
    const location = pick(terminal, ['gameplay', 'location'], {}) || {};
    const clock = pick(terminal, ['clock'], pick(terminal, ['net', 'updatedAt'], ''));
    const area = [text(location.mapId || ''), text(location.placeId || '')].filter(Boolean).join('/');
    if (opening == null && !area && !clock) return [];
    return [{
      scope_key: CHAT,
      opening: opening == null ? null : clip(JSON.stringify(opening), 2000),
      area: area || null,
      clock: clock ? clip(clock, 120) : null,
      updated_turn: turn,
    }];
  }

  function effectRows(terminal, turn = 0) {
    const rows = [];
    const shared = container(terminal, ['effects']);
    for (const [key, value] of entriesOf(shared)) {
      if (key === '$meta') continue;
      const record = value && typeof value === 'object' ? value : {};
      rows.push({
        effect_key: text(record.effect_key || record.id || key),
        target_key: text(record.target_key || record.target || ''),
        magnitude: Math.round(num(record.magnitude, num(record.value, 0))),
        left_turns: Math.max(0, Math.round(num(record.left_turns, num(record.turns, 0)))),
        updated_turn: turn,
      });
    }
    if (rows.length) return rows;
    for (const [key, actor] of actorsOf(terminal)) {
      const conditions = pick(actor, ['gameplay', 'numeric', 'conditions'], pick(actor, ['gameplay', 'tactical', 'conditions'], null));
      for (const [id, value] of entriesOf(conditions)) {
        if (!value || typeof value !== 'object') continue;
        rows.push({
          effect_key: text(value.id || value.key || id),
          target_key: text(actor?.actorId || key),
          magnitude: Math.round(num(value.magnitude, num(value.value, 0))),
          left_turns: Math.max(0, Math.round(num(value.left_turns, num(value.turns, 0)))),
          updated_turn: turn,
        });
      }
    }
    return rows;
  }

  function prefRows(terminal, turn = 0) {
    const rows = [];
    for (const [key, value] of entriesOf(container(terminal, ['prefs', 'pref', 'preferences']))) {
      if (key === '$meta' || value === undefined) continue;
      rows.push({
        pref_key: text(key),
        pref_value: clip(value && typeof value === 'object' ? JSON.stringify(value) : value, 400),
        updated_turn: turn,
      });
    }
    return rows;
  }

  function battleRows(terminal, turn = 0) {
    const rows = [];
    for (const [key, value] of entriesOf(container(terminal, ['battle', 'combat']))) {
      const record = value && typeof value === 'object' ? value : {};
      rows.push({
        battle_key: text(record.battle_key || record.id || key),
        enemy: clip(record.enemy || record.enemies || '', 120),
        hp_left: Math.max(0, Math.round(num(record.hp_left, num(record.hp, 0)))),
        ammo: Math.max(0, Math.round(num(record.ammo, 0))),
        updated_turn: turn,
      });
    }
    if (rows.length) return rows;
    for (const [key, actor] of actorsOf(terminal)) {
      const combat = pick(actor, ['gameplay', 'numeric', 'combat'], null);
      if (!combat || typeof combat !== 'object') continue;
      const me = combat.player && typeof combat.player === 'object' ? combat.player : {};
      const enemies = Array.isArray(combat.enemies) ? combat.enemies.map(item => text(item?.name || item?.id)).filter(Boolean) : [];
      rows.push({
        battle_key: text(combat.id || actor?.actorId || key),
        enemy: clip(enemies.join('、'), 120),
        hp_left: Math.max(0, Math.round(num(me.hp, num(pick(actor, ['gameplay', 'numeric', 'vitals', 'hp'], 0), 0)))),
        ammo: Math.max(0, Math.round(num(me.ammo, num(pick(actor, ['gameplay', 'numeric', 'resources', 'ammo'], 0), 0)))),
        updated_turn: turn,
      });
    }
    return rows;
  }

  function tacticalRows(terminal, turn = 0) {
    const rows = [];
    for (const [key, value] of entriesOf(container(terminal, ['tactical']))) {
      const record = value && typeof value === 'object' ? value : {};
      rows.push({
        tac_key: text(record.tac_key || record.id || key),
        deploy: clip(record.deploy || record.weaponSlot || '', 120) || null,
        overclock: record.overclock === true || record.overclock === 1 || record.enabled === true ? 1 : 0,
        order_no: Math.max(0, Math.round(num(record.order_no, num(record.order, 0)))),
        updated_turn: turn,
      });
    }
    if (rows.length) return rows;
    for (const [key, actor] of actorsOf(terminal)) {
      const tactical = pick(actor, ['gameplay', 'tactical'], null);
      if (!tactical || typeof tactical !== 'object') continue;
      const encounter = tactical.encounter && typeof tactical.encounter === 'object' ? tactical.encounter : {};
      rows.push({
        tac_key: text(tactical.id || actor?.actorId || key),
        deploy: clip(tactical.weaponSlot || encounter.deploy || '', 120) || null,
        overclock: tactical.overclock === true || encounter.overclock === true ? 1 : 0,
        order_no: Math.max(0, Math.round(num(encounter.order, num(tactical.revision, 0)))),
        updated_turn: turn,
      });
    }
    return rows;
  }

  function questRows(terminal, turn = 0) {
    const rows = [];
    for (const [key, value] of entriesOf(pick(terminal, ['quests'], null))) {
      if (key === '$meta') continue;
      const record = value && typeof value === 'object' ? value : {};
      rows.push({
        quest_key: text(record.id || key),
        owner_key: text(record.ownerActorId || 'player'),
        state: text(record.state || '已发布'),
        objective: record.objective ? clip(record.objective, 2000) : null,
        agree_yen: Math.round(num(record.agreedYen, 0)),
        paid_yen: Math.round(num(record.paidYen, 0)),
        updated_turn: turn,
      });
    }
    return rows;
  }

  function questMetaRows(terminal, turn = 0) {
    const rows = [];
    for (const [key, value] of entriesOf(pick(terminal, ['quests'], null))) {
      if (key === '$meta') continue;
      const record = value && typeof value === 'object' ? value : {};
      const extra = {};
      for (const field of ['settled', 'deadlineAt', 'chapter', 'acceptedFloor', 'definitionRef', 'discovered']) {
        if (record[field] !== undefined) extra[field] = record[field];
      }
      rows.push({
        quest_key: text(record.id || key),
        rank: record.rank ? clip(record.rank, 100) : null,
        known_facts: record.knownFacts ? clip(record.knownFacts, 8000) : null,
        refunded_yen: Math.round(num(record.refundedYen, 0)),
        extra_json: Object.keys(extra).length ? JSON.stringify(extra) : null,
        updated_turn: turn,
      });
    }
    return rows;
  }

  function turnIndexRows(terminal, turn = 0, entries = null) {
    const source = entries || container(terminal, ['turns', 'turnIndex', 'turnLog']);
    const rows = [];
    for (const [key, value] of entriesOf(source)) {
      const record = value && typeof value === 'object' ? value : { summary: value };
      const floor = Math.round(num(record.turn_no, num(record.floor, num(key, 0))));
      if (!Number.isFinite(floor) || floor < 0) continue;
      rows.push({
        turn_no: floor,
        summary: record.summary ? clip(record.summary, 400) : null,
        entities: Array.isArray(record.entities) ? clip(record.entities.join('、'), 400) : (record.entities ? clip(record.entities, 400) : null),
      });
    }
    return rows;
  }

  function turnIndexRow(turn, summary, entities) {
    return {
      turn_no: Number(turn) || 0,
      summary: summary ? clip(summary, 400) : null,
      entities: Array.isArray(entities) ? clip(entities.join('、'), 400) : (entities ? clip(entities, 400) : null),
    };
  }

  // 全部可读状态表（pending_tx 是写入台账，由 write.js 独占，不在此投影）
  const FULL_TABLES = [
    'cxx_actor', 'cxx_actor_stat', 'cxx_inventory', 'cxx_equipment', 'cxx_item_def',
    'cxx_actor_flag', 'cxx_wallet', 'cxx_roster', 'cxx_scene', 'cxx_effect',
    'cxx_pref', 'cxx_battle', 'cxx_tactical', 'cxx_quest', 'cxx_quest_meta',
    'cxx_fact', 'cxx_turn_index',
  ];

  function projectAll(terminal, turn = 0, options = {}) {
    const opts = options || {};
    return {
      cxx_actor: actorRows(terminal, turn),
      cxx_actor_stat: statRows(terminal, turn),
      cxx_inventory: inventoryRows(terminal, turn),
      cxx_equipment: equipmentRows(terminal, turn),
      cxx_item_def: itemDefRows(terminal),
      cxx_actor_flag: flagRows(terminal, turn),
      cxx_wallet: walletRows(terminal, turn),
      cxx_roster: rosterRows(terminal, turn),
      cxx_scene: sceneRows(terminal, turn),
      cxx_effect: effectRows(terminal, turn),
      cxx_pref: prefRows(terminal, turn),
      cxx_battle: battleRows(terminal, turn),
      cxx_tactical: tacticalRows(terminal, turn),
      cxx_quest: questRows(terminal, turn),
      cxx_quest_meta: questMetaRows(terminal, turn),
      cxx_fact: Array.isArray(opts.facts) ? opts.facts : [],
      cxx_turn_index: turnIndexRows(terminal, turn, opts.turns || null),
    };
  }

  function counts(projected) {
    const out = {};
    for (const [table, rows] of Object.entries(projected)) out[table] = Array.isArray(rows) ? rows.length : 0;
    return out;
  }

  return {
    project, projectAll, counts, FULL_TABLES,
    actorRows, statRows, inventoryRows, equipmentRows, itemDefRows, factRow,
    flagRows, walletRows, rosterRows, sceneRows, effectRows, prefRows, battleRows, tacticalRows,
    questRows, questMetaRows, turnIndexRows, turnIndexRow,
  };
});
