/** U03: one fact bundle over either the plugin database or the web-independent terminal.
 * Table routes, fixed views, plugin/derived parity, route facts and the no-database six-field path all live here.
 * Pure data: no fs, no network, no model calls. Callers pass tables, an export snapshot or a terminal + projector. */

export const FACT_SCHEMA = 1;

/** 11 tables the classifier may route on; the write ledger (pending_tx) stays with write.js. */
export const EVIDENCE_TABLES = [
  'cxx_actor', 'cxx_actor_stat', 'cxx_inventory', 'cxx_equipment', 'cxx_item_def',
  'cxx_wallet', 'cxx_roster', 'cxx_scene', 'cxx_quest', 'cxx_fact', 'cxx_turn_index',
];
export const SECONDARY_TABLES = ['cxx_actor_flag', 'cxx_effect', 'cxx_pref', 'cxx_battle', 'cxx_tactical'];
export const WRITE_LEDGER_TABLE = 'cxx_pending_tx';

export const TABLE_COLUMNS = {
  cxx_actor: ['row_id', 'actor_key', 'name', 'kind', 'location', 'chapter', 'status', 'updated_turn'],
  cxx_actor_stat: ['row_id', 'actor_key', 'hp', 'sanity', 'fatigue', 'yen', 'extra_json', 'updated_turn'],
  cxx_inventory: ['row_id', 'actor_key', 'item_key', 'count', 'quality', 'acquired_turn', 'note'],
  cxx_equipment: ['row_id', 'actor_key', 'slot', 'item_key', 'installed', 'updated_turn'],
  cxx_item_def: ['row_id', 'item_key', 'name', 'category', 'effect', 'price', 'note'],
  cxx_wallet: ['row_id', 'scope_key', 'yen', 'earned', 'spent', 'updated_turn'],
  cxx_roster: ['row_id', 'actor_key', 'present', 'last_floor', 'last_story', 'updated_turn'],
  cxx_scene: ['row_id', 'scope_key', 'opening', 'area', 'clock', 'updated_turn'],
  cxx_quest: ['row_id', 'quest_key', 'owner_key', 'state', 'objective', 'agree_yen', 'paid_yen', 'updated_turn'],
  cxx_quest_meta: ['row_id', 'quest_key', 'rank', 'known_facts', 'refunded_yen', 'extra_json', 'updated_turn'],
  cxx_fact: ['row_id', 'fact_key', 'turn_no', 'kind', 'payload', 'receipt'],
  cxx_turn_index: ['row_id', 'turn_no', 'summary', 'entities'],
  cxx_actor_flag: ['row_id', 'actor_key', 'flag_key', 'flag_value', 'updated_turn'],
  cxx_effect: ['row_id', 'effect_key', 'target_key', 'magnitude', 'left_turns', 'updated_turn'],
  cxx_pref: ['row_id', 'pref_key', 'pref_value', 'updated_turn'],
  cxx_battle: ['row_id', 'battle_key', 'enemy', 'hp_left', 'ammo', 'updated_turn'],
  cxx_tactical: ['row_id', 'tac_key', 'deploy', 'overclock', 'order_no', 'updated_turn'],
};
/** Chinese headers of the plugin export, same order as TABLE_COLUMNS minus row_id. */
export const TABLE_LABELS = {
  cxx_actor: ['角色键', '名称', '类型', '位置', '章节', '状态', '更新回合'],
  cxx_actor_stat: ['角色键', '生命', '理智', '疲劳', '金钱', '扩展数值', '更新回合'],
  cxx_inventory: ['角色键', '物品键', '数量', '品质', '获得回合', '备注'],
  cxx_equipment: ['角色键', '槽位', '物品键', '已安装', '更新回合'],
  cxx_item_def: ['物品键', '名称', '类别', '效果摘要', '价值', '备注'],
  cxx_wallet: ['作用域键', '余额', '累计收入', '累计支出', '更新回合'],
  cxx_roster: ['角色键', '是否在场', '最后楼层', '最后场景', '更新回合'],
  cxx_scene: ['作用域键', '当前开局', '所在区域', '故事时间', '更新回合'],
  cxx_quest: ['委托键', '接单人', '状态', '当前目标', '约定金额', '已付金额', '更新回合'],
  cxx_quest_meta: ['委托键', '档位', '已知情报', '已退款', '扩展数值', '更新回合'],
  cxx_fact: ['事实键', '回合', '类型', '载荷摘要', '凭据哈希'],
  cxx_turn_index: ['回合', '摘要', '涉及实体'],
};

