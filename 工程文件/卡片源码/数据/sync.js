(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxDataSync = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // 把 MVU 的 terminal 快照镜像进数据库表，并能从表里读回一个 terminal 形状的对象。
  // 写入主路径仍是 MVU；P3 摘掉 MVU 时把写侧换到这里。
  // TABLES 是历史 5 表集合（外部断言按它查行数，别扩）；MIRROR_TABLES 是整库镜像集合，
  // 不含 cxx_fact / cxx_pending_tx —— 那两张是只追加的台账，由 write.js 管，整表替换会清账。
  const TABLES = ['cxx_actor', 'cxx_actor_stat', 'cxx_inventory', 'cxx_equipment', 'cxx_item_def'];
  const MIRROR_TABLES = [
    'cxx_actor', 'cxx_actor_stat', 'cxx_inventory', 'cxx_equipment', 'cxx_item_def',
    'cxx_actor_flag', 'cxx_wallet', 'cxx_roster', 'cxx_scene', 'cxx_effect',
    'cxx_pref', 'cxx_battle', 'cxx_tactical', 'cxx_quest', 'cxx_quest_meta',
    'cxx_turn_index',
  ];

  function rowsModule(deps) {
    const rows = deps.rows;
    if (!rows || typeof rows.project !== 'function') throw new Error('缺少行映射模块 CxxDataRows');
    return rows;
  }

  const cell = (cells, index) => (cells && cells[index] !== undefined && cells[index] !== null ? cells[index] : '');
  const numOf = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const str = value => (value === undefined || value === null ? '' : String(value));

  function parseJson(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch (error) {
      return null;
    }
  }

  function create(deps) {
    const store = deps.store;
    const rows = rowsModule(deps);
    if (!store || typeof store.read !== 'function') throw new Error('缺少数据仓库 CxxDataStore');
    let last = { turn: -1, counts: {}, at: 0 };

    function project(terminal, turn) {
      return rows.project(terminal || {}, turn || 0);
    }

    function projectAll(terminal, turn, options) {
      if (typeof rows.projectAll !== 'function') return project(terminal, turn);
      return rows.projectAll(terminal || {}, turn || 0, options || {});
    }

    // 整表替换：先删干净再写。表小（62 行 × 5），比逐行 diff 好验证。
    async function pushTable(table, list, options = {}) {
      const check = options.assertCurrent || (() => {});
      check();
      const existing = await store.read(table);
      check();
      if (!existing.ok) return { table, ok: false, reason: existing.reason };
      for (let index = existing.rows.length - 1; index >= 0; index -= 1) {
        check();
        const removed = await store.remove(table, index);
        check();
        if (!removed.ok) return { table, ok: false, reason: removed.reason };
      }
      for (const row of list) {
        check();
        const written = await store.insert(table, row);
        check();
        if (!written.ok) return { table, ok: false, reason: written.reason };
      }
      return { table, ok: true, rows: list.length, removed: existing.rows.length };
    }

    async function pushTables(list, projected, turn, options = {}) {
      const check = options.assertCurrent || (() => {});
      check();
      const ensured = await store.ensureSchema();
      check();
      if (!ensured.ok) return { ok: false, reason: ensured.reason, results: [] };
      const batch = store.replaceTables ? await store.replaceTables(projected, list, options) : null;
      check();
      if (batch && !batch.ok && !batch.unsupported) return { ok: false, reason: batch.reason, results: batch.results || [] };
      const results = batch?.ok ? batch.results : [];
      if (!batch?.ok) for (const table of list) results.push(await pushTable(table, projected[table] || [], options));
      const failed = results.filter(item => !item.ok);
      const ok = failed.length === 0;
      if (ok) {
        last = {
          turn: turn || 0,
          counts: Object.fromEntries(results.map(item => [item.table, item.rows])),
          at: Date.now(),
        };
        check();
        if (!batch?.refreshed) await store.refresh();
        check();
      }
      return { ok, reason: ok ? '' : failed.map(item => item.table + ': ' + item.reason).join('；'), results };
    }

    function push(terminal, turn, options) {
      return pushTables(TABLES, project(terminal, turn), turn, options);
    }

    /** 整库镜像：16 张状态表一次推平（台账表不在此列）。 */
    function pushAll(terminal, turn, options) {
      return pushTables(MIRROR_TABLES, projectAll(terminal, turn, options), turn, options);
    }

    // 从表里读回一个可供面板使用的 terminal 形状（历史 5 表版本）
    async function pull() {
      const actors = await store.read('cxx_actor');
      if (!actors.ok) return { ok: false, reason: actors.reason };
      const stats = await store.read('cxx_actor_stat');
      const bag = await store.read('cxx_inventory');
      const gear = await store.read('cxx_equipment');
      const defs = await store.read('cxx_item_def');
      if (!stats.ok) return { ok: false, reason: stats.reason };
      const statOf = new Map(stats.rows.map(row => [row.cells[1], row.cells]));
      const definitions = defs.ok ? defs.rows.map(row => row.cells) : [];
      const ensemble = { actors: {} };
      for (const row of actors.rows) {
        const cells = row.cells;
        const key = cells[1];
        const stat = statOf.get(key) || [];
        ensemble.actors[key] = {
          actorId: key,
          name: cells[2],
          controllable: cells[3] === '主角',
          gameplay: {
            schema: 1,
            numeric: { hp: Number(stat[2]) || 0, fatigue: Number(stat[4]) || 0 },
            sanity: Number(stat[3]) || 0,
            inventory: bag.ok ? bag.rows.filter(item => item.cells[1] === key).map(item => ({ item_key: item.cells[2], count: Number(item.cells[3]) || 1 })) : [],
            equipment: gear.ok ? gear.rows.filter(item => item.cells[1] === key).map(item => ({ slot: item.cells[2], item_key: item.cells[3] })) : [],
            itemDefinitions: Object.fromEntries(definitions.map(def => [def[1], { name: def[2], category: def[3] }])),
          },
          wallet: { yen: Number(stat[5]) || 0 },
        };
      }
      return { ok: true, terminal: { ensemble }, definitions: definitions.length, actors: actors.rows.length };
    }

    /** 整库读回：16 张镜像表 → 完整 terminal 形状（钱包/名册/场景/委托/效果/偏好/战斗/战术/回合摘要）。 */
    async function pullAll() {
      const picked = {};
      for (const table of MIRROR_TABLES) {
        const read = await store.read(table);
        if (!read.ok) return { ok: false, reason: table + ': ' + read.reason };
        picked[table] = read.rows.map(row => row.cells);
      }
      const cellsOf = table => picked[table] || [];
      const defRows = cellsOf('cxx_item_def');
      const definitions = Object.fromEntries(defRows.map(cells => [str(cell(cells, 1)), { name: str(cell(cells, 2)), category: str(cell(cells, 3)), effect: cell(cells, 4) || null, price: numOf(cell(cells, 5), 0) }]));

      const statOf = new Map(cellsOf('cxx_actor_stat').map(cells => [str(cell(cells, 1)), cells]));
      const flagOf = new Map();
      for (const cells of cellsOf('cxx_actor_flag')) {
        const key = str(cell(cells, 1));
        if (!key) continue;
        if (!flagOf.has(key)) flagOf.set(key, {});
        flagOf.get(key)[str(cell(cells, 2))] = cell(cells, 3);
      }
      const bagOf = new Map();
      for (const cells of cellsOf('cxx_inventory')) {
        const key = str(cell(cells, 1));
        if (!bagOf.has(key)) bagOf.set(key, []);
        bagOf.get(key).push({ item_key: str(cell(cells, 2)), count: numOf(cell(cells, 3), 1), quality: str(cell(cells, 4)), note: cell(cells, 6) || null });
      }
      const gearOf = new Map();
      for (const cells of cellsOf('cxx_equipment')) {
        const key = str(cell(cells, 1));
        if (!gearOf.has(key)) gearOf.set(key, []);
        gearOf.get(key).push({ slot: str(cell(cells, 2)), item_key: str(cell(cells, 3)), installed: numOf(cell(cells, 4), 1) === 1 });
      }
      const walletOf = new Map(cellsOf('cxx_wallet').map(cells => [str(cell(cells, 1)), cells]));
      const rosterOf = new Map(cellsOf('cxx_roster').map(cells => [str(cell(cells, 1)), cells]));

      const ensemble = { actors: {} };
      for (const cells of cellsOf('cxx_actor')) {
        const key = str(cell(cells, 1));
        if (!key) continue;
        const stat = statOf.get(key) || [];
        const walletCells = walletOf.get(key);
        ensemble.actors[key] = {
          actorId: key,
          name: str(cell(cells, 2)),
          controllable: str(cell(cells, 3)) === '主角',
          sourceRef: { location: str(cell(cells, 4)), chapter: str(cell(cells, 5)) },
          flags: flagOf.get(key) || {},
          gameplay: {
            schema: 1,
            numeric: { hp: numOf(cell(stat, 2), 0), fatigue: numOf(cell(stat, 4), 0) },
            sanity: numOf(cell(stat, 3), 0),
            inventory: bagOf.get(key) || [],
            equipment: gearOf.get(key) || [],
            itemDefinitions: definitions,
          },
          wallet: walletCells
            ? { yen: numOf(cell(walletCells, 2), 0), earned: numOf(cell(walletCells, 3), 0), spent: numOf(cell(walletCells, 4), 0) }
            : { yen: numOf(cell(stat, 5), 0) },
        };
      }

      const chatWallet = walletOf.get('chat');
      const terminal = { ensemble };
      if (chatWallet) terminal.wallet = { id: 'wallet', yen: numOf(cell(chatWallet, 2), 0), earned: numOf(cell(chatWallet, 3), 0), spent: numOf(cell(chatWallet, 4), 0) };

      const present = [];
      const lastSeen = {};
      for (const [key, cells] of rosterOf) {
        if (numOf(cell(cells, 2), 0) === 1) present.push(key);
        lastSeen[key] = { floor: numOf(cell(cells, 3), 0), story: cell(cells, 4) || null };
      }
      if (rosterOf.size) terminal.roster = { schema: 1, present, lastSeen };

      const sceneCells = cellsOf('cxx_scene')[0];
      if (sceneCells) {
        const opening = parseJson(cell(sceneCells, 2));
        if (opening !== null) terminal.opening = opening;
        const area = str(cell(sceneCells, 3));
        if (area) {
          const parts = area.split('/');
          terminal.gameplay = { ...(terminal.gameplay || {}), location: { mapId: parts[0] || '', placeId: parts[1] || '' } };
        }
        if (cell(sceneCells, 4)) terminal.clock = cell(sceneCells, 4);
      }

      const effectRows = cellsOf('cxx_effect');
      if (effectRows.length) {
        terminal.effects = {};
        for (const cells of effectRows) {
          terminal.effects[str(cell(cells, 1))] = { id: str(cell(cells, 1)), target: str(cell(cells, 2)), magnitude: numOf(cell(cells, 3), 0), left_turns: numOf(cell(cells, 4), 0) };
        }
      }
      const prefRows = cellsOf('cxx_pref');
      if (prefRows.length) {
        terminal.prefs = {};
        for (const cells of prefRows) terminal.prefs[str(cell(cells, 1))] = cell(cells, 2);
      }
      const battleRows = cellsOf('cxx_battle');
      if (battleRows.length) {
        terminal.battle = {};
        for (const cells of battleRows) terminal.battle[str(cell(cells, 1))] = { id: str(cell(cells, 1)), enemy: str(cell(cells, 2)), hp_left: numOf(cell(cells, 3), 0), ammo: numOf(cell(cells, 4), 0) };
      }
      const tacticalRows = cellsOf('cxx_tactical');
      if (tacticalRows.length) {
        terminal.tactical = {};
        for (const cells of tacticalRows) terminal.tactical[str(cell(cells, 1))] = { id: str(cell(cells, 1)), deploy: cell(cells, 2) || '', overclock: numOf(cell(cells, 3), 0) === 1, order_no: numOf(cell(cells, 4), 0) };
      }

      const questRows = cellsOf('cxx_quest');
      if (questRows.length) {
        const metaOf = new Map(cellsOf('cxx_quest_meta').map(cells => [str(cell(cells, 1)), cells]));
        terminal.quests = {};
        for (const cells of questRows) {
          const key = str(cell(cells, 1));
          const meta = metaOf.get(key) || [];
          const extra = parseJson(cell(meta, 5)) || {};
          terminal.quests[key] = {
            id: key,
            ownerActorId: str(cell(cells, 2)) || 'player',
            state: str(cell(cells, 3)) || '已发布',
            objective: cell(cells, 4) || undefined,
            agreedYen: numOf(cell(cells, 5), 0),
            paidYen: numOf(cell(cells, 6), 0),
            rank: cell(meta, 2) || undefined,
            knownFacts: cell(meta, 3) || undefined,
            refundedYen: numOf(cell(meta, 4), 0),
            ...extra,
          };
        }
      }

      const turnRows = cellsOf('cxx_turn_index');
      if (turnRows.length) {
        terminal.turns = turnRows.map(cells => ({ turn_no: numOf(cell(cells, 1), 0), summary: cell(cells, 2) || '', entities: cell(cells, 3) || '' }));
      }

      return {
        ok: true,
        terminal,
        definitions: Object.keys(definitions).length,
        actors: Object.keys(ensemble.actors).length,
        counts: Object.fromEntries(MIRROR_TABLES.map(table => [table, (picked[table] || []).length])),
      };
    }

    function status() {
      return { ...last, tables: TABLES.slice(), mirror: MIRROR_TABLES.slice() };
    }

    return { push, pull, pushAll, pullAll, status, project, projectAll, sourceGuard: true };
  }

  return { create, TABLES, MIRROR_TABLES };
});
