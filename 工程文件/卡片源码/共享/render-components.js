/* Chat identity owns components; native slots and Gal are independent consumers. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports={create:factory};else root.Cxx233Components={create:factory};})(globalThis,function(options){
 'use strict';
 const {window:win,api,runtime,parser,templates,kinds}=options,doc=win.document;
 const allowed=new Set(kinds),owned=new Map(),observed=new Set(),near=new WeakSet(),saved=new WeakMap();
 // Old rendered slots can survive a host refresh. They borrow the current
 // status instance without retaining a second template or changing save data.
 const normalizeKind=kind=>!allowed.has(kind)&&allowed.has('status0')&&['status1','status2'].includes(kind)?'status0':kind;
 let scope='',disposed=false,layoutFrame=null,layer=null,resizeChat=null;
 const flow=api.Cxx249Shadow?.create({window:win,runtime,templates});
 let useClock=0;const inspections=new Map();
 const failedKinds=new Set();
 const flowKind=kind=>!failedKinds.has(kind)&&flow?.supported&&(kind.startsWith('status')||kind==='options');
 const counts={created:0,loads:0,updates:0,destroyed:0,parsed:0,snapshots:0};
 const context=()=>api.SillyTavern.getContext(),escape=t=>String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const editing=node=>Boolean(node?.closest('.mes')?.querySelector('.edit_textarea,#curEditTextarea'));
 const selected=e=>scope===runtime.key()&&context().chat[e.floor]===e.message&&(e.message.swipe_id||0)===e.swipe;
 const entryKey=(floor,swipe,kind)=>scope+':'+floor+':'+swipe+':'+kind;
 function nativeLayer(chat){
  if(!layer){layer=doc.createElement('div');layer.setAttribute('data-cxx-native-layer','246');layer.style.cssText='position:fixed;inset:0;margin:0;padding:0;border:0;pointer-events:none;overflow:visible;isolation:isolate';doc.body.append(layer);}
  const z=Number.parseInt(win.getComputedStyle?.(chat)?.zIndex,10);layer.style.zIndex=String((Number.isFinite(z)?z:0)+1);return layer;
 }
 function payload(kind,raw,parsed){if(kind.startsWith('status'))return JSON.stringify(parsed.scene||{date:'',time:'',location:'',characters:[]});if(kind==='options')return parsed.choices.map((s,i)=>(i+1)+'. '+s).join('\n');if(kind==='mvu')return /<UpdateVariable>[\s\S]*?<(Analysis|Analyze)>([\s\S]*?)<\/\1>[\s\S]*?<\/UpdateVariable>/i.exec(raw)?.[2]||'';return '';}
 function renderHTML(kind,value){let html=templates[kind];if(kind.startsWith('status'))html=html.replace('`$1`',()=>JSON.stringify(value).replaceAll('<','\\u003c'));else if(kind==='options')html=html.replace(/<script type="text\/template" id="options-data">[\s\S]*?<\/script>/,()=>'<script>window.Cxx236InitialValue='+JSON.stringify(value).replaceAll('<','\\u003c')+';<'+ '/script><script type="text/template" id="options-data"></'+ 'script>');else if(kind==='mvu')html=html.replaceAll('$1',escape(value));return html;}
 function remember(e){try{const child=e.frame.contentWindow,inner=e.frame.contentDocument,view=child?.CxxStatusViewState,surface=child?.CxxNativeStatus,state={...surface?.snapshot(),...view?.snapshot()};
  const details=[...inner?.querySelectorAll('details')||[]].map(n=>n.open),scrolls=[...inner?.querySelectorAll('[id]')||[]].filter(n=>n.scrollTop||n.scrollLeft).map(n=>({id:n.id,top:n.scrollTop,left:n.scrollLeft}));
  const animations=(inner?.documentElement?.getAnimations?.({subtree:true})||[]).filter(a=>a.animationName).map(a=>({name:a.animationName,time:a.currentTime}));
  if(!saved.has(e.message))saved.set(e.message,new Map());saved.get(e.message).set(e.swipe+':'+e.kind,{state,height:e.height,details,scrolls,animations});
 }catch{}}
 function playing(e){return e.kind.startsWith('music')&&[...e.frame.contentDocument?.querySelectorAll('audio,video')||[]].some(m=>!m.paused&&!m.ended);}
 function restoreExtras(e,state){const inner=e.frame.contentDocument;if(!inner||!state)return;[...inner.querySelectorAll('details')].forEach((n,i)=>{if(state.details?.[i]!==undefined)n.open=state.details[i];});for(const value of state.scrolls||[]){const n=inner.getElementById(value.id);if(n){n.scrollTop=value.top;n.scrollLeft=value.left;}}
  const animations=inner.documentElement?.getAnimations?.({subtree:true})||[];for(const a of animations){const previous=state.animations?.find(x=>x.name===a.animationName);if(previous&&Number.isFinite(previous.time))a.currentTime=previous.time;else if(a.animationName&&a.effect?.getComputedTiming?.().iterations!==Infinity)try{a.finish();}catch{}}
 }

 function remove(key,e){remember(e);owned.delete(key);for(const cancel of e.waits)cancel();for(const lease of e.leases)lease.onInvalid?.();e.leases.clear();resize?.unobserve(e.frame);e.frame.__cxxShadowDispose?.();runtime.releaseFrame(e.frame);e.frame.remove();counts.destroyed++;}
 function visible(e,show){if(e.visible===show)return;e.visible=show;e.frame.hidden=!show;e.frame.style.display=show?'block':'none';e.frame.dataset.cxxVisible=show?'1':'0';e.frame.contentWindow?.Cxx236Motion?.setVisible(show);if(e.inline&&e.node)e.node.style.height=show?'':e.height+'px';if(show)e.used=++useClock;}
 function layout(){
  layoutFrame=null;if(disposed)return;const chat=doc.getElementById('chat'),bounds=chat?.getBoundingClientRect?.();
  for(const e of owned.values()){
   const hostMessage=e.node?.isConnected?e.node.closest('.mes'):chat?.querySelector('.mes[mesid="'+e.floor+'"]');if(hostMessage?.querySelector('.edit_textarea,#curEditTextarea')){visible(e,false);continue;}
   if(e.leases.size){visible(e,true);if(layer)layer.style.zIndex='2147483600';continue;}
   if(e.inline){
    const show=Boolean(e.node?.isConnected&&selected(e)&&!editing(e.node)&&(!visibility||near.has(e.node))&&doc.body.getAttribute('data-cxx-gal-active')!=='1');
    visible(e,show);if(show&&e.pending)update(e);continue;
   }
   const node=e.node,rect=node?.isConnected?node.getBoundingClientRect?.():null,mes=node?.closest('.mes');
   const textBounds=mes?.querySelector('.mes_text')?.getBoundingClientRect?.();
   const style=mes&&win.getComputedStyle?.(mes);
   const show=Boolean(rect&&bounds&&selected(e)&&!editing(node)&&rect.width>0&&rect.height>0&&rect.bottom>bounds.top&&rect.top<bounds.bottom&&style?.display!=='none'&&style?.visibility!=='hidden'&&doc.body.getAttribute('data-cxx-gal-active')!=='1');
   visible(e,show);if(!show)continue;
   if(e.pending)update(e);
   // The hitbox is restricted to message text, below the host's edit toolbar.
   const top=Math.max(bounds.top,textBounds?.top??bounds.top),right=Math.min(bounds.right,textBounds?.right??bounds.right),bottom=Math.min(bounds.bottom,textBounds?.bottom??bounds.bottom),left=Math.max(bounds.left,textBounds?.left??bounds.left);
   const values={left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',clipPath:'inset('+Math.max(0,top-rect.top)+'px '+Math.max(0,rect.right-right)+'px '+Math.max(0,rect.bottom-bottom)+'px '+Math.max(0,left-rect.left)+'px)'};
   for(const [k,v]of Object.entries(values))if(e.frame.style[k]!==v)e.frame.style[k]=v;
  }
  trim();
  if(layer&&![...owned.values()].some(e=>e.leases.size)){const z=Number.parseInt(win.getComputedStyle?.(chat)?.zIndex,10);layer.style.zIndex=String((Number.isFinite(z)?z:0)+1);}
 }
 function scheduleLayout(){if(layoutFrame===null)layoutFrame=win.requestAnimationFrame(layout);}
 function trim(){
  const idle=[...owned].filter(([,e])=>!e.leases.size&&e.visible===false&&e.node&&!near.has(e.node)&&!playing(e)).sort((a,b)=>b[1].used-a[1].used);
  for(const [key,e]of idle.slice(2))remove(key,e);
 }
 function scrollLayout(){if([...owned.values()].some(e=>!e.inline&&!e.leases.size))scheduleLayout();}
 const visibility=win.IntersectionObserver?new win.IntersectionObserver(entries=>{const floors=new Set();for(const e of entries){if(e.isIntersecting){near.add(e.target);floors.add(Number(e.target.closest('.mes')?.getAttribute('mesid')));}else near.delete(e.target);}if(floors.size)refresh({full:false,floors:[...floors]});scheduleLayout();},{rootMargin:'200px'}):null;
 const resize=win.ResizeObserver?new win.ResizeObserver(entries=>{for(const item of entries){const e=item.target.__cxxEntry;if(e?.flow&&item.contentRect.height>0){e.frame.style.setProperty('--cxx-component-viewport-height',item.contentRect.height+'px');if(!e.leases.size&&e.visible!==false)e.height=Math.ceil(item.contentRect.height);}}scheduleLayout();}):null;
 function update(e){
  if(!e.ready||(!e.leases.size&&(editing(e.node)||e.visible===false)))return;
  e.pending=false;const child=e.frame.contentWindow;
  if(e.kind==='mvu'){const node=e.frame.contentDocument?.querySelector('.mvu-content');if(node)node.textContent=e.value;}
  else child?.Cxx236ComponentUpdate?.(e.value,e.variables);counts.updates++;
 }
 function inspect(floor,completed){
  const c=context(),message=c.chat[floor];if(!message||message.is_user||message.is_system)return null;
  const swipe=message.swipe_id||0,hostRaw=message.mes||'',history=win.Cxx249History;let raw=hostRaw,parsed=completed;try{if(win.CxxSource)raw=win.CxxSource.sync(floor);}catch(e){if(e.sourceGuard)return null;throw e;}
  if(!parsed&&history?.messageSource){
   const source=history.messageSource(message,scope),current=()=>!disposed&&scope===source.scope&&scope===runtime.key()&&context().chat[floor]===message&&(message.swipe_id||0)===swipe&&message.mes===hostRaw;
   parsed=history.get(source.key,source.revision);
   if(!parsed){let job=inspections.get(floor);if(!job||job.key!==source.key||job.revision!==source.revision){job={...source,current};inspections.set(floor,job);counts.parsed++;job.promise=history.submit('parse',{raw},{...source,isCurrent:current});job.promise.then(value=>{if(inspections.get(floor)!==job||!current())return;job.parsed=value;refresh({full:false,floors:[floor]});job.parsed=null;inspections.delete(floor);}).catch(error=>{if(inspections.get(floor)===job){inspections.delete(floor);if(error.code!=='cxx-history-stale')console.warn('[正文解析]',error);}});}
    if(job.parsed)parsed=job.parsed;else return null;
   }
  }
  if(!parsed){counts.parsed++;parsed=parser.parseMessage(raw);}
  const checked=parsed.validation||parser.inspect(raw),variables=runtime.statusSnapshot?.(floor)||message.variables?.[swipe]||{};counts.snapshots++;
  const live236=()=>{const s=(typeof globalThis!=='undefined'&&globalThis.Cxx236State)||(typeof window!=='undefined'&&window.parent&&window.parent.Cxx236State);if(!s||typeof s.stat!=='function')return null;try{const v=s.stat();return v&&v.terminal?v:null;}catch(e){return null;}};
  return {message,swipe,raw,parsed,checked,variables,ready:(Boolean(message.variables?.[swipe]?.stat_data)||(floor===c.chat.length-1&&!!live236()))&&!(doc.body.hasAttribute('data-generating')&&floor===c.chat.length-1)};
 }
 function valid(kind,data){const tag=kind==='options'?'xuan':kind==='mvu'?'UpdateVariable':kind.startsWith('status')?'ztl':null;if(!tag)return true;const blocks=data.checked.roots.filter(r=>r.kind===tag);return blocks.length===1&&blocks[0].valid&&blocks[0].complete||kind.startsWith('status')&&!blocks.length&&(data.checked.statusPlaceholder===true||(!data.parsed.validation&&[...data.raw.matchAll(/^ {0,3}<StatusPlaceHolderImpl\/>[ \t]*$/gm)].some(m=>!data.checked.protection.all[m.index])));}
 function prepare(floor,kind,node,data){
  const {message,swipe,raw,parsed,variables,ready}=data,key=entryKey(floor,swipe,kind);let e=owned.get(key);
  if(e&&e.message!==message){remove(key,e);e=null;}
  if(!valid(kind,data)){if(e&&!e.leases.size)remove(key,e);return null;}
  const value=payload(kind,raw,parsed),signature=value+'\u0000'+ready+'\u0000'+(kind.startsWith('status')?JSON.stringify(variables.stat_data||{}):'');
  if(e){if(node){e.node=node;if(e.inline&&!e.leases.size&&e.frame.parentNode!==node)node.append(e.frame);}if(e.node&&!e.inline)e.node.style.height=e.height+'px';if(signature!==e.signature){e.signature=signature;e.value=value;e.variables=variables;e.pending=true;update(e);}e.frame.dataset.cxxReady=ready?'1':'0';e.frame.style.pointerEvents=kind==='options'&&!ready?'none':'auto';return e;}
  if(kind==='options'&&!ready)return null;
  const isFlow=flowKind(kind),frame=doc.createElement(isFlow?'div':'iframe'),state=saved.get(message)?.get(swipe+':'+kind);
  frame.title=kind.startsWith('status')?'人物状态':kind==='options'?'行动选项':kind==='mvu'?'变量说明':'音乐播放器';
  Object.assign(frame.dataset,{cxxFloor:String(floor),cxxSwipe:String(swipe),cxxAutoHeight:isFlow?'0':'1',cxxComponent:kind,cxxReady:ready?'1':'0'});
  frame.className='cxx-component-frame-236';frame.style.cssText='position:fixed;display:none;height:44px;min-height:1px;border:0;background:transparent;pointer-events:auto';frame.hidden=true;
  // MVU keeps its isolated document and original icon CSS, but belongs to the chat's scroll chain.
  const inSlot=isFlow||kind==='mvu';
  e={flow:isFlow,inline:inSlot,used:++useClock,frame,node,message,floor,swipe,kind,signature,value,variables,height:state?.height||44,ready:false,pending:true,leases:new Set(),waits:new Set(),visible:false};
  if(node)node.style.height=e.height+'px';frame.style.height=e.height+'px';if(isFlow){frame.style.cssText='display:none;position:relative;min-width:0;border:0;background:transparent;pointer-events:auto';frame.__cxxEntry=e;}else if(inSlot)frame.style.cssText='display:none;position:relative;width:100%;max-width:100%;min-width:0;height:'+e.height+'px;border:0;background:transparent;pointer-events:auto';
  frame.__cxxResize=height=>{if(e.leases.size)return;e.height=height;if(e.node?.isConnected)e.node.style.height=height+'px';scheduleLayout();};
  frame.addEventListener('load',()=>{if(owned.get(key)!==e)return;e.ready=true;counts.loads++;for(const media of frame.contentDocument?.querySelectorAll('audio,video')||[])media.addEventListener('ended',()=>win.setTimeout(()=>refresh({full:false,floors:[]}),0));e.visible=undefined;scheduleLayout();update(e);if(state){const child=frame.contentWindow;if(child?.CxxStatusViewState){child.CxxStatusViewState.restore(state.state);if(typeof state.state.expanded==='boolean')child.CxxNativeStatus?.setExpanded(state.state.expanded);}else child?.CxxNativeStatus?.restore(state.state);win.requestAnimationFrame(()=>{if(owned.get(key)===e)restoreExtras(e,state);});}});
  owned.set(key,e);counts.created++;
  if(isFlow){(node||nativeLayer(doc.getElementById('chat'))).append(frame);try{flow.mount(frame,kind,value);resize?.observe(frame);}catch(error){remove(key,e);failedKinds.add(kind);console.warn('[组件回退]',kind,error);return prepare(floor,kind,node,data);}}
  else{runtime.setDocument(frame,renderHTML(kind,value));(inSlot&&node?node:nativeLayer(doc.getElementById('chat'))).append(frame);}
  return e;
 }
 function refresh(batch){
  if(disposed)return;const next=runtime.key();if(next!==scope){inspections.clear();for(const [key,e]of owned)remove(key,e);for(const n of observed)visibility?.unobserve(n);observed.clear();scope=next;}if(!scope)return;
  const chat=doc.getElementById('chat'),mounted=!batch||batch.full?new Map([...chat?.querySelectorAll('.mes')||[]].map(n=>[Number(n.getAttribute('mesid')),n])):null,floors=new Set(mounted?mounted.keys():batch.floors);
  if(!batch||batch.full)for(const e of owned.values())if(e.leases.size)floors.add(e.floor);
  const leased=new Map();for(const e of owned.values())if(e.leases.size){if(!leased.has(e.floor))leased.set(e.floor,[]);leased.get(e.floor).push(e);}
  for(const floor of floors){
   const mes=mounted?mounted.get(floor):chat?.querySelector('.mes[mesid="'+floor+'"]');if(mes?.querySelector('.edit_textarea,#curEditTextarea'))continue;
   const slots=new Map();for(const node of mes?.querySelectorAll('[data-cxx-slot]')||[]){const kind=normalizeKind(node.getAttribute('data-cxx-slot'));if(!allowed.has(kind)||slots.has(kind))continue;slots.set(kind,node);if(visibility&&!observed.has(node)){observed.add(node);visibility.observe(node);}}
   const active=leased.get(floor)||[];let data=null;
   for(const kind of new Set([...slots.keys(),...active.map(e=>e.kind)])){
    const node=slots.get(kind),old=owned.get(entryKey(floor,context().chat[floor]?.swipe_id||0,kind));
    if(visibility&&node&&!near.has(node)&&!old)continue;
    data??=inspect(floor);if(data)prepare(floor,kind,node,data);
   }
  }
  for(const [key,e]of owned){
   if(!selected(e)){remove(key,e);continue;}
   if(!chat?.contains(e.node)){e.node=null;if(!e.leases.size&&!playing(e))remove(key,e);}
  }
  for(const n of observed)if(!chat?.contains(n)){visibility?.unobserve(n);observed.delete(n);}
  if(chat!==resizeChat){if(resizeChat)resize?.unobserve(resizeChat);resizeChat=chat;if(chat)resize?.observe(chat);}scheduleLayout();
 }
 function loaded(e){return e.ready?Promise.resolve():new Promise((resolve,reject)=>{function cleanup(){win.clearTimeout(timer);e.waits.delete(cancel);e.frame.removeEventListener('load',done);}function cancel(){cleanup();reject(Error('聊天或回复已切换。'));}function done(){cleanup();selected(e)?resolve():reject(Error('聊天或回复已切换。'));}const timer=win.setTimeout(()=>{cleanup();reject(Error('人物状态加载超时，请重试。'));},10000);e.waits.add(cancel);e.frame.addEventListener('load',done);});}
 async function acquire(floor,{kind,onInvalid}={}){
  refresh({full:false,floors:[]});kind=normalizeKind(kind??[...allowed].find(k=>k.startsWith('status')));
  if(!scope||!allowed.has(kind))throw Error('人物状态尚未启用。');
  let data=inspect(floor);if(!data){const job=inspections.get(floor);if(job){const parsed=await job.promise;if(!job.current())throw Error('聊天或回复已切换。');data=inspect(floor,parsed);}}
  const message=doc.querySelector('#chat .mes[mesid="'+floor+'"]');
  const node=message?.querySelector('[data-cxx-slot="'+kind+'"]')||(kind==='status0'?message?.querySelector('[data-cxx-slot="status1"],[data-cxx-slot="status2"]'):null);
  const e=data&&prepare(floor,kind,node,data);if(!e)throw Error('当前回复没有完整的人物状态标签。');
  let released=false;const lease={frame:e.frame,scope,floor,swipe:e.swipe,onInvalid,valid:()=>!released&&owned.get(entryKey(floor,e.swipe,kind))===e&&selected(e),release(){if(released)return;released=true;e.leases.delete(lease);if(owned.get(entryKey(floor,e.swipe,kind))!==e)return;if(!e.leases.size){remember(e);if(!doc.getElementById('chat')?.contains(e.node)&&owned.get(entryKey(floor,e.swipe,kind))===e)remove(entryKey(floor,e.swipe,kind),e);else{if(e.inline)e.node.append(e.frame);e.frame.style.height=e.flow?'':e.height+'px';scheduleLayout();e.frame.contentWindow?.dispatchEvent(new e.frame.contentWindow.Event('resize'));}}}};
  e.leases.add(lease);if(e.inline)nativeLayer(doc.getElementById('chat')).append(e.frame);visible(e,true);try{await loaded(e);update(e);return lease;}catch(error){lease.release();throw error;}
 }
 async function ensure(floor){const lease=await acquire(floor);lease.release();}
 const stop=runtime.watchMessages(refresh);doc.addEventListener('scroll',scrollLayout,true);win.addEventListener('resize',scheduleLayout);
 const bodyObserver=new win.MutationObserver(scheduleLayout);bodyObserver.observe(doc.body,{attributes:true,attributeFilter:['data-cxx-gal-active']});
 const service={refresh,renderHTML,ensure,acquire,read:()=>({scope,frames:owned.size,leases:[...owned.values()].reduce((n,e)=>n+e.leases.size,0),...counts}),destroy(){if(disposed)return;disposed=true;inspections.clear();stop();visibility?.disconnect();resize?.disconnect();bodyObserver.disconnect();win.cancelAnimationFrame(layoutFrame);doc.removeEventListener('scroll',scrollLayout,true);win.removeEventListener('resize',scheduleLayout);for(const [key,e]of owned)remove(key,e);observed.clear();flow?.destroy();layer?.remove();if(win.Cxx236Components===service)delete win.Cxx236Components;}};
 win.Cxx236Components=service;refresh();return service;
});
