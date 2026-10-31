/** U03 acceptance: one fact bundle for the plugin database, the independent projection and the no-database path.
 *  Checks the 11 fixed views against their SQL templates, plugin/derived parity on one story, empty-vs-missing,
 *  renamed actors, multi-owner items, the six no-db fields, and the three database availability states. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  EVIDENCE_TABLES, TABLE_COLUMNS, TABLE_LABELS, VIEWS, VIEW_IDS,
  normalizeTables, tablesFromExport, tablesFromTerminal, deriveViews, equipmentView,
  routeFacts, classifyText, noDbFacts, buildFactBundle, capsule, detectDatabase, readPluginTables,
} from '../src/context/facts.mjs';

const WEB = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const rowsModule = require(path.resolve(WEB, '../卡片源码/数据/rows.js'));
const projectAll = rowsModule.projectAll;
const checks = [];
const record = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/* ── one story, two routes ─────────────────────────────────────────────── */
const terminal = {
  opening: { title: '盗芯之夜', place: '野狼酒吧' },
  clock: '2051-03-14 22:10',
  wallet: { yen: 5000, earned: 9000, spent: 4000 },
  gameplay: { location: { mapId: '夜之城', placeId: '野狼酒吧' } },
  ensemble: {
    actors: {
      v: {
        actorId: 'actor:v', name: 'V', controllable: true,
        sourceRef: { location: '野狼酒吧', chapter: '第一章 盗芯之夜' },
        wallet: { yen: 1200, earned: 2000, spent: 800 },
        gameplay: {
          numeric: { hp: 0, fatigue: 3, attack: 12 },
          sanity: 88,
          inventory: {
            'item:katana': { definitionRef: { id: 'item:katana' }, quantity: 1, quality: 'fine', note: '刀柄缠着胶带' },
            'item:chip': { definitionRef: { id: 'item:chip' }, quantity: 3 },
          },
          equipment: {
            primary: { itemId: 'item:katana', slotKey: 'primary', installed: true },
            cyber: { itemId: 'item:implant', slotKey: 'cyber', installed: false },
          },
          itemDefinitions: {
            'item:katana': { id: 'item:katana', name: '电磁武士刀', category: 'weapon', price: 2600, description: '近战' },
            'item:chip': { id: 'item:chip', name: '记忆芯片', category: 'consumable', price: 300 },
            'item:implant': { id: 'item:implant', name: '歧路司基础义眼', category: 'cyberware', price: 900 },
          },
        },
      },
      j: {
        actorId: 'actor:j', name: '朱迪',
        sourceRef: { location: '野狼酒吧', chapter: '第一章 盗芯之夜' },
        gameplay: { numeric: { hp: 60 }, inventory: { 'item:katana': { definitionRef: { id: 'item:katana' }, quantity: 2 } } },
      },
    },
  },
  roster: { present: ['actor:v'], lastSeen: { 'actor:v': { floor: 12, story: '野狼酒吧的雨夜' } } },
  quests: {
    q1: { id: 'q1', ownerActorId: 'actor:v', state: '已发布', objective: '取回芯片', agreedYen: 800, paidYen: 200, rank: 'C', knownFacts: '芯片在朱迪手里' },
    q2: { id: 'q2', state: '已完成', objective: '旧委托' },
  },
};
const TURN = 12;
const facts = [{ fact_key: 'f12', turn_no: TURN, kind: 'story', payload: 'V 在野狼酒吧接下取芯片的活' }];
const turns = [{ turn_no: 10, summary: '雨夜进店', entities: ['V'] }, { turn_no: 11, summary: '接下委托', entities: ['V', '朱迪'] }];

const tables = tablesFromTerminal(terminal, { turn: TURN, projectAll: (snapshot, turn) => projectAll(snapshot, turn, { facts, turns }) });