const text = value => (value === undefined || value === null ? '' : String(value));
const clip = (value, limit) => text(value).slice(0, limit);
const num = (value, fallback = null) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const flag = value => (value === 1 || value === '1' || value === true ? 1 : 0);
const EMPTY = Object.freeze({});

export function factDigest(value) {
  const source = typeof value === 'string' ? value : JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) { hash ^= source.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36).padStart(7, '0').slice(-7);
}

const rowsOf = (tables, name) => (Array.isArray(tables?.[name]) ? tables[name] : []);

/** Normalize a row set onto the declared columns; missing columns become null, unknown columns are dropped. */
export function normalizeTable(name, rows) {
  const columns = TABLE_COLUMNS[name];
  if (!columns) return [];
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const out = {};
    for (const column of columns) {
      const raw = row && Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null;
      out[column] = column === 'row_id' ? (num(Number(raw), index + 1) ?? index + 1) : raw === undefined ? null : raw;
    }
    if (!out.row_id) out.row_id = index + 1;
    return out;
  });
}

export function normalizeTables(tables = {}) {
  const out = {};
  for (const name of Object.keys(TABLE_COLUMNS)) out[name] = normalizeTable(name, tables?.[name]);
  return out;
}

/** Plugin export (AutoCardUpdaterAPI.exportTableAsJson) keeps Chinese headers; map cells positionally first, then by header label. */
export function tablesFromExport(exported) {
  const out = {};
  if (!exported || typeof exported !== 'object') return normalizeTables({});
  for (const [sheetKey, sheet] of Object.entries(exported)) {
    const name = text(sheetKey).replace(/^sheet_/, '');
    const columns = TABLE_COLUMNS[name];
    if (!columns) continue;
    const content = Array.isArray(sheet?.content) ? sheet.content : [];
    const header = Array.isArray(content[0]) ? content[0].map(cell => text(cell)) : [];
    const rows = [];
    for (const raw of content.slice(1)) {
      if (!Array.isArray(raw) || raw.every(cell => cell === '' || cell === null || cell === undefined)) continue;
      const row = {};
      columns.forEach((column, index) => {
        const positional = raw[index];
        if (positional !== undefined) { row[column] = positional === '' ? null : positional; return; }
        const label = TABLE_LABELS[name]?.[index - 1];
        const at = label ? header.indexOf(label) : -1;
        row[column] = at >= 0 && raw[at] !== undefined && raw[at] !== '' ? raw[at] : null;
      });
      rows.push(row);
    }
    out[name] = rows;
  }
  return normalizeTables(out);
}

/** Independent route: terminal -> rows.projectAll (card projector), then the same normalization. */
export function tablesFromTerminal(terminal, { turn = 0, projectAll = null } = {}) {
  const projector = projectAll || globalThis.CxxDataRows?.projectAll;
  if (typeof projector !== 'function') {
    const error = new Error('独立模式缺少表投影器（CxxDataRows.projectAll）');
    error.code = 'facts_projector_missing';
    throw error;
  }
  return normalizeTables(projector(terminal || EMPTY, num(turn, 0) ?? 0));
}

export function detectDatabase({ api = null } = {}) {
  const target = api || globalThis.AutoCardUpdaterAPI;
  if (typeof target?.exportTableAsJson !== 'function') return { ok: false, route: 'derived', reason: '数据库接口不可用，本轮沿独立投影取数', source: 'web-independent' };
  return { ok: true, route: 'plugin', reason: '插件数据库可用，本轮沿原表读取', source: 'plugin-database' };
}

