'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const Engine = require('../../卡片源码/剧情/line-engine.js'), Model = require('../../卡片源码/剧情/line-model.js');
const Q = require('../../卡片源码/运行时/quests.js'), Schema = require('../../卡片源码/MVU/schema.js');
const F = require('./fixtures.cjs'), {executor} = require('../MVU/mvu-fixture.cjs');
const chapter = require('../../卡片源码/剧情/盗芯之夜.json'), quests = require('../../卡片源码/终端/content/quests.json').quests.filter(q => q.id !== 'q_heist');
const detection = require('../../卡片源码/长期记忆/detection.json');
const plot = lines => require('../../卡片源码/长期记忆/plot.js').create({chapter, quests, detection, lines: lines || [F.line]});
const engine = lines => Engine.create(lines || [F.line]);
const source = (floor = 2, swipe = 0) => ({floor, swipe, story: 'fixture-' + floor + '-' + swipe});
const patch = events => ({op: 'add', path: '/terminal/quests/sample_parcel/events', value: events});
const schema = Schema.build(require('D:/SillyTavern/node_modules/zod'));
function policy(p, floor = 2, swipe = 0, body = F.body) {
  return {plot: p, questDefinition: id => p.definition(id), questRegistered: id => p.owns(id),
    mapIndex: {tokyo: ['shop', 'station']}, numericOptions: {factBatch: 'line_' + floor + '_' + swipe, source: source(floor, swipe), storyText: body}};
}
async function run(before, patches, p = plot(), floor = 2, swipe = 0, body = F.body) {
  let tx;
  const ex = executor(async (name, data, commands) => {
    if (name === 'mag_command_parsed') { tx = schema.prepare(patches, before, policy(p, floor, swipe, body)); Q.extendSchema(data.schema); commands.splice(0, commands.length, ...schema.commands(tx.patches)); }
    if (name === 'mag_variable_update_ended') schema.check(tx, before, data.stat_data);
  });
  const data = {stat_data: structuredClone(before), schema: structuredClone(ex.schema(structuredClone(before)))};
  data.schema.strictSet = true; data.schema.strictTemplate = false;
  await ex.run('<UpdateVariable><JSONPatch>' + JSON.stringify(patches) + '</JSONPatch></UpdateVariable>', data);
  schema.check(tx, before, data.stat_data);
  return structuredClone(data.stat_data);
}
function apply(e, before, events, floor = 2) {
  return {...before, terminal: {...before.terminal, quests: {...before.terminal.quests,
    sample_parcel: e.advance(before, 'sample_parcel', events, {source: source(floor), storyText: F.body})}}};
}
test('good and bad terminals each complete the line without completing unplayed branches', async () => {
  for (const bad of [false, true]) {
    const p = plot(); let s = await run(F.state(), [patch([F.event('P1', ['agreed']), F.event('P2', ['found'])])], p);
    s = bad ? await run(s, [patch([F.event('P2', ['lost'], 'outcome', 'lost'), F.event('Bad', ['reported'])])], p, 3)
      : await run(s, [patch([F.event('P2', ['recovered']), F.event('Good', ['returned'])])], p, 3);
    const r = s.terminal.quests.sample_parcel;
    assert.equal(r.state, '完成'); assert.equal(r.line.ending.id, bad ? 'lost' : 'returned');
    assert.notEqual(r.line.nodes[bad ? 'Good' : 'Bad']?.state, 'complete');
    assert.notEqual(r.line.nodes.Extra?.state, 'complete');
    assert(!p.entries(s).some(n => n.lineId === 'sample_parcel'));
    assert.equal(p.lineView(s, 'sample_parcel').state, '已完结');
    assert.deepEqual(s.terminal.wallet, F.state().terminal.wallet);
  }
});
test('first-entry wallet gate latches in the paying turn even without a plot event', async () => {
  const p = plot(); let s = await run(F.state(), [patch([F.event('P1', ['agreed'])])], p);
  const payment = [{op: 'replace', path: '/terminal/wallet/yen', value: 1000}, {op: 'replace', path: '/terminal/wallet/spent', value: 2000}];
  s = await run(s, payment, p, 3);
  assert(s.terminal.quests.sample_parcel.line.nodes.P2.opened);
  assert(p.entries(s).some(e => e.nodeId === 'P2'));
  s = await run(s, [patch([F.event('P2', ['found', 'recovered'])])], p, 4);
  assert.equal(s.terminal.quests.sample_parcel.line.nodes.P2.state, 'complete');
  assert.equal(s.terminal.wallet.yen, 1000);
});
test('unopened gates and explicit continuous gates remain effective, retaining facts on reopening', () => {
  const custom = structuredClone(F.line); custom.nodes[1].while = [{check: 'location', mapId: 'tokyo', placeId: 'shop'}];
  const e = engine([custom]); let s = F.state(); s.terminal.wallet.yen = 1000;
  s = apply(e, s, [F.event('P1', ['agreed'])]);
  assert.throws(() => apply(e, s, [F.event('P2', ['found'])]), /未开启/);
  s.terminal.wallet.yen = 3000; s = apply(e, s, [F.event('P2', ['found'])]);
  s.terminal.wallet.yen = 0; s.terminal.gameplay.location.placeId = 'station';
  assert.throws(() => apply(e, s, [F.event('P2', ['recovered'])]), /持续条件/);
  assert(s.terminal.quests.sample_parcel.line.nodes.P2.facts.found);
  s.terminal.gameplay.location.placeId = 'shop'; s = apply(e, s, [F.event('P2', ['recovered'])]);
  assert.equal(s.terminal.quests.sample_parcel.line.nodes.P2.state, 'complete');
});
test('pause, sourced resume, fork and ordinary abandonment retain distinct meanings', () => {
  const e = engine(); let s = apply(e, F.state(), [F.event('P1', ['agreed']), F.event('P2', ['found']), F.event('P2', ['pause'], 'outcome', 'pause')]);
  assert.equal(s.terminal.quests.sample_parcel.line.nodes.P2.state, 'paused');
  assert.throws(() => apply(e, s, [F.event('P2', ['recovered'])]), /未开启/);
  s = apply(e, s, [F.event('P2', ['resume'], 'resume'), F.event('P2', ['branch'], 'outcome', 'branch')]);
  assert.equal(s.terminal.quests.sample_parcel.line.nodes.P2.state, 'active');
  assert.equal(s.terminal.quests.sample_parcel.line.nodes.Extra.state, 'active');
  s = apply(e, s, [F.event('Extra', ['checked'])]);
  assert.equal(s.terminal.quests.sample_parcel.state, '进行中');
  const refused = apply(e, F.state(), [F.event('P1', ['refuse'], 'outcome', 'refuse')]);
  assert.equal(refused.terminal.quests.sample_parcel.state, '已放弃');
  assert.equal(refused.terminal.quests.sample_parcel.line.ending, undefined);
});
test('one transaction supports sequential cross-line facts and preserves unrelated values', async () => {
  const other = {schema: 1, id: 'sample_followup', title: '后续线', summary: '核对交付', track: 'relationship', nodes: [
    {id: 'F1', title: '确认', content: '核对玩家已经完成的交付。', requires: [{line: F.line.id, node: 'Good'}], conditions: {checked: '同伴实际核对收据'}, ending: {id: 'checked', title: '已经核对'}}]};
  const p = plot([F.line, other]);
  const s = await run(F.state(), [patch([F.event('P1', ['agreed']), F.event('P2', ['found', 'recovered']), F.event('Good', ['returned'])]),
    {op: 'add', path: '/terminal/quests/sample_followup/events', value: [F.event('F1', ['checked'])]}], p);
  assert.equal(s.terminal.quests.sample_followup.state, '完成'); assert.deepEqual(s.future, F.state().future);
});
test('only sourced happened events are accepted; invalid batches are atomic', () => {
  const p = plot(), before = F.state(), snapshot = structuredClone(before);
  for (const kind of ['plan', 'memory', 'denied', 'thought', 'hypothesis', 'option']) {
    const event = {...F.event('P1', ['agreed']), kind};
    assert.throws(() => schema.prepare([patch([event])], before, policy(p)), /只登记本轮/);
  }
  assert.throws(() => schema.prepare([patch([F.event('P1', ['agreed'])])], before, policy(p, 2, 0, '玩家没有答应调查包裹，只是想了想。')), /引文/);
  for (const leaf of ['state', 'knownFacts', 'line', 'line/nodes']) assert.throws(() => schema.prepare([{op: 'add', path: '/terminal/quests/sample_parcel/' + leaf, value: {}}], before, policy(p)), /事实事件/);
  assert.throws(() => schema.prepare([patch([F.event('P1', ['agreed']), F.event('missing', ['found'])])], before, policy(p)), /未登记/);
  assert.deepEqual(before, snapshot);
});
test('duplicate receipts, correction, reload and two reply branches preserve their own results', async () => {
  const p = plot(), before = F.state(), input = [patch([F.event('P1', ['agreed'])])];
  const a = await run(before, input, p), again = await run(a, input, p);
  assert.deepEqual(a, again);
  const b = await run(before, [patch([F.event('P1', ['refuse'], 'outcome', 'refuse')])], p, 2, 1);
  assert.equal(a.terminal.quests.sample_parcel.state, '进行中'); assert.equal(b.terminal.quests.sample_parcel.state, '已放弃');
  assert.deepEqual(p.entries(JSON.parse(JSON.stringify(a))), p.entries(a));
  const corrected = Q.plan(a, {id: 'undo_line', action: 'quest-correct', receiptId: 'line_2_0', expectedRevision: 1}, {questDefinitions: p.definitions});
  assert.deepEqual(corrected.terminal.quests, before.terminal.quests);
});
test('browsing and selection never write; tracked and current-scene nodes receive bounded priority', () => {
  const p = plot(), s = F.state(), before = structuredClone(s);
  p.entries(s); p.context(s, {analyzes: true}); p.lineView(s, F.line.id);
  assert.deepEqual(s, before); assert(p.entries(s).length <= 4);
  const candidates = Array.from({length: 10}, (_, i) => ({lineId: 'l' + i, name: '节点' + i, content: 'x'.repeat(100), track: i < 5 ? 'main' : 'relationship', scene: i === 8, progress: i === 7}));
  s.terminal.questJournal = {tracked: 'l9'};
  assert.deepEqual(Engine.select(candidates, s).map(e => e.lineId), ['l9', 'l8', 'l7', 'l0']);
  assert(Engine.select(candidates, s, {maxChars: 210}).length <= 2);
});
test('empty and prior-format saves require no migration; newer line schemas are not overwritten', async () => {
  const p = plot(), before = F.state(); delete before.terminal.quests;
  const s = await run(before, [patch([F.event('P1', ['agreed'])])], p);
  assert.equal(s.terminal.quests.sample_parcel.state, '进行中');
  const bad = structuredClone(s); bad.terminal.quests.sample_parcel.line.schema = 2;
  assert.throws(() => p.entries(bad), /版本/);
  s.terminal.quests.sample_parcel.extra = {zero: 0, future: false};
  const next = await run(s, [patch([F.event('P2', ['found'])])], p, 3);
  assert.deepEqual(next.terminal.quests.sample_parcel.extra, {zero: 0, future: false});
});
test('illustrations unlock once from the same event source and remain absent in another branch', () => {
  const e = engine(); let s = apply(e, F.state(), [F.event('P1', ['agreed']), F.event('P2', ['found'])]);
  assert.deepEqual(e.illustrations(s), []);
  s = apply(e, s, [F.event('P2', ['recovered'])], 5);
  assert.equal(e.illustrations(s).length, 1); assert.equal(e.illustrations(s)[0].source.floor, 5);
  assert.deepEqual(e.illustrations(F.state()), []);
});
test('authoring validation rejects broken references, cyclic prerequisites, collisions and retired affinity gates', () => {
  for (const change of [l => l.nodes[1].requires = ['missing'], l => l.nodes[0].requires = ['P2'], l => l.nodes[1].outcomes.lost.target = 'missing',
    l => l.nodes.forEach(n => delete n.ending), l => l.nodes[1].gate = [{check: 'state', path: ['高松灯', '好感度'], op: '>=', value: 300}]]) {
    const line = structuredClone(F.line); change(line); assert.throws(() => Model.validate([line]), /剧情线定义/);
  }
  const line = structuredClone(F.line); line.id = 'q01'; assert.throws(() => plot([line]), /编号.*重复/);
});
test('repeated pause/resume works and cancelling a closing batch restores its illustration unlock', async () => {
  const p=plot();let s=await run(F.state(),[patch([F.event('P1',['agreed']),F.event('P2',['found']),F.event('P2',['pause'],'outcome','pause')])],p);
  s=await run(s,[patch([F.event('P2',['resume'],'resume'),F.event('P2',['pause'],'outcome','pause')])],p,3);
  s=await run(s,[patch([F.event('P2',['resume'],'resume'),F.event('P2',['recovered']),F.event('Good',['returned'])])],p,4);
  assert.equal(p.album(s)[0].locked,false);
  const fixed=Q.plan(s,{id:'undo_end',action:'quest-correct',receiptId:'line_4_0',expectedRevision:3},{questDefinitions:p.definitions});
  assert.equal(fixed.terminal.quests.sample_parcel.state,'进行中');assert.equal(p.album(fixed)[0].locked,true);
});
test('line-level pause/resume and abandonment use the existing operation journal', async () => {
  const p=plot();const s=await run(F.state(),[patch([F.event('P1',['agreed'])])],p);
  const act=(before,action,id)=>Q.plan(before,{id,action:'quest-'+action,questId:F.line.id,expectedRevision:Q.journal(before).revision},{questDefinitions:p.definitions,questSource:source(3)});
  const paused=act(s,'pause','pause_line');assert(!p.entries(paused).some(e=>e.lineId===F.line.id));
  const resumed=act(paused,'resume','resume_line');assert(p.entries(resumed).some(e=>e.nodeId==='P2'));
  const abandoned=act(resumed,'abandon','leave_line');assert.equal(abandoned.terminal.quests.sample_parcel.line.ending,undefined);assert(Q.available(abandoned,p.definition(F.line.id),'accept',p.definitions));
});
module.exports = {plot, run, policy};
