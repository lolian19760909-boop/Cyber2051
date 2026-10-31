/* M18 isolated opening settings. No generation, sending, worldbook or direct MVU writes. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxOpeningLink = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const identities = Object.freeze([['corpo', '公司狗'], ['street', '街头小子'], ['student', '中产学生'], ['custom', '自定义']].map(([id, label]) => Object.freeze({ id, label })));
  const timelines = Object.freeze([['2050-12', '2050 年 12 月前后 · Mujica 起点'], ['2051-04', '2051 年 4 月前后 · MyGO 起点']].map(([id, label]) => Object.freeze({ id, label })));
  let sequence = 0;
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function fail(code, reason) { const error = new Error(reason); error.code = code; throw error; }
  function record(value, keys, label) {
    const proto = value && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined;
    const plain = proto === null || proto && own(proto, 'constructor') && typeof proto.constructor === 'function'
      && Function.prototype.toString.call(proto.constructor) === Function.prototype.toString.call(Object);
    if (!value || typeof value !== 'object' || Array.isArray(value) || !plain) fail('invalid', label + '须为普通对象。');
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail('invalid', label + '不支持字段：' + key);
    return value;
  }
  function text(value, label, limit, required = true) {
    if (typeof value !== 'string' || value.length > limit || required && !value.trim()) fail('invalid', label + '须为文本，且不超过 ' + limit + ' 字。');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<%|<\s*\/?\s*(script|iframe|style)\b|javascript\s*:/i.test(value)) fail('invalid', label + '只接受静态文本。');
    return value;
  }
  function id(value, label) {
    text(value, label, 128);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value) || ['__proto__', 'prototype', 'constructor'].includes(value)) fail('invalid', label + '无效。');
    return value;
  }
  function initialState(value, era) {
    if (value == null) return null;
    record(value, ['story'], '初始状态');
    const story = record(value.story, ['date', 'time', 'location', 'phase'], '初始剧情状态');
    const date = text(story.date, '初始日期', 10);
    if (date !== era) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), parsed = match && new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
      if (!match || date.slice(0, 7) !== era || parsed.getUTCFullYear() !== +match[1] || parsed.getUTCMonth() + 1 !== +match[2] || parsed.getUTCDate() !== +match[3]) fail('invalid', '初始日期须符合所选时间，且是有效日期。');
    }
    const result = { date };
    for (const field of ['time', 'location', 'phase']) if (own(story, field)) {
      const item = story[field];
      if (item === null) result[field] = null;
      else if (field === 'phase' && Number.isSafeInteger(item) && item >= 0) result[field] = item;
      else result[field] = text(item, '初始' + field, field === 'location' ? 512 : 128, false);
    }
    return { story: result };
  }
  function events(entry) {
    if (!own(entry, 'timelineTaskIds') && !own(entry, 'timelineEvents')) return null;
    let taskIds = null;
    if (own(entry, 'timelineTaskIds')) {
      if (!Array.isArray(entry.timelineTaskIds) || entry.timelineTaskIds.length > 128) fail('invalid', '前置任务清单须为数组，最多128项。');
      taskIds = Array.from(entry.timelineTaskIds, item => id(item, '前置任务ID'));
      if (new Set(taskIds).size !== taskIds.length) fail('invalid', '前置任务ID重复。');
    }
    let result = [];
    if (own(entry, 'timelineEvents')) {
      if (!Array.isArray(entry.timelineEvents) || entry.timelineEvents.length > 128) fail('invalid', '时间线事件须为数组，最多128项。');
      result = Array.from(entry.timelineEvents, item => {
        record(item, ['taskId', 'state', 'outcome'], '时间线事件');
        const value = { taskId: id(item.taskId, '事件任务ID'), state: item.state };
        if (!['occurred', 'skipped'].includes(value.state)) fail('invalid', '时间线事件只能标记occurred或skipped，不能写完成或奖励。');
        if (own(item, 'outcome')) value.outcome = text(item.outcome, '作者指定事件结果', 2000, false);
        return value;
      });
      if (new Set(result.map(item => item.taskId)).size !== result.length) fail('invalid', '时间线事件ID重复。');
    }
    if (taskIds && (taskIds.length !== result.length || taskIds.some(taskId => !result.some(item => item.taskId === taskId)))) fail('invalid', '非空任务清单须逐项提供作者指定事件状态。');
    return result;
  }
  function manifest(value) {
    if (value == null) fail('missing-manifest', '身份开场与双时间初始资料待作者提供。');
    record(value, ['version', 'identities', 'timelines'], '作者开局资料');
    const version = text(value.version, '作者资料版本', 128);
    const lists = {};
    for (const [field, known, keys] of [['identities', identities, ['id', 'label', 'body']], ['timelines', timelines, ['id', 'label', 'initialState', 'timelineTaskIds', 'timelineEvents']]]) {
      if (!Array.isArray(value[field]) || value[field].length > known.length) fail('invalid', field + '须为明确的有限列表。');
      lists[field] = value[field].map(item => {
        record(item, keys, field); const entry = { id: id(item.id, field + '编号'), label: text(item.label, field + '名称', 60) };
        if (!known.some(option => option.id === entry.id)) fail('invalid', '未找到对应的身份或时间编号：' + entry.id);
        if (field === 'identities') entry.body = item.body == null || item.body === '' ? '' : text(item.body, '作者通用开场', 4000);
        else { entry.initialState = initialState(item.initialState, entry.id); entry.timelineEvents = events(item); }
        return entry;
      });
      if (new Set(lists[field].map(item => item.id)).size !== lists[field].length) fail('invalid', field + '编号重复。');
    }
    return { version, ...lists };
  }
  function selection(value) {
    record(value, ['identityId', 'timelineId', 'customDescription'], '开局选择');
    const result = { identityId: value.identityId ?? null, timelineId: value.timelineId ?? null, customDescription: text(value.customDescription ?? '', '玩家补充说明', 4000, false) };
    if (result.identityId !== null && !identities.some(item => item.id === result.identityId)) fail('invalid', '未知身份。');
    if (result.timelineId !== null && !timelines.some(item => item.id === result.timelineId)) fail('invalid', '未知起始时间。');
    if (result.identityId !== 'custom' && result.customDescription) fail('invalid', '玩家补充说明只用于自定义身份。');
    return result;
  }
  function context(value) {
    if (!value || typeof value !== 'object' || typeof value.hasStarted !== 'boolean') fail('context-unavailable', '宿主没有提供明确的聊天状态。');
    const scope = text(value.scope, '聊天标识', 512);
    if (!Number.isSafeInteger(value.floor) || value.floor < 0 || !(typeof value.branch === 'string' || Number.isSafeInteger(value.branch))) fail('context-unavailable', '宿主楼层或分支标识无效。');
    return { scope, floor: value.floor, branch: value.branch, hasStarted: value.hasStarted, busy: value.busy === true, openingToken: typeof value.openingToken === 'string' ? value.openingToken : null };
  }
  const sameContext = (a, b) => a.scope === b.scope && a.floor === b.floor && a.branch === b.branch;
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function validateTransaction(value) {
    record(value, ['token', 'expectedContext', 'manifestVersion', 'opening', 'initialState', 'timelineEvents'], '开局事务');
    const token = text(value.token, '开局提交标识', 160), manifestVersion = text(value.manifestVersion, '作者资料版本', 128);
    const expected = record(value.expectedContext, ['scope', 'floor', 'branch'], '预期聊天状态');
    const scope = text(expected.scope, '聊天标识', 512);
    if (expected.floor !== 0) fail('invalid', '开局事务只能指向尚未开始的新聊天首层。');
    const branch = typeof expected.branch === 'string' ? text(expected.branch, '聊天分支标识', 1024) : expected.branch;
    if (typeof branch !== 'string' && !Number.isSafeInteger(branch)) fail('invalid', '聊天分支标识无效。');
    const source = record(value.opening, ['title', 'body', 'identityId', 'identityLabel', 'timelineId', 'timelineLabel', 'customDescription'], '开局正文资料');
    const chosen = selection({ identityId: source.identityId, timelineId: source.timelineId, customDescription: source.customDescription });
    if (!chosen.identityId || !chosen.timelineId) fail('invalid', '开局事务须明确身份与起始时间。');
    const opening = { title: text(source.title, '开局标题', 60), body: text(source.body, '作者通用开场', 4000),
      identityId: chosen.identityId, identityLabel: text(source.identityLabel, '身份名称', 60), timelineId: chosen.timelineId,
      timelineLabel: text(source.timelineLabel, '起始时间名称', 60), customDescription: chosen.customDescription };
    const initial = initialState(value.initialState, opening.timelineId);
    if (!initial) fail('invalid', '开局事务须提供作者初始剧情状态。');
    if (!Array.isArray(value.timelineEvents)) fail('invalid', '开局事务须明确时间线事件数组；无事件时使用空数组。');
    const timelineEvents = events({ timelineEvents: value.timelineEvents });
    return freeze({ token, expectedContext: { scope, floor: 0, branch }, manifestVersion, opening, initialState: initial, timelineEvents });
  }
  function create({ manifest: authored, readContext, commitOpening }) {
    if (typeof readContext !== 'function' || typeof commitOpening !== 'function') throw Error('开局服务尚未就绪，请刷新当前故事。');
    let pending = null, lastAttempt = null, lastInspection = {}, disposed = false, state = { phase: 'idle', reason: '' };
    async function evaluate(rawSelection) {
      const model = { canStart: false, code: '', reason: '', opening: null };
      try {
        if (disposed) fail('destroyed', '开局协调器已关闭。');
        const source = manifest(authored), chosen = selection(rawSelection);
        const identity = source.identities.find(item => item.id === chosen.identityId), timeline = source.timelines.find(item => item.id === chosen.timelineId);
        if (!chosen.identityId) fail('missing-identity', '请选择身份。');
        if (!identity?.body) fail('missing-body', '这个身份的通用开场待作者定稿。');
        model.opening = { title: identity.label, body: identity.body, identityId: identity.id, identityLabel: identity.label,
          timelineId: chosen.timelineId, timelineLabel: timeline?.label || '', customDescription: chosen.customDescription };
        if (!chosen.timelineId) fail('missing-timeline', '请选择起始时间。');
        if (!timeline?.initialState) fail('missing-state', '这个起始时间的初始状态待作者提供。');
        if (timeline.timelineEvents === null) fail('missing-events', '作者须明确前置事件清单；确实没有时可提供空数组。');
        Object.assign(model, { manifestVersion: source.version, initialState: timeline.initialState, timelineEvents: timeline.timelineEvents });
        const current = context(await readContext()); model.expectedContext = current;
        if (disposed) fail('destroyed', '开局协调器已关闭，未提交设置。');
        model.signature = JSON.stringify([source.version, model.opening, model.initialState, model.timelineEvents]);
        if (current.busy) fail('busy', '宿主正在处理其他操作，请稍后确认。');
        if (current.hasStarted) {
          if (lastAttempt && sameContext(current, lastAttempt.expectedContext) && current.openingToken === lastAttempt.token && model.signature === lastAttempt.signature) { model.code = 'confirmed'; model.token = lastAttempt.token; model.reason = '这份开局设置已确认；没有发送消息或生成剧情。'; return model; }
          fail('old-chat', '这个聊天已有开局或游戏记录，不能覆盖初始化。');
        }
        if (current.floor !== 0) fail('old-chat', '只有尚未开始的新聊天首层可以确认开局设置。');
        model.canStart = true; model.code = 'ready'; model.reason = '可以确认开局设置；本操作不发送消息或生成剧情。';
      } catch (error) { model.code = error.code || 'context-unavailable'; model.reason = error.message || '开局资料暂不可用。'; }
      return model;
    }
    function inspect(chosen) {
      if (disposed) return Promise.resolve({ canStart: false, code: 'destroyed', reason: '开局协调器已关闭。' });
      if (pending) return Promise.resolve({ ...lastInspection, canStart: false, code: 'busy', reason: '正在确认开局设置，请勿重复提交。' });
      return evaluate(chosen).then(model => { lastInspection = model; return model; });
    }
    function start(chosen) {
      if (pending) return pending;
      state = { phase: 'busy', reason: '正在确认开局设置。' };
      pending = (async () => {
        const model = await evaluate(chosen); lastInspection = model;
        if (model.code === 'confirmed') return { ok: true, recovered: true, token: model.token, opening: model.opening, reason: model.reason };
        if (!model.canStart) return { ok: false, code: model.code, reason: model.reason };
        const current = context(await readContext());
        if (disposed) return { ok: false, code: 'destroyed', reason: '开局协调器已关闭，未提交设置。' };
        if (!sameContext(current, model.expectedContext)) return { ok: false, code: 'context-changed', reason: '聊天、楼层或分支已变化，未提交开局设置。' };
        if (current.hasStarted || current.busy) return { ok: false, code: current.busy ? 'busy' : 'old-chat', reason: '宿主状态已变化，未提交开局设置。' };
        const token = 'm18-opening-' + Date.now().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2);
        const transaction = validateTransaction({ token, expectedContext: { scope: current.scope, floor: current.floor, branch: current.branch }, manifestVersion: model.manifestVersion,
          opening: model.opening, initialState: model.initialState, timelineEvents: model.timelineEvents });
        lastAttempt = { ...transaction, signature: model.signature };
        let commitError = null;
        try { await commitOpening(transaction); } catch (error) { commitError = error; }
        const readback = context(await readContext());
        if (!sameContext(readback, current)) return { ok: false, code: 'context-changed', reason: '提交期间聊天、楼层或分支发生变化，请核对原聊天的设置。' };
        if (readback.hasStarted && readback.openingToken === token) return { ok: true, token, opening: transaction.opening, recovered: Boolean(commitError), reason: '开局设置已确认；没有发送消息或生成剧情。' };
        return { ok: false, code: commitError ? 'commit-failed' : 'unconfirmed', reason: commitError ? '开局设置未确认，请保留选择后重试。' : '重读未确认这次提交，未将界面标记为成功。' };
      })().catch(error => ({ ok: false, code: error.code || 'context-unavailable', reason: error.message || '宿主状态暂不可读取，请稍后重试。' })).then(result => {
        state = { phase: disposed ? 'closed' : result.ok ? 'confirmed' : 'error', ...result }; return result;
      }).finally(() => { pending = null; });
      return pending;
    }
    return { inspect, start, status: () => Object.freeze({ ...state }), destroy() { disposed = true; state = { phase: 'closed', reason: '开局协调器已关闭。' }; } };
  }
  function mount({ root, manifest: authored, getContext, commit }) {
    if (!root?.ownerDocument) throw Error('需要独立开局容器。');
    const doc = root.ownerDocument, coordinator = create({ manifest: authored, readContext: getContext, commitOpening: commit });
    let destroyed = false, revision = 0, displayedOutcome = null;
    function node(tag, className, value) { const element = doc.createElement(tag); element.className = className; if (value !== undefined) element.textContent = value; return element; }
    const panel = node('section', 'cxx-opening-link'); panel.setAttribute('aria-label', '确认身份与起始时间'); panel.style.minWidth = '0';
    const identity = node('select', 'cxx-opening-link-identity'), era = node('select', 'cxx-opening-link-timeline');
    for (const [select, options, label] of [[identity, identities, '选择身份'], [era, timelines, '选择起始时间']]) {
      const placeholder = node('option', '', label); placeholder.value = ''; select.append(placeholder);
      for (const entry of options) { const option = node('option', '', entry.label); option.value = entry.id; select.append(option); }
      select.value = ''; select.style.maxWidth = '100%'; select.style.minHeight = '44px';
    }
    const identityLabel = node('label', '', '玩家身份 '), eraLabel = node('label', '', '起始时间 '); identityLabel.append(identity); eraLabel.append(era);
    const customLabel = node('label', 'cxx-opening-link-custom', '自定义身份补充说明（不会替换作者正文）');
    const custom = node('textarea', 'cxx-opening-link-description'); custom.maxLength = 4000; custom.rows = 3; custom.style.width = '100%'; custom.style.boxSizing = 'border-box'; customLabel.append(custom); customLabel.hidden = true;
    const title = node('h3', '', '作者通用开场'), preview = node('pre', 'cxx-opening-link-preview', '作者正文待提供。');
    preview.style.whiteSpace = 'pre-wrap'; preview.style.overflowWrap = 'anywhere'; preview.style.margin = '0';
    const note = node('p', 'cxx-opening-link-note'); note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
    const button = node('button', 'cxx-opening-link-start', '确认开局设置'); button.type = 'button'; button.disabled = true; button.style.minHeight = '44px';
    panel.append(identityLabel, eraLabel, customLabel, title, preview, note, button); root.append(panel);
    const getSelection = () => ({ identityId: identity.value || null, timelineId: era.value || null, customDescription: identity.value === 'custom' ? custom.value || '' : '' });
    async function refresh() {
      const turn = ++revision, model = await coordinator.inspect(getSelection());
      if (destroyed || turn !== revision) return model;
      const current = coordinator.status(), busy = current.phase === 'busy';
      identity.disabled = era.disabled = custom.disabled = busy; customLabel.hidden = identity.value !== 'custom';
      title.textContent = model.opening?.title || '作者通用开场'; preview.textContent = model.opening?.body || '作者正文待提供。';
      note.textContent = current.phase === 'confirmed' ? current.reason : displayedOutcome?.ok === false ? displayedOutcome.reason : model.reason;
      button.disabled = busy || !model.canStart || current.phase === 'confirmed'; panel.setAttribute('aria-busy', String(busy));
      return model;
    }
    async function confirm() { if (destroyed) return { ok: false, code: 'destroyed', reason: '开局容器已关闭。' }; displayedOutcome = null; const result = coordinator.start(getSelection()); await refresh(); const outcome = await result; displayedOutcome = outcome; await refresh(); return outcome; }
    const change = () => { displayedOutcome = null; refresh(); }, click = () => { confirm(); };
    identity.addEventListener('change', change); era.addEventListener('change', change); custom.addEventListener('input', change); button.addEventListener('click', click);
    const ready = refresh();
    return { ready, refresh, getSelection, start: confirm, inspect: () => coordinator.inspect(getSelection()), status: coordinator.status,
      destroy() { destroyed = true; revision++; coordinator.destroy(); identity.removeEventListener('change', change); era.removeEventListener('change', change); custom.removeEventListener('input', change); button.removeEventListener('click', click); panel.remove(); } };
  }
  return Object.freeze({ identities, timelines, validateTransaction, create, mount });
});