export function readPluginTables(api = null) {
  const target = api || globalThis.AutoCardUpdaterAPI;
  if (typeof target?.exportTableAsJson !== 'function') return { ok: false, filled: 0, reason: '数据库接口不可用', tables: normalizeTables({}) };
  try {
    const exported = target.exportTableAsJson();
    const tables = tablesFromExport(typeof exported === 'string' ? JSON.parse(exported) : exported);
    const filled = EVIDENCE_TABLES.filter(name => rowsOf(tables, name).length).length;
    return { ok: true, tables, filled, reason: filled ? '' : '原表为空，视图按无记录处理' };
  } catch (cause) {
    return { ok: false, filled: 0, reason: '原表读取失败：' + (cause?.message || cause), tables: normalizeTables({}) };
  }
}
/** Fixed views: label of the same name either served by the plugin database or derived here, same columns and empty semantics. */
export const SLOT_NAMES = Object.freeze({ primary: '主手', secondary: '副手', face: '头部', body: '躯干', legs: '腿部', cyber: '义体' });
const OPEN_QUEST_EXCLUDED = ['完成', '已完成', '失败', '已放弃', '已错过', '已过期', '已取消'];

const orderBy = (rows, key) => rows.slice().sort((left, right) => (Number(left[key]) || 0) - (Number(right[key]) || 0));
const byActor = rows => orderBy(rows, 'row_id');

/** Equipped / un-equipped rows with item definitions folded in; a missing definition keeps item_key and 杂项. */
export function equipmentView(tables, installed = 1) {
  const defs = new Map(rowsOf(tables, 'cxx_item_def').map(row => [text(row.item_key), row]));
  return byActor(rowsOf(tables, 'cxx_equipment'))
    .filter(row => flag(row.installed) === (installed ? 1 : 0))
    .map(row => {
      const def = defs.get(text(row.item_key)) || null;
      return {
        actor_key: text(row.actor_key),
        slot: text(row.slot) || '义体',
        item_key: text(row.item_key),
        item_name: text(def?.name) || text(row.item_key),
        installed: flag(row.installed),
        updated_turn: num(row.updated_turn),
        def_present: def ? 1 : 0,
      };
    });
}

function inventoryView(tables) {
  const defs = new Map(rowsOf(tables, 'cxx_item_def').map(row => [text(row.item_key), row]));
  return byActor(rowsOf(tables, 'cxx_inventory')).map(row => {
    const def = defs.get(text(row.item_key)) || null;
    return {
      actor_key: text(row.actor_key),
      item_key: text(row.item_key),
      item_name: text(def?.name) || text(row.item_key),
      category: text(def?.category) || '杂项',
      count: num(row.count, 0) ?? 0,
      quality: text(row.quality),
      note: row.note === undefined ? null : row.note,
      def_present: def ? 1 : 0,
    };
  });
}

function statView(tables) {
  const stats = new Map(rowsOf(tables, 'cxx_actor_stat').map(row => [text(row.actor_key), row]));
  return byActor(rowsOf(tables, 'cxx_actor')).map(row => {
    const stat = stats.get(text(row.actor_key)) || null;
    return {
      actor_key: text(row.actor_key),
      name: text(row.name) || text(row.actor_key),
      hp: stat ? num(stat.hp) : null,
      sanity: stat ? num(stat.sanity) : null,
      fatigue: stat ? num(stat.fatigue) : null,
      yen: stat ? num(stat.yen) : null,
      extra_json: stat ? (stat.extra_json === undefined ? null : stat.extra_json) : null,
      stat_present: stat ? 1 : 0,
    };
  });
}

function questView(tables) {
  const meta = new Map(rowsOf(tables, 'cxx_quest_meta').map(row => [text(row.quest_key), row]));
  return byActor(rowsOf(tables, 'cxx_quest'))
    .filter(row => !OPEN_QUEST_EXCLUDED.includes(text(row.state)))
    .map(row => {
      const extra = meta.get(text(row.quest_key)) || null;
      return {
        quest_key: text(row.quest_key),
        owner_key: text(row.owner_key),
        state: text(row.state) || '已发布',
        objective: text(row.objective),
        agree_yen: num(row.agree_yen),
        paid_yen: num(row.paid_yen),
        rank: text(extra?.rank),
        known_facts: extra?.known_facts === undefined ? null : extra.known_facts,
      };
    });
}

const tailRecent = (rows, limit) => orderBy(rows, 'row_id').slice(-limit);