function toExport(source) {
  const out = {};
  for (const [name, rows] of Object.entries(source)) {
    const columns = TABLE_COLUMNS[name];
    const labels = TABLE_LABELS[name];
    if (!columns) continue;
    const header = ['row_id', ...(labels || columns.slice(1))];
    const content = [header];
    rows.forEach((row, index) => {
      content.push(columns.map(column => {
        if (column === 'row_id') return index + 1;
        const value = row[column];
        return value === undefined || value === null ? '' : value;
      }));
    });
    out['sheet_' + name] = { content };
  }
  return out;
}

/* 1) eleven fixed views, columns and SQL templates in step */
const viewProblems = [];
for (const view of VIEWS) {
  if (!view.columns?.length) viewProblems.push(view.id + ': 无列');
  if (new Set(view.columns).size !== view.columns.length) viewProblems.push(view.id + ': 列重名');
  if (!Array.isArray(view.tables) || !view.tables.every(name => TABLE_COLUMNS[name])) viewProblems.push(view.id + ': 表未登记');
  if (!/^SELECT .+ FROM /.test(view.sql)) viewProblems.push(view.id + ': SQL 模板不完整');
  const selectPart = view.sql.slice('SELECT '.length, view.sql.indexOf(' FROM '));
  for (const column of view.columns) {
    if (!new RegExp('(^|[\\s,.])' + column + '($|[\\s,])').test(selectPart + ' ')) viewProblems.push(view.id + ': SQL 缺列 ' + column);
  }
}
record('11 条固定视图的列与 SQL 模板同序', VIEW_IDS.length === 11 && new Set(VIEW_IDS).size === 11 && viewProblems.length === 0, { views: VIEW_IDS, problems: viewProblems });

/* 2) plugin export and independent projection agree on one story */
const reimported = tablesFromExport(toExport(tables));
const derivedDirect = deriveViews(tables);
const derivedReimported = deriveViews(reimported);
const tableDiffs = Object.keys(TABLE_COLUMNS).filter(name => !same(tables[name], reimported[name]));
const viewDiffs = VIEW_IDS.filter(id => !same(derivedDirect[id], derivedReimported[id]));
record('同一故事：插件导出与独立投影逐表逐视图一致', tableDiffs.length === 0 && viewDiffs.length === 0, {
  tables: Object.keys(TABLE_COLUMNS).length, viewDiffs, tableDiffs,
  rows: Object.fromEntries(EVIDENCE_TABLES.map(name => [name, tables[name].length])),
  views: Object.fromEntries(VIEW_IDS.map(id => [id, derivedDirect[id].length])),
});

/* 3) equipped and un-equipped stay apart and carry item names */
const equipped = derivedDirect.v_equipped;
const loose = derivedDirect.v_uninstalled;
record('已装备与未装备分开且带物品名',
  equipped.length === 1 && equipped[0].slot === '主手' && equipped[0].item_name === '电磁武士刀' && equipped[0].installed === 1
  && loose.length === 1 && loose[0].slot === '义体' && loose[0].item_name === '歧路司基础义眼' && loose[0].installed === 0,
  { equipped, loose });

/* 4) missing records vs empty values */
const sparse = normalizeTables({
  cxx_actor: [{ actor_key: 'a1', name: '有数值' }, { actor_key: 'a2', name: '无数值行' }],
  cxx_actor_stat: [{ actor_key: 'a1', hp: 0, sanity: 0, yen: 0, extra_json: null }],
  cxx_inventory: [{ actor_key: 'a1', item_key: 'item:ghost', count: 1, note: null }],
});
const sparseViews = deriveViews(sparse);
const zero = sparseViews.v_actor_stat.find(row => row.actor_key === 'a1');
const absent = sparseViews.v_actor_stat.find(row => row.actor_key === 'a2');
const ghost = sparseViews.v_inventory_detail[0];
record('无记录给 null、空值保留 0、缺定义回落',
  zero.hp === 0 && zero.stat_present === 1 && absent.hp === null && absent.stat_present === 0
  && ghost.note === null && ghost.item_name === 'item:ghost' && ghost.category === '杂项' && ghost.def_present === 0,
  { zero, absent, ghost });

