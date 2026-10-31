'use strict';
const {test} = require('node:test'), assert = require('node:assert/strict');
const Compat = require('../../卡片源码/剧情/graph-compat.js');
const Plot = require('../../卡片源码/长期记忆/plot.js');
const F = require('./fixtures.cjs');
const source = {floor: 3, swipe: 1, story: 'original-source'};
function prior() {
  const stat = F.state();
  stat.terminal.wallet.yen = 0;
  stat.terminal.quests[F.line.id] = {id: F.line.id, state: '进行中', knownFacts: '原有公开线索', extra: {keep: false},
    graph: {schema: 1, nodes: {P1: {status: 'complete', since: 2, floor: 2}, P2: {status: 'progress', since: 3}}, unlocked: [], custom: '保留'},
    plot: {schema: 1, facts: {P1_agreed: {quote: F.quotes.agreed, source: {...source, floor: 2}}, P2_found: {quote: F.quotes.found, source}},
      history: [{node: 'P1', event: 'complete', source: {...source, floor: 2}, evidence: [{fact: 'agreed', quote: F.quotes.agreed}]},
        {node: 'P2', event: 'progress', source, evidence: [{fact: 'found', quote: F.quotes.found}]}]}};
  return stat;
}
test('graph projection is read-only, keeps original bytes and latches already-open gates', () => {
  const stat = prior(), before = structuredClone(stat), plot = Plot.create({chapters: [], quests: [], lines: [F.line]});
  assert(plot.entries(stat).some(item => item.nodeId === 'P2'));
  const projected = Compat.project(stat, [F.line]);
  assert.equal(projected.terminal.quests[F.line.id].line.nodes.P2.facts.found.quote, F.quotes.found);
  assert.deepEqual(projected.terminal.quests[F.line.id].graph, before.terminal.quests[F.line.id].graph);
  assert.deepEqual(stat, before);
});
test('next normal fact commits modern state while retaining graph, plot sources and unknown fields', () => {
  const stat = prior(), before = structuredClone(stat), plot = Plot.create({chapters: [], quests: [], lines: [F.line]});
  const record = plot.advance(stat, F.line.id, [F.event('P2', ['recovered'])], {source: {...source, floor: 4}, storyText: F.body});
  assert.equal(record.line.nodes.P2.state, 'complete'); assert.deepEqual(record.graph, before.terminal.quests[F.line.id].graph);
  assert.deepEqual(record.extra, {keep: false}); assert.equal(record.line.nodes.P2.facts.found.source.story, 'original-source');
  assert.deepEqual(stat, before);
  const withModern = {...stat, terminal: {...stat.terminal, quests: {...stat.terminal.quests, [F.line.id]: record}}};
  assert.equal(Compat.project(withModern, [F.line]), withModern);
});
test('unloaded graphs remain untouched and loaded mismatches stop without resetting records', () => {
  const stat = prior(), before = structuredClone(stat);
  assert.equal(Compat.project(stat, []), stat); assert.equal(Compat.unloaded(stat, [])[0].id, F.line.id);
  const unloaded = Plot.create({chapters: [], quests: [], lines: []});
  assert.match(unloaded.context(stat), /定义未装载/); assert.deepEqual(stat, before);
  stat.terminal.quests[F.line.id].graph.nodes.Unregistered = {status: 'complete'};
  assert.throws(() => Compat.project(stat, [F.line]), /定义不一致/);
  delete stat.terminal.quests[F.line.id].graph.nodes.Unregistered; stat.terminal.quests[F.line.id].graph.schema = 2;
  assert.throws(() => Compat.project(stat, [F.line]), /版本/);
});
test('a saved contributor ending maps to the declared ending and keeps unvisited branches incomplete', () => {
  const stat = prior(), record = stat.terminal.quests[F.line.id]; record.state = '完成';
  record.graph.nodes.Good = {status: 'complete', since: 4, floor: 4};
  const next = Compat.project(stat, [F.line]), saved = next.terminal.quests[F.line.id].line;
  assert.equal(saved.ending.id, 'returned'); assert.notEqual(saved.nodes.Bad?.state, 'complete');
  assert.deepEqual(next.terminal.quests[F.line.id].graph, record.graph);
});
