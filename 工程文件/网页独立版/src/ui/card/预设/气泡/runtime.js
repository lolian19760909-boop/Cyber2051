/* Derived from 卡片源码/预设/气泡/runtime.js; source SHA256 b5b54db26aa4cd513bff02160f0a3e5499b8549eac8c1b3c077d97ec13c0f5f0. Rebuild with tools/p3a-adapt-views.mjs. */
(() => {
  'use strict';
  const native=window.CxxWebUIData.native,BDA_META=native.meta,CXX_BDA_NAMES=native.names,CXX_BDA_MEDIA=native.media,BDA_CSS=native.controlsCSS,CXX_BDA_GROUPS=native.groups,CXX_BDA_CROPS=native.crops;
  const KEY='__cyber2051BandoriAvatar', PREF='cyber2051-dialogue-display-v1', ROLE_PREF='cyber2051-dialogue-characters-v1';
  let host;
  try {host=window;void host.document.head;} catch(e){throw Error('无法访问酒馆页面：'+e.message);}
  host[KEY]?.dispose();
  const doc=host.document,chat=doc.querySelector('#stage-lines'),settings=doc.querySelector('#session-settings');
  if(!chat || !settings)throw Error('未找到酒馆聊天区或酒馆助手设置区，显示脚本未启动。');
  const choices={avatar:'头像气泡',initial:'首字气泡',color:'对白上色',off:'关闭美化'};
  let mode='avatar';
  try{const saved=host.localStorage.getItem(PREF);if(Object.hasOwn(choices,saved))mode=saved;}catch(e){console.warn('显示方式暂不能保存，将使用默认头像气泡。',e);}
  const style=doc.createElement('style');style.id='cxx-bda-style';style.textContent=BDA_CSS;doc.head.append(style);
  const row=doc.createElement('section');row.id='cxx-bda-control';row.setAttribute('aria-label','2051 台词显示设置');
  const title=doc.createElement('span');title.textContent='2051 · 台词显示';row.append(title);
  const select=doc.createElement('select');select.setAttribute('aria-label','2051 台词显示');
  for(const [value,label]of Object.entries(choices)){const opt=doc.createElement('option');opt.value=value;opt.textContent=label;select.append(opt);}
  select.value=mode;row.append(select);settings.before(row);
  const USER_PREF='cyber2051-user-avatar-source-v1';let userAvatarSource='persona';
  try{if(host.localStorage.getItem(USER_PREF)==='initial')userAvatarSource='initial';}catch{}
  const userLabel=doc.createElement('label');userLabel.className='cxx-bda-user-avatar';userLabel.append('用户头像');
  const userSelect=doc.createElement('select');userSelect.setAttribute('aria-label','2051 用户头像来源');
  for(const [value,label]of [['persona','当前用户头像'],['initial','首字占位']]){const opt=doc.createElement('option');opt.value=value;opt.textContent=label;userSelect.append(opt);}
  userSelect.value=userAvatarSource;userLabel.append(userSelect);row.append(userLabel);
  userSelect.addEventListener('change',()=>{userAvatarSource=userSelect.value;try{host.localStorage.setItem(USER_PREF,userAvatarSource);}catch{}scan(chat,true);});
  let rolePrefs={};
  try{const saved=JSON.parse(host.localStorage.getItem(ROLE_PREF)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))rolePrefs=Object.fromEntries(Object.entries(saved).filter(([,v])=>typeof v==='boolean'));}catch(e){console.warn('角色显示偏好暂不能读取，将使用默认选择。',e);}
  const defaultRole=id=>Object.hasOwn(CXX_BDA_MEDIA,id)||id==='user'||id==='cxx';
  const enabledRole=id=>Object.hasOwn(rolePrefs,id)?rolePrefs[id]:defaultRole(id);
  const roleInputs=new Map(),groupInputs=[];
  const panel=doc.createElement('details');panel.id='cxx-bda-roles';
  const summary=doc.createElement('summary');summary.textContent='选择显示气泡的角色';panel.append(summary);
  const toolbar=doc.createElement('div');toolbar.className='cxx-bda-role-actions';panel.append(toolbar);
  function saveRoles(){try{host.localStorage.setItem(ROLE_PREF,JSON.stringify(rolePrefs));}catch(e){console.warn('角色显示偏好暂不能保存，将保持本次选择。',e);}syncRoleControls();scan(chat,true);}
  for(const [label,value]of [['全开',true],['全关',false]]){const button=doc.createElement('button');button.type='button';button.textContent=label;button.setAttribute('data-role-all',String(value));button.addEventListener('click',()=>{for(const group of CXX_BDA_GROUPS)for(const id of group.ids)rolePrefs[id]=value;saveRoles();});toolbar.append(button);}
  const groups=doc.createElement('div');groups.className='cxx-bda-role-groups';panel.append(groups);
  for(const group of CXX_BDA_GROUPS){
    const field=doc.createElement('fieldset'),legend=doc.createElement('legend'),label=doc.createElement('label'),input=doc.createElement('input');input.type='checkbox';input.setAttribute('data-role-group',group.id);
    const name=doc.createElement('span');name.textContent=group.name;label.append(input,name);legend.append(label);field.append(legend);
    input.addEventListener('change',()=>{for(const id of group.ids)rolePrefs[id]=input.checked;saveRoles();});groupInputs.push({input,ids:group.ids});
    const members=doc.createElement('div');members.className='cxx-bda-role-members';field.append(members);
    for(const id of group.ids){const member=doc.createElement('label'),check=doc.createElement('input'),text=doc.createElement('span');check.type='checkbox';check.setAttribute('data-role-id',id);text.textContent=id==='user'?'当前用户':id==='cxx'?'其他 NPC':BDA_META[id]?.name||id;check.addEventListener('change',()=>{rolePrefs[id]=check.checked;saveRoles();});member.append(check,text);members.append(member);roleInputs.set(id,check);}
    groups.append(field);
  }
  function syncRoleControls(){for(const [id,input]of roleInputs)input.checked=enabledRole(id);for(const {input,ids}of groupInputs){const selected=ids.filter(enabledRole).length;input.checked=selected===ids.length;input.indeterminate=selected>0&&selected<ids.length;}}
  syncRoleControls();row.append(panel);
  const touched=new Set(),pending=new Set(),remote=new Map(),captions=new Map(),portraits=new Map(),labels=new Map(),subscriptions=[];let disposed=false,timer=null,timerDelay=0,generating=false;
  const entrances=new Map(),eligibleMessages=new Map();
  let knownMessages=new WeakSet(),messageScope='',generationType='';
  const context=()=>host.CxxWebReadingContext();
  const scopeOf=ctx=>ctx?.scope;
  function stopEntrance(el){const stop=entrances.get(el);if(stop)stop();else el.removeAttribute('data-bda-enter');}
  function stopEntrances(){for(const stop of [...entrances.values()])stop();}
  function seedMessages(){const ctx=context();messageScope=scopeOf(ctx);knownMessages=new WeakSet((ctx?.chat??[]).filter(message=>message&&typeof message==='object'));eligibleMessages.clear();stopEntrances();}
  function messageAt(floor){const ctx=context();if(scopeOf(ctx)!==messageScope){seedMessages();return null;}const id=Number(floor?.getAttribute('mesid'));return floor&&Number.isSafeInteger(id)&&id>=0?ctx?.chat?.[id]:null;}
  function newMessage(index,type=generationType){
    const ctx=context();if(scopeOf(ctx)!==messageScope){seedMessages();return;}
    const message=ctx?.chat?.[Number(index)];if(!message||typeof message!=='object'||knownMessages.has(message))return;
    knownMessages.add(message);
    if(!['swipe','continue','regenerate','quiet','impersonate'].includes(type))eligibleMessages.set(message,new WeakSet());
    pending.add(chat);schedule(80);
  }
  function finishDecoration(el){
    const theme=doc.documentElement.getAttribute('data-cxx-theme');
    el.setAttribute('data-bda-theme',['yellow','night'].includes(theme)?theme:'red');
    touched.add(el);
    const candidates=eligibleMessages.get(messageAt(el.closest('.mes')));
    if(!candidates||candidates.has(el))return;
    candidates.add(el);
    if(generating||!['avatar','initial'].includes(el.getAttribute('data-bda-view'))||host.Cxx236Preferences?.read?.().level==='low'||host.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    const end=event=>{if(event&&event.target!==el)return;host.clearTimeout(timeout);el.removeEventListener('animationend',end);el.removeEventListener('animationcancel',end);el.removeAttribute('data-bda-enter');entrances.delete(el);};
    const timeout=host.setTimeout(()=>end(),320);
    entrances.set(el,end);el.addEventListener('animationend',end);el.addEventListener('animationcancel',end);el.setAttribute('data-bda-enter','');
  }
  function consumeMessages(root){
    const floors=new Set([root.closest('.mes'),...root.querySelectorAll('.mes')]);
    for(const floor of floors)if(floor)eligibleMessages.delete(messageAt(floor));
    const chatMessages=context()?.chat??[];
    for(const message of eligibleMessages.keys())if(!chatMessages.includes(message))eligibleMessages.delete(message);
  }
  const galActive=()=>doc.body.getAttribute('data-cxx-gal-active')==='1';
  const expressionNames={normal:'正常',smile:'微笑',blush:'脸红',serious:'严肃',sadness:'悲伤',regret:'遗憾',shocked:'震惊',constricted_pupils:'缩瞳',cyberpsychosis:'赛博精神病发作',yandere_trance:'冲击',angry:'生气',cry:'哭泣'};
  function expressionOf(raw,id){
    const aliases={default:'normal',idle:'normal',idle01:'normal',smile01:'smile',angry01:'angry',cry01:'cry',yandere_trance:'constricted_pupils'};
    let face=aliases[raw]||raw;
    if(CXX_BDA_MEDIA[id])face=({angry:'serious',cry:'sadness'})[face]||face;
    return Object.hasOwn(expressionNames,face)?face:'normal';
  }
  function updateCaption(el,face,view,portrait){
    el.setAttribute('data-bda-expression',face);
    if(view!=='avatar'){captions.get(el)?.remove();captions.delete(el);return;}
    let caption=captions.get(el);
    if(!caption||caption.parentElement!==el){caption=doc.createElement('span');caption.className='cxx-bda-expression';caption.setAttribute('data-bda-expression-label','');el.append(caption);captions.set(el,caption);}
    const note=portrait?.status==='loading'?'加载中':portrait?.status==='unavailable'?'立绘暂未载入':portrait?.status==='fallback'?'↳ '+portrait.face:'';
    const text=face+(note?'\n'+note:'');
    if(caption.textContent!==text)caption.textContent=text;
    caption.setAttribute('title','表情：'+face+' · '+expressionNames[face]+(note?'；头像：'+note:''));
    caption.setAttribute('aria-label','表情：'+face+'，'+expressionNames[face]+(note?'，头像'+note:''));
  }
  // Keep the card's character/expression media interface. Never use donor art.
  // A missing expression may fall back only to this character's own normal pose.
  function cyberPortrait(id,raw){
    const entry=CXX_BDA_MEDIA[id];if(!entry)return null;
    const face=expressionOf(raw,id);
    for(const key of [...new Set([face,'normal'])]){
      const url=entry.faces[key];if(!url)continue;
      let item=remote.get(url);
      if(!item){
        const img=new host.Image();item={state:'loading',img};remote.set(url,item);
        img.onload=()=>{if(disposed)return;item.state='ready';scan(chat);};
        img.onerror=()=>{if(disposed)return;item.state='failed';item.lease?.release();item.lease=null;scan(chat);};
        Promise.resolve().then(()=>host.CxxResources?.acquire?host.CxxResources.acquire(url):{url,release(){}}).then(lease=>{if(disposed){lease.release();return;}item.lease=lease;img.src=lease.url;},()=>{if(disposed)return;item.state='failed';scan(chat);});
      }
      if(item.state==='ready')return {url:item.lease?.url||url,crop:CXX_BDA_CROPS[id],status:key===face?'ready':'fallback',face:key};
      if(item.state==='loading')return {status:'loading'};
    }
    return {status:'unavailable'};
  }
  function portraitNode(el,view,url,crop,pose){
    if(view!=='avatar'){portraits.get(el)?.box.remove();portraits.delete(el);return;}
    let entry=portraits.get(el);
    if(!entry||entry.box.parentElement!==el){const box=doc.createElement('span');box.className='cxx-bda-portrait';box.setAttribute('data-bda-owned','portrait');box.setAttribute('aria-hidden','true');el.append(box);entry={box,img:null};portraits.set(el,entry);}
    if(!url){if(entry.img){entry.img.onload=null;entry.img.remove();entry.img=null;}const initial=el.getAttribute('data-bda-initial')||'◇';if(entry.box.textContent!==initial)entry.box.textContent=initial;entry.box.dataset.placeholder='true';return;}
    if(!entry.img){entry.box.textContent='';delete entry.box.dataset.placeholder;const img=doc.createElement('img');img.className='cxx-bda-portrait-image';img.alt='';img.draggable=false;img.decoding='async';entry.box.append(img);entry.img=img;}
    const {img}=entry;entry.crop=crop;entry.pose=pose;
    img.onload=()=>{if(disposed||entry.crop||!img.naturalWidth)return;const current=entry.pose||{},scale=(current.size||100)/100;img.style.setProperty('top',((1-scale*img.naturalHeight/img.naturalWidth)*(current.y??10))+'%','important');};
    if(img.getAttribute('src')!==url)img.setAttribute('src',url);
    // Crop coordinates use original-width fractions; no recompression or canvas.
    if(crop){img.style.setProperty('width',(100/crop.width)+'%','important');img.style.setProperty('left',(-100*crop.left/crop.width)+'%','important');img.style.setProperty('top',(-100*crop.top/crop.width)+'%','important');img.style.setProperty('height','auto','important');}
    else {const scale=(pose?.size||100)/100;img.style.setProperty('width',(scale*100)+'%','important');img.style.setProperty('left',((1-scale)*(pose?.x??50))+'%','important');img.style.setProperty('top','0%','important');img.style.setProperty('height','auto','important');if(img.complete)img.onload();}
  }
  function clear(el){
    stopEntrance(el);
    const saved=labels.get(el);if(saved?.node.isConnected&&saved.node.textContent===saved.applied)saved.node.textContent=saved.original;labels.delete(el);
    captions.get(el)?.remove();captions.delete(el);
    portraits.get(el)?.box.remove();portraits.delete(el);
    for(const key of ['data-bda','data-bda-view','data-bda-initial','data-bda-name','data-bda-expression','data-bda-theme'])el.removeAttribute(key);
    for(const key of ['--bda-color','--bda-image','--bda-x','--bda-y','--bda-size'])el.style.removeProperty(key);
    touched.delete(el);
  }
  function userProfile(){const current=host.CxxWebReadingContext();return {name:current.userName,avatar:current.userAvatar||""};}
  function decorate(el){
    if(galActive()||!el.closest('.mes_text')?.querySelector('[data-cxx-bda-style="r4"]')){if(touched.has(el))clear(el);return;}
    if(el.closest('pre,code,blockquote,details,[data-cxx-slot]')||!el.matches('span.bdc,span.custom-bdc')){if(touched.has(el))clear(el);return;}
    if(!touched.has(el)){stopEntrance(el);el.querySelectorAll(':scope > [data-bda-owned],:scope > [data-bda-expression-label]').forEach(node=>node.remove());}
    const tokens=Array.from(el.classList,t=>t.replace(/^custom-/,''));
    const role=tokens.find(t=>t.startsWith('bdc-')&&t!=='bdc-thought')?.slice(4);
    const label=el.querySelector('.bda-speaker,.custom-bda-speaker');
    const name=label?.textContent.replace(/[：:]\s*$/,'').trim();
    const user=userProfile();
    let id=role==='cxx'?(CXX_BDA_NAMES[name]||'cxx'):role==='raana'?'rana':role;
    if(role==='cxx'&&(['user','{{user}}','<user>','用户'].includes(name?.toLowerCase())||user.name&&name===user.name))id='user';
    if(!enabledRole(id)){clear(el);return;}
    const raw=tokens.find(t=>t.startsWith('bde-'))?.slice(4)||'default',face=expressionOf(raw,id);
    if (id === 'user') {
  const name = user.name || (nameIsActual(label?.textContent)?label.textContent.replace(/[：:]\s*$/,'').trim():'姓名未读取');
  const avatar = userAvatarSource==='persona'?user.avatar:'';
  if(label&&label.textContent!==name+'：'){
    if(!labels.has(el))labels.set(el,{node:label,original:label.textContent});
    labels.get(el).applied=name+'：';label.textContent=name+'：';
  }

  const view =
    mode === 'avatar' && !avatar ? 'initial' : mode;

  el.setAttribute('data-bda', 'user');
  el.setAttribute('data-bda-name', name);
  el.setAttribute('data-bda-view', view);
  el.setAttribute(
    'data-bda-initial',
    Array.from(name)[0] || ''
  );

  el.style.setProperty('--bda-color', '#B8C5D6');
  el.style.setProperty('--bda-x', '50%');
  el.style.setProperty('--bda-y', '50%');
  el.style.setProperty('--bda-size', '100%');

  portraitNode(el,view,avatar,null,{size:100,x:50,y:50});

  updateCaption(el,face,view,null);finishDecoration(el);
  return;
}if(!id||(!Object.hasOwn(BDA_META,id)&&!(id==='cxx'&&name))){if(touched.has(el))clear(el);return;}
    const meta=BDA_META[id]||{name,initial:Array.from(name)[0],color:'#aeb8c3'};
    const portrait=mode==='avatar'?cyberPortrait(id,raw):null;
    const view=mode==='avatar'&&!CXX_BDA_MEDIA[id]?'initial':mode;
    el.setAttribute('data-bda',id);el.setAttribute('data-bda-view',view);el.setAttribute('data-bda-initial',meta.initial);
    el.setAttribute('data-bda-name',name||meta.name);
    el.style.setProperty('--bda-color',meta.color);
    portraitNode(el,view,portrait?.url,portrait?.crop,null);
    updateCaption(el,face,view,portrait);finishDecoration(el);
  }
  function nameIsActual(value){return value&& !['user','{{user}}','<user>','用户'].includes(value.replace(/[：:]\s*$/,'').trim().toLowerCase());}
  function scan(root,force=false){if(disposed||generating&&!force||root.nodeType!==1)return;if(root.matches('span.bdc,span.custom-bdc,span[data-bda]'))decorate(root);root.querySelectorAll('span.bdc,span.custom-bdc,span[data-bda]').forEach(decorate);consumeMessages(root);}
  function flush(){
    timer=null;if(disposed||generating)return;
    const roots=[...pending];pending.clear();for(const root of roots)if(root.isConnected)scan(root);
    for(const el of [...touched])if(!el.isConnected)clear(el);
  }
  function schedule(delay=900){if(timer!==null&&timerDelay<delay)return;if(timer!==null)host.clearTimeout(timer);timer=null;if(!disposed&&!generating){timerDelay=delay;timer=host.setTimeout(flush,delay);}}
  const observer=new host.MutationObserver(records=>{
    for(const r of records){
      if(r.target===doc.body&&r.attributeName==='data-cxx-gal-active'){scan(chat,true);continue;}
      if(r.target===doc.documentElement&&r.attributeName==='data-cxx-theme'){stopEntrances();scan(chat,true);continue;}
      const el=r.target.nodeType===1?r.target:r.target.parentElement;
      if(!el||el.closest('[data-bda-expression-label],[data-bda-owned]'))continue;
      if(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].every(n=>n.nodeType===1&&n.matches('[data-bda-expression-label],[data-bda-owned]')))continue;
      pending.add(el.closest('.mes_text')||el);
    }
    if(pending.size)schedule();
  });
  observer.observe(chat,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});
  observer.observe(doc.body,{attributes:true,attributeFilter:['data-cxx-gal-active']});
  observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-cxx-theme']});
  function generationStart(type,options,dryRun){if(dryRun||type==='quiet')return;generationType=type;generating=true;if(timer!==null)host.clearTimeout(timer);timer=null;}
  function generationEnd(){generating=false;generationType='';pending.clear();pending.add(chat);schedule(80);}
  function chatChanged(){seedMessages();generationEnd();}
  const preferencesChanged=()=>{if(host.Cxx236Preferences?.read?.().level==='low')stopEntrances();};
  host.addEventListener('cxx-ui-preferences-changed',preferencesChanged);subscriptions.push(()=>host.removeEventListener('cxx-ui-preferences-changed',preferencesChanged));
  try{
    const ctx=host.SillyTavern?.getContext?.(),source=ctx?.eventSource,events=ctx?.event_types||ctx?.eventTypes;
    if(source?.on&&source?.removeListener&&events?.GENERATION_STARTED&&events?.GENERATION_ENDED){
      const listen=(name,fn)=>{if(name){source.on(name,fn);subscriptions.push(()=>source.removeListener(name,fn));}};
      listen(events.GENERATION_STARTED,generationStart);listen(events.GENERATION_ENDED,generationEnd);
      listen(events.GENERATION_STOPPED,generationEnd);listen(events.CHAT_CHANGED,chatChanged);
      listen(events.MESSAGE_SENT,index=>newMessage(index,''));listen(events.MESSAGE_RECEIVED,newMessage);
      listen(events.PERSONA_CHANGED,()=>scan(chat,true));listen(events.PERSONA_UPDATED,()=>scan(chat,true));
    }
  }catch(e){console.warn('生成事件不可用，使用正文稳定后刷新。',e);}
  select.addEventListener('change',()=>{stopEntrances();mode=select.value;try{host.localStorage.setItem(PREF,mode);}catch(e){console.warn('本次显示方式未能保存。',e);}scan(chat,true);});
  seedMessages();
  scan(chat);
  function dispose(){if(disposed)return;disposed=true;observer.disconnect();for(const unsubscribe of subscriptions)unsubscribe();if(timer!==null)host.clearTimeout(timer);pending.clear();eligibleMessages.clear();stopEntrances();for(const item of remote.values()){item.img.onload=null;item.img.onerror=null;item.img.src='';item.lease?.release();}remote.clear();for(const el of [...touched])clear(el);style.remove();row.remove();window.removeEventListener('pagehide',dispose);if(host[KEY]?.dispose===dispose)delete host[KEY];}
  host[KEY]={dispose,refresh:()=>scan(chat,true)};window.addEventListener('pagehide',dispose,{once:true});
})();
