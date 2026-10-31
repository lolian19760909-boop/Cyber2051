'use strict';
// 终端状态来源：读缓存、未就绪语义、数据库镜像钩子、写后回灌。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const src = (f) => fs.readFileSync(path.join(root, '卡片源码', f), 'utf8').replace(/\r\n/g, '\n');

// 从 terminal.js 里取出台账相关的最小片段，在沙箱里跑真实代码。
function slice() {
  const text = src('终端/terminal.js');
  const start = text.indexOf('  let statCache=null;');
  const end = text.indexOf('  function completedQuestCount(');
  assert.ok(start > 0 && end > start, '台账片段必须能在 terminal.js 里定位');
  return text.slice(start, end);
}

function harness({ stat, variables = true, stateFails = false }) {
  const reports = [];
  const reads = [];
  const hostBridge = {
    readState() { reads.push('bridge'); return { statData: variables ? stat : null, sourceFloor: 0 }; },
    changed() {},
  };
  const window = {
    parent: {
      Cxx236State: stateFails
        ? { stat() { throw new Error('boom'); } }
        : (stat ? { stat: () => ({ terminal: stat.terminal }) } : undefined),
      Cxx233Runtime: undefined,
      CxxDiagnostics: { report: (row) => reports.push(row) },
    },
  };
  const data = { quests: [{ id: 'q_a' }, { id: 'q_b' }] };
  const stats = { reads: 0 };
  const getVariables = variables ? () => null : undefined;
  const getLastMessageId = () => 0;
  const ctx = vm.createContext({
    window, data, stats, getVariables, getLastMessageId, hostBridge,
    localStorage: { getItem: () => null, setItem() {} },
    LEDGER_DEMO_KEY: 'demo', Number, String, Date, JSON, Object, Array, Set,
  });
  const body = slice() + '\n;globalThis.__api={readStatData,questRecord,walletYen,invalidateStatCache};';
  vm.runInContext(body, ctx);
  return { api: ctx.__api, reports, reads, stats };
}

test('拿到状态时任务按真实状态返回', () => {
  const f = harness({ stat: { terminal: { quests: { q_a: { state: '进行中', acceptedFloor: 3 } } } } });
  const rec = f.api.questRecord('q_a');
  assert.equal(rec.state, '进行中');
  assert.equal(rec.acceptedFloor, 3);
  assert.equal(rec.ready, true);
  assert.equal(f.api.questRecord('q_b').state, '已发布');
  assert.equal(f.reports.length, 0);
});

test('读不到状态时显示未就绪并且只上报一次', () => {
  const f = harness({ stat: null, variables: true, stateFails: true });
  const first = f.api.questRecord('q_a');
  assert.equal(first.state, '未就绪');
  assert.equal(first.ready, false);
  assert.equal(f.reports.length, 1);
  assert.match(f.reports[0].message, /都没有读到状态/);
  f.api.questRecord('q_b');
  assert.equal(f.reports.length, 1, '同一次会话不重复刷诊断');
});

test('同一帧内重复读取走缓存，失效后重新读一次', () => {
  const f = harness({ stat: null, variables: true });
  f.api.readStatData();
  f.api.readStatData();
  f.api.readStatData();
  assert.equal(f.reads.length, 1, '三次读取只透传一次');
  assert.equal(f.stats.reads, 3, '计数仍然反映调用次数');
  f.api.invalidateStatCache();
  f.api.readStatData();
  assert.equal(f.reads.length, 2, '失效后重新读取');
});

test('数据库镜像以 Cxx236State 为准，Mvu 只作为兜底', () => {
  const core = src('装配/启动脚本/cxx-business-core-241.js');
  const start = core.indexOf('function mirror236(){');
  const end = core.indexOf('parent.CxxDataSyncRun=mirror236;');
  const body = core.slice(start, end);
  const hit = body.indexOf('const state236=parent.Cxx236State');
  const fallback = body.indexOf('const mvu=fromState?null:parent.Mvu;');
  assert.ok(hit > 0, '镜像钩子必须读取 Cxx236State');
  assert.ok(fallback > hit, 'Mvu 只能在 Cxx236State 缺席时兜底');
  assert.ok(!/const mvu=parent\.Mvu;\s*\n\s*const data=/.test(body), '不能回到只读 Mvu 的旧写法');
});

test('终端写状态后会请求一次数据库回灌', () => {
  const ui = src('装配/启动脚本/cxx-native-ui-231.js');
  const mutate = ui.slice(ui.indexOf('function mutate(guard,update){'), ui.indexOf('function writeNews(dyn,guard){'));
  assert.match(mutate, /CxxDataSyncRun\?\.\(\)/, '写成功后要触发镜像');
  const term = src('终端/terminal.js');
  assert.match(term, /invalidateStatCache\(\);if\(ok\)try\{window\.parent\?\.CxxDataSyncRun\?\.\(\)/, '终端写完也要回灌并让缓存失效');
});
