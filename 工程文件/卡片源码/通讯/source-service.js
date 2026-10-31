/* Canonical story copies from MirrorTranslate's public reading API. Never persists a projection. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./reading-guard.js') : root.CxxReadingGuard);
  if (typeof module === 'object' && module.exports)
    module.exports = api;
  else
    root.CxxMirrorSource = api;
}(globalThis, function (Guard) {
  'use strict';
  const fault = (code, message) => Object.assign(Error(message), {
    code,
    sourceGuard: true
  });
  function create({api, top, runtime, timeoutMs}) {
    const context = () => api.SillyTavern.getContext();
    const enabled=()=>api.getVariables?.({type:'chat'})?.__cxx_ui_preferences?.mirror!==false;
    const original=floor=>{const m=context().chat?.[floor];return typeof top.__JINGYI__?.floor?.original==='function'&&!m?.is_user&&!m?.is_system?top.__JINGYI__.floor.original(floor):String(m?.mes||'');};
    const plain=floor=>({ok:true,sourceMessage:original(floor),snapshot:null});
    const records = new Map();
    const ids = new WeakMap();
    const listeners = new Set();
    const offs = [];
    let nextId = 0;
    let scope = '';
    let disposed = false;
    let observed = null;
    let timer = null;
    function settingsStamp() {
      try {
        const s = top.__JINGYI__?.reading?.status?.();
        return JSON.stringify([
          enabled(),s?.apiVersion,
          s?.targetLanguage,
          s?.bodyTags,
          s?.bodyStartMarkers
        ]);
      } catch {
        return 'unavailable';
      }
    }
    function owner({messageId, swipeId} = {}) {
      const c = context();
      const m = c.chat?.[messageId];
      const key = runtime.key();
      if (!key || !m)
        return null;
      const selected = m.swipe_id || 0;
      const swipe = swipeId ?? selected;
      const raw = swipe === selected ? m.mes : m.swipes?.[swipe];
      if (typeof raw !== 'string')
        return null;
      const settings = settingsStamp();
      const user = !!m.is_user;
      const system = !!m.is_system;
      let entry = ids.get(m);
      if (!entry || entry.key !== key || entry.floor !== messageId || entry.swipe !== swipe
        || entry.raw !== raw || entry.settings !== settings || entry.user !== user || entry.system !== system) {
        entry = {
          key,
          floor: messageId,
          swipe,
          raw,
          settings,
          user,
          system,
          token: String(++nextId)
        };
        ids.set(m, entry);
      }
      return {
        chatId: String(c.getCurrentChatId()),
        messageId,
        swipeId: swipe,
        token: entry.token
      };
    }
    const guard = Guard.create({
      getApi: () => top.__JINGYI__,
      readScope: owner,
      timeoutMs
    });
    function stamp(floor) {
      return owner({ messageId: floor })?.token || '';
    }
    function notify(floor, reason = 'ready') {
      runtime.scheduleMessages?.(floor, floor == null, 'source');
      for (const fn of [...listeners])
        try {
          fn({
            floor,
            scope: runtime.key(),
            reason
          });
        } catch {
        }
      top.dispatchEvent?.(new top.CustomEvent('cxx-source-changed', {
        detail: {
          floor,
          scope: runtime.key(),
          reason
        }
      }));
    }
    function reset() {
      scope = runtime.key();
      records.clear();
    }
    function current(floor, r) {
      return !disposed && scope === runtime.key() && r.stamp === stamp(floor) && r.plugin === top.__JINGYI__;
    }
    function cached(floor) {
      if(!enabled())return plain(floor);
      if (scope !== runtime.key())
        reset();
      const r = records.get(floor);
      return r && current(floor, r) && r.result ? r.result : null;
    }
    async function read(floor, {signal} = {}) {
      if (disposed)
        throw fault('closed', '原文服务已关闭。');
      if (scope !== runtime.key())
        reset();
      const c = context();
      const m = c.chat?.[floor];
      if (!runtime.key() || !m)
        throw fault('missing', '正文楼层已不存在。');
      if (m.is_user || m.is_system || !top.__JINGYI__)
        return {
          ok: true,
          sourceMessage: String(m.mes || ''),
          snapshot: null
        };
      if(!enabled())return plain(floor);
      const existing = cached(floor);
      if (existing)
        return existing;
      let r = records.get(floor);
      if (r && current(floor, r) && r.flight)
        return r.flight;
      r = {
        stamp: stamp(floor),
        plugin: top.__JINGYI__,
        result: null,
        flight: null
      };
      records.set(floor, r);
      r.flight = (async () => {
        let result;
        for (let n = 0; n < 3; n++) {
          result = await guard.read({ messageId: floor });
          if (result.code !== 'changed' || !current(floor, r) || n === 2)
            break;
        }
        if (!current(floor, r) || records.get(floor) !== r)
          throw fault('changed', '正文归属已变化，旧读取已丢弃。');
        r.result = result;
        notify(floor, result.ok ? 'ready' : 'failed');
        return result;
      })().finally(() => r.flight = null);
      return r.flight;
    }
    async function text(floor, options) {
      const result = await read(floor, options);
      if (!result.ok)
        throw fault(result.code, result.message);
      return result.sourceMessage;
    }
    function sync(floor) {
      const c = context();
      const m = c.chat?.[floor];
      if (!m)
        return '';
      if (m.is_user || m.is_system || !top.__JINGYI__)
        return String(m.mes || '');
      if(!enabled())return original(floor);
      const r = cached(floor);
      if (r?.ok)
        return r.sourceMessage;
      if (r)
        throw fault(r.code, r.message);
      void read(floor).catch(() => {
      });
      throw fault('source_pending', '正在核对镜译原文，请稍后重试。');
    }
    function message(m, floor = context().chat.indexOf(m)) {
      return {
        ...m,
        mes: sync(floor)
      };
    }
    async function prime(from = 0, to = context().chat.length - 1) {
      const expected = runtime.key();
      for (let i = Math.max(0, from); i <= to; i++)
        await text(i);
      if (disposed || !expected || runtime.key() !== expected)
        throw fault('changed', '聊天已切换，原文读取已取消。');
    }
    async function chat(from = 0, to = context().chat.length - 1) {
      await prime(from, to);
      return context().chat.map((m, i) => i >= from && i <= to ? message(m, i) : m);
    }
    function invalidate(event) {
      if (disposed)
        return;
      const c = context();
      if (event?.chatId && event.chatId !== String(c.getCurrentChatId()))
        return;
      const floor = Number.isInteger(event?.messageId) ? event.messageId : null;
      if (floor !== null && event?.swipeId != null && event.swipeId !== (c.chat[floor]?.swipe_id || 0))
        return;
      if (floor === null)
        records.clear();
      else
        records.delete(floor);
      notify(floor, 'invalidated');
      if (floor !== null)
        void read(floor).catch(() => {
        });
    }
    function warm(batch) {
      if (disposed)
        return;
      if (scope !== runtime.key())
        reset();
      if (!runtime.key())
        return;
      // Source readiness already updated the cache; its notification is for consumers.
      if (!batch?.full && batch?.reasons?.length && batch.reasons.every(reason => reason === 'source'))
        return;
      const c = context();
      const end = c.chat.length - 1;
      const start = Math.max(0, end - 19);
      for (const floor of records.keys())
        if (floor > end)
          records.delete(floor);
      const floors = batch && !batch.full && batch.floors?.length ? new Set(batch.floors) : Array.from({ length: end - start + 1 }, (_, i) => start + i);
      for (const floor of floors)
        if (floor >= start && floor <= end && !c.chat[floor]?.is_user && !c.chat[floor]?.is_system) {
          void read(floor).catch(() => {
          });
        }
    }
    async function before(type, options) {
      if (options && Object.hasOwn(options, 'automatic_trigger') && ['normal', 'continue', 'swipe', 'regenerate'].includes(type)) {
        try {
          await prime();
        } catch (e) {
          context().stopGeneration?.();
          top.toastr?.warning(e.message, '剧情原文不可用');
          throw e;
        }
      }
    }
    function start() {
      offs.push(guard.subscribe(invalidate));
      offs.push(runtime.watchMessages(warm));
      const event = context().eventTypes?.GENERATION_AFTER_COMMANDS;
      if (event && api.eventOn) {
        api.eventOn(event, before);
        offs.push(() => api.eventRemoveListener(event, before));
      }
      observed = top.__JINGYI__;
      let observedSettings = settingsStamp();
      timer = top.setInterval(() => {
        if (observed !== top.__JINGYI__ || observedSettings !== settingsStamp()) {
          observed = top.__JINGYI__;
          observedSettings = settingsStamp();
          records.clear();
          notify(null, 'invalidated');
          warm();
        }
      }, 1500);
      const changed=()=>{records.clear();notify(null,'preferences');warm();};top.addEventListener?.('cxx-ui-preferences-changed',changed);offs.push(()=>top.removeEventListener?.('cxx-ui-preferences-changed',changed));
      warm();
      return service;
    }
    function destroy() {
      if (disposed)
        return;
      disposed = true;
      if (timer != null)
        top.clearInterval(timer);
      guard.destroy();
      offs.splice(0).forEach(f => f());
      records.clear();
      listeners.clear();
    }
    const service = {
      read,
      original,
      enabled,
      text,
      sync,
      message,
      chat,
      prime,
      peek: cached,
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      refresh(floor) {
        if (floor == null)
          records.clear();
        else
          records.delete(floor);
        warm();
        return floor == null ? prime() : read(floor);
      },
      start,
      destroy
    };
    return service;
  }
  return { create };
}));
