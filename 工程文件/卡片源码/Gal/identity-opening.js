/* Pure opening drafts. Selection never writes a message, worldbook or game state. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxIdentityOpening = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const eras = Object.freeze([
    Object.freeze({ id: '2050-12', name: '2050 年 12 月前后', label: 'Mujica 起点', description: '从较早的时间开始，亲历后续事件。' }),
    Object.freeze({ id: '2051-04', name: '2051 年 4 月前后', label: 'MyGO 起点', description: '此前事件按时间线已发生或跳过，不补发任务奖励。' }),
  ]);
  const builtins = Object.freeze([
    ['corpo', '公司员工'], ['street', '街头小子'], ['student', '青年学生'], ['custom', '自定义'],
  ].map(([id, name]) => Object.freeze({ id, name, opening: '', source: 'builtin', draft: true })));
  const allowed = new Set(['id', 'name', 'opening', 'background', 'appearance', 'skills']);
  function text(value, field, limit, required) {
    if (typeof value !== 'string' || value.length > limit || required && !value.trim()) throw Error(field + '须为非空文本，且不超过 ' + limit + ' 字。');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<%|<\s*\/?\s*(script|iframe|style)\b|javascript\s*:/i.test(value)) throw Error(field + '只接受静态文本。');
    return value;
  }
  function validate(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw Error('身份资料须为对象。');
    for (const key of Object.keys(entry)) if (!allowed.has(key)) throw Error('身份资料不支持字段：' + key);
    if (typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(entry.id) || ['__proto__', 'prototype', 'constructor'].includes(entry.id)) throw Error('身份编号无效。');
    const value = { id: entry.id, name: text(entry.name, '身份名称', 60, true), opening: text(entry.opening, '通用开场', 4000, true) };
    for (const field of ['background', 'appearance', 'skills']) if (entry[field] !== undefined) value[field] = text(entry[field], field, 4000, false);
    return Object.freeze({ ...value, source: 'external', draft: false });
  }
  // Only project display fields here. The M18 session validates the full transaction before writing.
  function authoredChoices(manifest) {
    if (manifest == null) return { identities: builtins, eras };
    if (typeof manifest !== 'object' || Array.isArray(manifest) || !Array.isArray(manifest.identities) || !Array.isArray(manifest.timelines)) throw Error('作者开局清单须包含身份与时间列表。');
    text(manifest.version, '作者资料版本', 128, true);
    function entries(values, known, label) {
      const found = new Map();
      for (const value of values) {
        if (!value || !known.some(item => item.id === value.id) || found.has(value.id)) throw Error(label + '编号未知或重复。');
        text(value.label, label + '名称', 60, true); found.set(value.id, value);
      }
      return found;
    }
    const authored = entries(manifest.identities, builtins, '身份'), times = entries(manifest.timelines, eras, '时间');
    return {
      identities: builtins.map(item => {
        const entry = authored.get(item.id);
        if (!entry) return item;
        const opening = text(entry.body ?? '', '通用开场', 4000, false);
        return Object.freeze({ ...item, name: entry.label, opening, draft: !opening.trim() });
      }),
      eras: Object.freeze(eras.map(item => times.has(item.id) ? Object.freeze({ ...item, label: times.get(item.id).label }) : item)),
    };
  }
  function createSelection({ identities = [], manifest = null, identityId = null, eraId = null } = {}) {
    if (!Array.isArray(identities)) throw Error('身份列表须为数组。');
    const authored = authoredChoices(manifest), list = [...authored.identities], ids = new Set(list.map(entry => entry.id));
    for (const incoming of identities) {
      const entry = validate(incoming);
      if (ids.has(entry.id)) throw Error('身份编号重复或占用了内置身份：' + entry.id);
      ids.add(entry.id); list.push(entry);
    }
    const selectedIdentity = list.find(entry => entry.id === identityId) || null;
    const selectedEra = authored.eras.find(era => era.id === eraId) || null;
    if (identityId !== null && !selectedIdentity) throw Error('未知的身份。');
    if (eraId !== null && !selectedEra) throw Error('未知的起始时间。');
    const reason = !selectedIdentity ? '请选择身份。' : selectedIdentity.draft ? '这个身份的通用开场待作者编写。' : !selectedEra ? '请选择起始时间。' : '';
    return Object.freeze({ identities: Object.freeze(list), eras: authored.eras, selectedIdentity, selectedEra,
      opening: selectedIdentity?.opening || '', canPreview: !reason, canStart: false, reason,
      // A display projection cannot certify initial state or authorise a transaction.
      timelineTaskIds: Object.freeze([]), initialStateReady: false });
  }
  function describe(selection) {
    if (!selection.selectedIdentity) return '先选择你在东京都的身份。';
    if (selection.reason) return selection.reason;
    return selection.selectedIdentity.name + ' · ' + selection.selectedEra.name + '。两档时间共用这篇开场；初始状态尚待确认。';
  }
  return Object.freeze({ eras, builtins, validate, createSelection, describe });
});
