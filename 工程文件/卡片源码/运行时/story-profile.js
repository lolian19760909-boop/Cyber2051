(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else{root.CxxStoryProfile=api;if(root.parent&&!root.__cxxStandaloneUI)root.parent.CxxStoryProfile=api;}})(globalThis,function(root){
 'use strict';
 const structuredClone=(typeof module==='object'&&module.exports?require('../共享/data-clone.js'):globalThis.CxxDataClone).clone;
 const cryptoCompat=()=>typeof module==='object'&&module.exports?require('./crypto-compat.js'):root.CxxCrypto;
 const KEY='__cxx_story_profile',fields={name:'姓名',address:'称谓',gender:'性别',age:'年龄',appearance:'外貌',clothing:'服装',personality:'性格',history:'经历',additional:'补充设定'};
 const appearance=()=>typeof module==='object'&&module.exports?require('./appearance.js'):root.CxxAppearance;
 function normalize(p){if(!p||p.schema!==1||!/^profile_[a-z0-9-]+$/i.test(p.id||''))throw Error('人物资料版本或编号无效。');const out=structuredClone(p);for(const k of Object.keys(fields)){out[k]=String(p[k]||'');if(['name','address','gender','age'].includes(k)){out[k]=out[k].trim();if(out[k].length>80)throw Error(fields[k]+'过长。');}}if(!out.name)throw Error('请填写人物姓名。');if(p.appearanceTraits!==undefined)out.appearanceTraits=appearance().normalize(p.appearanceTraits);if(p.portrait!==undefined)out.portrait=portrait(p.portrait);return out;}
 function description(p){return [Object.entries(fields).filter(([k])=>p[k]).map(([k,v])=>v+'：'+p[k]).join('\n'),p.origin?.name&&'出身：'+p.origin.name,p.origin?.background&&'出身背景：'+p.origin.background,appearance()?.describe(p.appearanceTraits)].filter(Boolean).join('\n');}
 function hostPersona(win){return String(win.SillyTavern?.getContext?.().powerUserSettings?.persona_description||'');}
 function seed(win){const c=win.SillyTavern?.getContext?.()||{},id='profile_'+(win.crypto?.randomUUID?.()||Date.now().toString(36));return {schema:1,id,name:c.name1||'旅人',address:'',gender:'',age:'',appearance:'',clothing:'',personality:'',history:'',additional:'',avatar:{kind:'current'}};}
 function importPersona(profile,text){const out=structuredClone(profile),value=String(text||'');if(value&&out.importedPersona!==value){out.additional=[out.additional,value].filter(Boolean).join('\n\n');out.importedPersona=value;}return out;}
 function modules(win){return new Promise((resolve,reject)=>{const id='cxx-persona-module-'+(win.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2)),script=win.document.createElement('script');let timer;const end=(error,data)=>{win.clearTimeout(timer);win.removeEventListener(id,receive);script.remove();error?reject(error):resolve(data);},receive=e=>e.detail.error?end(Error(e.detail.error)):end(null,e.detail);win.addEventListener(id,receive,{once:true});script.type='module';script.textContent='Promise.all([import("/scripts/personas.js"),import("/script.js")]).then(([personas,host])=>window.dispatchEvent(new CustomEvent('+JSON.stringify(id)+',{detail:{personas,host}})),e=>window.dispatchEvent(new CustomEvent('+JSON.stringify(id)+',{detail:{error:e.message}})));';script.onerror=()=>end(Error('宿主人物接口无法加载，请保存草稿后重试。'));timer=win.setTimeout(()=>end(Error('宿主人物接口加载超时，草稿已保留。')),10000);win.document.head.append(script);});}
 const marker=e=>(e?.extra?.__cxx_story_profile?.schema>=1);
 const Host=win=>typeof module==='object'&&module.exports?require('./host.js'):win.Cxx233Updater?.host?.worldbookEntries;
 const locks=new Map();
 function same(a,b){if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;return Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
 function withBookLock(win,book,work){if(win.navigator?.locks?.request)return win.navigator.locks.request('cxx-worldbook:'+book,work);const previous=locks.get(book)||Promise.resolve(),next=previous.catch(()=>{}).then(work);locks.set(book,next);return next.finally(()=>{if(locks.get(book)===next)locks.delete(book);});}
 function originalBook(api,ctx){const name=api.getCharWorldbookNames?.('current')?.primary||ctx.characters?.[ctx.characterId]?.data?.extensions?.world;if(!name||/^(Cyber2051-(Story|User)-|cxx-content-)/.test(name))throw Error('原角色世界书尚未绑定，请先导入成卡内的世界书。');return name;}
 async function readBook(win,name){const c=win.SillyTavern.getContext(),r=await win.fetch('/api/worldinfo/get',{method:'POST',headers:c.getRequestHeaders(),body:JSON.stringify({name}),signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('人物世界书读取失败（HTTP '+r.status+'）。');const raw=await r.json();if(!raw?.entries||typeof raw.entries!=='object')throw Error('人物世界书内容无效。');return raw;}
 async function bind(win,input,{api=root,art=root.CxxItemArt,assertCurrent=()=>{}}={}){
  const profile=normalize(input),ctx=()=>win.SillyTavern.getContext(),chat=ctx().chatMetadata,expected=ctx().getCurrentChatId?.()||ctx().chatId;
  const guard=()=>{assertCurrent();if(ctx().chatMetadata!==chat||(ctx().getCurrentChatId?.()||ctx().chatId)!==expected)throw Error('故事已切换，人物保存停止。');};
  const book=originalBook(api,ctx()),route=chat.__cxx_story_v1?.routeId||expected;
  let images;if(profile.portraitUpload){if(!art||profile.portrait?.kind!=='asset'||profile.portrait.id!==profile.portraitUpload.id)throw Error('人物立绘与图片资源不一致。');images=await art.merge(chat[art.key],[profile.portraitUpload]);guard();}
  if(profile.portrait?.kind==='asset'&&!(images||chat[art?.key])?.assets?.[profile.portrait.id])throw Error('人物立绘资源缺失，请重新选择图片。');
  return withBookLock(win,book,async()=>{
   guard();const raw=await readBook(win,book);guard();const rows=Object.values(raw.entries),H=Host(win);
   if(!H)throw Error('人物资料保存服务正在启动，请稍后重试。');
   let previous=rows.find(e=>marker(e)&&e.extra.__cxx_story_profile.routeId===route);
   if(rows.filter(e=>marker(e)&&e.extra.__cxx_story_profile.routeId===route).length>1)throw Error('这个故事有重复的user条目，请保留一条后重试。');
   let source=previous,sourceRows=[],sourceRoute=profile.binding?.routeId||route;
   if(!source&&profile.binding?.worldbook&&(profile.binding.worldbook===book||api.getWorldbookNames().includes(profile.binding.worldbook))){const old=profile.binding.worldbook===book?raw:await readBook(win,profile.binding.worldbook);guard();sourceRows=Object.values(old.entries);source=sourceRows.find(e=>marker(e)&&(profile.binding.entryUid!==undefined?e.uid===profile.binding.entryUid:e.extra.__cxx_story_profile.routeId===profile.binding.routeId));}
   const legacy=api.getChatWorldbookName?.('current'),detach=legacy&&/^(Cyber2051-(Story|User)-|cxx-content-)/.test(legacy);
   if(detach&&legacy!==book){const old=await readBook(win,legacy);guard();sourceRows=Object.values(old.entries);source||=sourceRows.find(e=>marker(e)&&(!e.extra.__cxx_story_profile.routeId||e.extra.__cxx_story_profile.routeId===sourceRoute));}
   const content=source?.content??profile.worldbookContent??('【本存档的user】\n{{user}}在本故事中扮演：'+profile.name+'。\n'+description(profile));
   const uid=previous?.uid??Math.max(-1,...rows.map(e=>Number(e.uid)))+1;
   const before=previous?H.rawEntryRuntime(previous):undefined;
   const entry=H.normalizeEntry({...before,uid,name:'[mvu_plot][mvu_update]user · '+profile.name,enabled:false,content,
    strategy:{type:'constant',keys:[],keys_secondary:{logic:'and_any',keys:[]},scan_depth:'same_as_global'},
    position:{type:'before_character_definition',role:'system',depth:0,order:100},
    recursion:{prevent_incoming:true,prevent_outgoing:true,delay_until:null},
    extra:{...before?.extra,__cxx_story_profile:{schema:2,profileId:profile.id,routeId:route}}});
   const next=H.mergeRawEntry(previous,before,entry,previous?.displayIndex??rows.length),target={...raw,entries:{...raw.entries,[uid]:next}},migrated=[];
   let nextUid=Math.max(uid,...rows.map(e=>Number(e.uid)))+1;
   for(const old of sourceRows){const m=old.extra?.__cxx_official_content;if(!m||m.routeId&&m.routeId!==sourceRoute)continue;
    if(Object.values(target.entries).some(e=>{const v=e.extra?.__cxx_official_content;return v?.routeId===route&&v.owner===m.owner&&v.id===m.id;}))continue;
    const moved={...structuredClone(old),uid:nextUid++,extra:{...structuredClone(old.extra),__cxx_official_content:{...structuredClone(m),routeId:route,instanceId:win.Cxx233Updater?.host?.readState?.().instanceId||m.instanceId}}};target.entries[moved.uid]=moved;migrated.push(moved);
   }
   if(!same(previous,next)||migrated.length){guard();if(typeof ctx().saveWorldInfo!=='function')throw Error('世界书保存接口尚未就绪。');await ctx().saveWorldInfo(book,target,true);guard();}
   const disk=await readBook(win,book);guard();if([next,...migrated].some(e=>!same(disk.entries[e.uid],e)))throw Error('故事世界书尚未保存一致，请重试。');
   const binding={schema:4,kind:'worldbook-entry',worldbook:book,entryUid:uid,chatId:expected,routeId:route};
   profile.avatar={kind:'current'};delete profile.avatarUpload;delete profile.portraitUpload;
   const result={...profile,binding,worldbookContent:content};
   if(JSON.stringify(chat[KEY])!==JSON.stringify(result)||images||detach){const save=async()=>{guard();if(images)chat[art.key]=images;chat[KEY]=result;if(detach){await api.rebindChatWorldbook('current',null);guard();}await ctx().saveMetadata();guard();};const saveHost=win.Cxx233Updater?.host;if(saveHost?.withChatSave)await saveHost.withChatSave(saveHost.getContext(),save);else await save();}
   return structuredClone(result);
  });
 }
 async function selected(win,{api=root,migrate=true}={}){const c=win.SillyTavern.getContext(),identity=c.chatMetadata?.variables?.__cxx_identity;let p=c.chatMetadata?.[KEY];if(!p&&migrate&&identity?.setupToken)p={...seed(win),origin:{id:identity.id,name:identity.name,background:identity.background}};if(!p)return null;const profile=migrate?await bind(win,p,{api}):p,b=profile.binding;if(b?.schema!==4)return null;const raw=await readBook(win,b.worldbook),entry=raw.entries[b.entryUid];if(!marker(entry)||entry.extra.__cxx_story_profile.routeId!==b.routeId)throw Error('当前存档的user条目绑定不一致。');return {...entry,world:b.worldbook,disable:false};}
 function filterEntries(payload,binding,selectedEntry,route){
  for(const name of ['globalLore','characterLore','chatLore','personaLore'])if(Array.isArray(payload?.[name]))payload[name].splice(0,payload[name].length,...payload[name].filter(e=>!marker(e)&&(!e.extra?.__cxx_official_content?.routeId||e.extra.__cxx_official_content.routeId===route)));
  if(selectedEntry&&binding?.entryUid===selectedEntry.uid&&binding.worldbook===selectedEntry.world){(payload.characterLore||(payload.characterLore=[])).push({...selectedEntry,disable:false});}
 }
 function avatarSource(personas,host){const current=personas.user_avatar||host.user_avatar;return current?'/User Avatars/'+encodeURIComponent(current):host.default_user_avatar||'/img/user-default.png';}
 async function currentAvatar(win,{load=()=>modules(win)}={}){const {personas,host}=await load();return avatarSource(personas,host);}
 // Visuals never participate in persona text or avatar binding.
 const portraitGallery=['Saki','Tomorin','Anon','Soyo','Taki','Rana','Uika','Mutsumi','Umiri','Nyamu'];
 function visualStamp(profile){return JSON.stringify([profile?.id||null,profile?.portrait||null,profile?.visualRevision||0]);}
 function portrait(value){if(value==null)return undefined;if(value.schema!==1||!['gallery','asset'].includes(value.kind)||(value.kind==='gallery'?!portraitGallery.includes(value.id):!/^art_[a-f0-9]{64}$/.test(value.id||'')))throw Error('人物主视觉引用无效。');return {schema:1,kind:value.kind,id:value.id};}
 function withPortrait(previous,request){if(!/^visual_[a-z0-9-]+$/i.test(request.id||''))throw Error('人物图片操作编号无效。');if(previous?.visualReceipt===request.id){if(JSON.stringify(previous.portrait||null)!==JSON.stringify(portrait(request.portrait)||null))throw Error('同一人物图片请求不可改变。');return structuredClone(previous);}if(visualStamp(previous)!==request.expectedVisual)throw Error('故事人物图已变化，原选择已保留；请关闭后核对最新人物图。');const ref=portrait(request.portrait),out=previous?structuredClone(previous):normalize(request.legacyProfile);if(ref)out.portrait=ref;else delete out.portrait;out.visualSchema=1;out.visualRevision=(previous?.visualRevision||0)+1;out.visualReceipt=request.id;return out;}
 return {KEY,fields,normalize,description,seed,hostPersona,importPersona,bind,selected,filterEntries,withBookLock,currentAvatar,portraitGallery,portrait,visualStamp,withPortrait};
});
