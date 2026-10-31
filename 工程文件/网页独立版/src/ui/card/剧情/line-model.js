/* Derived from 卡片源码/剧情/line-model.js; source SHA256 6104491fb7048bd44784dce7793708af474c8aa1635e02972eccc4ea28605f6e. Rebuild with tools/p3a-adapt-views.mjs. */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxStoryLineModel = api;
})(globalThis, function(root) {
  'use strict';
  const reserved = new Set(['__proto__', 'prototype', 'constructor']);
  const id = value => typeof value === 'string' && /^[a-zA-Z][\w-]{0,79}$/.test(value) && !reserved.has(value);
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  const operators = ['==', '!=', '>=', '>', '<=', '<'];
  function requireValue(ok, message) { if (!ok) throw Error('剧情线定义：' + message); }
  function reference(value, line) {
    return typeof value === 'string' ? {line, node: value} : value;
  }
  function gate(rule) {
    requireValue(plain(rule), '门槛必须是对象');
    requireValue(['wallet', 'location', 'quest', 'state'].includes(rule.check), '不支持的门槛类型 ' + rule.check);
    if (rule.check === 'quest') {
      requireValue(id(rule.id) && text(rule.state), '委托门槛缺少编号或状态');
    } else if (rule.check === 'location') {
      requireValue(text(rule.mapId) && text(rule.placeId), '地点门槛需要 mapId 和 placeId');
    } else {
      requireValue(operators.includes(rule.op), '门槛比较符无效');
      requireValue(['string', 'number', 'boolean'].includes(typeof rule.value), '门槛比较值必须是单值');
      if (typeof rule.value === 'number') requireValue(Number.isFinite(rule.value), '数值门槛必须有限');
      if (rule.check === 'wallet') requireValue(typeof rule.value === 'number', '钱包门槛必须是数值');
      if (rule.check === 'state') {
        requireValue(Array.isArray(rule.path) && rule.path.length && rule.path.every(k => text(k) && !reserved.has(k)), '存档门槛路径无效');
        requireValue(!rule.path.includes('好感度'), '本项目已停用数值好感度，请使用互动事实前置');
      }
    }
  }
  function validate(lines) {
    requireValue(Array.isArray(lines), 'lines 必须是数组');
    const catalog = new Map(), nodes = new Map();
    for (const line of lines) {
      requireValue(plain(line) && line.schema === 1 && id(line.id), '结构版本或剧情线编号无效');
      requireValue(!catalog.has(line.id), '重复剧情线 ' + line.id);
      requireValue(text(line.title) && text(line.summary), line.id + ' 缺少标题或概要');
      requireValue(['main', 'relationship', 'commission'].includes(line.track), line.id + ' 类型无效');
      if (line.placeId !== undefined || line.mapId !== undefined) requireValue(id(line.placeId) && id(line.mapId), line.id + ' 地图与地点编号须同时有效');
      if (line.pay !== undefined) requireValue(Number.isSafeInteger(line.pay) && line.pay >= 0, line.id + ' 公开报酬必须为非负整数');
      requireValue(Array.isArray(line.nodes) && line.nodes.length, line.id + ' 没有节点');
      catalog.set(line.id, line);
      const endings = new Set();
      for (const node of line.nodes) {
        const key = line.id + '/' + node.id;
        requireValue(id(node.id) && !nodes.has(key), '节点编号无效或重复 ' + key);
        requireValue(text(node.title) && text(node.content), key + ' 缺少标题或正文');
        requireValue(plain(node.conditions) && Object.keys(node.conditions).length, key + ' 至少需要一个完成条件');
        for (const [key, label] of Object.entries(node.conditions)) requireValue(id(key) && text(label), '完成条件编号或说明无效');
        for (const name of ['requires', 'gate', 'while']) requireValue(node[name] === undefined || Array.isArray(node[name]), key + ' 的 ' + name + ' 必须是数组');
        for (const name of ['requiresMode', 'gateMode']) requireValue(node[name] === undefined || ['all', 'any'].includes(node[name]), key + ' 条件组合无效');
        for (const rule of [...node.gate || [], ...node.while || []]) gate(rule);
        if (node.exclusive !== undefined) requireValue(id(node.exclusive), key + ' 互斥组编号无效');
        if (node.locations !== undefined) {
          requireValue(Array.isArray(node.locations), key + ' 场景提示必须是数组');
          node.locations.forEach(place => gate({check: 'location', ...place}));
        }
        if (node.ending) {
          requireValue(id(node.ending.id) && text(node.ending.title) && !endings.has(node.ending.id), key + ' 结局编号或标题无效／重复');
          endings.add(node.ending.id);
          requireValue(Object.values(node.outcomes || {}).every(o => o.effect === 'pause'), key + ' 终点只可配置暂停出口');
        }
        for (const [group, options] of Object.entries(node.choices || {})) {
          requireValue(id(group) && plain(options) && Object.keys(options).length >= 2, key + ' 事实选择组无效');
          for (const [value, label] of Object.entries(options)) requireValue(id(value) && text(label), key + ' 事实选择无效');
        }
        if (node.endings) {
          requireValue(!node.ending && plain(node.endings) && node.choices?.[node.endingChoice], key + ' 分支结局需要对应事实选择组');
          requireValue(Object.values(node.outcomes || {}).every(o => o.effect === 'pause'), key + ' 分支终点只可配置暂停出口');
          requireValue(Object.keys(node.endings).length === Object.keys(node.choices[node.endingChoice]).length, key + ' 分支结局必须覆盖选择');
          for (const [value, ending] of Object.entries(node.endings)) {
            requireValue(Object.hasOwn(node.choices[node.endingChoice], value) && id(ending.id) && text(ending.title) && !endings.has(ending.id), key + ' 分支结局无效或重复');
            endings.add(ending.id);
          }
        }
        for (const [key, outcome] of Object.entries(node.outcomes || {})) {
          requireValue(id(key) && text(outcome.label) && ['pause', 'end_line', 'jump', 'fork'].includes(outcome.effect), '结果定义无效');
          requireValue(!Object.hasOwn(node.conditions, key), '结果与完成条件编号不能相同');
        }
        const pictures = new Set();
        for (const picture of node.illustrations || []) {
          requireValue(id(picture.id) && !pictures.has(picture.id) && text(picture.file) && !picture.file.split(/[\\/]/).includes('..') && !/^(?:[a-z]+:|[\\/])/i.test(picture.file), key + ' 插图编号或资源路径无效');
          const trigger = picture.trigger || 'complete';
          requireValue(['complete', 'progress'].includes(trigger) || trigger.startsWith('outcome:') && Object.hasOwn(node.outcomes || {}, trigger.slice(8)), key + ' 插图解锁条件无效');
          pictures.add(picture.id);
        }
        nodes.set(key, node);
      }
      requireValue(endings.size > 0, line.id + ' 必须明确标注至少一个正式终点');
    }
    for (const line of lines) for (const node of line.nodes) {
      for (const raw of node.requires || []) {
        const ref = reference(raw, line.id);
        requireValue(plain(ref) && id(ref.line) && id(ref.node) && nodes.has(ref.line + '/' + ref.node), '前置节点不存在');
      }
      for (const outcome of Object.values(node.outcomes || {})) if (['jump', 'fork'].includes(outcome.effect)) {
        requireValue(outcome.target !== node.id && nodes.has(line.id + '/' + outcome.target), '跳转或另开目标不存在／指向自身');
      }
    }
    const visiting = new Set(), visited = new Set();
    function visit(key) {
      requireValue(!visiting.has(key), '节点前置存在循环 ' + key);
      if (visited.has(key)) return;
      visiting.add(key);
      for (const raw of nodes.get(key).requires || []) { const ref = reference(raw, key.split('/')[0]); visit(ref.line + '/' + ref.node); }
      visiting.delete(key); visited.add(key);
    }
    for (const key of nodes.keys()) visit(key);
    return lines;
  }
  function actor(stat) {
    const api = typeof module === 'object' && module.exports ? require('../运行时/ensemble-state.js') : root.CxxEnsembleState || root?.CxxEnsembleState;
    if (api) return api.selected(stat);
    if (stat?.terminal?.ensemble) throw Error('人物状态服务尚未就绪。');
    return {actorId: 'player', wallet: stat?.terminal?.wallet, gameplay: stat?.terminal?.gameplay};
  }
  function owned(stat, lineId) {
    const record = stat?.terminal?.quests?.[lineId];
    return !record || (record.ownerActorId || 'player') === actor(stat).actorId;
  }
  function matches(stat, rule) {
    if (rule.check === 'quest') return stat.terminal?.quests?.[rule.id]?.state === rule.state;
    if (rule.check === 'location') {
      const at = actor(stat).gameplay?.location;
      return at?.mapId === rule.mapId && at?.placeId === rule.placeId;
    }
    const value = rule.check === 'wallet' ? actor(stat).wallet?.yen : rule.path.reduce((v, k) => v != null && Object.hasOwn(v, k) ? v[k] : undefined, stat);
    if (value === undefined || typeof value !== typeof rule.value) return false;
    if (rule.op === '==') return value === rule.value;
    if (rule.op === '!=') return value !== rule.value;
    if (typeof value !== 'number') return false;
    return rule.op === '>=' ? value >= rule.value : rule.op === '>' ? value > rule.value : rule.op === '<=' ? value <= rule.value : value < rule.value;
  }
  function mainRoute(stat) {
    for (const key of ['q_heist', 'q_chip_night']) {
      const r = stat?.terminal?.quests?.[key];
      if (r && (r.state && r.state !== '已发布' || r.chapter?.history?.length || Object.keys(r.plot?.facts || {}).length || ['acceptedFloor', 'startedFloor', 'paidYen', 'refundedYen', 'settled'].some(k => Boolean(r[k])) || key === 'q_heist' && ['objective', 'knownFacts', 'rank'].some(k => Boolean(r[k])))) return 'legacy';
    }
    return 'author-20261018';
  }
  return {validate, matches, reference, id, mainRoute, actor, owned};
});
