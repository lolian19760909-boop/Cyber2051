(function(root, factory) {
  const local = typeof module === 'object' && module.exports;
  const api = factory(local ? require('./line-model.js') : root.CxxStoryLineModel,
    local ? require('../共享/data-clone.js') : root.CxxDataClone);
  if (local) module.exports = api;
  else root.CxxStoryLines = api;
})(globalThis, function(Model, Clone) {
  'use strict';
  const copy = Clone.clone, norm = text => String(text || '').replace(/\s+/g, ' ').trim();
  const live = ['已发布', '已接取', '进行中'];
  // 接取式：只有玩家真的接取过（已接取／进行中）的线才进入提示词；已发布=可选未接取。
  const playing = state => state === '已接取' || state === '进行中';
  function select(entries, stat, {maxNodes = 4, maxChars = 12000} = {}) {
    const rank = {main: 0, relationship: 1, commission: 2}, tracked = stat.terminal?.questJournal?.tracked;
    const priority = e => [e.lineId === tracked ? 0 : 1, e.scene ? 0 : 1, e.progress ? 0 : 1, rank[e.track] ?? 2];
    const ordered = entries.map((entry, index) => ({entry, index, rank: priority(entry)})).sort((a, b) => {
      for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
      return a.index - b.index;
    });
    const result = []; let chars = 0;
    for (const {entry} of ordered) {
      const size = entry.name.length + entry.content.length;
      if (result.length >= maxNodes) break;
      if (chars + size > maxChars) continue;
      result.push(entry); chars += size;
    }
    return result;
  }
  function create(input = []) {
    const lines = Model.validate(copy(input));
    const catalog = new Map(lines.map(line => [line.id, line]));
    const definitions = lines.map(line => ({id: line.id, title: line.title, goal: line.summary,
      track: line.track, route: line.route, mapId: line.mapId, placeId: line.placeId,
      storyLine: true, startMode: 'narrative', pay: line.pay || 0, retry: false}));
    const owns = id => catalog.has(id);
    const record = (stat, id) => stat.terminal?.quests?.[id] || {state: '已发布'};
    function state(stat, id) {
      const saved = record(stat, id).line;
      if (saved && (saved.schema !== 1 || !saved.nodes || typeof saved.nodes !== 'object' || Array.isArray(saved.nodes))) throw Error('剧情线存档版本或节点记录不匹配，请保留原存档。');
      return saved || {schema: 1, nodes: {}, history: [], illustrations: {}};
    }
    function allowed(stat, line, node, saved = state(stat, line.id)) {
      if (!Model.owned(stat, line.id)) return false;
      if (line.route === 'author-20261018' && Model.mainRoute(stat) === 'legacy') return false;
      if (!live.includes(record(stat, line.id).state) || saved.ending) return false;
      const current = saved.nodes[node.id];
      if (current && current.state !== 'active') return false;
      if (node.exclusive && line.nodes.some(other => other.id !== node.id && other.exclusive === node.exclusive && Object.keys(saved.nodes[other.id]?.facts || {}).length)) return false;
      if (!(node.while || []).every(rule => Model.matches(stat, rule))) return false;
      if (current?.opened) return true;
      const pre = (node.requires || []).map(raw => {
        const ref = Model.reference(raw, line.id);
        return Model.owned(stat, ref.line) && state(stat, ref.line).nodes[ref.node]?.state === 'complete';
      });
      const gates = (node.gate || []).map(rule => Model.matches(stat, rule));
      const passes = (values, mode) => !values.length || (mode === 'any' ? values.some(Boolean) : values.every(Boolean));
      return passes(pre, node.requiresMode) && passes(gates, node.gateMode);
    }
    function prompt(node) {
      return node.content + '\n本节点完成条件：' + JSON.stringify(node.conditions) +
        (Object.keys(node.outcomes || {}).length ? '\n可能结果：' + JSON.stringify(Object.fromEntries(Object.entries(node.outcomes).map(([id, value]) => [id, value.label]))) : '') +
        (node.choices ? '\n必须确认的实际分歧（每组择一，未发生不选）：' + JSON.stringify(node.choices) : '') +
        (node.ending || node.endings ? '\n这是本线正式终点；完成上述事实与分歧后登记具体结局。' : '');
    }
    function entries(stat) {
      const result = [];
      for (const line of lines) { if (!playing(record(stat, line.id).state)) continue; for (const node of line.nodes) if (allowed(stat, line, node)) {
        const saved = state(stat, line.id).nodes[node.id];
        result.push({id: node.lore ?? line.id + ':' + node.id, lineId: line.id, nodeId: node.id,
          name: line.title + ' · ' + node.title, content: prompt(node), track: line.track,
          progress: Object.keys(saved?.facts || {}).length > 0,
          scene: (node.locations || []).some(at => Model.matches(stat, {check: 'location', ...at}))});
      }}
      return result;
    }
    function initializeMoney(record) {
      if (!record.line && !record.graph && record.acceptedFloor === undefined && record.startedFloor === undefined && !record.knownFacts) {
        record.agreedYen ??= 0; record.paidYen ??= 0; record.refundedYen ??= 0; record.settled ??= false;
      }
    }
    function opened(record, node, source) {
      initializeMoney(record);
      record.line ||= {schema: 1, nodes: {}, history: [], illustrations: {}};
      const previous = record.line.nodes[node.id];
      if (previous?.opened) return;
      record.line.nodes[node.id] = {...previous, state: 'active', facts: {...previous?.facts}, opened: copy(source)};
      record.schema = 1; record.state = '进行中'; record.acceptedFloor ??= source.floor;
    }
    // Selection is read-only. Openings are committed with the successful turn's existing MVU batch.
    function openings(stat, selected, source) {
      if (!source) return {};
      const changed = {};
      for (const entry of selected) {
        if (!owns(entry.lineId) || state(stat, entry.lineId).nodes[entry.nodeId]?.opened) continue;
        const line = catalog.get(entry.lineId), node = line.nodes.find(n => n.id === entry.nodeId);
        if (!node || !allowed(stat, line, node)) continue;
        const r = changed[line.id] ||= {...copy(record(stat, line.id)), id: line.id};
        if (!Object.hasOwn(stat.terminal?.quests || {}, line.id)) r.ownerActorId = Model.actor(stat).actorId;
        opened(r, node, source); r.objective = line.summary;
      }
      return changed;
    }
    function evidence(items, expected, source, storyText) {
      if (!Array.isArray(items) || !items.length) throw Error('剧情事件需要本轮正文凭据。');
      const facts = {};
      for (const item of items) {
        const quote = norm(item?.quote);
        if (!item || typeof item.quote !== 'string' || Object.keys(item).some(k => !['fact', 'quote'].includes(k)) || !expected.includes(item.fact) || Object.hasOwn(facts, item.fact) || quote.length < 8 || quote.length > 400 || !norm(storyText).includes(quote)) throw Error('剧情事件条件与本轮有效正文引文不匹配。');
        facts[item.fact] = {quote: item.quote, source: copy(source)};
      }
      return facts;
    }
    function advance(stat, id, events, {source, storyText}) {
      const line = catalog.get(id);
      if (!line || !Array.isArray(events) || !events.length || events.length > 8 || !source) throw Error('剧情线事件须属于已装载内容，并为 1—8 项数组。');
      if (!Model.owned(stat, id)) throw Error('这条剧情线属于另一位人物，请切回接取人物后继续。');
      const r = {...copy(record(stat, id)), id}; initializeMoney(r);
      if (!Object.hasOwn(stat.terminal?.quests || {}, id)) r.ownerActorId = Model.actor(stat).actorId;
      const saved = r.line = copy(state(stat, id));
      if (!live.includes(r.state) || saved.ending) throw Error('暂停或已结束的剧情线不能推进。');
      const working = {...stat, terminal: {...stat.terminal, quests: {...stat.terminal?.quests, [id]: r}}};
      for (const event of events) {
        if (!event || event.kind !== 'happened' || Object.keys(event).some(k => !['event', 'node', 'outcome', 'choice', 'value', 'kind', 'evidence'].includes(k))) throw Error('只登记本轮已经发生的事实；计划、回忆、否定、心声与未选选项不能推进。');
        if (!live.includes(r.state) || saved.ending) throw Error('本线已经结束，不能继续提交节点。');
        const node = line.nodes.find(n => n.id === event.node);
        if (!node) throw Error('剧情节点未登记。');
        if (event.event === 'resume') {
          const prior = saved.nodes[node.id];
          if (prior?.state !== 'paused') throw Error('此节点没有暂停。');
          const facts = evidence(event.evidence, ['resume'], source, storyText);
          prior.state = 'active';
          saved.history.push({node: node.id, event: 'resume', evidence: facts, source: copy(source)});
          continue;
        }
        if (!allowed(working, line, node, saved)) throw Error('节点未开启、持续条件不成立或分支已关闭。');
        const outcome = event.event === 'outcome' && node.outcomes?.[event.outcome];
        const choice = event.event === 'choice' && node.choices?.[event.choice]?.[event.value];
        if (!['progress', 'outcome', 'choice'].includes(event.event) || event.event === 'outcome' && !outcome || event.event === 'choice' && !choice || event.event !== 'outcome' && event.outcome !== undefined || event.event !== 'choice' && (event.choice !== undefined || event.value !== undefined)) throw Error('节点事件或结果未登记。');
        const facts = evidence(event.evidence, choice ? [event.choice + '_' + event.value] : outcome ? [event.outcome] : Object.keys(node.conditions), source, storyText);
        opened(r, node, source);
        const current = saved.nodes[node.id];
        if (outcome && outcome.effect !== 'pause' && current.outcomes?.[event.outcome]) throw Error('此节点结果已经登记。');
        if (!outcome && !choice && Object.keys(facts).every(key => Object.hasOwn(current.facts, key))) continue;
        if (choice && current.choices?.[event.choice]) {
          if (current.choices[event.choice].value !== event.value) throw Error('已确认的剧情分歧不能覆盖，请先纠正对应识别或回到原分支。');
          continue;
        }
        if (node.exclusive && outcome?.effect !== 'pause') for (const sibling of line.nodes) if (sibling.id !== node.id && sibling.exclusive === node.exclusive) {
          const old = saved.nodes[sibling.id];
          saved.nodes[sibling.id] = {...old, state: 'closed', facts: {...old?.facts}, closedBy: node.id};
        }
        const entry = {node: node.id, event: event.event, ...(outcome ? {outcome: event.outcome} : {}), ...(choice ? {choice: event.choice, value: event.value} : {}), evidence: facts, source: copy(source)};
        saved.history.push(entry); r.startedFloor ??= source.floor;
        let complete = false;
        if (outcome) {
          current.outcomes = {...current.outcomes, [event.outcome]: copy(entry)};
          if (outcome.effect === 'pause') current.state = 'paused';
          if (outcome.effect === 'end_line') r.state = '已放弃';
          if (['jump', 'fork'].includes(outcome.effect)) {
            const target = line.nodes.find(n => n.id === outcome.target), prior = saved.nodes[target.id];
            if (prior && prior.state !== 'active') throw Error('不能重新打开已暂停、已完成或已关闭的跳转目标。');
            if (outcome.effect === 'jump') current.state = 'closed';
            opened(r, target, source);
          }
        } else {
          if (choice) current.choices = {...current.choices, [event.choice]: {value: event.value, ...copy(facts[event.choice + '_' + event.value])}};
          else for (const [key, value] of Object.entries(facts)) if (!Object.hasOwn(current.facts, key)) current.facts[key] = value;
          complete = Object.keys(node.conditions).every(key => Object.hasOwn(current.facts, key)) && Object.keys(node.choices || {}).every(key => current.choices?.[key]);
          if (complete) {
            current.state = 'complete'; current.completed = copy(source);
            const ending = node.ending || node.endings?.[current.choices?.[node.endingChoice]?.value];
            if (ending) { saved.ending = {...copy(ending), node: node.id, source: copy(source)}; r.state = '完成'; }
          }
        }
        saved.illustrations ||= {};
        for (const picture of node.illustrations || []) {
          const trigger = picture.trigger || 'complete', key = node.id + ':' + picture.id;
          if (!saved.illustrations[key] && (trigger === 'complete' && complete || trigger === 'progress' && !outcome || outcome && trigger === 'outcome:' + event.outcome)) saved.illustrations[key] = {node: node.id, id: picture.id, source: copy(source)};
        }
      }
      const facts = line.nodes.flatMap(n => [...Object.entries(saved.nodes[n.id]?.facts || {}).map(([key, value]) => (n.conditions[key] || key) + '：' + value.quote), ...Object.entries(saved.nodes[n.id]?.choices || {}).map(([key, value]) => n.choices[key][value.value] + '：' + value.quote)]);
      saved.priorFacts ??= record(stat, id).knownFacts || '';
      r.knownFacts = [saved.priorFacts, ...facts].filter(Boolean).join('\n').slice(-8000);
      r.objective = saved.ending ? '本线已完结：' + saved.ending.title : r.state === '已放弃' ? '已放弃本线。' : line.summary;
      return r;
    }
    function view(stat, id) {
      const line = catalog.get(id); if (!line) return null;
      const saved = state(stat, id), r = record(stat, id);
      const nodes = line.nodes.filter(node => saved.nodes[node.id]?.opened || allowed(stat, line, node)).map(node => {
        const current = saved.nodes[node.id];
        const ended = saved.ending && current?.state !== 'complete';
        return {id: node.id, title: node.title, state: ended ? (Object.keys(current?.facts || {}).length ? 'unfinished' : 'unvisited') : current?.state || 'available', eligible: allowed(stat, line, node),
          facts: copy(current?.facts || {}), choices: copy(current?.choices || {}), total: Object.keys(node.conditions).length + Object.keys(node.choices || {}).length};
      });
      return {id, title: line.title, state: r.state === '完成' ? '已完结' : r.state, ending: copy(saved.ending || null), nodes};
    }
    function illustrations(stat) {
      return lines.flatMap(line => Object.values(state(stat, line.id).illustrations || {}).flatMap(unlock => {
        const node = line.nodes.find(n => n.id === unlock.node), picture = node?.illustrations?.find(p => p.id === unlock.id);
        return picture ? [{...copy(picture), lineId: line.id, lineTitle: line.title, nodeId: node.id, source: copy(unlock.source)}] : [];
      }));
    }
    function album(stat) {
      return lines.flatMap(line => line.nodes.flatMap(node => (node.illustrations || []).map(picture => {
        const unlock = state(stat, line.id).illustrations?.[node.id + ':' + picture.id];
        return {id: line.id + ':' + node.id + ':' + picture.id, lineId: line.id, lineTitle: line.title,
          locked: !unlock, caption: unlock ? picture.caption || node.title : '未解锁插图', ...(unlock ? {url: picture.url, source: copy(unlock.source)} : {})};
      })));
    }
    return {owns, definitions, entries, openings, advance, view, illustrations, album};
  }
  return {create, select};
});
