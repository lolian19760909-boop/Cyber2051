(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CxxBusinessContentSync=api;})(globalThis,function(){
'use strict';
  const CryptoCompat=typeof module==='object'&&module.exports?require('./crypto-compat.js'):globalThis.CxxCrypto;
function create({api,Core,Content,Host,Gameplay,host,readSeed,transaction}){
const clone=x=>JSON.parse(JSON.stringify(x)),same=(a,b)=>Core.canonical(a)===Core.canonical(b),error=(code,message)=>Object.assign(Error(message),{code});
let confirmed='';
    function readRecords() {
      try {
        for (let floor = api.getLastMessageId(); floor >= 0; floor--) {
          const value = api.getVariables({ type: 'message', message_id: floor });
          if (value?.stat_data) return value.stat_data.terminal?.quests || {};
        }
      } catch { /* Missing MVU is a read-only empty ledger, never initialization. */ }
      return {};
    }
    function readGameplay() {
      try {for(let floor=api.getLastMessageId();floor>=0;floor--){const value=api.getVariables({type:'message',message_id:floor});if(value?.stat_data)return value.stat_data.terminal?.gameplay || {};}}catch{}
      return {};
    }
    function chatVars() { return api.getVariables({ type: 'chat' }); }
    function pins() { return chatVars().__cxx_content_pins || {}; }

    function selectedWorldbook(registry, state, chatPins) {
      const result = [],selectedOrigin=readGameplay().origin?.definitionRef;
      for (const [id, r] of Object.entries(registry.packages)) {
        if (r.optional && !state.subscriptions[id] || ['new_chat', 'opt_in'].includes(r.activation) && !chatPins[id]) continue;
        const version = chatPins[id] || r.version, content = Content.packageContent(r, version);
        if (!content) continue;
        for (const entry of content.worldbook || []) {
          if(entry.extra?.__cxx_player_start && !(selectedOrigin?.packageId===id && selectedOrigin.version===version && selectedOrigin.uid===entry.uid))continue;
          result.push({ owner: id, id: 'worldbook.' + entry.uid, version, entry });
        }
      }
      return result;
    }
    function questEntry(quest) {
      for (const key of ['id', 'title', 'fixer', 'district', 'brief', 'goal', 'terms', 'risk', 'bonus', 'unlock']) if (typeof quest[key] === 'string' && /<%|<script\b/i.test(quest[key])) throw error('invalid-content', '任务世界书只接受静态文本：' + key);
      const content = ['任务编号：' + quest.id, '任务名称：' + quest.title, '委托人：' + quest.fixer,
        '地点：' + quest.district, '简报：' + quest.brief, '目标：' + quest.goal, '报酬：' + quest.pay + '日元',
        ...['terms', 'risk', 'bonus', 'unlock'].filter(k => quest[k]).map(k => ({ terms: '条款：', risk: '风险：', bonus: '加成：', unlock: '解锁条件：' }[k]) + quest[k]),
        '玩家接取后开始推进，任务进度与账目使用当前故事记录。'].join('\n');
      return { name: '更新任务·' + quest.title, content, enabled: false, strategy: { type: 'selective', keys: [quest.id, quest.title],
        keys_secondary: { logic: 'and_any', keys: [] }, scan_depth: 'same_as_global' },
        position: { type: 'after_character_definition', role: 'system', depth: 4, order: 100 },
        probability: 100, recursion: { prevent_incoming: true, prevent_outgoing: true, delay_until: null },
        effect: { sticky: null, cooldown: null, delay: null }, extra: {} };
    }
    function selection() {
      const rawState = host.readState(), state = Content.withMigration ? Content.withMigration(rawState, chatVars()) : rawState;
      const chatPins = pins(), initial = state.initialContent;
      const gallery = { characters: (readSeed().characterIds || []).map(id => ({ id, standard: [], daily: [], av: '' })) };
      const view = Content.view({ quests: initial.quests, gallery }, state.registry, readRecords(), {
        subscriptions: state.subscriptions, pins: chatPins, initialContent: initial });
      const wanted = selectedWorldbook(state.registry, state, chatPins);
      if(Gameplay)wanted.push(...Gameplay.promptEntries(state.registry,{mapIndex:readSeed().mapIndex,subscriptions:state.subscriptions,pins:chatPins},readGameplay()));
      for (const q of view.quests) if (q.definitionRef) wanted.push({ owner: q.definitionRef.packageId,
        id: 'quest.' + q.id, version: q.definitionRef.version, entry: questEntry(q) });
      return {rawState,state,wanted};
    }
    // Tavern Helper's older worldbook writer drops entry.extensions, so the
    // ownership marker can vanish while the entries stay. The generated name is
    // still stable, so it is the fallback identity for adoption below.
    function officialName(w){const name=String(w.entry?.name??'');return /\[mvu_(?:plot|update)\]/i.test(name)?name:(/^(gameplay|quest)\./.test(w.id)?'[mvu_plot][mvu_update]':'[mvu_plot]')+name;}
    function signature(value=selection()){const c=host.getContext?.()||{};return Core.canonical([c.characterKey||'',c.chatId||'',api.getChatWorldbookName?.('current')||'',value.state.instanceId,value.state.contentRevision||'',value.wanted]);}
    async function syncChat() {
      const ctx=api.SillyTavern?.getContext?.();
      if(ctx?.chat&&ctx.chat.length<=1&&!chatVars().__cxx_identity?.setupToken)return;
      const route=ctx?.chatMetadata?.__cxx_story_v1?.routeId||host.getContext?.().chatId||'';
      const {rawState,state,wanted}=selection();host.setScope('character');
      const owned=e=>e.extra?.__cxx_official_content?.instanceId===state.instanceId&&e.extra.__cxx_official_content.routeId===route;
      const before=await host.snapshot(undefined,['worldbook','registry'],{freshWorldbook:true});
      const remember=()=>{const now=selection();confirmed=same(now.wanted,wanted)?signature(now):'';};
      const wantedNames = new Map();
      for (const w of wanted) if (!wantedNames.has(w.owner + ':' + w.id)) wantedNames.set(w.owner + ':' + w.id, { name: officialName(w), content: String(w.entry?.content ?? '') });
      // Adoption keeps an unmarked entry as ours instead of appending a second copy,
      // and drops byte-identical stale copies left by earlier duplicated installs.
      const adopted = new Map(), staleCopies = new Set();
      for (const e of before.worldbook.entries) {
        if (owned(e)) continue;
        for (const [key, info] of wantedNames) {
          if (e.name !== info.name) continue;
          const first = adopted.get(key);
          if (!first) adopted.set(key, e);
          else if (same({ ...e, uid: first.uid }, first) || String(e.content) === info.content) staleCopies.add(e.uid);
          break;
        }
      }
      const adoptedUids = new Set([...adopted.values()].map(e => e.uid));
      const existing = new Map(); let uid = Math.max(-1, ...before.worldbook.entries.map(e => e.uid)) + 1;
      const records = {}, order = [];
      for (const e of before.worldbook.entries) {
        const info = e.extra?.__cxx_official_content;
        if (!owned(e)) continue;
        const key = info.owner + ':' + info.id;
        if (existing.has(key)) throw error('content-id-collision', '聊天世界书含重复的官方内容标记');
        existing.set(key, e); records['number:' + e.uid] = info.baseline; order.push('number:' + e.uid);
      }
      const incoming = before.worldbook.entries.filter(e => !owned(e) && !adoptedUids.has(e.uid) && !staleCopies.has(e.uid)).map(clone);
      const newMetadata = new Map();
      for (const w of wanted) {
        const old = existing.get(w.owner + ':' + w.id) || adopted.get(w.owner + ':' + w.id), entry = Host.normalizeEntry({ ...clone(w.entry), uid: old?.uid ?? uid++ });
        // Both MVU tags expose shared facts to the narrative and update requests.
        // Preserve explicit publisher routes. Untagged narrative stays plot-only.
        entry.name = officialName(w);
        const seed = (await Core.fingerprints({ worldbook: { internalName: 'content', entries: [entry] } })).worldbook.entries.records['number:' + entry.uid];
        newMetadata.set(entry.uid, { instanceId: state.instanceId, routeId:route, owner: w.owner, id: w.id, version: w.version, baseline: seed });
        incoming.push(entry);
      }
      // Installation metadata is ours. Remove only that marker while checking
      // upstream removals; otherwise the marker itself looks like a player edit.
      const local = clone(before);
      for (const e of local.worldbook.entries) if (owned(e)) delete e.extra.__cxx_official_content;
      const claimed = new Set([...adoptedUids, ...staleCopies]);
      local.worldbook.entries = local.worldbook.entries.filter(e => !claimed.has(e.uid));
      const metadata = (await Core.fingerprints({ worldbook: before.worldbook })).worldbook.metadata;
      const merged = await Core.mergeComponents({ format: 1, worldbook: { metadata, entries: { order, records } } }, local,
        { worldbook: { internalName: before.worldbook.internalName || 'content', entries: incoming } });
      const after = merged.components;
      const oldMetadata = new Map(before.worldbook.entries.filter(e => owned(e)).map(e => [e.uid, e.extra.__cxx_official_content]));
      for (const e of after.worldbook.entries) {
        const info = newMetadata.get(e.uid) || oldMetadata.get(e.uid);
        if (info) e.extra = { ...e.extra, __cxx_official_content: info };
      }
      const conflicts = [...new Map([...(state.conflicts || []), ...merged.conflicts.map(c => ({ ...c, scope: 'chat' }))].map(c => [Core.canonical(c), c])).values()];
      if (same(before.worldbook.entries, after.worldbook.entries)) {
        if (!same(conflicts, state.conflicts || [])) { rawState.conflicts = conflicts; await host.saveState(rawState); }
        remember();
        return;
      }
      after.worldbook.internalName = before.worldbook.internalName;
      await transaction(before, after, state.installed, state.baseline, conflicts, 'character');
      remember();
    }

syncChat.isCurrent=()=>!!confirmed&&confirmed===signature();
const run=()=>{const win=api.parent||api,P=win.CxxStoryProfile||api.CxxStoryProfile,book=api.getCharWorldbookNames?.('current')?.primary;return P?.withBookLock&&book?P.withBookLock(win,book,syncChat):syncChat();};run.isCurrent=syncChat.isCurrent;return run;
}
return {create};
});