/* 5) renaming an actor keeps the key and the row count, and follows into the capsule */
const renamed = normalizeTables({ ...tables, cxx_actor: tables.cxx_actor.map(row => (row.actor_key === 'actor:j' ? { ...row, name: '朱迪·阿尔瓦雷兹' } : row)) });
const beforeName = derivedDirect.v_actor_public.find(row => row.actor_key === 'actor:j')?.name;
const afterRow = deriveViews(renamed).v_actor_public.find(row => row.actor_key === 'actor:j');
const renamedBundle = buildFactBundle({ route: 'derived', tables: renamed, messages: [], floor: TURN, turn: TURN });
record('角色改名：键不变、行数不变、改名进入视图与胶囊',
  beforeName === '朱迪' && afterRow?.name === '朱迪·阿尔瓦雷兹' && afterRow.actor_key === 'actor:j'
  && deriveViews(renamed).v_actor_public.length === derivedDirect.v_actor_public.length
  && capsule(renamedBundle).includes('朱迪·阿尔瓦雷兹'),
  { beforeName, afterRow, capsule: capsule(renamedBundle) });

/* 6) one item held by two actors */
const multi = derivedDirect.v_inventory_detail.filter(row => row.item_key === 'item:katana');
record('同一物品多持有者各算各的',
  multi.length === 2 && multi[0].count === 1 && multi[1].count === 2
  && multi.every(row => row.def_present === 1 && row.item_name === '电磁武士刀'),
  { rows: multi });

/* 7) the six no-database fields keep plans apart from what happened */
const messages = [
  { role: 'user', content: '我打算今晚去野狼酒吧找朱迪，先把芯片弄到手。', floor: 12, at: '2026-10-26T13:00:00.000Z' },
  { role: 'assistant', content: 'V 推门进了野狼酒吧，身上的湿气还没散。', floor: 13 },
  { role: 'assistant', content: '听说芯片已经被人转手。', floor: 13 },
  { role: 'assistant', content: '下一步预计会有人来收债。', floor: 13 },
];
const six = noDbFacts({ messages, scene: { area: '夜之城/野狼酒吧', clock: '2051-03-14 22:10' }, tables, floor: 13, turn: TURN });
const sixKeys = ['current_state', 'player_intent', 'progression', 'recall_needs', 'unsupported_claims', 'uncertainties'];
const plannedBodies = six.unsupported_claims.items.map(item => item.body);
const happenedInClaims = plannedBodies.some(body => body.includes('推门进了野狼酒吧'));
record('无DB六字段：计划与已发生分列',
  sixKeys.every(key => six[key] && typeof six[key].body === 'string' && six[key].status)
  && six.current_state.body.includes('推门进了野狼酒吧') && six.current_state.status === 'happened'
  && six.player_intent.status === 'planned' && six.player_intent.body.includes('野狼酒吧')
  && six.progression.body.includes('回合') && six.recall_needs.body.includes('野狼酒吧')
  && six.unsupported_claims.status === 'planned' && plannedBodies.some(body => body.includes('今晚')) && plannedBodies.some(body => body.includes('收债'))
  && !happenedInClaims && six.uncertainties.body.includes('转述待核'),
  { six, plannedBodies, happenedInClaims });

/* 8) database availability: absent, present, then absent again */
const noApi = detectDatabase({ api: null });
const fakeTables = toExport(tables);
const fakeApi = { exportTableAsJson: () => fakeTables };
const withApi = detectDatabase({ api: fakeApi });
const pluginRead = readPluginTables(fakeApi);
const brokenApi = readPluginTables({ exportTableAsJson: () => { throw new Error('接口崩了'); } });
const backAgain = detectDatabase({ api: undefined });
record('数据库可用／停用／恢复三态',
  noApi.ok === false && noApi.route === 'derived'
  && withApi.ok === true && withApi.route === 'plugin' && pluginRead.ok === true && pluginRead.filled === 11
  && brokenApi.ok === false && brokenApi.reason.includes('接口崩了')
  && backAgain.route === 'derived',
  { noApi, withApi, filled: pluginRead.filled, broken: brokenApi.reason, backAgain: backAgain.route });

