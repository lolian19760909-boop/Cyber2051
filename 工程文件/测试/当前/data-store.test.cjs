'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const Store = require(path.join(root, '卡片源码/数据/store.js'));
const template = require(path.join(root, '卡片源码/数据/schema.js'));

test('正式模板每张业务表都有稳定唯一 uid，供真实 ACU 导入校验', () => {
  const keys = Object.keys(template).filter(key => key.startsWith('sheet_'));
  assert.equal(keys.length, 18);
  assert.equal(new Set(keys.map(key => template[key].uid)).size, keys.length);
  for (const key of keys) assert.equal(template[key].uid, key, key + ' missing or drifting uid');
});

test('建表等待原插件异步 ACK 后才开始读回，保留其余表', async () => {
  const tables = { sheet_private: { name: '玩家自用表', content: [['row_id', '备注'], [1, '保留']] } };
  const kept = structuredClone(tables.sheet_private);
  const api = {
    async importTemplateFromData(doc, options) {
      assert.equal(options.scope, 'chat'); assert.equal(options.dataMode, 'seed');
      await new Promise(resolve => setTimeout(resolve, 10));
      for (const key of Object.keys(doc).filter(key => key.startsWith('sheet_'))) tables[key] = { ...structuredClone(doc[key]), content: structuredClone(tables[key]?.content || doc[key].content) };
      return { success: true, runtimeReady: true };
    },
    exportTableAsJson() { return structuredClone(tables); }
  };
  const result = await Store.ensureSchema(api, template, { wait: 1, step: 1 });
  assert.equal(result.ok, true, result.reason); assert.deepEqual(tables.sheet_private, { ...kept, uid: 'sheet_private' });
});

test('建表失败返回真实插件拒绝原因，不继续用缺表轮询覆盖 ACK', async () => {
  let reads = 0;
  const result = await Store.ensureSchema({
    getTableTemplate() { return null; },
    async importTemplateFromData() { return { success: false, error: '模板导入校验失败：表「钱包表」缺少 uid。' }; },
    exportTableAsJson() { reads++; return {}; }
  }, template, { wait: 1, step: 1 });
  assert.equal(result.ok, false); assert.match(result.reason, /钱包表.*缺少 uid/); assert.equal(reads, 1, 'only inspect the preserved baseline, never poll after a rejected ACK');
});

test('已有完整18表和玩家数据时ensureSchema只读就绪，不重交scope-only模板', async () => {
  const tables = structuredClone(template); tables.sheet_cxx_wallet.content.push([1, 'chat', 17, 17, 0, 4]);
  const result = await Store.ensureSchema({
    exportTableAsJson() { return tables; },
    async importTemplateFromData() { assert.fail('完整现存表不得再导入模板扰动持久投影'); }
  }, template);
  assert.equal(result.ok, true); assert.equal(result.attempts, 0);
  assert.equal(result.tables.cxx_wallet.content[1][2], 17);
});

test('原插件导入抛错可读返回，不留下未处理的异步拒绝', async () => {
  const result = await Store.ensureSchema({ async importTemplateFromData() { throw Error('原插件提交失败'); } }, template);
  assert.equal(result.ok, false); assert.match(result.reason, /原插件提交失败/);
});

