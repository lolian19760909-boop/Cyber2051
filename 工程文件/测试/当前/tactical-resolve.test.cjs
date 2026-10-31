const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../lib/tactical-fixtures.cjs');
const T = require('../../卡片源码/运行时/tactical-engine.js');

let sequence = 0;
function op(g, action, fields = {}, scenario) { return T.operation(g, { action, id: 'action_' + (++sequence), expected: T.stamp(g), ...fields }, { scene: scenario }); }

function scene(hostile = true, template = 'guard') { return { hostile, playerZone: 'room', zones: [{ id: 'room', name: '门厅', cover: 1, known: true, exit: true }, { id: 'hall', name: '走廊', cover: 0, known: false }, { id: 'vault', name: '仓库', cover: 2, known: false }], edges: [{ a: 'room', b: 'hall', open: true, los: true }, { a: 'hall', b: 'vault', open: false, los: false, door: 'door' }], actors: [{ id: 'enemy', name: '敌人', template, zone: 'room', networked: true, network: 'local', visible: true }], nodes: [{ id: 'camera', name: '摄像头', kind: 'camera', zone: 'room', network: 'local', known: true }, { id: 'door', name: '仓门', kind: 'door', zone: 'hall', network: 'local', known: false }], source: { floor: 1, hash: 'test' } }; }

function setup(type = 'pistol') {
  let g = F.equip(F.game(), type, 1, 'weapon_1');
  g = op(g, 'tactical-initialize', { supplies: { light: 100, heavy: 100, shell: 30, precision: 20, med: 2, throwing: 3 }, programs: Object.keys(T.rules.programs), devices: { drone: 1, turret: 1, trap: 1 }, magazines: { weapon_1: T.profile(F.L.list(g).find(x => x.slot === 'weapon_1').definition).magazine } });
  return op(g, 'tactical-enable', { enabled: true });
}

function start(g, s = scene(), seed = 1234) { return op(g, 'tactical-start', { seed, encounterId: 'encounter_' + (++sequence) }, s); }

test('速决用真实结算把遭遇推到结束，并给出可读战报', () => {
  const g = start(setup());
  const report = T.resolve(g, { maxRounds: 10 });
  assert.ok(['victory', 'defeat', 'stalemate'].includes(report.outcome));
  assert.equal(report.enemies.length, 1);
  assert.equal(typeof report.player.after, 'number');
  assert.ok(report.actions > 0, '至少要发生一次出手');
  assert.ok(Array.isArray(report.lines) && report.lines.length > 0, '战报不能是空的');
  assert.ok(report.rounds >= 1);
});

test('速决对同一存档同一种子给出相同结果', () => {
  const a = T.resolve(start(setup(), scene(), 4242), { maxRounds: 6 });
  const b = T.resolve(start(setup(), scene(), 4242), { maxRounds: 6 });
  assert.equal(a.outcome, b.outcome);
  assert.equal(a.rounds, b.rounds);
  assert.deepEqual(a.enemies.map(x => x.after), b.enemies.map(x => x.after));
  assert.deepEqual(a.lines, b.lines);
});

test('没有进行中的战斗时明确报错，不会静默空转', () => {
  assert.throws(() => T.resolve(F.game()), /没有进行中的战斗/);
});

test('速决可以作为战斗操作提交，并把战报留在战况上', () => {
  const g = start(setup());
  const next = op(g, 'tactical-resolve', { maxRounds: 10 });
  const report = next.tactical.lastReport;
  assert.ok(report, '战报必须写回战况');
  assert.ok(['victory', 'defeat', 'stalemate'].includes(report.outcome));
  assert.ok(report.lines.length > 0);
  assert.ok(next.tactical.receiptOrder.length > 0, '速决要留下行动回执');
});