/** The 11 fixed views. sql is the comparison template: same columns, same null and empty semantics as derive. */
export const VIEWS = [
  {
    id: 'v_actor_public', purpose: '角色公开档案', tables: ['cxx_actor'],
    columns: ['actor_key', 'name', 'kind', 'location', 'chapter', 'status', 'updated_turn'],
    sql: 'SELECT actor_key, name, kind, location, chapter, status, updated_turn FROM cxx_actor ORDER BY row_id',
    derive: tables => byActor(rowsOf(tables, 'cxx_actor')).map(row => ({
      actor_key: text(row.actor_key), name: text(row.name) || text(row.actor_key), kind: text(row.kind),
      location: text(row.location), chapter: text(row.chapter), status: text(row.status), updated_turn: num(row.updated_turn),
    })),
  },
  {
    id: 'v_actor_stat', purpose: '角色数值（缺行给 null，不给 0）', tables: ['cxx_actor', 'cxx_actor_stat'],
    columns: ['actor_key', 'name', 'hp', 'sanity', 'fatigue', 'yen', 'extra_json', 'stat_present'],
    sql: 'SELECT a.actor_key, a.name, s.hp, s.sanity, s.fatigue, s.yen, s.extra_json, CASE WHEN s.actor_key IS NULL THEN 0 ELSE 1 END AS stat_present FROM cxx_actor a LEFT JOIN cxx_actor_stat s ON s.actor_key = a.actor_key ORDER BY a.row_id',
    derive: statView,
  },
  {
    id: 'v_inventory_detail', purpose: '背包明细（缺定义回落 item_key / 杂项）', tables: ['cxx_inventory', 'cxx_item_def'],
    columns: ['actor_key', 'item_key', 'item_name', 'category', 'count', 'quality', 'note', 'def_present'],
    sql: 'SELECT i.actor_key, i.item_key, COALESCE(d.name, i.item_key) AS item_name, COALESCE(d.category, \'杂项\') AS category, i.count, i.quality, i.note, CASE WHEN d.item_key IS NULL THEN 0 ELSE 1 END AS def_present FROM cxx_inventory i LEFT JOIN cxx_item_def d ON d.item_key = i.item_key ORDER BY i.row_id',
    derive: inventoryView,
  },
  {
    id: 'v_equipped', purpose: '已装备义体与武器', tables: ['cxx_equipment', 'cxx_item_def'],
    columns: ['actor_key', 'slot', 'item_key', 'item_name', 'installed', 'updated_turn', 'def_present'],
    sql: 'SELECT e.actor_key, e.slot, e.item_key, COALESCE(d.name, e.item_key) AS item_name, e.installed, e.updated_turn, CASE WHEN d.item_key IS NULL THEN 0 ELSE 1 END AS def_present FROM cxx_equipment e LEFT JOIN cxx_item_def d ON d.item_key = e.item_key WHERE e.installed = 1 ORDER BY e.row_id',
    derive: tables => equipmentView(tables, 1),
  },
  {
    id: 'v_uninstalled', purpose: '未装备（在包里或待装）', tables: ['cxx_equipment', 'cxx_item_def'],
    columns: ['actor_key', 'slot', 'item_key', 'item_name', 'installed', 'updated_turn', 'def_present'],
    sql: 'SELECT e.actor_key, e.slot, e.item_key, COALESCE(d.name, e.item_key) AS item_name, e.installed, e.updated_turn, CASE WHEN d.item_key IS NULL THEN 0 ELSE 1 END AS def_present FROM cxx_equipment e LEFT JOIN cxx_item_def d ON d.item_key = e.item_key WHERE e.installed = 0 ORDER BY e.row_id',
    derive: tables => equipmentView(tables, 0),
  },
  {
    id: 'v_wallet', purpose: '钱包（聊天与世界两个作用域）', tables: ['cxx_wallet'],
    columns: ['scope_key', 'yen', 'earned', 'spent', 'updated_turn'],
    sql: 'SELECT scope_key, yen, earned, spent, updated_turn FROM cxx_wallet ORDER BY row_id',
    derive: tables => byActor(rowsOf(tables, 'cxx_wallet')).map(row => ({
      scope_key: text(row.scope_key), yen: num(row.yen, 0) ?? 0, earned: num(row.earned, 0) ?? 0, spent: num(row.spent, 0) ?? 0, updated_turn: num(row.updated_turn),
    })),
  },
  {
    id: 'v_roster_present', purpose: '在场角色', tables: ['cxx_roster'],
    columns: ['actor_key', 'present', 'last_floor', 'last_story'],
    sql: 'SELECT actor_key, present, last_floor, last_story FROM cxx_roster WHERE present = 1 ORDER BY row_id',
    derive: tables => byActor(rowsOf(tables, 'cxx_roster')).filter(row => flag(row.present) === 1).map(row => ({
      actor_key: text(row.actor_key), present: 1, last_floor: num(row.last_floor), last_story: text(row.last_story),
    })),
  },
  {
    id: 'v_scene_now', purpose: '当前场景与故事时间', tables: ['cxx_scene'],
    columns: ['scope_key', 'opening', 'area', 'clock', 'updated_turn'],
    sql: 'SELECT scope_key, opening, area, clock, updated_turn FROM cxx_scene ORDER BY row_id',
    derive: tables => byActor(rowsOf(tables, 'cxx_scene')).map(row => ({
      scope_key: text(row.scope_key), opening: text(row.opening), area: text(row.area), clock: text(row.clock), updated_turn: num(row.updated_turn),
    })),
  },
  {
    id: 'v_quest_open', purpose: '未结委托（含档位与已知情报）', tables: ['cxx_quest', 'cxx_quest_meta'],
    columns: ['quest_key', 'owner_key', 'state', 'objective', 'agree_yen', 'paid_yen', 'rank', 'known_facts'],
    sql: 'SELECT q.quest_key, q.owner_key, q.state, q.objective, q.agree_yen, q.paid_yen, m.rank, m.known_facts FROM cxx_quest q LEFT JOIN cxx_quest_meta m ON m.quest_key = q.quest_key WHERE q.state NOT IN (\'完成\', \'失败\', \'已放弃\', \'已错过\', \'已过期\', \'已取消\') ORDER BY q.row_id',
    derive: questView,
  },
  {
    id: 'v_turn_recent', purpose: '最近回合摘要', tables: ['cxx_turn_index'],
    columns: ['turn_no', 'summary', 'entities'],
    sql: 'SELECT turn_no, summary, entities FROM cxx_turn_index ORDER BY turn_no DESC LIMIT 8',
    derive: tables => tailRecent(rowsOf(tables, 'cxx_turn_index'), 8).map(row => ({
      turn_no: num(row.turn_no, 0) ?? 0, summary: text(row.summary), entities: text(row.entities),
    })),
  },
  {
    id: 'v_fact_recent', purpose: '最近事实归档', tables: ['cxx_fact'],
    columns: ['fact_key', 'turn_no', 'kind', 'payload'],
    sql: 'SELECT fact_key, turn_no, kind, payload FROM cxx_fact ORDER BY turn_no DESC, row_id DESC LIMIT 8',
    derive: tables => tailRecent(rowsOf(tables, 'cxx_fact'), 8).map(row => ({
      fact_key: text(row.fact_key), turn_no: num(row.turn_no, 0) ?? 0, kind: text(row.kind), payload: text(row.payload),
    })),
  },
];