test('真实 ACU 缺席隐藏语义下仍保留原生未知表、拼音业务键及用户字段', async () => {
  const saved = {
    mate: { type: 'chatSheets', version: 1, playerConfig: 'keep' },
    sheet_private: { uid: 'sheet_private', name: '玩家自用表', sourceData: { ddl: 'private ddl', playerField: { zero: 0 } }, content: [['row_id', '备注'], [1, '保留']] },
    sheet_jue_se_dang_an_biao: { ...structuredClone(template.sheet_cxx_actor), uid: 'sheet_jue_se_dang_an_biao', playerUnknown: { retained: true } }
  };
  const expected = structuredClone(saved); let runtime = { ...structuredClone(saved), sheet_runtime_only: { uid: 'sheet_runtime_only', name: '只在运行态的玩家表', sourceData: { ddl: 'runtime ddl' }, content: [['row_id', '备注'], [1, '同样保留']] } }, calls = 0;
  const runtimeOnly = structuredClone(runtime.sheet_runtime_only);
  const api = {
    getTableTemplate(options) { assert.deepEqual(options, { scope: 'chat' }); return structuredClone(saved); },
    exportTableAsJson() { return structuredClone(runtime); },
    async importTemplateFromData(target, options) {
      assert.equal(options.dataMode, 'seed'); calls++;
      // ACU reconcile removes absent sheets from the current visible runtime,
      // even without hard deletion. Object.assign would hide this regression.
      const next = structuredClone(target);
      for (const key of Object.keys(next)) if (runtime[key]?.content) next[key].content = structuredClone(runtime[key].content);
      runtime = next;
      return { success: true };
    }
  };
  const result = await Store.ensureSchema(api, template, { wait: 1, step: 1 });
  assert.equal(result.ok, true, result.reason); assert.equal(calls, 1);
  assert.deepEqual(runtime.sheet_private, expected.sheet_private);
  assert.deepEqual(runtime.sheet_runtime_only, runtimeOnly);
  assert.deepEqual(runtime.sheet_jue_se_dang_an_biao, expected.sheet_jue_se_dang_an_biao);
  assert.deepEqual(runtime.mate, expected.mate);
  assert.equal(runtime.sheet_cxx_actor, undefined, 'do not introduce a second schema for the existing pinyin-key table');
  assert.equal(Object.keys(runtime).filter(key => key.startsWith('sheet_')).length, 20);
});

const PINYIN = {
  cxx_actor: 'sheet_jue_se_dang_an_biao',
  cxx_actor_stat: 'sheet_jue_se_shu_zhi_biao',
  cxx_inventory: 'sheet_bei_bao_biao',
  cxx_equipment: 'sheet_zhuang_bei_biao',
  cxx_item_def: 'sheet_wu_pin_ding_yi_biao',
  cxx_fact: 'sheet_shi_shi_liu_shui_biao',
  cxx_pending_tx: 'sheet_dai_ding_shi_wu_biao',
  cxx_turn_index: 'sheet_hui_he_suo_yin_biao',
  cxx_actor_flag: 'sheet_ren_wu_biao_ji_biao',
  cxx_wallet: 'sheet_qian_bao_biao',
  cxx_roster: 'sheet_zai_chang_ming_ce_biao',
  cxx_scene: 'sheet_chang_jing_biao',
  cxx_effect: 'sheet_zhuang_tai_xiao_guo_biao',
  cxx_pref: 'sheet_xian_shi_pian_hao_biao',
  cxx_battle: 'sheet_zhan_dou_zhuang_tai_biao',
  cxx_tactical: 'sheet_zhan_shu_zhuang_tai_biao',
  cxx_quest: 'sheet_wei_tuo_dang_an_biao',
  cxx_quest_meta: 'sheet_wei_tuo_ming_xi_biao',
};

