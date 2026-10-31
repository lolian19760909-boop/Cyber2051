(function (root, factory) {
  const local=typeof module==='object'&&module.exports;
  const api = factory(local?require("../数值引擎/src/growth-base.js"):root.CxxNumericGrowthBase,local?require("../数值引擎/adapters/mvu.js"):root.CxxNumericMvu,local?require('./item-definitions.js'):root.CxxItemDefinitions);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CxxGameplay = api;
})(typeof globalThis === 'object' ? globalThis : window, function (growthBase,numericMvu,Definitions) {
  'use strict';
  const KINDS = ['slots', 'resources', 'items', 'blueprints', 'recipes', 'skills', 'shops', 'services', 'encounters'];
  const TABLES = ['inventory', 'blueprints', 'skills', 'equipment', 'resources', 'events', 'results'];
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clone = v => JSON.parse(JSON.stringify(v));
  function fail(code, message) { throw Object.assign(new Error(message), { code }); }
  function id(v) { if (typeof v !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v) || ['constructor','prototype','__proto__'].includes(v)) fail('gameplay-id', '玩法编号只能使用字母、数字、横线与下划线'); }
  function text(v, max = 4000) { if (typeof v !== 'string' || !v.trim() || v.length > max || /<\x25|<\s*\/?\s*script\b|javascript\s*:/i.test(v)) fail('gameplay-text', '玩法内容只接受有长度限制的静态文字'); }
  function integer(v, min = 0, max = 1000000000) { if (!Number.isSafeInteger(v) || v < min || v > max) fail('gameplay-number', '玩法数量超出允许范围'); }
  function keys(v, allowed) { if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) fail('gameplay-field', '玩法定义含未支持字段，需要匹配的新版角色卡'); }
  const normalized = v => Array.isArray(v) ? v.map(normalized) : object(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalized(v[k])])) : v;
  const same = (a, b) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
  function location(v, mapIndex) {
    keys(v, ['mapId','placeId']); text(v.mapId, 128); text(v.placeId, 128);
    if (!mapIndex?.[v.mapId]?.includes(v.placeId)) fail('gameplay-place', '玩法地点尚未登记在地图目录');
  }
  function amounts(v) { if (!object(v)) fail('gameplay-number', '材料或资源必须是编号与数量表'); for (const [k, n] of Object.entries(v)) { id(k); integer(n, 1); } }
  function condition(v, mapIndex) {
    keys(v, ['location','blueprints','skills','events']);
    if (v.location) location(v.location, mapIndex);
    for (const k of ['blueprints','skills']) if (v[k] !== undefined) {
      if (!Array.isArray(v[k]) || new Set(v[k]).size !== v[k].length) fail('gameplay-condition', '学习条件必须是没有重复编号的数组'); v[k].forEach(id);
    }
    if (v.events !== undefined) { if (!object(v.events)) fail('gameplay-condition', '事件条件格式错误'); for (const [k, value] of Object.entries(v.events)) { id(k); if (!['completed','refused'].includes(value)) fail('gameplay-condition','事件条件状态错误'); } }
  }
  function effects(v) {
    keys(v, ['resources','description']); if (v.description !== undefined) text(v.description);
    if (v.resources !== undefined) { if (!object(v.resources)) fail('gameplay-effects', '资源效果须为编号与增减值'); for (const [k,n] of Object.entries(v.resources)) { id(k); integer(n,-1000000000); } }
  }
  function validate(defs, options = {}) {
    keys(defs, ['schema', ...KINDS]); if (defs.schema !== 1) fail('gameplay-version', '这组玩法定义需要更新角色卡');
    for (const kind of KINDS) {
      const rows = defs[kind] || []; if (!Array.isArray(rows) || rows.length > 500) fail('gameplay-list','玩法清单须为最多500项的数组');
      const seen = new Set();
      for (const d of rows) {
        const fields = { slots: [], resources: ['min','max'], items: ['slots','effects','use'], blueprints: ['recipes','learnCost'],
          recipes: ['blueprintId','materials','outputs','cost'], skills: ['learnCost','cost','effects'], shops: ['location','offers'],
          services: ['location','service','recipeId','offer','cost','effects'], encounters: ['outcomes'] }[kind];
        keys(d, ['id','name','description','requires',...fields]); id(d.id); text(d.name,80); text(d.description);
        if (seen.has(d.id)) fail('gameplay-duplicate','同一类玩法编号重复：'+d.id); seen.add(d.id);
        if (d.requires) condition(d.requires, options.mapIndex);
        if (d.location) location(d.location, options.mapIndex);
        if (d.cost !== undefined) integer(d.cost); if (d.learnCost !== undefined) integer(d.learnCost);
        if (d.effects) effects(d.effects);
        if (kind === 'resources') { integer(d.min,-1000000000); integer(d.max); if (d.min > d.max) fail('gameplay-range','资源上下限颠倒'); }
        if (kind === 'items') {
          if (d.slots !== undefined) { if (!Array.isArray(d.slots) || new Set(d.slots).size !== d.slots.length) fail('gameplay-slots','装备槽位列表无效'); d.slots.forEach(id); }
          if (d.effects?.resources) fail('gameplay-effects','装备不自动改变资源；数值即时效果只放在使用定义里');
          if (d.use) { keys(d.use,['cost','effects']); integer(d.use.cost || 0); effects(d.use.effects); }
        }
        if (kind === 'blueprints') { if (!Array.isArray(d.recipes) || !d.recipes.length) fail('gameplay-recipes','蓝图须关联配方'); d.recipes.forEach(id); }
        if (kind === 'recipes') { if (d.blueprintId) id(d.blueprintId); amounts(d.materials); amounts(d.outputs); if (!Object.keys(d.outputs).length) fail('gameplay-recipe','配方须有产物'); integer(d.cost || 0); }
        if (kind === 'shops') {
          location(d.location,options.mapIndex); if (!Array.isArray(d.offers) || d.offers.length > 500) fail('gameplay-offer','商店商品清单无效');
          const offers = new Set(); for (const o of d.offers) { offer(o); if (offers.has(o.id)) fail('gameplay-offer','商品选项编号重复'); offers.add(o.id); }
        }
        if (kind === 'services') {
          location(d.location,options.mapIndex);
          if (!['purchase','craft','heal','repair'].includes(d.service)) fail('gameplay-service','功能区服务尚无消费者');
          if (d.service === 'purchase') offer(d.offer); else if (d.service === 'craft') id(d.recipeId); else effects(d.effects);
        }
        if (kind === 'encounters') {
          if (!Array.isArray(d.outcomes) || !d.outcomes.length) fail('gameplay-event','事件必须声明可消费的结果');
          const outcomes = new Set(); for (const o of d.outcomes) { keys(o,['id','name','items','cost','effects']); id(o.id); text(o.name,120); if (outcomes.has(o.id)) fail('gameplay-event','事件结果重复'); outcomes.add(o.id); if (o.items) amounts(o.items); integer(o.cost || 0); if (o.effects) effects(o.effects); }
        }
      }
    }
    return defs;
  }
  function offer(o) { keys(o,['id','kind','targetId','price']); id(o.id); id(o.targetId); integer(o.price); if (!['items','blueprints','skills'].includes(o.kind)) fail('gameplay-offer','商品类型尚无消费者'); }
  function catalogue(registry, options = {}) {
    const lists = Object.fromEntries(KINDS.map(k => [k, new Map()])), packages = registry?.packages || {};
    for (const [packageId, record] of Object.entries(packages)) {
      if (record.optional && options.subscriptions?.[packageId] !== true || ['new_chat','opt_in'].includes(record.activation) && !options.pins?.[packageId]) continue;
      const version = options.pins?.[packageId] || record.version;
      const content = version === record.version ? record.content : record.history?.[version];
      if (!content?.gameplay) continue; validate(content.gameplay, options);
      for (const kind of KINDS) for (const definition of content.gameplay[kind] || []) {
        if (lists[kind].has(definition.id)) fail('gameplay-owner','玩法编号被多个内容包占用：'+definition.id);
        lists[kind].set(definition.id, { ...clone(definition), definitionRef: { packageId,version,kind,id:definition.id } });
      }
    }
    function get(kind, key, ref) {
      if (!KINDS.includes(kind)) fail('gameplay-definition','未知玩法种类'); id(key);
      if (!ref) { const d=lists[kind].get(key); if (!d) fail('gameplay-definition','当前聊天没有启用这项内容：'+key); return clone(d); }
      if (ref.kind !== kind || ref.id !== key) fail('gameplay-definition','玩家资产的定义引用不一致');
      const record = packages[ref.packageId], content = record && (record.version === ref.version ? record.content : record.history?.[ref.version]);
      const d = content?.gameplay?.[kind]?.find(row => row.id === key);
      if (!d) fail('gameplay-definition','缺少已获得内容的原始定义：'+key); validate(content.gameplay, options);
      return { ...clone(d),definitionRef:clone(ref) };
    }
    function related(kind,key,source) {
      const ref=source?.definitionRef, record=packages[ref?.packageId];
      const content=record && (record.version===ref.version?record.content:record.history?.[ref.version]);
      if(content?.gameplay?.[kind]?.some(d=>d.id===key))return get(kind,key,{...ref,kind,id:key});
      return get(kind,key);
    }
    return { lists, get, related,starts:clone(options.starts || []),openingManifest:clone(options.openingManifest || {version:'pending-authored-content',identities:[],timelines:[]}) };
  }
  function read(stat) {
    if (!object(stat?.terminal)) fail('gameplay-state','当前回复没有终端存档，先完成原生开局');
    const g=stat.terminal.gameplay;
    if (g !== undefined && (!object(g) || g.schema !== 1)) fail('gameplay-version','当前玩法存档需要匹配的新版角色卡');
    for (const key of TABLES) if (g?.[key] !== undefined && !object(g[key])) fail('gameplay-state','玩法存档表格式不符：'+key);
    const yen=stat.terminal.wallet?.yen; integer(yen,-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER); integer(stat.terminal.wallet?.spent || 0); integer(stat.terminal.wallet?.earned || 0);
    for (const [key,v] of Object.entries(g?.inventory || {})) if (key !== '$meta') { id(key); if (!object(v)) fail('gameplay-state','物品记录不完整'); integer(v.quantity); }
    return { ...Object.fromEntries(TABLES.map(k => [k, {}])),...(g || {}),enabled:g?.schema === 1,yen };
  }
  function getPath(root, path) { return path.reduce((v,k) => v?.[k],root); }
  function initializeVariables(variables) {
    const state=read(variables.stat_data);if(state.enabled)return clone(variables);
    if(!variables.schema?.properties?.terminal?.properties)fail('gameplay-schema','当前MVU缺少已核定的终端结构，停止启用');
    const next=clone(variables), empty={schema:1,...Object.fromEntries(TABLES.map(k=>[k,{}]))};
    next.stat_data.terminal.gameplay=empty;
    next.schema.properties.terminal.properties.gameplay={type:'object',properties:{schema:{type:'number',required:true},
      ...Object.fromEntries(TABLES.map(k=>[k,{type:'object',properties:{},extensible:true,recursiveExtensible:true,required:true}]))},extensible:true,recursiveExtensible:true,required:false};
    return next;
  }
  function validateOpeningManifest(value) {
    keys(value,['version','identities','timelines']);text(value.version,128);
    for(const key of ['identities','timelines'])if(!Array.isArray(value[key]))fail('opening-format','开局资料缺少身份或时间清单');
    const ids=new Set();for(const d of value.identities){keys(d,['id','label','body']);if(!['corpo','street','student','custom'].includes(d.id) || ids.has(d.id))fail('opening-identity','正式身份编号未知或重复');ids.add(d.id);text(d.label,60);if(d.body)text(d.body);}
    const eras=new Set();for(const era of value.timelines){
      keys(era,['id','label','initialState','timelineTaskIds','timelineEvents']);if(!['2050-12','2051-04'].includes(era.id) || eras.has(era.id))fail('opening-era','开局时间未知或重复');eras.add(era.id);text(era.label,60);
      if(era.initialState!=null){keys(era.initialState,['story']);const s=era.initialState.story;keys(s,['date','time','location','phase']);text(s.date,10);
        if(s.date!==era.id){const d=/^\d{4}-\d{2}-\d{2}$/.test(s.date) && new Date(s.date+'T00:00:00Z');if(s.date.slice(0,7)!==era.id || !d || !Number.isFinite(d.getTime()) || d.toISOString().slice(0,10)!==s.date)fail('opening-date','起始日期不符合所选时间');}
        for(const k of ['time','location','phase'])if(s[k]!=null){if(k==='phase' && Number.isSafeInteger(s[k]))integer(s[k]);else text(s[k],k==='location'?512:128);}}
      if(era.timelineEvents!==undefined){if(!Array.isArray(era.timelineEvents) || era.timelineEvents.length>128)fail('opening-events','背景事件清单无效');const tasks=new Set();for(const e of era.timelineEvents){keys(e,['taskId','state','outcome']);text(e.taskId,128);if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(e.taskId) || tasks.has(e.taskId) || !['occurred','skipped'].includes(e.state))fail('opening-events','背景事件不能写作玩家完成或重复');tasks.add(e.taskId);if(e.outcome)text(e.outcome,2000);}
        if(era.timelineTaskIds && (!Array.isArray(era.timelineTaskIds) || era.timelineTaskIds.length!==tasks.size || era.timelineTaskIds.some(k=>!tasks.has(k))))fail('opening-events','背景事件清单不一致');}
    }
    return value;
  }
  function plan(stat, catalog, request) {
    const state=read(stat), before=clone(stat), changes=[], definitions=[];
    const gpath=k=>['terminal','gameplay',k];
    const change=(path,value)=>{ const previous=changes.find(c=>same(c.path,path)); if(previous)previous.after=clone(value); else changes.push({path,before:getPath(before,path) ?? null,missing:getPath(before,path) === undefined,after:clone(value)}); };
    const def=(kind,key,ref)=>{const d=catalog.get(kind,key,ref); if(!definitions.some(x=>same(x.definitionRef,d.definitionRef)))definitions.push(d); return d;};
    const related=(kind,key,source)=>{const d=catalog.related(kind,key,source);return def(kind,key,d.definitionRef);};
    const check=d=>{
      const c=d.requires || {}, at=c.location || d.location;
      if (at && (!state.location || state.location.mapId!==at.mapId || state.location.placeId!==at.placeId)) fail('gameplay-location','尚未确认玩家位于服务地点，请先在剧情中抵达');
      for(const id of c.blueprints || [])if(!state.blueprints[id]?.learned)fail('gameplay-condition','还没有学会所需蓝图');
      for(const id of c.skills || [])if(!state.skills[id]?.learned)fail('gameplay-condition','还没有学会所需技能');
      for(const [id,status]of Object.entries(c.events || {}))if(state.events[id]?.status!==status)fail('gameplay-condition','前置事件尚未满足');
    };
    const charge=n=>{integer(n);if(state.yen<n)fail('gameplay-funds','余额不足');if(n){change(['terminal','wallet','yen'],state.yen-n);change(['terminal','wallet','spent'],(stat.terminal.wallet.spent || 0)+n);}};
    const item=(key,delta,definition)=>{
      const old=state.inventory[key],qty=old?.quantity || 0,next=qty+delta;integer(next);
      if(delta>0 && old?.definitionRef && !same(old.definitionRef,definition.definitionRef)) fail('gameplay-definition-conflict','已有物品使用旧定义，不能直接混入不同版本：'+key);
      const occupied=Object.values(state.equipment).filter(x=>x?.itemId===key).length;
      if(next<occupied)fail('gameplay-equipped','请先卸下要消耗的装备');
      change([...gpath('inventory'),key],{...(old || {}),quantity:next,definitionRef:clone(old?.definitionRef || definition.definitionRef)});
    };
    const effect=(e,source)=>{for(const [key,n]of Object.entries(e?.resources || {})){const d=related('resources',key,source),value=state.resources[key];if(!Number.isSafeInteger(value))fail('gameplay-resource','资源尚未在剧情中初始化：'+key);if(n<0 && value+n<d.min)fail('gameplay-resource','资源不足：'+d.name);change([...gpath('resources'),key],Math.min(d.max,value+n));}};
    const purchase=o=>{
      const d=def(o.kind,o.targetId);check(d);charge(o.price*quantity);
      if(o.kind==='items')item(d.id,quantity,d);
      else {if(quantity!==1 || state[o.kind][d.id]?.owned)fail('gameplay-owned','这项蓝图或技能已获得，不能重复购买');change([...gpath(o.kind),d.id],{owned:true,learned:false,definitionRef:d.definitionRef});}
      return d.name;
    };
    const craft=(d,n)=>{
      check(d);if(d.blueprintId){const learned=state.blueprints[d.blueprintId];if(!learned?.learned)fail('gameplay-blueprint','尚未学习这张蓝图');const b=def('blueprints',d.blueprintId,learned.definitionRef);if(!b.recipes.includes(d.id))fail('gameplay-blueprint','蓝图未解锁此配方');}
      charge((d.cost || 0)*n);
      const delta={};for(const [key,q]of Object.entries(d.materials)){if((state.inventory[key]?.quantity || 0)<q*n)fail('gameplay-materials','材料不足：'+key);delta[key]=(delta[key] || 0)-q*n;}
      for(const [key,q]of Object.entries(d.outputs))delta[key]=(delta[key] || 0)+q*n;
      for(const [key,q]of Object.entries(delta))item(key,q,q<=0?def('items',key,state.inventory[key]?.definitionRef):related('items',key,d));
    };
    const recipe=key=>{
      for(const [id,record]of Object.entries(state.blueprints))if(record?.learned){const b=def('blueprints',id,record.definitionRef);if(b.recipes.includes(key))return related('recipes',key,b);}
      return def('recipes',key);
    };
    keys(request,['action','id','offerId','quantity','slot','outcomeId','eraId']);
    const quantity=request.quantity ?? 1;integer(quantity,1,999);let title=request.action;
    if(!['buy','use','craft','service'].includes(request.action) && quantity!==1)fail('gameplay-quantity','此行动每次只处理一次');
    if(request.action==='enable'){
      if(state.enabled)fail('gameplay-enabled','本聊天已启用正文玩法');
      change(['terminal','gameplay'],{schema:1,...Object.fromEntries(TABLES.map(k=>[k,{}]))});title='为当前聊天启用正文玩法';
    }else{
      if(!state.enabled)fail('gameplay-disabled','请先为当前聊天启用正文玩法');
      if(request.action==='start'){
        if(state.origin || stat.terminal.opening || state.yen || stat.terminal.wallet.earned || stat.terminal.wallet.spent || Object.entries(stat.terminal.quests || {}).some(([k,v])=>k!=='$meta' && v) || TABLES.some(t=>Object.keys(state[t]).some(k=>k!=='$meta')))fail('opening-old-chat','当前聊天已有开局或游戏记录，不能重新选择出身');
        const manifest=validateOpeningManifest(catalog.openingManifest),builtin=manifest.identities.find(d=>d.id===request.id),d=catalog.starts.find(d=>d.id===request.id) || (builtin && {id:builtin.id,name:builtin.label,opening:builtin.body}),era=manifest.timelines.find(e=>e.id===request.eraId);
        if(!d?.opening)fail('opening-missing','该身份的通用开场尚未定稿');if(!era?.initialState || !Array.isArray(era.timelineEvents))fail('opening-missing','这个起始时间的背景或前置事件尚未定稿');
        const origin={identityId:d.id,identityName:d.name,body:d.opening,eraId:era.id,eraName:era.label,manifestVersion:manifest.version,initialState:clone(era.initialState),timelineEvents:clone(era.timelineEvents)};
        for(const key of ['background','appearance','skills','definitionRef'])if(d[key]!==undefined)origin[key]=clone(d[key]);
        definitions.push({...clone(d),initialState:clone(era.initialState),timelineEvents:clone(era.timelineEvents)});change(['terminal','gameplay','origin'],origin);title='以'+d.name+'开始 · '+era.label;
      }
      else if(request.action==='buy') {const d=def('shops',request.id);check(d);const o=d.offers.find(o=>o.id===request.offerId);if(!o)fail('gameplay-offer','商品已下架');title='购买 '+purchase(o)+' × '+quantity;}
      else if(request.action==='use'){const old=state.inventory[request.id],d=def('items',request.id,old?.definitionRef);check(d);if(!d.use)fail('gameplay-use','该物品不能直接消耗使用');item(d.id,-quantity,d);charge((d.use.cost || 0)*quantity);effect({resources:Object.fromEntries(Object.entries(d.use.effects.resources || {}).map(([k,n])=>[k,n*quantity]))},d);title='使用 '+d.name+' × '+quantity;}
      else if(request.action==='learn-blueprint' || request.action==='learn-skill'){
        const kind=request.action==='learn-blueprint'?'blueprints':'skills', old=state[kind][request.id];
        if(!old?.owned || old.learned)fail('gameplay-learning','需要先获得且尚未学习');const d=def(kind,request.id,old.definitionRef);check(d);charge(d.learnCost || 0);change([...gpath(kind),d.id],{...old,learned:true});title='学习 '+d.name;
      }else if(request.action==='craft'){const d=recipe(request.id);craft(d,quantity);title='制作 '+d.name+' × '+quantity;}
      else if(request.action==='equip'){
        const old=state.inventory[request.id],d=def('items',request.id,old?.definitionRef);check(d);const slot=related('slots',request.slot,d);check(slot);
        if(!d.slots?.includes(slot.id) || !old?.quantity)fail('gameplay-slot','没有这件物品，或装备槽位不匹配');
        if(Object.entries(state.equipment).filter(([s,x])=>s!==slot.id && x?.itemId===d.id).length>=old.quantity)fail('gameplay-equipped','没有可用于该槽位的额外装备');
        change([...gpath('equipment'),slot.id],{itemId:d.id,definitionRef:d.definitionRef,effects:d.effects || {}});title='装备 '+d.name+' → '+slot.name;
      }else if(request.action==='unequip'){id(request.slot);if(!state.equipment[request.slot])fail('gameplay-slot','该槽位没有装备');change([...gpath('equipment'),request.slot],null);title='卸下装备';}
      else if(['activate-skill','deactivate-skill','use-skill'].includes(request.action)){
        const old=state.skills[request.id];if(!old?.learned)fail('gameplay-learning','技能尚未学会');const d=def('skills',request.id,old.definitionRef);check(d);
        if(request.action==='use-skill'){if(!old.active)fail('gameplay-skill','请先启用该技能');charge(d.cost || 0);effect(d.effects,d);}
        else change([...gpath('skills'),d.id],{...old,active:request.action==='activate-skill',effects:d.effects || {}});
        title=({ 'activate-skill':'启用','deactivate-skill':'停用','use-skill':'使用' }[request.action])+'技能 '+d.name;
      }else if(request.action==='service'){
        const d=def('services',request.id);check(d);
        if(d.service==='purchase')purchase(d.offer);else if(d.service==='craft')craft(recipe(d.recipeId),quantity);else{if(quantity!==1)fail('gameplay-quantity','每次只申请一次服务');charge(d.cost || 0);effect(d.effects,d);}title='申请服务 '+d.name;
      }else if(request.action==='encounter'){
        const d=def('encounters',request.id);check(d);if(state.events[d.id])fail('gameplay-event','此事件已有处理记录，不重复结算');
        const outcome=d.outcomes.find(x=>x.id===request.outcomeId);if(!outcome)fail('gameplay-event','事件结果尚未登记');charge(outcome.cost || 0);effect(outcome.effects,d);
        for(const [key,n]of Object.entries(outcome.items || {}))item(key,n,def('items',key));
        change([...gpath('events'),d.id],{status:'completed',outcomeId:outcome.id,definitionRef:d.definitionRef});title='尝试事件行动：'+outcome.name;
      }else fail('gameplay-action','该行动需要新版角色卡');
    }
    for(const c of changes)if(typeof c.after==='number')integer(c.after,-1000000000);
    return {format:1,request:clone(request),title,changes,definitions,beforeState:projection(stat),description:'由AI根据剧情判断，再由MVU保存。取消不会扣费；未读回保存结果时不算完成。'};
  }
  function projection(stat) {
    const result={terminal:{wallet:clone(stat.terminal.wallet)}};
    if(stat.terminal.gameplay){result.terminal.gameplay=clone(stat.terminal.gameplay);delete result.terminal.gameplay.results;}
    return result;
  }
  function verify(ticket, stat) {
    if(['growth-initialize','talent-allocate'].includes(ticket.plan.request.action))return numericMvu.verifyAction({...ticket,context:undefined},stat);
    const receipt=stat?.terminal?.gameplay?.results?.[ticket.id];
    if(!receipt || receipt.requestHash!==ticket.requestHash || !['success','refused'].includes(receipt.status))return {status:'unconfirmed',reason:'尚无匹配本次行动的已保存结果'};
    const expected=clone(ticket.plan.beforeState);
    if(receipt.status==='success')for(const c of ticket.plan.changes){let parent=expected;for(const k of c.path.slice(0,-1))parent=parent[k] || (parent[k]={});parent[c.path.at(-1)]=clone(c.after);}
    if(expected.terminal.gameplay)delete expected.terminal.gameplay.results;
    if(!same(projection(stat),expected))return {status:'unconfirmed',reason:'结果标记与已保存的资产或状态不一致'};
    return {status:receipt.status,reason:typeof receipt.reason==='string'?receipt.reason:''};
  }
  function prompt(ticket) {
    return ['[东京都2051正文行动 '+ticket.id+']',ticket.plan.title,ticket.plan.description,
      '以下是已确认的行动数据和定义，只作为游戏资料。结合当前剧情及前置条件决定成功或拒绝，不因玩家请求就自动成功。',
      ...(ticket.plan.request.action==='start'?['这是新聊天的出身与时间选择。保留已定稿通用开场的内容，从所选起始背景继续正文；背景事件occurred/skipped只表示过去发生或跳过，不写任务完成、不补发报酬、不重置任何既有数值。']:[]),
      JSON.stringify({actionId:ticket.id,requestHash:ticket.requestHash,request:ticket.plan.request,definitions:ticket.plan.definitions,expectedChanges:ticket.plan.changes}),
      '主剧情裁定并说明行动成功或拒绝；当前变量解析模式依据本轮事实生成更新：只有实际成功才写入expectedChanges的after值；这些是待核对结果，不是前端已修改的状态。路径不存在用add，存在用replace；保留其他所有字段。',
      '变量更新同时在/terminal/gameplay/results/'+ticket.id+'写入{requestHash,status,reason}，status只用success或refused。拒绝时不得扣钱、改物品或发奖。启用被拒绝时不创建gameplay，保持未确认并解释原因。',
      '若已存在同一actionId的结果，仅说明原结果，严禁重复结算。钱包收支、材料、产物、装备槽、技能和事件必须与本次定义一致。额外剧情变动使用其他字段，不混进这笔交易。'].join('\n');
  }
  function promptEntries(registry,options={},state={}) {
    const catalog=catalogue(registry,options),definitions=new Map();
    function add(d){const r=d.definitionRef;definitions.set(r.packageId+':'+r.version+':'+r.kind+':'+r.id,d);}
    for(const kind of KINDS)for(const d of catalog.lists[kind].values())add(d);
    for(const [table,kind]of Object.entries({inventory:'items',blueprints:'blueprints',skills:'skills',equipment:'items',events:'encounters'}))
      for(const [key,record]of Object.entries(state[table] || {}))if(key!=='$meta' && record?.definitionRef){
        const id=record.itemId||key;
        if(kind!=='items'){add(catalog.get(kind,id,record.definitionRef));continue;}
        const d=Definitions.resolve(state,id,record.definitionRef,{registry});
        if(d)add(d);
        else {options.onDefinitionIssue?.(id);add({id,name:id,description:'原定义暂不可读取，保留已有所有权；不据此推断数值或补发物品。',definitionRef:clone(record.definitionRef)});}
      }
    return [...definitions.values()].map(d=>{const r=d.definitionRef;return {owner:r.packageId,id:'gameplay.'+r.kind+'.'+r.id+'.'+r.version,version:r.version,entry:{
      name:'玩法定义·'+d.name,content:'按版本读取游戏定义；获取、学习和完成状态取自当前故事变量。\n'+JSON.stringify(d),enabled:true,
      strategy:{type:'selective',keys:[d.id,d.name],keys_secondary:{logic:'and_any',keys:[]},scan_depth:'same_as_global'},
      position:{type:'after_character_definition',role:'system',depth:4,order:110},probability:100,
      recursion:{prevent_incoming:true,prevent_outgoing:true,delay_until:null},effect:{sticky:null,cooldown:null,delay:null},extra:{}}};});
  }
  // One numeric implementation serves UI planning, MVU settlement and combat.
  const growth=growthBase;
  return {KINDS,TABLES,validate,catalogue,read,initializeVariables,validateOpeningManifest,plan,verify,prompt,promptEntries,getPath,same,growth};
});