export const VIEW_IDS = VIEWS.map(view => view.id);

export function viewOf(id) {
  return VIEWS.find(view => view.id === id) || null;
}

/** All fixed views over one table set; every row keeps its declared column order. */
export function deriveViews(tables) {
  const out = {};
  for (const view of VIEWS) {
    const rows = view.derive(normalizeTables(tables));
    out[view.id] = rows.map(row => {
      const shaped = {};
      for (const column of view.columns) shaped[column] = row[column] === undefined ? null : row[column];
      return shaped;
    });
  }
  return out;
}

export function viewSignatures(views) {
  return VIEW_IDS.map(id => ({ id, columns: (viewOf(id)?.columns || []).slice(), rows: (views?.[id] || []).length }));
}
/** Route facts (era / chapter / locations / characters) — the same four field families the A4 route note uses. */
export const ROUTE_KEYS = ['era', 'chapter', 'locations', 'characters'];
export const ROUTE_LIMITS = Object.freeze({ locations: 6, characters: 16 });

const PLANNED_RE = /(打算|准备|将要|即将|下一步|计划|预计|会先|先把|想要|企图|按计划|待会儿|稍后)/;
const CLAIM_RE = /(据说|听说|据传|声称|自称|传闻|他们都说|据称)/;
const UNKNOWN_RE = /(不清楚|不知道|未确认|也许|可能|大概|待查)/;

