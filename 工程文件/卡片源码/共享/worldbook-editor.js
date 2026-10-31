(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxWorldbookEditor = api;
})(globalThis, function () {
  'use strict';
  const KEY = '__cxx_worldbook_editor_v1';
  const intrinsic = new Set(['length', 'name', 'prototype', 'caller', 'arguments']);

  function create(win, $) {
    const wrappedCallbacks = new WeakSet();
    let leases = 0, active = false, pending = null, wrapper = null, previous = null;
    const stats = { scheduled: 0, started: 0, finished: 0, skipped: 0, failed: 0, maxActive: 0, maxPending: 0 };
    function releaseWrapper() {
      if (!leases && !active && !pending && $.fn.pagination === wrapper) $.fn.pagination = previous;
    }
    async function drain() {
      if (active) return;
      active = true;
      stats.maxActive = 1;
      try {
        while (pending) {
          const item = pending;
          pending = null;
          stats.started++;
          try { item.resolve(await item.callback.apply(item.receiver, item.args)); stats.finished++; }
          catch (error) { stats.failed++; item.reject(error); }
        }
      } finally { active = false; releaseWrapper(); }
    }
    function wrapCallback(callback) {
      if (wrappedCallbacks.has(callback)) return callback;
      const wrapped = function (...args) {
        stats.scheduled++;
        return new Promise((resolve, reject) => {
          if (pending) { stats.skipped++; pending.resolve(); }
          pending = { callback, receiver: this, args, resolve, reject };
          stats.maxPending = 1;
          void drain();
        });
      };
      wrappedCallbacks.add(wrapped);
      return wrapped;
    }
    function install() {
      if ($.fn.pagination === wrapper) return;
      const original = $.fn.pagination;
      const next = function (...args) {
        const options = args[0];
        if (this.length === 1 && this[0] === win.document.getElementById('world_info_pagination')
          && options && typeof options === 'object' && typeof options.callback === 'function') {
          args[0] = { ...options, callback: wrapCallback(options.callback) };
        }
        return original.apply(this, args);
      };
      // pagination.js reads its defaults through $.fn.pagination on every call.
      // Forward the same properties, including later changes made by the host.
      for (const key of Reflect.ownKeys(original)) {
        if (intrinsic.has(key)) continue;
        const descriptor = Object.getOwnPropertyDescriptor(original, key);
        const property = { configurable: true, enumerable: descriptor.enumerable, get: () => Reflect.get(original, key, original) };
        if (descriptor.writable || descriptor.set) property.set = value => Reflect.set(original, key, value, original);
        Object.defineProperty(next, key, property);
      }
      previous = original;
      wrapper = next;
      $.fn.pagination = next;
    }
    return {
      acquire() {
        if (!leases) install();
        leases++;
        let released = false;
        return {
          read: () => ({ ...stats, active: Number(active), pending: Number(!!pending), leases }),
          release() { if (released) return; released = true; leases--; releaseWrapper(); },
        };
      },
    };
  }
  function acquire(win) {
    const $ = win?.jQuery;
    if (!$?.fn || typeof $.fn.pagination !== 'function' || !win.document?.getElementById) return { release() {} };
    // Retain one queue across Helper iframe reloads. Existing native pagination
    // objects can still hold an earlier callback after its lease is released.
    const shared = win[KEY] || (win[KEY] = create(win, $));
    return shared.acquire();
  }
  return { acquire };
});
