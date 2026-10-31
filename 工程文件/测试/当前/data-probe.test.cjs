/*
 * 数据探针测试：用假宿主把 probe-core 的调用顺序与幂等语义钉住。
 * 假宿主只实现《数据库插件 API 文档》里我们真正会用的那几个方法。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const engine = path.resolve(__dirname, '../..');
const core = require(path.join(engine, '工具/数据探针/probe-core.js'));
const template = JSON.parse(fs.readFileSync(path.join(engine, '数据/表格模板-cxx8.json'), 'utf8'));

function ddlNames(table) {
  const ddl = template['sheet_' + table].sourceData.ddl;
  const body = ddl.slice(ddl.indexOf('(') + 1, ddl.lastIndexOf(')'));
  return body
    .split('\n')
    .map(line => (line.split('--')[0].match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s+[A-Za-z]/) || [])[1])
    .filter(Boolean);
}

function mockHost(options = {}) {
  const state = { tables: {}, writes: 0, deletes: 0, imports: 0 };
  const api = {
    exportTableAsJson() {
      return JSON.parse(JSON.stringify(state.tables));
    },
    importTemplateFromData(doc, config) {
      assert.equal(doc.mate.type, 'chatSheets');
      assert.equal(config.dataMode, 'merge');
      state.imports += 1;
      for (const key of Object.keys(doc)) {
        if (!/^sheet_/.test(key)) continue;
        const sheet = doc[key];
        const header = (sheet.content || [])[0] || [];
        state.tables[key] = { name: sheet.name, content: [header] };
      }
      return true;
    },
    insertRow(table, row) {
      const sheet = state.tables[table] || state.tables['sheet_' + table];
      assert.ok(sheet, '表不存在：' + table);
      const names = ddlNames(String(table).replace(/^sheet_/, ''));
      const header = sheet.content[0];
      sheet.content.push(header.map((label, index) => (index === 0 ? sheet.content.length : row[names[index]] ?? row[label] ?? '')));
      state.writes += 1;
      return true;
    },
    deleteRow(table, index) {
      const sheet = state.tables[table] || state.tables['sheet_' + table];
      sheet.content.splice(index + 1, 1);
      state.deletes += 1;
      return true;
    }
  };
  if (options.noPlugin) return { state, host: {} };
  return { state, host: { AutoCardUpdaterAPI: api } };
}

test('detect 自己找到父窗口的数据库接口', () => {
  const { host } = mockHost();
  const frame = { parent: host };
  host.parent = frame;
  const found = core.detect(frame);
  assert.equal(found.available, true);
  assert.equal(found.depth, 1);
  assert.deepEqual(found.capability, { export: true, importTemplate: true, insert: true, update: false, remove: true, restore: false });
});

test('没有插件时给出可读原因，不抛错', async () => {
  const { host } = mockHost({ noPlugin: true });
  const report = await core.run({ parent: host }, template, { stamp: 'x' });
  assert.equal(report.pass, false);
  assert.equal(report.steps[0].id, 'capability');
  assert.match(report.steps[0].detail, /AutoCardUpdaterAPI/);
  assert.equal(report.steps.length, 1);
});

test('完整一轮：建表 → 写行 → 读回 → 删探针 → 指纹不变', async () => {
  const { state, host } = mockHost();
  const report = await core.run({ parent: host }, template, { stamp: 'T1' });
  assert.equal(report.pass, true, JSON.stringify(report.steps));
  assert.equal(state.imports, 1);
  assert.equal(state.writes, 1);
  assert.equal(state.deletes, 1);
  assert.equal(state.tables.sheet_cxx_fact.content.length, 1, '探针行必须删干净');
  assert.match(report.fingerprint, /cxx_fact:0\/\d+/);
});

test('再跑一次结果一致（可复跑）', async () => {
  const { host } = mockHost();
  const first = await core.run({ parent: host }, template, { stamp: 'A' });
  const second = await core.run({ parent: host }, template, { stamp: 'B' });
  assert.equal(first.pass, true);
  assert.equal(second.pass, true);
  assert.equal(first.fingerprint, second.fingerprint);
});
