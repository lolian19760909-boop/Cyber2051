/* Linear chapters keep the established chapter/plot save contract; general nodes use CxxStoryLines. */
(function(root, factory) {
  const local = typeof module === 'object' && module.exports;
  const api = factory(local ? require('../共享/data-clone.js') : root.CxxDataClone);
  if (local) module.exports = api; else root.CxxStoryChapters = api;
})(globalThis, function(Clone) {
  'use strict';
  const copy = Clone.clone, norm = value => String(value || '').replace(/\s+/g, ' ').trim();
  const text = value => typeof value === 'string' && !!norm(value);
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  const id = value => typeof value === 'string' && /^[A-Za-z][\w-]{0,79}$/.test(value) && !['constructor', 'prototype', '__proto__'].includes(value);
  const fail = message => { throw Error(message); };
  const defaultTexts = {
    completeObjective: '已离开酒店，接上安全屋求援。',
    endedNote: '盗芯之夜本章已结束，停在离开酒店并接上安全屋求援。诊断、香澄初见与后续追查尚未装载；按玩家眼前行动继续，不预演后续提纲。',
    eventNote: '，盗芯另填实际 stage',
    acceptNote: '盗芯用 invitation，表示同意展开这条故事，B03 的正式接单另核对 contract',
    stageLine: '盗芯当前阶段 ',
    fullRule: 'B08 的 advance 结束本章；第5—7段实际被迫撤离可用 escape 转 B08，不补造跳过的事实。替代解法及是否植入按实际结果保留。',
    sampleRule: '当前样本仅检测 B01，抵达 B02 后只可暂停、继续或退出。',
    legacyError: '已有旧版盗芯记录，保留原路线。',
    escapeError: '只有酒店行动第 5—7 段可转入紧急撤离。',
    sampleError: '当前样本已抵达 B02；后续节点尚未开放检测。'
  };
  function fromChapter(chapter, detection = {}) {
    if (!chapter || chapter.enabled === false) return [];
    const total = chapter.stageTotal ?? (chapter.id === 'chip_night_v1' ? 8 : chapter.stages.length);
    return [{schema: 1, id: chapter.quest.id, mode: 'chapter', title: chapter.quest.title,
      track: chapter.quest.track, chapterId: chapter.id, stageTotal: total,
      acceptFact: chapter.acceptFact || 'invitation', legacyQuest: chapter.legacyQuest || (chapter.id === 'chip_night_v1' ? 'q_heist' : undefined),
      quest: copy(chapter.quest), texts: chapter.id === 'chip_night_v1' ? {...defaultTexts, ...chapter.texts} : copy(chapter.texts || {}),
      provenance: {authorApproval: chapter.authorApproval, source: chapter.source, sourceSHA256: chapter.sourceSHA256},
      nodes: chapter.stages.map((stage, index) => ({...copy(stage), lore: stage.lore ?? (chapter.id === 'chip_night_v1' ? 94 + index : undefined),
        conditions: copy(stage.conditions || detection.stages?.[index + 1] || (index === 0 && chapter.id === 'chip_night_v1' ? {cooperation: '实际完成与爱音的前置合作', invitation: '玩家明确同意听取新工作'} : {})),
        ...(chapter.id === 'chip_night_v1' && index >= 4 && index <= 6 ? {escape: 'B08'} : {})}))}];
  }
  function normalize(input = []) {
    if (!Array.isArray(input)) fail('章节清单须为数组。');
    const seen = new Set();
    return copy(input).map(line => {
      if (!plain(line) || line.schema !== 1 || line.mode !== 'chapter' || !id(line.id) || seen.has(line.id) || !id(line.chapterId) || !plain(line.quest) || line.quest.id !== line.id || !text(line.title) || !['main', 'relationship', 'commission'].includes(line.track) || !Array.isArray(line.nodes) || !line.nodes.length || !Number.isInteger(line.stageTotal) || line.stageTotal < line.nodes.length || !plain(line.texts) || Object.keys(defaultTexts).some(key => typeof line.texts[key] !== 'string')) fail('章节定义或编号无效。');
      seen.add(line.id);
      const nodes = new Set();
      for (const [index, node] of line.nodes.entries()) {
        const previewOnly = line.nodes.length < line.stageTotal && index > 0;
        if (!plain(node) || !id(node.id) || nodes.has(node.id) || !text(node.title) || !text(node.content) || !text(node.exit) || !Number.isInteger(node.lore) || !plain(node.conditions) || !previewOnly && !Object.keys(node.conditions).length || Object.entries(node.conditions).some(([key, label]) => !id(key) || !text(label))) fail('章节节点定义无效：' + line.id + '/' + (node?.id || index));
        if (['requires', 'gate', 'while', 'illustrations', 'ending'].some(key => node[key] !== undefined)) fail('顺序章节不能使用通用节点字段：' + line.id + '/' + node.id);
        nodes.add(node.id);
        if (node.outcomes) {
          if (!plain(node.outcomes) || Object.keys(node.outcomes).some(key => key !== 'escape') || node.outcomes.escape && (node.outcomes.escape.effect !== 'goto' || !id(node.outcomes.escape.node))) fail('章节只支持明确的撤离出口。');
          node.escape ||= node.outcomes.escape?.node;
        }
      }
      for (const [index, node] of line.nodes.entries()) if (node.escape && line.nodes.findIndex(target => target.id === node.escape) <= index) fail('章节撤离必须指向已装载的后续节点。');
      if (!Object.hasOwn(line.nodes[0].conditions, line.acceptFact)) fail('章节接取事实须是首段条件。');
      return line;
    });
  }
  const initial = line => ({schema: 1, chapterId: line.chapterId, stage: 1, status: 'active', history: [], knownFacts: ''});
  function create(input = [], {common = {}} = {}) {
    const lines = normalize(input), catalog = new Map(lines.map(line => [line.id, line]));
    const record = (stat, line) => stat?.terminal?.quests?.[line.id] || {state: '已发布'};
    const legacy = (stat, line) => {
      const r = line.legacyQuest && stat?.terminal?.quests?.[line.legacyQuest];
      return !!r && (r.state !== '已发布' || ['objective', 'knownFacts', 'rank', 'acceptedFloor', 'startedFloor', 'paidYen', 'refundedYen', 'settled'].some(key => Boolean(r[key])));
    };
    function current(r, line) {
      const saved = r.chapter;
      if (saved && (saved.schema !== 1 || saved.chapterId !== line.chapterId || !Number.isInteger(saved.stage) || saved.stage < 1 || saved.stage > line.nodes.length || !['active', 'complete', 'closed'].includes(saved.status) || !Array.isArray(saved.history))) fail('章节记录版本或阶段无效，请保留原存档。');
      return saved || initial(line);
    }
    const factKey = (line, stage, key) => stage === 1 ? key : line.nodes[stage - 1].id + '_' + key;
    function advance(before, id, events, {Q, source, storyText, questDefinitions} = {}) {
      const line = catalog.get(id);
      if (!line || !Array.isArray(events) || !events.length || events.length > 8 || !source || !norm(storyText)) fail('章节更新需要本轮正文与1—8项事件。');
      if (legacy(before, line)) fail(line.texts.legacyError);
      let r = copy(Q.record(before, id));
      const working = copy(before); working.terminal.quests ||= {};
      if (current(r, line).status !== 'active') fail('章节已结束，保留原记录。');
      const full = line.nodes.length === line.stageTotal;
      for (const event of events) {
        const saved = current(r, line), stage = saved.stage, node = line.nodes[stage - 1];
        const allowed = ['accept', 'advance', 'progress', 'pause', 'resume', 'leave', ...(full ? ['escape', 'fail'] : [])];
        if (!plain(event) || Object.keys(event).some(key => !['event', 'stage', 'kind', 'evidence'].includes(key)) || event.kind !== 'happened' || !allowed.includes(event.event) || event.stage !== stage || saved.status !== 'active') fail('只登记本轮已经发生且属于当前阶段的事实；计划、回忆、否定、假设、心声和未选选项不能推进。');
        if (!full && stage !== 1 && !['pause', 'resume', 'leave'].includes(event.event)) fail(line.texts.sampleError);
        if (event.event === 'escape' && !node.escape) fail(line.texts.escapeError);
        const expected = event.event === 'accept' ? [line.acceptFact] : ['pause', 'resume', 'leave', 'fail', 'escape'].includes(event.event) ? [event.event] : Object.keys(node.conditions);
        if (!Array.isArray(event.evidence) || !event.evidence.length) fail('章节事件需要本轮正文凭据。');
        const facts = {};
        for (const item of event.evidence) {
          const quote = norm(item?.quote), key = factKey(line, stage, item?.fact);
          if (!plain(item) || Object.keys(item).some(key => !['fact', 'quote'].includes(key)) || !expected.includes(item.fact) || Object.hasOwn(facts,key) || quote.length < 8 || quote.length > 400 || !norm(storyText).includes(quote)) fail('事件条件与本轮有效正文引文不匹配。');
          facts[key] = {quote: item.quote, source: copy(source)};
        }
        if (event.event === 'accept') {
          working.terminal.quests[id] = r;
          r = Q.plan(working, {id: 'plot_accept', action: 'quest-accept', questId: id, expectedRevision: Q.journal(working).revision}, {questDefinitions, questSource: source}).terminal.quests[id];
          r.chapter ||= initial(line);
        } else if (event.event === 'leave' && r.state === '已发布') r = {...r, id, schema: 1, state: '已放弃'};
        else if (['pause', 'resume', 'leave'].includes(event.event)) {
          working.terminal.quests[id] = r;
          const action = {pause: 'pause', resume: 'resume', leave: 'abandon'}[event.event];
          r = Q.plan(working, {id: 'plot_' + action, action: 'quest-' + action, questId: id, expectedRevision: Q.journal(working).revision}, {questDefinitions, questSource: source}).terminal.quests[id];
        } else if (!['已接取', '进行中'].includes(r.state)) fail('先明确接取；暂停或已结束的任务不能登记执行结果。');
        if (event.event === 'fail') { r.state = '失败'; r.startedFloor ??= source.floor; }
        const prior = r.plot || {schema: 1, facts: {}, history: [], priorFacts: r.knownFacts || ''};
        if (prior.schema !== 1 || !plain(prior.facts) || !Array.isArray(prior.history)) fail('剧情事实记录版本不匹配。');
        r.plot = {...prior, facts: {...prior.facts, ...facts}, history: [...prior.history, {event: event.event, stage, source: copy(source), evidence: copy(event.evidence)}]};
        if (['progress', 'advance', 'escape'].includes(event.event)) {
          if (event.event === 'advance' && Object.keys(node.conditions).some(key => !r.plot.facts[factKey(line, stage, key)])) fail('当前片段的退出条件尚未全部得到正文证明。');
          r.state = '进行中'; r.startedFloor ??= source.floor;
          if (event.event !== 'progress') {
            const complete = stage === line.nodes.length && event.event === 'advance';
            const next = event.event === 'escape' ? line.nodes.findIndex(target => target.id === node.escape) + 1 : complete ? stage : stage + 1;
            r.chapter = {...current(r, line), stage: next, status: complete ? 'complete' : 'active', history: [...(r.chapter?.history || []), {event: event.event, stage, evidence: event.evidence.map(item => item.quote).join('\n'), source: copy(source)}]};
            r.objective = complete ? line.texts.completeObjective : line.nodes[next - 1].exit;
            if (complete) r.state = '完成';
          }
        }
        if (full && r.chapter && ['leave', 'fail'].includes(event.event)) r.chapter.status = 'closed';
        const labels = {...common};
        for (const [index, part] of line.nodes.entries()) for (const [key, label] of Object.entries({...common, ...part.conditions})) labels[factKey(line, index + 1, key)] = label;
        r.knownFacts = [r.plot.priorFacts, ...Object.entries(r.plot.facts).map(([key, value]) => (labels[key] || key) + '：' + value.quote)].filter(Boolean).join('\n');
        if (r.chapter) r.chapter.knownFacts = r.knownFacts;
      }
      return r;
    }
    function entries(stat) {
      return lines.flatMap(line => {
        const r = record(stat, line);
        if (!['已发布', '已接取', '进行中'].includes(r.state) || legacy(stat, line)) return [];
        if (!['已接取', '进行中'].includes(r.state)) return [];
        const saved = current(r, line); if (saved.status !== 'active') return [];
        const node = line.nodes[saved.stage - 1];
        return [{id: node.lore, lineId: line.id, name: line.title + ' ' + node.id + ' · ' + node.title,
          content: node.content + '\n本段退出条件：' + node.exit, track: line.track, progress: ['已接取', '进行中'].includes(r.state)}];
      });
    }
    const ended = stat => lines.filter(line => record(stat, line).chapter?.status === 'complete').map(line => '\n' + line.texts.endedNote).join('');
    const rules = (stat, selected) => lines.filter(line => selected.has(line.id) && !legacy(stat, line)).map(line => {
      const stage = current(record(stat, line), line).stage;
      return '\n' + line.texts.stageLine + stage + '：' + JSON.stringify(line.nodes[stage - 1].conditions) + '。advance 要求本段全部条件成立。' + (line.nodes.length === line.stageTotal ? line.texts.fullRule : line.texts.sampleRule);
    }).join('');
    return {lines, definitions: lines.map(line => copy(line.quest)), owns: id => catalog.has(id), advance, entries, ended, rules};
  }
  return {create, normalize, fromChapter};
});