const sentences = value => text(value).split(/[。！？!?\n]+/).map(part => part.trim()).filter(Boolean);
const excerpt = (value, limit = 120) => {
  const flat = text(value).replace(/\s+/g, ' ').trim();
  return flat.length > limit ? flat.slice(0, limit) + '…' : flat;
};

/** Route facts never invent values: a field without a backing row is reported as an empty fact, not a default. */
export function routeFacts(tables, { floor = null } = {}) {
  const scene = rowsOf(tables, 'cxx_scene')[0] || null;
  const actors = rowsOf(tables, 'cxx_actor');
  const roster = new Map(rowsOf(tables, 'cxx_roster').map(row => [text(row.actor_key), row]));
  const yearMatch = text(scene?.clock).match(/(\d{4})/);
  const era = yearMatch ? { value: yearMatch[1] + ' 年', status: 'happened', source: { route: 'derived', table: 'cxx_scene', rowId: scene?.row_id ?? null, column: 'clock', floor } } : { value: '', status: 'unknown', source: { route: 'derived', table: 'cxx_scene', rowId: null, column: 'clock', floor } };
  const primary = actors.find(row => ['玩家', 'player', '主角'].includes(text(row.kind))) || actors[0] || null;
  const chapter = text(primary?.chapter)
    ? { value: text(primary?.chapter), status: 'happened', source: { route: 'derived', table: 'cxx_actor', rowId: primary?.row_id ?? null, column: 'chapter', floor } }
    : { value: '', status: 'unknown', source: { route: 'derived', table: 'cxx_actor', rowId: null, column: 'chapter', floor } };
  const locations = [];
  const seenPlace = new Set();
  const pushPlace = (value, source) => {
    const name = text(value).trim();
    if (!name || seenPlace.has(name) || locations.length >= ROUTE_LIMITS.locations) return;
    seenPlace.add(name);
    locations.push({ value: name, status: 'happened', source });
  };
  pushPlace(scene?.area, { route: 'derived', table: 'cxx_scene', rowId: scene?.row_id ?? null, column: 'area', floor });
  for (const actor of actors) pushPlace(actor.location, { route: 'derived', table: 'cxx_actor', rowId: actor.row_id ?? null, column: 'location', floor });
  const characters = [];
  const seenActor = new Set();
  for (const actor of actors) {
    const name = text(actor.name) || text(actor.actor_key);
    if (!name || seenActor.has(name) || characters.length >= ROUTE_LIMITS.characters) continue;
    seenActor.add(name);
    const present = roster.has(text(actor.actor_key)) ? flag(roster.get(text(actor.actor_key)).present) : null;
    characters.push({ value: name, present, status: present === null ? 'unknown' : 'happened', source: { route: 'derived', table: 'cxx_actor', rowId: actor.row_id ?? null, column: 'name', floor } });
  }
  return { era, chapter, locations, characters };
}

/** Message classification: a plan is planned, a retelling is claimed, a bare line is happened. */
export function classifyText(value) {
  const body = text(value);
  if (!body) return 'unknown';
  if (PLANNED_RE.test(body) && !/已经|刚|刚刚|方才/.test(body)) return 'planned';
  if (CLAIM_RE.test(body)) return 'claimed';
  if (UNKNOWN_RE.test(body)) return 'unknown';
  return 'happened';
}

function messageFacts(messages, { floor = null } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const facts = [];
  list.forEach((message, index) => {
    const body = text(message?.content ?? message?.text ?? message);
    if (!body.trim()) return;
    for (const sentence of sentences(body).slice(-4)) {
      facts.push({
        id: 'message:' + (message?.id || index) + ':' + factDigest(sentence),
        kind: 'message',
        status: classifyText(sentence),
        source: { route: 'message', table: null, rowId: index, floor: num(message?.floor, floor), speaker: text(message?.role || message?.name || 'narrator'), at: text(message?.at) },
        body: excerpt(sentence, 160),
      });
    }
  });
  return facts;
}

function viewFacts(views, { route, floor = null } = {}) {
  const facts = [];
  for (const view of VIEWS) {
    (views?.[view.id] || []).forEach((row, index) => {
      facts.push({
        id: 'view:' + view.id + ':' + (row.row_id ?? index),
        field: view.id,
        kind: 'view',
        status: 'happened',
        source: { route, table: view.tables.join('+'), rowId: num(row.row_id, index) ?? index, floor },
        body: excerpt(JSON.stringify(row), 220),
      });
    });
  }
  return facts;
}