// 假宿主：中文表名 + 拼音键 + 异步落盘（写入后第二次导出才看得到）
function mockHost(options = {}) {
  const state = { tables: {}, writes: 0, deletes: 0, refreshes: 0, pending: null };
  const snapshot = () => {
    if (state.pending) {
      const flush = state.pending;
      state.pending = null;
      flush();
    }
    return JSON.parse(JSON.stringify(state.tables));
  };
  const api = {
    exportTableAsJson: () => snapshot(),
    importTemplateFromData(doc, config) {
      assert.equal(doc.mate.type, 'chatSheets');
      assert.equal(config.dataMode, 'seed');
      const created = {};
      for (const key of Object.keys(doc)) {
        if (!/^sheet_/.test(key)) continue;
        const sheet = doc[key];
        const actualKey = PINYIN[key.slice(6)] || key;
        created[actualKey] = { ...structuredClone(sheet), uid: actualKey, content: [(sheet.content || [])[0] || []] };
      }
      // 导入异步：下一次导出才看到表
      state.pending = () => { Object.assign(state.tables, created); };
      return true;
    },
    insertRow(table, row) {
      const key = Object.keys(state.tables).find(key => state.tables[key].name === table) || (state.tables[table] ? table : PINYIN[String(table).replace(/^sheet_/, '')] || table);
      const sheet = state.tables[key];
      assert.ok(sheet, '表不存在：' + table);
      const header = sheet.content[0];
      const names = Store.ddlNames(template['sheet_' + Object.keys(PINYIN).find(k => PINYIN[k] === key)].sourceData.ddl);
      sheet.content.push(header.map((label, index) => (index === 0 ? sheet.content.length : row[names[index]] ?? row[label] ?? '')));
      state.writes += 1;
      return true;
    },
    deleteRow(table, index) {
      const key = Object.keys(state.tables).find(key => state.tables[key].name === table) || (state.tables[table] ? table : PINYIN[String(table).replace(/^sheet_/, '')] || table);
      state.tables[key].content.splice(index, 1);
      state.deletes += 1;
      return true;
    },
    async refreshDataAndWorldbook() {
      state.refreshes += 1;
    },
  };
  if (options.noPlugin) return { state, host: {} };
  return { state, host: { AutoCardUpdaterAPI: api } };
}

test('按中文表名把拼音键解析成逻辑表', async () => {
  const { host } = mockHost();
  const store = Store.create({ scope: { parent: host }, template, wait: 6, step: 5 });
  const ensured = await store.ensureSchema();
  assert.equal(ensured.ok, true, JSON.stringify(ensured));
  const all = await store.readAll();
  assert.equal(Object.keys(all.tables).length, 18);
  assert.equal(all.tables.cxx_fact.key, 'sheet_shi_shi_liu_shui_biao');
});

test('没有插件时给可读原因，不抛错', async () => {
  const { host } = mockHost({ noPlugin: true });
  const store = Store.create({ scope: { parent: host }, template, wait: 3, step: 5 });
  const all = await store.readAll();
  assert.equal(all.ok, false);
  assert.match(all.reason, /数据库接口/);
});

test('写入轮询等异步落盘，读得到新增行', async () => {
  const { state, host } = mockHost();
  const store = Store.create({ scope: { parent: host }, template, wait: 8, step: 5 });
  await store.ensureSchema();
  const before = await store.read('cxx_fact');
  assert.equal(before.rows.length, 0);
  const written = await store.insert('cxx_fact', { fact_key: 'k1', turn_no: 3, kind: '其他', payload: '测试' });
  assert.equal(written.ok, true, JSON.stringify(written));
  const after = await store.read('cxx_fact');
  assert.equal(after.rows.length, 1);
  assert.equal(after.rows[0].cells[1], 'k1');
  assert.equal(state.writes, 1);
});

test('删除会刷新并让行数下降', async () => {
  const { state, host } = mockHost();
  const store = Store.create({ scope: { parent: host }, template, wait: 8, step: 5 });
  await store.ensureSchema();
  await store.insert('cxx_fact', { fact_key: 'k2', turn_no: 4, kind: '其他', payload: '删我' });
  const removed = await store.remove('cxx_fact', 0);
  assert.equal(removed.ok, true, JSON.stringify(removed));
  assert.ok(state.refreshes >= 1, '删除后必须刷新');
  const after = await store.read('cxx_fact');
  assert.equal(after.rows.length, 0);
});

test('删除第二条业务行使用ACU第2行，不误删第一条', async () => {
  const { state, host } = mockHost();
  const store = Store.create({ scope: { parent: host }, template, wait: 8, step: 5 });
  await store.ensureSchema();
  for(const key of ['keep-first','remove-second'])assert.equal((await store.insert('cxx_fact',{fact_key:key,turn_no:1,kind:'其他'})).ok,true);
  assert.equal((await store.remove('cxx_fact',1)).ok,true);
  assert.deepEqual((await store.read('cxx_fact')).rows.map(row=>row.cells[1]),['keep-first']);
  assert.equal(state.deletes,1);
});

