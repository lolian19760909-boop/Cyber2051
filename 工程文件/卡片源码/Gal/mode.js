/* Chat-local preference only. Host lifecycle and disk-save confirmation live elsewhere. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CxxGalMode = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = '__cxx_gal_mode';
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const objectSource = Function.prototype.toString.call(Object);
  function plain(value) {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    // TH returns values from the host realm, whose Object.prototype is different.
    return proto === null || (Object.getPrototypeOf(proto) === null && own(proto, 'constructor') && typeof proto.constructor === 'function' &&
      Function.prototype.toString.call(proto.constructor) === objectSource);
  }
  function reject(code) { const error = Error(code); error.modeCode = code; throw error; }
  const failure = code => ({ ok: false, enabled: false, code });
  function inspect(variables) {
    if (!plain(variables)) reject('invalid-state');
    if (!own(variables, KEY)) return { enabled: false, record: null };
    const record = variables[KEY];
    if (!plain(record) || !own(record, 'schemaVersion')) reject('invalid-state');
    if (record.schemaVersion !== 1) reject('unsupported-version');
    if (!own(record, 'enabled') || typeof record.enabled !== 'boolean') reject('invalid-state');
    return { enabled: record.enabled, record };
  }
  function create({ readScope, getVariables, updateVariablesWith } = {}) {
    function checkScope(expectedKey) {
      if (typeof expectedKey !== 'string' || !expectedKey || readScope() !== expectedKey) reject('scope-changed');
    }
    function read(expectedKey) {
      if (typeof readScope !== 'function' || typeof getVariables !== 'function') return failure('volatile');
      try {
        checkScope(expectedKey);
        const current = inspect(getVariables({ type: 'chat' }));
        checkScope(expectedKey);
        return { ok: true, enabled: current.enabled };
      } catch (error) { return failure(error?.modeCode || 'read-failed'); }
    }
    function setEnabled(expectedKey, enabled) {
      if (typeof enabled !== 'boolean') return failure('invalid-enabled');
      if (typeof readScope !== 'function' || typeof getVariables !== 'function' || typeof updateVariablesWith !== 'function') {
        return failure('volatile');
      }
      try {
        checkScope(expectedKey);
        const result = updateVariablesWith(variables => {
          const current = inspect(variables);
          const next = { ...variables, [KEY]: { ...current.record, schemaVersion: 1, enabled } };
          checkScope(expectedKey); // Throw before TH's synchronous replaceVariables call.
          return next;
        }, { type: 'chat' });
        if (result && typeof result.then === 'function') return failure('write-failed');
        const verified = read(expectedKey);
        if (!verified.ok) return verified;
        return verified.enabled === enabled ? verified : failure('write-failed');
      } catch (error) { return failure(error?.modeCode || 'write-failed'); }
    }
    return Object.freeze({ read, setEnabled });
  }
  return Object.freeze({ create });
});
