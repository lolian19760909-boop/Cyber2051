(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CxxNewsState = api;
})(typeof globalThis === 'object' ? globalThis : window, function () {
  'use strict';
  const states = ['已发布', '进行中', '完成', '失败', '搁置'];
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
  const copy = v => JSON.parse(JSON.stringify(v));
  const freeze = value => { Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(value); };
  const text = (v, max, required = true) => typeof v === 'string' && v.length <= max
    && (!required || Boolean(v.trim())) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
  const id = v => text(v, 128) && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(v)
    && !['__proto__', 'constructor', 'prototype'].includes(v);
  const floor = v => Number.isSafeInteger(v) && v >= 0 ? v : null;

  // Exact canonical input is kept only in memory. Persistent stamps contain no source text.
  function canonical(value, seen = new Set(), depth = 0) {
    if (depth > 16) throw new Error('State is too deep');
    if (value === undefined) return 'u';
    if (value === null) return 'n';
    if (typeof value === 'boolean') return value ? 'b1' : 'b0';
    if (typeof value === 'string') { if (value.length > 65536) throw new Error('State text is too long'); return 's' + value.length + ':' + value; }
    if (typeof value === 'number') return 'd' + String(value);
    if (typeof value !== 'object' || seen.has(value)) throw new Error('State must be JSON');
    seen.add(value);
    const keys = Object.keys(value).sort();
    if (keys.length > 2048) throw new Error('State has too many fields');
    const result = Array.isArray(value) ? 'a[' + value.map(v => canonical(v, seen, depth + 1)).join(',') + ']'
      : 'o{' + keys.map(k => canonical(k) + ':' + canonical(value[k], seen, depth + 1)).join(',') + '}';
    seen.delete(value);
    if (result.length > 262144) throw new Error('State is too large');
    return result;
  }
  function digest(value) {
    let a = 2166136261, b = 5381;
    for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ value.charCodeAt(i); }
    return value.length + ':' + (a >>> 0).toString(16) + ':' + (b >>> 0).toString(16);
  }
  function ref(value, questId) {
    return object(value) && id(value.packageId) && text(value.version, 80) && value.questId === questId;
  }
  function story(opening) {
    const unknown = { date: 'unknown', time: 'unknown', location: 'unknown', phase: 'unknown' };
    const s = opening?.initialState?.story, date = s?.date;
    if (opening?.schemaVersion !== 1 || !text(opening.token, 160) || !text(opening.manifestVersion, 128)
      || !['2050-12', '2051-04'].includes(opening.timelineId) || !text(date, 10)
      || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(date) || date.slice(0, 7) !== opening.timelineId) return unknown;
    if (date.length === 10) {
      const [year, month, day] = date.split('-').map(Number), parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return unknown;
    }
    return { date, time: text(s.time, 80) ? s.time : 'unknown', location: text(s.location, 120) ? s.location : 'unknown',
      phase: Number.isSafeInteger(s.phase) && s.phase >= 0 || text(s.phase, 80) ? s.phase : 'unknown' };
  }
  function normalizeDynamic(value) {
    if (!object(value) || !Array.isArray(value.news) || !Array.isArray(value.threads)
      || !value.news.length || value.news.length > 4 || !value.threads.length || value.threads.length > 4) return null;
    const result = { news: [], threads: [] };
    const fields = (input, limits) => {
      if (!object(input)) return null;
      const out = {};
      for (const [key, max] of Object.entries(limits)) { if (!text(input[key], max)) return null; out[key] = input[key]; }
      for (const [key, max] of [['id', 160], ['time', 40]]) if (text(input[key], max)) out[key] = input[key];
      out.dynamic = true;
      return out;
    };
    for (const item of value.news) {
      const n = fields(item, { outlet: 80, column: 80, title: 160, lead: 800, body: 4000 });
      if (!n) return null; result.news.push(n);
    }
    for (const item of value.threads) {
      const t = fields(item, { board: 80, title: 160, author: 80 });
      if (!t || !Array.isArray(item.posts) || !item.posts.length || item.posts.length > 8) return null;
      t.posts = [];
      for (const post of item.posts) { const p = fields(post, { author: 80, text: 2000 }); if (!p) return null; delete p.dynamic; t.posts.push(p); }
      result.threads.push(t);
    }
    if (text(value.generatedAt, 80)) result.generatedAt = value.generatedAt;
    return JSON.stringify(result).length <= 65536 ? result : null;
  }

  function create(deps) {
    if (!deps || typeof deps.read !== 'function') throw new TypeError('read is required');
    const tickets = new WeakMap(), caches = new Map(), reportedByScope = new Map();
    let previous = null, epoch = 0;
    function cacheFor(partition, persistent) {
      if (caches.has(partition)) return caches.get(partition);
      const cache = { stamp: null, dynamic: null };
      if (persistent) try {
        const raw = deps.storage?.getItem('cxx2051-news-state-v1:' + partition);
        if (typeof raw === 'string' && raw.length <= 262144) {
          const value = JSON.parse(raw);
          if (value?.format === 1 && text(value.stamp, 80)) {
            cache.stamp = value.stamp; cache.dynamic = normalizeDynamic(value.dynamic);
          }
        }
      } catch { /* Unavailable or malformed display storage starts empty. */ }
      caches.set(partition, cache); return cache;
    }
    function reportedFor(scope) {
      const reported = reportedByScope.get(scope) || { markers: [] };
      // Legacy display-cache markers belong to individual branches. Do not promote them into chat history.
      // Another terminal instance may have reported an event since our previous observation.
      if (scope !== null) try {
        const raw = deps.storage?.getItem('cxx2051-news-reported-v1:' + JSON.stringify(scope));
        if (typeof raw === 'string' && raw.length <= 262144) {
          const value = JSON.parse(raw);
          if (value?.format === 1 && Array.isArray(value.markers) && value.markers.length <= 2048
            && value.markers.every(m => text(m, 80))) reported.markers = [...new Set([...value.markers, ...reported.markers])].slice(-2048);
        }
      } catch { /* Unavailable reporting history remains local to this instance. */ }
      reportedByScope.set(scope, reported); return reported;
    }
    function persist(view) {
      if (!view.persistent) return;
      for (const [key, value] of [
        ['cxx2051-news-state-v1:' + view.partition, { format: 1, ...view.cache }],
        ['cxx2051-news-reported-v1:' + JSON.stringify(view.scope), { format: 1, ...view.reported }],
      ]) try { deps.storage?.setItem(key, JSON.stringify(value)); }
      catch { /* Successful results and reporting history remain available in this instance. */ }
    }
    function observe() {
      let input;
      try { input = deps.read(); } catch { epoch++; previous = null; return null; }
      const scope = text(input?.scope, 2048) ? input.scope : null;
      const branch = text(input?.branch, 1024) ? input.branch : null;
      const partition = JSON.stringify([scope, branch]), persistent = scope !== null;
      const records = object(input?.statData?.terminal?.quests) ? input.statData.terminal.quests : {};
      const quests = Array.isArray(input?.quests) ? input.quests : [];
      let exact;
      try {
        if (quests.length > 512) throw new Error('Too many task definitions');
        // sourceFloor diagnoses fallback reads; copying the same effective state to floor must not invalidate it.
        exact = canonical({ scope, branch, floor: input?.floor,
          revision: input?.revision, records, quests, opening: input?.statData?.terminal?.opening,
          hasStarted: input?.hasStarted, openingToken: input?.openingToken });
      } catch {
        epoch++; previous = null;
        return null;
      }
      if (previous && previous.exact !== exact) epoch++;
      const changed = previous && previous.exact !== exact;
      const cache = cacheFor(partition, persistent), reported = reportedFor(scope);
      if (changed) { cache.stamp = null; cache.dynamic = null; }
      const counts = Object.fromEntries(states.map(s => [s, 0])), completed = [];
      const seen = new Set();
      for (const q of quests) {
        if (!object(q) || !id(q.id) || seen.has(q.id)) continue;
        seen.add(q.id);
        const rec = object(records[q.id]) ? records[q.id] : {};
        if (rec.state !== undefined && !states.includes(rec.state)) continue;
        const state = states.includes(rec.state) ? rec.state : '已发布';
        if (q.hidden === true || q.unlocked === false || q.locked === true && state === '已发布') continue;
        const explicit = q.locked === false || q.unlocked === true;
        if (!explicit && state === '已发布') {
          if (q.id === 'q_heist' || q.flagship === true || q.unlock) continue;
          if (q.prerequisites !== undefined && (!Array.isArray(q.prerequisites)
            || !q.prerequisites.every(key => id(key) && records[key]?.state === '完成'))) continue;
        }
        if (own(rec, 'definitionRef')) {
          if (!ref(rec.definitionRef, q.id) || !ref(q.definitionRef, q.id)
            || canonical(rec.definitionRef) !== canonical(q.definitionRef)) continue;
        } else if (q.definitionRef !== undefined) {
          if (!ref(q.definitionRef, q.id) || state !== '已发布') continue;
        }
        counts[state]++;
        // A summary is not a future-task teaser. Only an already completed record may enter a request.
        if (state === '完成' && text(q.publicSummary, 800)) {
          const marker = digest(canonical([q.id, floor(rec.acceptedFloor), rec.definitionRef || null]));
          completed.push({ marker, summary: q.publicSummary, observation: 'recorded' });
        }
      }
      const pending = completed.filter(c => !reported.markers.includes(c.marker)).slice(0, 24);
      const view = { exact, stamp: digest(exact), epoch, scope, partition, persistent, cache, reported,
        source: { floor: floor(input?.floor), sourceFloor: floor(input?.sourceFloor) },
        context: { story: story(input?.statData?.terminal?.opening), taskCounts: counts,
          publicEvents: pending.map(c => ({ summary: c.summary, observation: c.observation })) },
        markers: pending.map(c => c.marker) };
      previous = view; return view;
    }
    function capture() {
      const view = observe();
      if (!view) return null;
      const ticket = Object.freeze({ source: Object.freeze({ ...view.source }), context: freeze(copy(view.context)) });
      tickets.set(ticket, { ...view, consumed: false }); return ticket;
    }
    function isCurrent(ticket) {
      const captured = tickets.get(ticket), current = observe();
      // Successful consumption does not make the source stale: the same ticket can guard optional headline sync.
      return Boolean(captured && current && captured.epoch === current.epoch && captured.exact === current.exact);
    }
    function readDynamic() {
      const current = observe();
      return current && current.cache.stamp === current.stamp && current.cache.dynamic ? copy(current.cache.dynamic) : null;
    }
    function requestContent(ticket) {
      const captured = tickets.get(ticket);
      return captured && !captured.consumed && isCurrent(ticket)
        && captured.markers.every(marker => !previous.reported.markers.includes(marker)) ? copy(captured.context) : null;
    }
    function commit(ticket, dynamic) {
      const captured = tickets.get(ticket);
      if (!captured || captured.consumed || !isCurrent(ticket)
        || captured.markers.some(marker => previous.reported.markers.includes(marker))) return false;
      const value = normalizeDynamic(dynamic); if (!value) return false;
      const current = previous;
      captured.consumed = true;
      current.cache.stamp = current.stamp; current.cache.dynamic = value;
      current.reported.markers = [...new Set([...current.reported.markers, ...captured.markers])].slice(-2048);
      persist(current); return true;
    }
    return Object.freeze({ capture, readDynamic, commit, requestContent, isCurrent, validateDynamic: value => Boolean(normalizeDynamic(value)) });
  }
  return Object.freeze({ create });
});