test('未知表与缺表都给可读原因', async () => {
  const { host } = mockHost();
  const store = Store.create({ scope: { parent: host }, template, wait: 3, step: 5 });
  const unknown = await store.read('cxx_nope');
  assert.equal(unknown.ok, false);
  assert.match(unknown.reason, /未知表/);
  const missing = await store.read('cxx_fact');
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /没有这张表/);
});

test('公开整库导入一次替换镜像，等待ACK，保留台账和未知表元数据', async () => {
  let tables = structuredClone(template), calls = 0, completed = false, checked = 0;
  tables.sheet_private = { uid: 'private', name: '玩家表', extra: { keep: 1 }, content: [['row', '笔记'], [1, '原文']] };
  tables.sheet_cxx_fact.content.push([1, 'fact-keep', 1, '其他', '已记账']);
  tables.sheet_cxx_pending_tx.content.push([1, 'tx-keep']);
  tables.customTop = { keep: ['unknown'] };
  const before = structuredClone(tables);
  const api = {
    exportTableAsJson: () => tables,
    importTemplateFromData() {},
    async importTableAsJson(json) {
      calls++;
      assert.deepEqual(tables, before, 'export返回原对象，构造目标不得先改运行态');
      await new Promise(resolve => setTimeout(resolve, 5));
      tables = JSON.parse(json); completed = true; return true;
    },
    insertRow() { assert.fail('不逐行写入'); },
    refreshDataAndWorldbook() { assert.fail('公开导入ACK已包含刷新，不重复刷新'); }
  };
  const store = Store.create({ scope: { AutoCardUpdaterAPI: api }, template });
  const result = await store.replaceTables({ cxx_wallet: [{ scope_key: 'player', yen: 17, earned: 17, spent: 0 }] }, ['cxx_wallet'], { assertCurrent() { checked++; } });
  assert.equal(result.ok, true, result.reason); assert.equal(completed, true); assert.equal(calls, 1); assert.equal(checked, 3);
  assert.deepEqual(tables.sheet_private, before.sheet_private);
  assert.deepEqual(tables.sheet_cxx_fact, before.sheet_cxx_fact);
  assert.deepEqual(tables.sheet_cxx_pending_tx, before.sheet_cxx_pending_tx);
  assert.deepEqual(tables.customTop, before.customTop);
  assert.equal(tables.sheet_cxx_wallet.content.length, 2);
  assert.equal(tables.sheet_cxx_wallet.content[1][1], 'player');
  assert.equal(tables.sheet_cxx_wallet.content[1][2], 17);
});

test('批量导入拒绝或ACK后读回错误均不签成功；异步切聊天原样退出', async () => {
  const base = { exportTableAsJson: () => structuredClone(template), importTemplateFromData() {} };
  const rejected = Store.create({ scope: { AutoCardUpdaterAPI: { ...base, async importTableAsJson() { return false; } } }, template });
  const values = { cxx_wallet: [{ scope_key: 'player', yen: 17 }] };
  assert.equal((await rejected.replaceTables(values, ['cxx_wallet'])).ok, false);
  const notReadBack = Store.create({ scope: { AutoCardUpdaterAPI: { ...base, async importTableAsJson() { return true; } } }, template });
  assert.match((await notReadBack.replaceTables(values, ['cxx_wallet'])).reason, /读回不一致/);
  let changed = false;
  const switched = Store.create({ scope: { AutoCardUpdaterAPI: { ...base, async importTableAsJson() { changed = true; return true; } } }, template });
  await assert.rejects(switched.replaceTables(values, ['cxx_wallet'], { assertCurrent() { if (changed) throw Error('聊天已切换'); } }), /聊天已切换/);
});
