(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CxxContent = api;
})(typeof globalThis === 'object' ? globalThis : window, function (root) {
  'use strict';
  const CryptoCompat=typeof module==='object'&&module.exports?require('./crypto-compat.js'):globalThis.CxxCrypto;
  const NAMESPACE = '__cxx_update_state';
  const copy = value => JSON.parse(JSON.stringify(value));
  const safeId = id => typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(id)
    && !['__proto__', 'constructor', 'prototype'].includes(id);
  const NOTE_KINDS = new Set(['world_factor', 'character', 'user_identity', 'encounter', 'function_zone', 'npc']);
  const GAMEPLAY_NOTE_KINDS = { shop_item: 'items', blueprint: 'blueprints', recipe: 'recipes', skill: 'skills', function: 'services' };
  const staticNoteText = (value, max, required = true) => typeof value === 'string' && value.length <= max
    && (!required || Boolean(value.trim())) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
    && !/<[%]|<\s*\/?\s*script\b|javascript\s*:/i.test(value);
  function safeImage(url) {
    if (typeof url !== 'string' || /[<>"'`\\\s]/.test(url)) return false;
    try { const u = new URL(url); return u.protocol === 'https:' && u.origin === 'https://cyber2051.top' && u.pathname.startsWith('/img/') && !u.username && !u.password && !u.hash; }
    catch { return false; }
  }
  function validateStoryMetadata(entry) {
    const extra=entry.extra || {};
    if(extra.__cxx_event_media){
      const m=extra.__cxx_event_media;
      if(!m || typeof m!=='object' || Array.isArray(m) || m.format!==1 || Object.keys(m).some(k=>!['format','id','name','category','url','alt','eventId','outcomeId'].includes(k)) ||
        !safeId(m.id) || !safeId(m.eventId) || !safeId(m.outcomeId) || !['event','scene'].includes(m.category) || !safeImage(m.url) || !staticNoteText(m.name,80) || !staticNoteText(m.alt,160))throw Error('事件插画须为静态官方素材，明确声明事件与结果编号');
    }
    function check(value,allowed,required){
      if(!value || typeof value!=='object' || Array.isArray(value) || value.format!==1 || Object.keys(value).some(k=>!allowed.includes(k)))throw Error('人物或出身资料格式需要匹配的新版角色卡');
      for(const k of allowed.filter(k=>!['format','media'].includes(k)))if(value[k]!==undefined || required.includes(k))if(!staticNoteText(value[k],k==='name'?60:4000,required.includes(k)))throw Error('人物或出身字段只接受静态正文：'+k);
    }
    if(extra.__cxx_player_start)check(extra.__cxx_player_start,['format','name','opening','background','appearance','skills'],['name','opening','background']);
    if(extra.__cxx_npc){const n=extra.__cxx_npc;check(n,['format','name','identity','background','relationships','boundaries','media'],['name','identity','background']);
      if(n.media!==undefined){if(!Array.isArray(n.media) || n.media.length>12)throw Error('NPC素材清单最多12项');const ids=new Set();for(const m of n.media){if(!m || Object.keys(m).some(k=>!['id','url','alt'].includes(k)) || !safeId(m.id) || ids.has(m.id) || !safeImage(m.url) || !staticNoteText(m.alt,120))throw Error('NPC素材须有唯一编号、官方图片地址及说明');ids.add(m.id);}}
    }
    return entry;
  }
  function storyChoices(registry,options={}) {
    const starts=[],npcs=[];
    for(const [packageId,r]of Object.entries(registry?.packages || {})){
      if(r.optional && options.subscriptions?.[packageId]!==true || ['new_chat','opt_in'].includes(r.activation) && !options.pins?.[packageId])continue;
      const version=options.pins?.[packageId] || r.version,content=packageContent(r,version);if(!content)continue;
      for(const entry of content.worldbook || []){validateStoryMetadata(entry);const base={id:packageId+':'+entry.uid,definitionRef:{packageId,version,kind:'worldbook',uid:entry.uid},location:copy(entry.extra?.__cxx_workshop_location || {}),source:copy(entry.extra?.__cxx_workshop_source || {})};
        if(entry.extra?.__cxx_player_start)starts.push({...copy(entry.extra.__cxx_player_start),...base});
        if(entry.extra?.__cxx_npc)npcs.push({...copy(entry.extra.__cxx_npc),...base});
      }
    }
    return {starts,npcs};
  }
  function readHost() {
    try {
      const value = typeof getVariables === 'function' ? getVariables({ type: 'character' })[NAMESPACE] : null;
      return value?.cardId === 'cyber2051' ? withMigration(value, getVariables({ type: 'chat' })) : null;
    } catch { return null; }
  }
  function chatPins() {
    try { return typeof getVariables === 'function' ? getVariables({ type: 'chat' }).__cxx_content_pins || {} : {}; }
    catch { return {}; }
  }
  function withMigration(state, vars = {}) {
    const saved = vars.__cxx_migration;
    if (saved?.format !== 1 || !saved.archive?.packages) return state;
    // This chat owns its historical data. Never save this effective view back
    // into the character's install ledger or use it as proof of installation.
    const result = copy(state), packages = result.registry?.packages || {};
    result.registry = { format: 1, ...(result.registry || {}), packages };
    for (const [id, old] of Object.entries(saved.archive.packages)) {
      if (!safeId(id)) continue;
      const current = packages[id];
      if (!current) packages[id] = copy(old);
      else {
        // A new installation in another chat cannot reinterpret a version that
        // this chat already played. The archive remains the historical authority.
        const history = { ...(current.history || {}), ...copy(old.history || {}), [old.version]: copy(old.content) };
        if (history[current.version]) current.content = copy(history[current.version]);
        delete history[current.version]; current.history = history;
      }
    }
    result.registry.migrationLegacyQuests = copy(saved.archive.legacyQuests || []);
    result.subscriptions = { ...(saved.preferences?.subscriptions || {}), ...(result.subscriptions || {}) };
    result.mediaPreferences = { ...(saved.preferences?.mediaPreferences || {}), ...(result.mediaPreferences || {}) };
    return result;
  }
  function packageContent(record, version) {
    return !version || version === record.version ? record.content : record.history?.[version];
  }
  function eventMedia(registry, savedEvents = {}) {
    const unlocked=[];
    for(const [eventId,event] of Object.entries(savedEvents)){
      const ref=event?.definitionRef,record=registry?.packages?.[ref?.packageId];
      if(event?.status!=='completed' || ref?.kind!=='encounters' || ref.id!==eventId || !record)continue;
      // Resolve the version which produced the saved outcome, never today's definition.
      const content=packageContent(record,ref.version),definition=content?.gameplay?.encounters?.find(e=>e.id===eventId);
      if(!definition?.outcomes?.some(o=>o.id===event.outcomeId))continue;
      for(const entry of content.worldbook || []){
        const media=entry.extra?.__cxx_event_media;if(!media || media.eventId!==eventId || media.outcomeId!==event.outcomeId)continue;
        try{validateStoryMetadata(entry);}catch{continue;}
        unlocked.push({...copy(media),id:ref.packageId+':'+media.id,definitionRef:copy(ref)});
      }
    }
    return unlocked;
  }
  function baseAssetId(characterId, category, index) { return 'base.' + characterId + '.' + category + '.' + (index + 1); }
  function view(base, registry, records = {}, options = {}) {
    const result = { ...base, quests: copy(base.quests || []), gallery: copy(base.gallery || { characters: [] }) };
    result.assetMeta = {}; result.contentWarnings = []; result.workshopNotes = [];
    const locationMaps = base.locationMaps || [{ id: 'tokyo-central', places: base.nodes || [] }];
    const hasPlace = (mapId, placeId) => locationMaps.some(map => map.id === mapId && map.places.some(place => place.id === placeId));
    const quests = new Map(result.quests.map(q => [q.id, q]));
    const owners = new Map(result.quests.map(q => [q.id, 'base']));
    const initialQuests = new Map((options.initialContent?.quests || []).map(q => [q.id, q]));
    const initialAssets = new Map((options.initialContent?.gallery || []).map(a => [a.id, a]));
    const assetSlots = new Map();
    const characters = new Map((result.gallery.characters || []).map(ch => [ch.id, ch]));
    for (const ch of characters.values()) {
      for (const category of ['standard', 'daily']) {
        (ch[category] || []).forEach((url, index) => {
          const id = baseAssetId(ch.id, category, index);
          assetSlots.set(id, { characterId: ch.id, category, index, url });
          result.assetMeta[url] = { id, characterId: ch.id, category, fallback: url };
        });
      }
    }
    const entries = Object.entries(registry?.packages || {}).sort(([a], [b]) => a.localeCompare(b));
    for (const [packageId, record] of entries) {
      if (!safeId(packageId) || (record.optional && options.subscriptions?.[packageId] !== true)) continue;
      if (['new_chat', 'opt_in'].includes(record.activation) && !options.pins?.[packageId]) continue;
      const version = options.pins?.[packageId] || record.version;
      const content = packageContent(record, version);
      if (!content) { result.contentWarnings.push(packageId + ' 的旧版本内容不可用'); continue; }
      if (packageId.startsWith('community.') && record.optional === true && record.activation === 'opt_in' && options.pins?.[packageId]) {
        const noteIds = new Set();
        let gameplayValid;
        const validNoteKind = (location, source) => {
          const type = location?.templateKind;
          if (NOTE_KINDS.has(type)) return true;
          if (!Object.hasOwn(GAMEPLAY_NOTE_KINDS, type) || source?.type !== type || source.templateKind !== type
            || !Array.isArray(content.gameplay?.[GAMEPLAY_NOTE_KINDS[type]]) || !content.gameplay[GAMEPLAY_NOTE_KINDS[type]].length) return false;
          if (gameplayValid === undefined) {
            try {
              const gameplay = typeof module === 'object' && module.exports ? require('./gameplay.js') : root.CxxGameplay;
              if (typeof gameplay?.validate !== 'function') throw Error('玩法校验未载入');
              gameplay.validate(content.gameplay, { mapIndex: Object.fromEntries(locationMaps.map(map => [map.id, map.places.map(place => place.id)])) });
              gameplayValid = true;
            } catch { gameplayValid = false; }
          }
          return gameplayValid;
        };
        for (const entry of content.worldbook || []) {
          const location = entry?.extra?.__cxx_workshop_location;
          if (location === undefined) continue;
          const source = entry?.extra?.__cxx_workshop_source;
          if (!location || !hasPlace(location.mapId, location.placeId)
            || !validNoteKind(location, source) || !staticNoteText(location.title, 60) || !staticNoteText(entry.content, 40000)
            || !Number.isSafeInteger(entry.uid) || entry.uid < 0 || noteIds.has(entry.uid)
            || !source || typeof source.publisherId !== 'string' || !/^[a-f0-9]{16}$/.test(source.publisherId)
            || source.creditName !== undefined && !staticNoteText(source.creditName, 24, false)) {
            result.contentWarnings.push('玩家投稿资料已隐藏，地点或正文格式无效：' + packageId); continue;
          }
          noteIds.add(entry.uid);
          result.workshopNotes.push({ id: packageId + ':' + entry.uid, packageId, version, mapId: location.mapId,
            placeId: location.placeId, title: location.title, templateKind: location.templateKind, body: entry.content, source: copy(source) });
        }
      }
      for (const incoming of content.quests || []) {
        if (!safeId(incoming.id)) continue;
        const existingOwner = owners.get(incoming.id);
        if (existingOwner && existingOwner !== packageId && (existingOwner !== 'base' || packageId !== 'cyber2051.base-content')) {
          result.contentWarnings.push('任务编号冲突：' + incoming.id); continue;
        }
        let q = copy(incoming);
        const accepted = records[incoming.id]?.definitionRef;
        if (accepted) {
          const owner = registry.packages[accepted.packageId];
          const old = owner && packageContent(owner, accepted.version)?.quests?.find(x => x.id === accepted.questId);
          if (!old) { result.contentWarnings.push('已接任务的原始版本缺失：' + incoming.id); continue; }
          q = { ...copy(old), ...copy(accepted.localOverride || {}) };
          q.definitionRef = copy(accepted);
        } else {
          const original = initialQuests.get(q.id), local = quests.get(q.id), localOverride = {};
          if (original && local && existingOwner === 'base') {
            for (const key of Object.keys(local)) if (key !== 'definitionRef' && JSON.stringify(local[key]) !== JSON.stringify(original[key])) {
              q[key] = copy(local[key]); localOverride[key] = copy(local[key]);
            }
          }
          q.definitionRef = { packageId, version, questId: q.id, ...(Object.keys(localOverride).length ? { localOverride } : {}) };
        }
        quests.set(q.id, q); owners.set(q.id, packageId);
      }
      for (const asset of content.gallery || []) {
        if (!safeId(asset.id) || !safeImage(asset.url)) continue;
        const ch = characters.get(asset.characterId);
        if (!ch) { result.contentWarnings.push('图片没有对应角色：' + asset.characterId); continue; }
        const custom = options.mediaPreferences?.[asset.id];
        const url = safeImage(custom?.url) ? custom.url : asset.url;
        if (asset.category === 'avatar') {
          const original = options.initialAvatars?.[ch.id];
          if (original && ch.av !== original) { result.contentWarnings.push('保留自选头像：' + ch.id); continue; }
          const fallback = ch.av; ch.av = url;
          result.assetMeta[url] = { id: asset.id, characterId: ch.id, category: 'avatar', fallback };
          continue;
        }
        if (!['standard', 'daily'].includes(asset.category)) continue;
        const slot = assetSlots.get(asset.id);
        if (slot && (slot.characterId !== ch.id || slot.category !== asset.category)) {
          result.contentWarnings.push('图片编号与角色冲突：' + asset.id); continue;
        }
        const list = ch[asset.category] || (ch[asset.category] = []);
        const original = initialAssets.get(asset.id);
        if (slot && original && slot.url !== original.url) { result.contentWarnings.push('保留自选图片：' + asset.id); continue; }
        const index = slot ? slot.index : list.length;
        const fallback = slot?.url || asset.fallbackUrl || '';
        list[index] = url;
        assetSlots.set(asset.id, { characterId: ch.id, category: asset.category, index, url });
        result.assetMeta[url] = { id: asset.id, characterId: ch.id, category: asset.category, fallback: safeImage(fallback) ? fallback : '' };
      }
    }
    // Accepted definitions survive hiding/unsubscribing their optional pack.
    for (const [questId, progress] of Object.entries(records)) {
      const ref = progress?.definitionRef;
      if (!ref) {
        const legacy = registry?.migrationLegacyQuests?.find(q => q.id === questId);
        if (legacy) quests.set(questId, { ...copy(legacy), definitionRef: { packageId: 'migration.legacy', version: '1.0.0', questId } });
        continue;
      }
      if (!ref || quests.get(questId)?.definitionRef?.version === ref.version) continue;
      const record = registry?.packages?.[ref.packageId];
      const q = record && packageContent(record, ref.version)?.quests?.find(x => x.id === ref.questId);
      if (q) quests.set(questId, { ...copy(q), ...copy(ref.localOverride || {}), definitionRef: copy(ref) });
      else result.contentWarnings.push('已接任务的原始版本缺失：' + questId);
    }
    // The installed registry controls availability; accepted legacy definitions remain usable.
    result.quests = [...quests.values()];
    result.gallery.counts = {
      characters: characters.size,
      standard: [...characters.values()].reduce((n, ch) => n + (ch.standard?.length || 0), 0),
      daily: [...characters.values()].reduce((n, ch) => n + (ch.daily?.length || 0), 0),
    };
    return result;
  }
  function request(command, detail = {}) {
    const state = readHost();
    if (!state || typeof eventEmit !== 'function') return false;
    eventEmit('cxx:update:request', { command, ...detail, instanceId: state.instanceId });
    return true;
  }
  function savedEventMedia(options={}){
    if(options.signal?.aborted)return Promise.resolve([]);
    if(!readHost() || typeof eventOn!=='function' || typeof eventRemoveListener!=='function' || typeof SillyTavern==='undefined')return Promise.resolve([]);
    const key=()=>{const c=SillyTavern.getContext();return JSON.stringify([c.characterId,c.getCurrentChatId(),c.chat?.length,c.chat?.at(-1)?.swipe_id,c.chat?.at(-1)?.mes]);};
    const scope=key(),requestId=CryptoCompat.uuid(),instanceId=readHost().instanceId;
    return new Promise((resolve,reject)=>{
      let finished=false;const abort=()=>finish(null,[]);
      const name='cxx:update:media:result',finish=(error,media)=>{if(finished)return;finished=true;clearTimeout(timer);eventRemoveListener(name,receive);options.signal?.removeEventListener('abort',abort);error?reject(Error(error)):resolve(media);};
      const receive=value=>{if(value?.requestId!==requestId || value.instanceId!==instanceId)return;if(key()!==scope)return finish('聊天或回复分支已变化，请重新读取保存结果');finish(value.error,options.receipt?value.mvuReceipt:value.media || []);};
      const timer=setTimeout(()=>finish('保存读回尚未确认，请稍后重新打开影像'),8000);eventOn(name,receive);
      options.signal?.addEventListener('abort',abort,{once:true});
      if(!request('media',{requestId}))finish('当前卡无法读取保存记录');
    });
  }
  function bindImage(img, url, meta) {
    const win=img.ownerDocument?.defaultView,resources=win?.CxxResources||win?.parent?.CxxResources;
    img.src = resources?.source(url)||url;
    img.addEventListener('error', () => {
      const fallback = meta?.fallback;
      if (fallback && fallback !== url && (safeImage(fallback) || fallback.startsWith('data:image/'))) img.src = resources?.source(fallback)||fallback;
    }, { once: true });
  }
  // Status-bar pools use the same read-only registry, without writing old messages.
  function urls(characterId, category, original) {
    const state = readHost();
    if (!state) return original;
    const base = { quests: [], gallery: { characters: [{ id: characterId, standard: category === 'standard' ? original : [], daily: category === 'daily' ? original : [], av: '' }] } };
    return view(base, state.registry, {}, { subscriptions: state.subscriptions, pins: chatPins(), mediaPreferences: state.mediaPreferences, initialContent: state.initialContent }).gallery.characters[0][category] || original;
  }
  function avatar(characterId, original) {
    const state = readHost();
    if (!state) return original;
    const base = { quests: [], gallery: { characters: [{ id: characterId, standard: [], daily: [], av: original }] } };
    return view(base, state.registry, {}, { subscriptions: state.subscriptions, pins: chatPins(),
      initialAvatars: state.initialAvatars }).gallery.characters[0].av;
  }
  function fallback(url) {
    const state = readHost(); if (!state) return '';
    const pins = chatPins();
    for (const [packageId, record] of Object.entries(state.registry?.packages || {}).sort(([a], [b]) => a.localeCompare(b))) {
      if (!safeId(packageId) || (record.optional && state.subscriptions?.[packageId] !== true)) continue;
      if (['new_chat', 'opt_in'].includes(record.activation) && !pins[packageId]) continue;
      const image = packageContent(record, pins[packageId] || record.version)?.gallery?.find(a => a.url === url);
      if (!image) continue;
      const original = image.category === 'avatar' ? state.initialAvatars?.[image.characterId]
        : state.initialContent?.gallery?.find(a => a.id === image.id)?.url;
      if (original && original !== url && (safeImage(original) || original.startsWith('data:image/'))) return original;
      const prior = Object.values(record.history || {}).reverse().flatMap(c => c.gallery || []).find(a => a.id === image.id && a.url !== url);
      if (safeImage(prior?.url)) return prior.url;
      return image.fallbackUrl !== url && safeImage(image.fallbackUrl) ? image.fallbackUrl : '';
    }
    return '';
  }
  return { NAMESPACE, safeId, safeImage, readHost, withMigration, chatPins, view, request, bindImage, urls, avatar, fallback, baseAssetId, packageContent,validateStoryMetadata,storyChoices,eventMedia,savedEventMedia };
});