/* 9) bundle facts carry route, row and speaker; capsule names the sections */
const bundle = buildFactBundle({ route: 'derived', tables, projectAll, messages, floor: 13, turn: TURN, scene: null });
const sourceless = bundle.facts.filter(fact => !fact.source || !fact.source.route);
const viewFactWithoutTable = bundle.facts.filter(fact => fact.kind === 'view' && !fact.source.table);
const messageSpeakers = new Set(bundle.facts.filter(fact => fact.kind === 'message').map(fact => fact.source.speaker));
const text = capsule(bundle);
record('每条事实带来源，胶囊含场景／数值／装备／计划',
  bundle.schema === 1 && bundle.path === 'independent-projection' && sourceless.length === 0 && viewFactWithoutTable.length === 0
  && messageSpeakers.has('user') && messageSpeakers.has('assistant')
  && ['[场景]', '[数值]', '[已装备]', '[未装备]', '[委托]', '[近况]', '[计划待落实]'].every(tag => text.includes(tag))
  && bundle.routeFacts.era.value.startsWith('2051') && bundle.routeFacts.locations.some(item => item.value === '野狼酒吧'),
  { facts: bundle.facts.length, sourceless: sourceless.length, speakers: [...messageSpeakers], capsule: text });

/* 10) closed quests stay out of the open view */
record('已结委托不进未结视图，档位与情报带上',
  derivedDirect.v_quest_open.length === 1 && derivedDirect.v_quest_open[0].quest_key === 'q1'
  && derivedDirect.v_quest_open[0].rank === 'C' && derivedDirect.v_quest_open[0].state === '已发布'
  && VIEWS.find(view => view.id === 'v_quest_open').sql.includes('NOT IN'),
  { open: derivedDirect.v_quest_open });

/* 11) the no-database story reuses the same tables: same views, only route differs */
const noDbBundle = buildFactBundle({ route: 'none', tables, messages, floor: 13, turn: TURN });
record('无DB路径复用同一批视图，只有路径与来源不同',
  same(noDbBundle.views, bundle.views) && noDbBundle.path === 'no-database'
  && noDbBundle.facts.length === bundle.facts.length && noDbBundle.six.unsupported_claims.status === 'planned',
  { path: noDbBundle.path, facts: noDbBundle.facts.length });

/* 12) classifyText covers planned / claimed / happened / unknown */
const samples = { planned: classifyText('我准备明天动手'), claimed: classifyText('据说有人见过她'), happened: classifyText('他推门进来'), unknown: classifyText('这件事我不清楚') };
record('计划／转述／已发生／未确认四类判定',
  samples.planned === 'planned' && samples.claimed === 'claimed' && samples.happened === 'happened' && samples.unknown === 'unknown',
  samples);

const failed = checks.filter(row => !row.ok);
const report = {
  schema: 1, at: new Date().toISOString(),
  scope: 'U03 fact bundle: fixed views, plugin/derived parity, no-database six fields, database availability',
  stats: { views: VIEW_IDS.length, facts: bundle.facts.length, tables: Object.keys(TABLE_COLUMNS).length, evidence: EVIDENCE_TABLES.length },
  checks,
  verdict: failed.length ? 'failed: ' + failed.map(row => row.name).join(' / ') : 'all ' + checks.length + ' checks passed',
};
fs.mkdirSync(path.join(WEB, 'reports'), { recursive: true });
fs.writeFileSync(path.join(WEB, 'reports/u03-facts-check.json'), JSON.stringify(report, null, 2));
for (const row of checks) console.log((row.ok ? 'PASS ' : 'FAIL ') + row.name);
console.log(report.verdict);
process.exit(failed.length ? 1 : 0);
