'use strict';
/*! 变量程序应用器（applier）回归：不连真宿主、不碰远端 MVU，只验证「抽块 → 校验 → 执行 → 落库」这条链。 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const Schema = require(path.join(root, '卡片源码/MVU/schema.js'));
const Validator = require(path.join(root, '卡片源码/数据/validator.js'));
const Applier = require(path.join(root, '卡片源码/数据/applier.js'));

const schema = Schema.build(Validator.z);
const POLICY = { mapIndex: { m1: ['p1', 'p2'] } };

const TERMINAL = () => ({
  terminal: {
    wallet: { yen: 1000, earned: 0, spent: 0 },
    quests: {},
    ensemble: { control: { actorId: 'player' }, actors: {} },
    gameplay: { location: { mapId: 'm1', placeId: 'p1' } },
  },
});

const block = list => '<UpdateVariable><JSONPatch>' + JSON.stringify(list) + '</JSONPatch></UpdateVariable>';

function harness(overrides) {
  const options = overrides || {};
  const calls = { write: [], sync: [], notices: [], reports: [] };
  const write = {
    state: key => (calls.write.some(call => call.receipt === key) ? { state: 'applied', at: 'fake' } : null),
    apply: async input => {
      calls.write.push(input);
      return options.writeFails ? { ok: false, state: 'pending', reason: '假宿主：表写入失败。' } : { ok: true, state: 'applied' };
    },
  };
  const sync = {
    push: async (terminal, turn) => {
      calls.sync.push({ turn, wallet: terminal.terminal.wallet });
      return options.syncFails ? { ok: false, reason: '假宿主：同步失败。' } : { ok: true };
    },
  };
  const applier = Applier.create({
    schema,
    write,
    sync,
    policy: POLICY,
    notify: message => calls.notices.push(message),
    report: item => calls.reports.push(item.message),
  });
  return { applier, calls };
}

test('applier：没有终端时给空 terminal，不抛也不写库', async () => {
  const { applier, calls } = harness();
  assert.deepEqual(applier.empty().terminal.wallet, { yen: 0, earned: 0, spent: 0 });
  const result = await applier.apply(block([{ op: 'replace', path: '/terminal/wallet/yen', value: 900 }]), { receipt: 'r-empty', turn: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'uninitialized');
  assert.match(result.reason, /状态尚未初始化/);
  assert.deepEqual(result.terminal.wallet, { yen: 0, earned: 0, spent: 0 });
  assert.equal(calls.write.length, 0);
  assert.equal(calls.sync.length, 0);
  applier.destroy();
});

test('applier：add / replace / remove / test 四个操作的执行结果正确，且不改入参', () => {
  const before = { a: { b: 1, c: 2 }, list: [10, 20] };
  const snapshot = JSON.stringify(before);

  const added = Applier.applyOps(before, [{ op: 'add', path: '/a/d', value: 3 }]);
  assert.equal(added.ok, true);
  assert.deepEqual(added.root, { a: { b: 1, c: 2, d: 3 }, list: [10, 20] });

  const replaced = Applier.applyOps(before, [{ op: 'replace', path: '/a/b', value: 9 }]);
  assert.deepEqual(replaced.root.a, { b: 9, c: 2 });

  const removed = Applier.applyOps(before, [{ op: 'remove', path: '/a/b' }]);
  assert.deepEqual(removed.root.a, { c: 2 });

  const missing = Applier.applyOps(before, [{ op: 'remove', path: '/a/zz' }]);
  assert.equal(missing.ok, false);
  assert.match(missing.reason, /remove 路径不存在/);

  const tested = Applier.applyOps(before, [{ op: 'test', path: '/a/b', value: 1 }]);
  assert.equal(tested.ok, true);
  const testFails = Applier.applyOps(before, [{ op: 'test', path: '/a/b', value: 2 }]);
  assert.equal(testFails.ok, false);
  assert.match(testFails.reason, /自检不通过/);

  assert.equal(JSON.stringify(before), snapshot, '入参不得被就地改动');
});

test('applier：未知路径与类型不符被校验层拒绝，原因可读且不落库', async () => {
  const { applier, calls } = harness();
  const before = TERMINAL();

  const unknown = await applier.apply(block([{ op: 'replace', path: '/terminal/nope', value: 1 }]), { before, receipt: 'r-1', turn: 2 });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.status, 'rejected');
  assert.match(unknown.reason, /该字段由程序维护或尚未开放：\/terminal\/nope/);

  const typed = await applier.apply(block([{ op: 'replace', path: '/terminal/wallet/yen', value: '不是数字' }]), { before, receipt: 'r-2', turn: 2 });
  assert.equal(typed.status, 'rejected');
  assert.match(typed.reason, /需要数字/);

  const polluted = await applier.apply(block([{ op: 'add', path: '/terminal/__proto__/x', value: 1 }]), { before, receipt: 'r-3', turn: 2 });
  assert.equal(polluted.status, 'rejected');
  assert.match(polluted.reason, /不是可更新的状态|路径格式不正确/);

  assert.equal(calls.write.length, 0);
  assert.equal(calls.sync.length, 0);
  assert.deepEqual(before, TERMINAL(), '被拒绝的批次不得改动原状态');
  applier.destroy();
});

test('applier：合法批次写进状态并按 write → sync 顺序落库', async () => {
  const { applier, calls } = harness();
  const result = await applier.apply(block([
    { op: 'replace', path: '/terminal/wallet/yen', value: '900' },
    { op: 'replace', path: '/terminal/wallet/spent', value: 100 },
  ]), { before: TERMINAL(), receipt: 'r-ok', turn: 7 });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'applied');
  assert.equal(result.persisted, true);
  assert.equal(result.terminal.wallet.yen, 900);
  assert.equal(result.terminal.wallet.spent, 100);
  assert.equal(calls.write.length, 1);
  assert.equal(calls.write[0].receipt, 'r-ok');
  assert.equal(calls.write[0].turn, 7);
  assert.match(calls.write[0].payload, /terminal\/wallet\/yen/);
  assert.deepEqual(calls.sync[0], { turn: 7, wallet: { yen: 900, earned: 0, spent: 100 } });
  applier.destroy();
});

test('applier：同一票据重复结算只落库一次', async () => {
  const { applier, calls } = harness();
  const text = block([{ op: 'replace', path: '/terminal/wallet/yen', value: 900 }, { op: 'replace', path: '/terminal/wallet/spent', value: 100 }]);
  const first = await applier.apply(text, { before: TERMINAL(), receipt: 'r-dup', turn: 3 });
  const second = await applier.apply(text, { before: TERMINAL(), receipt: 'r-dup', turn: 3 });
  assert.equal(first.status, 'applied');
  assert.equal(second.ok, true);
  assert.equal(second.status, 'duplicate');
  assert.equal(calls.write.length, 1);
  assert.equal(calls.sync.length, 1);
  assert.equal(applier.state('r-dup').status, 'applied');
  applier.destroy();
});

test('applier：落库失败要如实报错，不假装成功', async () => {
  const failing = harness({ writeFails: true }).applier;
  const result = await failing.apply(block([{ op: 'replace', path: '/terminal/wallet/yen', value: 900 }, { op: 'replace', path: '/terminal/wallet/spent', value: 100 }]), { before: TERMINAL(), receipt: 'r-fail', turn: 4 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /表写入失败/);
  assert.equal(result.persisted, false);
  failing.destroy();

  const { applier, calls } = harness({ syncFails: true });
  const syncFail = await applier.apply(block([{ op: 'replace', path: '/terminal/wallet/yen', value: 900 }, { op: 'replace', path: '/terminal/wallet/spent', value: 100 }]), { before: TERMINAL(), receipt: 'r-sync', turn: 4 });
  assert.equal(syncFail.ok, false);
  assert.match(syncFail.reason, /同步失败/);
  assert.equal(calls.sync.length, 1, '失败也要记录这次已尝试同步');
  applier.destroy();
});

test('applier：坏 JSON / 没有变量块 / 收支不平 都有明确结论', async () => {
  const { applier, calls } = harness();

  const broken = await applier.apply('<UpdateVariable><JSONPatch>[{op:replace,</JSONPatch></UpdateVariable>', { before: TERMINAL(), receipt: 'r-bad', turn: 1 });
  assert.equal(broken.status, 'rejected');
  assert.match(broken.reason, /JSON 数组/);

  const skipped = await applier.apply('这一楼只有正文。', { before: TERMINAL(), receipt: 'r-skip', turn: 1 });
  assert.equal(skipped.status, 'skipped');
  assert.match(skipped.reason, /未提供可执行的变量更新/);

  const lopsided = await applier.apply(block([
    { op: 'replace', path: '/terminal/wallet/yen', value: 900 },
    { op: 'replace', path: '/terminal/wallet/earned', value: 100 },
  ]), { before: TERMINAL(), receipt: 'r-lop', turn: 1 });
  assert.equal(lopsided.status, 'rejected');
  assert.match(lopsided.reason, /钱包余额与本轮累计收入、支出不一致/);

  assert.equal(calls.write.length, 0, '被拒绝的批次一律不落库');
  applier.destroy();
});

test('applier：抽块能穿过 JSONPatch 标签与代码围栏，destroy 后停止工作', async () => {
  const { applier } = harness();
  const inline = applier.parse('正文\n' + block([{ op: 'replace', path: '/terminal/wallet/yen', value: 1 }]));
  assert.equal(inline.found, true);
  assert.equal(inline.patches.length, 1);

  const fenced = applier.parse('<UpdateVariable>\n```json\n[{"op":"replace","path":"/terminal/wallet/yen","value":2}]\n```\n</UpdateVariable>');
  assert.equal(fenced.patches.length, 1);
  assert.equal(fenced.patches[0].value, 2);

  assert.equal(applier.parse('没有变量块').found, false);

  applier.destroy();
  const ended = await applier.apply(block([{ op: 'replace', path: '/terminal/wallet/yen', value: 1 }]), { before: TERMINAL(), receipt: 'r-end', turn: 1 });
  assert.equal(ended.status, 'ended');
  assert.equal(applier.ready(), false);
});

test('applier：真实校验层下收支一致才落库，破坏守恒的批次整批拒绝', async () => {
  const { applier, calls } = harness();
  const income = await applier.apply(block([
    { op: 'replace', path: '/terminal/wallet/yen', value: 1100 },
    { op: 'replace', path: '/terminal/wallet/earned', value: 100 },
  ]), { before: TERMINAL(), receipt: 'r-income', turn: 3 });
  assert.equal(income.status, 'applied');
  assert.equal(calls.sync.length, 1, '收支一致时落库一次');
  assert.deepEqual(calls.sync[0].wallet, { yen: 1100, earned: 100, spent: 0 });

  const broken = await applier.apply(block([
    { op: 'replace', path: '/terminal/wallet/yen', value: 900 },
    { op: 'replace', path: '/terminal/wallet/earned', value: 100 },
  ]), { before: TERMINAL(), receipt: 'r-broken', turn: 4 });
  assert.equal(broken.ok, false);
  assert.match(broken.reason, /钱包余额与本轮累计收入、支出不一致/);
  assert.equal(calls.sync.length, 1, '被拒绝的批次一律不落库');
  applier.destroy();
});

test('applier：写入层缺失时如实失败，不假装保存', async () => {
  const applier = Applier.create({ schema, policy: POLICY, notify: () => {}, report: () => {} });
  const result = await applier.apply(block([
    { op: 'replace', path: '/terminal/wallet/yen', value: 1100 },
    { op: 'replace', path: '/terminal/wallet/earned', value: 100 },
  ]), { before: TERMINAL(), receipt: 'r-nowrite', turn: 5 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /数据库写入层尚未就绪/);
  applier.destroy();
});

test('本地结算：MVU 缺席时 variables.js 自己抽块、校验、执行并落库一次', async () => {
  const Variables = require(path.join(root, '卡片源码/MVU/variables.js'));
  const chat = [{
    is_user: false,
    swipe_id: 0,
    cxx_plot_id: 'plot-local',
    mes: block([
      { op: 'replace', path: '/terminal/wallet/yen', value: 100 },
      { op: 'replace', path: '/terminal/wallet/earned', value: 100 },
    ]),
  }];
  const seen = { write: 0, pushed: null, warned: [] };
  const api = {
    SillyTavern: { getContext: () => ({ chat, eventTypes: { CHAT_CHANGED: 'changed' } }) },
    eventOn: () => {},
    eventRemoveListener: () => {},
  };
  const win = {
    toastr: { warning: message => seen.warned.push(message), info: () => {} },
    CxxDiagnostics: { report: () => {} },
    CxxDataWrite: { state: () => null, apply: async () => { seen.write++; return { ok: true, state: 'applied' }; } },
    CxxDataSync: { push: async terminal => { seen.pushed = terminal; return { ok: true }; } },
  };
  const runtime = { key: () => 'char|chat', scheduleMessages: () => {} };
  const service = Variables.create({ api, win, runtime, schema, policy: () => POLICY });

  assert.equal(service.state().mode, 'local', '没有 Mvu 时走本地路径');
  assert.equal(service.state().ready, true);

  const result = await service.settle(0);
  assert.equal(result.status, 'applied');
  assert.deepEqual(result.terminal.wallet, { yen: 100, earned: 100, spent: 0 });
  assert.equal(seen.write, 1);
  assert.deepEqual(seen.pushed.terminal.wallet, { yen: 100, earned: 100, spent: 0 });

  const replay = await service.settle(0);
  assert.equal(replay.status, 'duplicate', '同层重放不重复落库');
  assert.equal(seen.write, 1);

  service.destroy();
  assert.equal((await service.settle(0)).status, 'ended');
});

