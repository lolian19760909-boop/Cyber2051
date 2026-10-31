/* Gal names and host capabilities around the frozen M18 opening transaction. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./integrations/m18/opening-link.js'), require('./integrations/m18/terminal-host-state.js'));
  } else root.CxxGalOpeningSession = factory(root.CxxOpeningLink, root.CxxTerminalHost);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (opening, terminal) {
  'use strict';
  if (typeof opening?.create !== 'function' || typeof opening?.validateTransaction !== 'function' || typeof terminal?.create !== 'function') {
    throw Error('Gal 开局接入缺少已冻结的 M18 开局与宿主模块。');
  }

  function selection(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const mapped = { ...value, timelineId: value.eraId };
    delete mapped.eraId;
    return mapped;
  }

  function create({ manifest, readContext, commitOpening } = {}) {
    const session = opening.create({ manifest, readContext, commitOpening });
    return Object.freeze({
      inspect: chosen => session.inspect(selection(chosen)),
      start: chosen => session.start(selection(chosen)),
      status: session.status,
      destroy: session.destroy,
    });
  }

  function createHost({ getContext, getLastMessageId, getVariables, updateVariablesWith, busy } = {}) {
    const missing = Object.entries({ getContext, getLastMessageId, getVariables, updateVariablesWith, busy })
      .filter(([, value]) => typeof value !== 'function').map(([name]) => name);
    function readBusy() {
      if (missing.length) {
        const error = Error('当前宿主仅可预览开局；缺少能力：' + missing.join('、') + '。');
        error.code = 'capability-unavailable'; throw error;
      }
      const value = busy();
      if (typeof value !== 'boolean') {
        const error = Error('宿主未提供明确的生成状态，未提交开局设置。');
        error.code = 'context-unavailable'; throw error;
      }
      return value;
    }
    const host = terminal.create({
      getContext, getLastMessageId, getVariables, validateOpening: opening.validateTransaction,
      updateVariablesWith: typeof updateVariablesWith === 'function' ? (update, scope) => updateVariablesWith(variables => {
        // Check at the actual synchronous write boundary as well as confirmation time.
        if (readBusy()) throw Error('宿主正在处理其他操作，未提交开局设置。');
        return update(variables);
      }, scope) : undefined,
    });
    return Object.freeze({
      readContext() {
        const processing = readBusy();
        const { scope, floor, branch, hasStarted, openingToken } = host.readState();
        return { scope, floor, branch, hasStarted, openingToken, busy: processing };
      },
      commitOpening(transaction) {
        if (readBusy()) return { ok: false, code: 'busy', reason: '宿主正在处理其他操作，未提交开局设置。' };
        return host.commitOpening(transaction);
      },
      changed: host.changed,
    });
  }

  return Object.freeze({ create, createHost });
});
