'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const Chapters = require('../../卡片源码/剧情/chapter-engine.js');
const Data = require('../../卡片源码/剧情/chapter-data.cjs');
const Plot = require('../../卡片源码/长期记忆/plot.js');
const Q = require('../../卡片源码/运行时/quests.js');
const Schema = require('../../卡片源码/MVU/schema.js');
const {executor} = require('../MVU/mvu-fixture.cjs');
const root = path.resolve(__dirname, '../../卡片源码');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const detection = JSON.parse(read('长期记忆/detection.json'));
const quests = JSON.parse(read('终端/content/quests.json')).quests.filter(q => q.id !== 'q_heist');
const chapters = Data.load(read), schema = Schema.build(require('D:/SillyTavern/node_modules/zod'));
const state = () => ({terminal: {quests: {}, wallet: {yen: 100, earned: 100, spent: 0}}, future: {keep: true}});
const source = (floor = 3, swipe = 0) => ({floor, swipe, story: 'chapter-' + floor + '-' + swipe});
const event = (action, stage, facts) => ({event: action, stage, kind: 'happened', evidence: facts.map(fact => ({fact, quote: '伙伴当场核实了这一项事实已经完成，记录编号为' + fact + '。'}))});
const body = events => events.flatMap(item => item.evidence.map(fact => fact.quote)).join('\n');
function policy(plot, floor, text, swipe = 0) {
  return {plot, questDefinition: id => plot.definition(id), questRegistered: id => plot.owns(id),
    numericOptions: {factBatch: 'chapter_' + floor + '_' + swipe, source: source(floor, swipe), storyText: text}};
}
async function run(before, plot, events, floor = 3, id = 'q_chip_night', swipe = 0) {
  const patches = [{op: 'add', path: '/terminal/quests/' + id + '/events', value: events}];
  let tx;
  const ex = executor(async (name, data, commands) => {
    if (name === 'mag_command_parsed') {
      tx = schema.prepare(patches, before, policy(plot, floor, body(events), swipe));
      Q.extendSchema(data.schema); commands.splice(0, commands.length, ...schema.commands(tx.patches));
    }
    if (name === 'mag_variable_update_ended') schema.check(tx, before, data.stat_data);
  });
  const data = {stat_data: structuredClone(before), schema: structuredClone(ex.schema(structuredClone(before)))};
  data.schema.strictSet = true; data.schema.strictTemplate = false;
  await ex.run('<UpdateVariable><JSONPatch>' + JSON.stringify(patches) + '</JSONPatch></UpdateVariable>', data);
  schema.check(tx, before, data.stat_data);
  return structuredClone(data.stat_data);
}
test('current chapter data matches closed worldbook bodies and keeps the approved clinic text', () => {
  const manifest = JSON.parse(read('世界书/entries.json'));
  const entries = manifest.entries.map(item => ({...item, content: read(item.file)}));
  const current = Data.load(read, {entries});
  assert.equal(current.length, 1); assert.equal(current[0].nodes.length, 8);
  assert.equal(current[0].mode, 'chapter'); assert.equal(current[0].nodes[7].lore, 101);
  assert.match(current[0].nodes[7].content, /宇田川巴/); assert(!current[0].nodes[7].content.includes('联系阿杨'));
  const wrong = structuredClone(entries); wrong.find(item => item.id === 101).content = '旧章节正文';
  assert.throws(() => Data.load(read, {entries: wrong}), /正文.*不一致/);
});
test('all eight data-driven stages use the existing atomic MVU record, without changing money or unknowns', async () => {
  const plot = Plot.create({chapters, quests, detection});
  let stat = state();
  stat = await run(stat, plot, [event('accept', 1, ['invitation']), event('advance', 1, ['cooperation'])]);
  stat.terminal.quests.q_chip_night.future = {custom: '保留'};
  for (let stage = 2; stage <= 8; stage++) stat = await run(stat, plot, [event('advance', stage, Object.keys(detection.stages[stage]))], stage + 3);
  const record = stat.terminal.quests.q_chip_night;
  assert.equal(record.state, '完成'); assert.equal(record.chapter.chapterId, 'chip_night_v1');
  assert.equal(record.chapter.stage, 8); assert.equal(record.chapter.status, 'complete');
  assert.equal(record.chapter.history.length, 8); assert(record.plot.facts.B08_rescue);
  assert.deepEqual(record.future, {custom: '保留'}); assert.deepEqual(stat.future, state().future);
  assert.deepEqual(stat.terminal.wallet, state().terminal.wallet);
  assert(!plot.entries(stat).some(item => item.lineId === 'q_chip_night'));
  assert.match(plot.context(stat), /本章已结束/);
});
test('an independent chapter initializes its own stable record and escape target', async () => {
  const line = structuredClone(chapters[0]);
  line.id = line.quest.id = 'q_second_chapter'; line.chapterId = line.quest.chapterId = 'second_v1';
  line.title = line.quest.title = '另一个章节'; delete line.legacyQuest;
  line.stageTotal = 2; line.nodes = line.nodes.slice(0, 2);
  line.nodes[0].conditions = {invitation: '玩家同意开始', worked: '玩家实际完成工作'};
  line.nodes[0].escape = 'B02'; line.nodes[1].conditions = {arrived: '玩家实际抵达终点'};
  line.texts.completeObjective = '已到达本章终点。'; line.texts.endedNote = '另一个章节已经结束。';
  const plot = Plot.create({chapters: [line], quests: [], detection});
  let stat = await run(state(), plot, [event('accept', 1, ['invitation']), event('escape', 1, ['escape'])], 3, line.id);
  assert.equal(stat.terminal.quests[line.id].chapter.chapterId, 'second_v1');
  assert.equal(stat.terminal.quests[line.id].chapter.stage, 2);
  stat = await run(stat, plot, [event('advance', 2, ['arrived'])], 4, line.id);
  assert.equal(stat.terminal.quests[line.id].state, '完成');
  assert.equal(stat.terminal.quests[line.id].objective, '已到达本章终点。');
  assert.match(plot.context(stat), /另一个章节已经结束/);
});
test('contributor chapter records preserve evidence, independent reply branches and whole-batch correction', async () => {
  const plot = Plot.create({chapters, quests, detection});
  const before = await run(state(), plot, [event('accept', 1, ['invitation'])]);
  before.terminal.quests.q_chip_night.chapter.extra = {keep: 4};
  const a = await run(before, plot, [event('advance', 1, ['cooperation'])], 4);
  const b = await run(before, plot, [event('leave', 1, ['leave'])], 4, 'q_chip_night', 1);
  assert.equal(a.terminal.quests.q_chip_night.chapter.stage, 2);
  assert.equal(b.terminal.quests.q_chip_night.state, '已放弃');
  assert.deepEqual(a.terminal.quests.q_chip_night.chapter.extra, {keep: 4});
  assert.deepEqual(await run(a, plot, [event('advance', 1, ['cooperation'])], 4), a);
  const corrected = Q.plan(a, {id: 'undo_adoption', action: 'quest-correct', receiptId: 'chapter_4_0', expectedRevision: 2}, {questDefinitions: plot.definitions});
  assert.deepEqual(corrected.terminal.quests, before.terminal.quests);
});
test('chapter, commissions and general nodes share the four-entry character budget', () => {
  const plot = Plot.create({chapters, quests, detection}), stat = state(), before = structuredClone(stat);
  const selected = plot.entries(stat);
  assert.equal(selected.length, 4); assert(selected.reduce((sum, item) => sum + item.name.length + item.content.length, 0) <= 12000);
  stat.terminal.quests.q01 = {state: '进行中', knownFacts: '已保存摘要', plot: {schema: 1, facts: {}, history: Array.from({length: 100}, () => ({payload: 'x'.repeat(2000)}))}};
  assert(!plot.context(stat).includes('payload')); assert(plot.context(stat).includes('已保存摘要'));
  plot.entries(before); assert.deepEqual(before, state());
});
test('invalid chapter data, future record schemas and malformed events leave input untouched', () => {
  const broken = structuredClone(chapters); broken[0].nodes[0].escape = 'missing';
  assert.throws(() => Chapters.create(broken), /撤离/);
  for (const change of [data => data[0].nodes[0].content = 123, data => data[0].nodes[0].conditions.cooperation = {}, data => data[0].stageTotal = 0]) {
    const invalid = structuredClone(chapters); change(invalid); assert.throws(() => Chapters.create(invalid), /定义/);
  }
  const plot = Plot.create({chapters, quests, detection}), stat = state();
  stat.terminal.quests.q_chip_night = {state: '进行中', chapter: {schema: 2, stage: 1}};
  const before = structuredClone(stat); assert.throws(() => plot.entries(stat), /版本/); assert.deepEqual(stat, before);
  const fresh = state(), wrong = event('accept', 1, ['invitation']); wrong.kind = 'plan';
  assert.throws(() => schema.prepare([{op: 'add', path: '/terminal/quests/q_chip_night/events', value: [wrong]}], fresh, policy(plot, 3, body([wrong]))), /只登记本轮/);
  assert.deepEqual(fresh, state());
});