/** The six fields the no-database path must still produce; planned and claimed never merge into happened. */
export function noDbFacts({ messages = [], scene = null, tables = null, floor = null, turn = null } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const lastAssistant = [...list].reverse().find(message => ['assistant', 'ai', 'narrator', 'system'].includes(text(message?.role)));
  const lastUser = [...list].reverse().find(message => ['user', 'player'].includes(text(message?.role)));
  /* current_state 取最后一条真的写下了「已发生」的正文，而不是最后一条带计划口吻的句子。 */
  const stateMessage = [...list].reverse().find(message => sentences(message?.content ?? message?.text ?? message).some(line => classifyText(line) === 'happened')) || lastAssistant;
  const actorNames = (rowsOf(tables || EMPTY, 'cxx_actor') || []).map(row => text(row.name)).filter(Boolean);
  const place = text(scene?.area);
  const planned = [];
  const claimed = [];
  const unknown = [];
  for (const message of list) {
    for (const sentence of sentences(message?.content ?? message?.text ?? message)) {
      const status = classifyText(sentence);
      const entry = { status, body: excerpt(sentence, 140), source: { table: null, floor: num(message?.floor, floor), speaker: text(message?.role || 'narrator') } };
      if (status === 'planned') planned.push(entry);
      else if (status === 'claimed') claimed.push(entry);
      else if (status === 'unknown') unknown.push(entry);
    }
  }
  const turns = rowsOf(tables || EMPTY, 'cxx_turn_index');
  const progressionBody = turns.length
    ? turns.slice(-3).map(row => '第 ' + text(row.turn_no) + ' 回合：' + excerpt(row.summary, 80)).join('；')
    : list.length + ' 条对话，尚无回合摘要';
  const recall = [];
  if (place) recall.push('地点：' + place);
  const presentNames = (rowsOf(tables || EMPTY, 'cxx_roster') || []).filter(row => flag(row.present) === 1).map(row => text(row.actor_key));
  if (presentNames.length) recall.push('在场：' + presentNames.join('、'));
  const userWords = [...new Set(sentences(lastUser?.content || '').join(' ').match(/[\u4e00-\u9fa5A-Za-z0-9]{2,6}/g) || [])].slice(0, 8);
  if (userWords.length) recall.push('本轮关注：' + userWords.join('、'));
  const missing = EVIDENCE_TABLES.filter(name => !rowsOf(tables || EMPTY, name).length);
  const unresolved = actorNames.filter(name => name && !text(list.map(message => message?.content || '').join(' ')).includes(name)).slice(0, 4);
  return {
    current_state: { field: 'current_state', status: 'happened', body: excerpt(stateMessage?.content || '', 200) || '本轮尚无正文', source: { table: null, floor, speaker: text(stateMessage?.role || 'assistant') } },
    player_intent: { field: 'player_intent', status: 'planned', body: excerpt(lastUser?.content || '', 200) || '本轮没有玩家输入', source: { table: null, floor, speaker: 'user' } },
    progression: { field: 'progression', status: 'happened', body: progressionBody, source: { table: 'cxx_turn_index', floor } },
    recall_needs: { field: 'recall_needs', status: 'happened', body: recall.join('；') || '无额外召回线索', source: { table: null, floor } },
    unsupported_claims: { field: 'unsupported_claims', status: planned.length ? 'planned' : 'happened', body: planned.map(entry => entry.body).join(' / ') || '没有无表依据的计划句', items: planned, source: { table: null, floor } },
    uncertainties: {
      field: 'uncertainties',
      status: (missing.length || unresolved.length || claimed.length || unknown.length) ? 'unknown' : 'happened',
      body: [
        missing.length ? '缺表：' + missing.join('、') : '',
        unresolved.length ? '正文未提及：' + unresolved.join('、') : '',
        claimed.length ? '转述待核：' + claimed.map(entry => entry.body).join(' / ') : '',
        unknown.length ? '未确认：' + unknown.map(entry => entry.body).join(' / ') : '',
      ].filter(Boolean).join('；') || '没有已知缺口',
      items: { missing, unresolved, claimed, unknown },
      source: { table: null, floor },
    },
  };
}

