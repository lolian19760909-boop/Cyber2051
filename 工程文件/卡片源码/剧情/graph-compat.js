/* Read contributor graph saves; the existing node engine remains the only runtime writer. */
(function(root, factory) {
  const local = typeof module === 'object' && module.exports;
  const api = factory(local ? require('../共享/data-clone.js') : root.CxxDataClone);
  if (local) module.exports = api; else root.CxxStoryGraphCompat = api;
})(globalThis, function(Clone) {
  'use strict';
  const copy = Clone.clone;
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  function convert(record, line) {
    if (!record?.graph || record.line) return record;
    const graph = record.graph;
    if (graph.schema !== 1 || !plain(graph.nodes) || graph.unlocked !== undefined && !Array.isArray(graph.unlocked)) throw Error('旧剧情节点记录版本不匹配，请保留原存档。');
    const ids = new Set(line.nodes.map(node => node.id));
    if ([...Object.keys(graph.nodes), ...graph.unlocked || []].some(id => !ids.has(id))) throw Error('旧剧情节点与当前定义不一致，请保留原存档并装载对应定义。');
    const out = copy(record), saved = {schema: 1, nodes: {}, history: [], illustrations: {}, priorFacts: record.plot?.priorFacts ?? record.knownFacts ?? ''};
    const history = Array.isArray(record.plot?.history) ? record.plot.history : [];
    const source = (node, floor) => {
      const item = [...history].reverse().find(entry => entry.node === node && (floor === undefined || entry.source?.floor === floor));
      return item?.source ? copy(item.source) : {floor: Number.isInteger(floor) ? floor : 0, legacyGraph: true};
    };
    for (const node of line.nodes) {
      const prior = graph.nodes[node.id], forced = graph.unlocked?.includes(node.id);
      if (!prior && !forced) continue;
      const states = {complete: 'complete', progress: 'active', open: 'active', paused: 'paused', closed: 'closed'};
      if (prior && !states[prior.status]) throw Error('旧剧情节点状态无法确认，请保留原存档。');
      const current = saved.nodes[node.id] = {state: states[prior?.status] || 'active', facts: {}, opened: source(node.id, prior?.since)};
      for (const key of Object.keys(node.conditions)) {
        const fact = record.plot?.facts?.[node.id + '_' + key];
        if (fact) current.facts[key] = copy(fact);
      }
      if (prior?.status === 'complete') current.completed = source(node.id, prior.floor);
      for (const item of history.filter(entry => entry.node === node.id)) {
        const evidence = Object.fromEntries((item.evidence || []).map(fact => [fact.fact, {quote: fact.quote, source: copy(item.source || {})}]));
        const entry = {node: node.id, event: item.event === 'complete' ? 'progress' : item.event, evidence, source: copy(item.source || {}), ...(item.outcome ? {outcome: item.outcome} : {})};
        if (item.outcome && node.outcomes?.[item.outcome]) current.outcomes = {...current.outcomes, [item.outcome]: entry};
      }
      for (const picture of node.illustrations || []) {
        const trigger = picture.trigger || 'complete';
        const floor = trigger === 'progress' ? prior?.since : trigger === 'complete' && prior?.status === 'complete' || trigger === 'outcome:' + prior?.outcome ? prior?.floor : undefined;
        if (Number.isInteger(floor)) saved.illustrations[node.id + ':' + picture.id] = {node: node.id, id: picture.id, source: source(node.id, floor)};
      }
    }
    saved.history = history.filter(item => ids.has(item.node)).map(item => ({node: item.node,
      event: item.event === 'complete' ? 'progress' : item.event,
      evidence: Object.fromEntries((item.evidence || []).map(fact => [fact.fact, {quote: fact.quote, source: copy(item.source || {})}])),
      source: copy(item.source || {}), ...(item.outcome ? {outcome: item.outcome} : {})}));
    if (record.state === '完成') {
      const ending = line.nodes.find(node => node.ending && graph.nodes[node.id]?.status === 'complete');
      if (ending) saved.ending = {...copy(ending.ending), node: ending.id, source: source(ending.id, graph.nodes[ending.id].floor)};
    }
    out.line = saved;
    return out;
  }
  function project(stat, lines = []) {
    let quests;
    for (const line of lines) {
      const record = stat?.terminal?.quests?.[line.id], next = convert(record, line);
      if (next !== record) { quests ||= {...stat.terminal.quests}; quests[line.id] = next; }
    }
    return quests ? {...stat, terminal: {...stat.terminal, quests}} : stat;
  }
  function unloaded(stat, lines = []) {
    const loaded = new Set(lines.map(line => line.id));
    return Object.entries(stat?.terminal?.quests || {}).filter(([id, record]) => record?.graph && !loaded.has(id))
      .map(([id, record]) => ({id, state: record.state, schema: record.graph.schema, nodes: Object.keys(record.graph.nodes || {}).length}));
  }
  return {project, unloaded};
});
