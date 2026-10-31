/* Read-only character cache comparison; no card, chat, variable or settings writes. */
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.CxxCharacterCacheCheck=value;})(globalThis,function(){
  'use strict';
  const Comparison = typeof module === 'object' && module.exports ? require('./character-comparison.js') : globalThis.CxxCharacterComparison;
  const clone = value => JSON.parse(JSON.stringify(value));
  const { rawData, character: comparable } = Comparison;
  function describe(value) {
    if (value === undefined) return { type: 'absent' };
    const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (['boolean', 'number', 'null'].includes(type)) return { type, value };
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    // A small diagnostic fingerprint, not a signature or save authorization.
    let hash = 2166136261; for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return { type, length: text.length, fingerprint32: (hash >>> 0).toString(16).padStart(8, '0') };
  }
  function difference(a, b, limit = 60) {
    const changes = []; let omitted = 0;
    const object = v => v !== null && typeof v === 'object';
    function walk(left, right, path) {
      if (left === right) return;
      if (object(left) && object(right) && Array.isArray(left) === Array.isArray(right)) {
        for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) walk(left[key], right[key], path + '/' + key.replace(/~/g, '~0').replace(/\//g, '~1'));
      } else if (changes.length < limit) changes.push({ path, cache: describe(left), disk: describe(right) }); else omitted++;
    }
    walk(a, b, ''); return { equal: !changes.length && !omitted, changes, omitted };
  }
  const envelope = raw => typeof raw?.json_data === 'string' ? JSON.parse(raw.json_data) : raw;
  function pause(ms,signal){return new Promise((resolve,reject)=>{const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);resolve();},cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(Error('角色缓存检查已取消。'));},timer=setTimeout(finish,ms);if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});});}
  async function capture(win, api, { wait, signal, timeout = 10000 } = {}) {
    const ctx = () => (api.SillyTavern || win.SillyTavern).getContext();
    const get = () => (api.getCharData || win.TavernHelper?.getCharData)('current');
    const scope = () => { const c = ctx(); return [c.characters?.[c.characterId]?.avatar || api.getCurrentCharacterId?.(), c.getCurrentChatId?.()]; };
    const beforeScope = scope(), cached = clone(get()), left = comparable(cached), reads = [];
    if (!beforeScope[0]) throw Error('请先打开报错的角色卡。');
    const check = () => { if (signal?.aborted) throw Error('角色缓存检查已取消。'); if (JSON.stringify(scope()) !== JSON.stringify(beforeScope)) throw Error('检查中切换了角色或聊天，请重新检查。'); };
    async function read() {
      check(); const controller = new AbortController(), cancel = () => controller.abort(), timer = setTimeout(cancel, timeout);
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        const response = await (api.fetch || win.fetch).call(api.fetch ? api : win, new URL('/api/characters/get', win.location.origin).href,
          { method: 'POST', signal: controller.signal, headers: ctx().getRequestHeaders(), credentials: 'same-origin', cache: 'no-store', body: JSON.stringify({ avatar_url: beforeScope[0] }) });
        check(); if (!response.ok) throw Error('角色读取接口返回 HTTP ' + response.status);
        const disk = await response.json(); check(); reads.push({ at: new Date().toISOString(), difference: difference(left, comparable(disk)) }); return disk;
      } catch (error) { check(); if (controller.signal.aborted) throw Error('角色读取超时，请重试检查。'); throw error; }
      finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
    }
    const first = await read(); await (wait?wait(2500):pause(2500,signal)); const last = await read(), after = get(); check();
    const cacheStable = difference(left, comparable(after)).equal && cached.json_data === after.json_data;
    return { probe: 'character-cache-20261014', at: new Date().toISOString(),
      hostVersion: api.getTavernVersion?.(), helperVersion: api.getTavernHelperVersion?.(),
      build: win.CxxResources?.read?.()?.cardBuild || null, cacheStable,
      conclusion: !cacheStable ? '检查中本地缓存发生变化，先等待保存结束再检查。' : reads[1].difference.equal ? (reads[0].difference.equal ? '本次缓存与宿主读取结果一致。' : '保存延迟：第二次读取已一致。') : '仍存在差异：查看 difference 中的字段路径。',
      reads, cacheDataVsRaw: difference(left, comparable(rawData(cached))),
      diskDataVsRaw: difference(comparable(last), comparable(rawData(last))),
      rawJsonDifference: difference(comparable(rawData(cached)), comparable(rawData(last))),
      outer: { cacheKeys: Object.keys(envelope(cached) || {}).filter(k => k !== 'data'), diskKeys: Object.keys(envelope(last) || {}).filter(k => k !== 'data'),
        characterVersion: { cache: describe(envelope(cached)?.character_version), disk: describe(envelope(last)?.character_version) } },
      books: { cacheRootKeys: Object.keys(left.character_book || {}), diskRootKeys: Object.keys(comparable(last).character_book || {}) },
      diskChangedDuringWait: !difference(comparable(first), comparable(last)).equal };
  }
  return { comparable, difference, capture };
});