/** One bundle for both routes plus the no-database path; every fact keeps its route, row, floor and speaker. */
export function buildFactBundle({ route = 'derived', terminal = null, tables = null, views = null, projectAll = null, turn = 0, floor = null, messages = [], scene = null, source = null } = {}) {
  const detected = route === 'plugin' || route === 'derived' ? route : 'none';
  let tableSet = tables;
  if (!tableSet && detected === 'derived' && terminal) tableSet = tablesFromTerminal(terminal, { turn, projectAll });
  tableSet = normalizeTables(tableSet || {});
  const viewSet = views || deriveViews(tableSet);
  const filled = EVIDENCE_TABLES.filter(name => rowsOf(tableSet, name).length);
  const sceneRow = scene || rowsOf(tableSet, 'cxx_scene')[0] || null;
  const facts = [...viewFacts(viewSet, { route: detected, floor }), ...messageFacts(messages, { floor })];
  const six = noDbFacts({ messages, scene: sceneRow, tables: tableSet, floor, turn });
  const bundle = {
    schema: FACT_SCHEMA,
    path: detected === 'plugin' ? 'plugin-database' : detected === 'derived' ? 'independent-projection' : 'no-database',
    route: detected,
    at: new Date().toISOString(),
    floor,
    turn,
    source: source || { route: detected, filled: filled.length, tables: filled },
    tables: tableSet,
    views: viewSet,
    routeFacts: routeFacts(tableSet, { floor }),
    facts,
    six,
  };
  bundle.capsule = capsule(bundle);
  return bundle;
}

/** Compact text form for prompts and diagnostics; every line names where the fact came from. */
export function capsule(bundle, { limit = 1600 } = {}) {
  if (!bundle) return '';
  const lines = [];
  lines.push('[事实] 路径=' + bundle.path + ' 来源=' + (bundle.source?.route || bundle.route) + ' 楼层=' + (bundle.floor ?? '—'));
  const views = bundle.views || {};
  const scene = (views.v_scene_now || [])[0];
  if (scene) lines.push('[场景] ' + [scene.area, scene.opening, scene.clock].filter(Boolean).join(' · '));
  const stats = (views.v_actor_stat || []).filter(row => row.stat_present === 1).slice(0, 4);
  if (stats.length) lines.push('[数值] ' + stats.map(row => row.name + ' HP' + (row.hp ?? '—') + '/理智' + (row.sanity ?? '—') + '/¥' + (row.yen ?? '—')).join('；'));
  const gear = (views.v_equipped || []).slice(0, 6);
  if (gear.length) lines.push('[已装备] ' + gear.map(row => row.slot + ':' + row.item_name).join('、'));
  const loose = (views.v_uninstalled || []).slice(0, 4);
  if (loose.length) lines.push('[未装备] ' + loose.map(row => row.slot + ':' + row.item_name).join('、'));
  const quests = (views.v_quest_open || []).slice(0, 3);
  if (quests.length) lines.push('[委托] ' + quests.map(row => row.quest_key + '(' + row.state + ')').join('；'));
  const turns = (views.v_turn_recent || []).slice(-2);
  if (turns.length) lines.push('[近况] ' + turns.map(row => '第' + row.turn_no + '回合 ' + excerpt(row.summary, 60)).join('；'));
  const six = bundle.six || {};
  if (six.unsupported_claims?.items?.length) lines.push('[计划待落实] ' + six.unsupported_claims.items.slice(0, 3).map(item => item.body).join(' / '));
  if (six.uncertainties?.body && six.uncertainties.status !== 'happened') lines.push('[缺口] ' + six.uncertainties.body);
  const joined = lines.join('\n');
  return joined.length > limit ? joined.slice(0, limit) + '…' : joined;
}

export default { FACT_SCHEMA, EVIDENCE_TABLES, SECONDARY_TABLES, WRITE_LEDGER_TABLE, TABLE_COLUMNS, TABLE_LABELS, VIEWS, VIEW_IDS, ROUTE_KEYS, viewOf, deriveViews, viewSignatures, equipmentView, routeFacts, classifyText, noDbFacts, buildFactBundle, capsule, normalizeTable, normalizeTables, tablesFromExport, tablesFromTerminal, detectDatabase, readPluginTables, factDigest };
