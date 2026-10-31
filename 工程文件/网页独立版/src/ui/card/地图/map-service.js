/* Derived from 卡片源码/地图/map-service.js; source SHA256 01cd3eae2ec1c836dcea047d8138feff1e53974c34d51af956d12eb6950e779b. Rebuild with tools/p3a-adapt-views.mjs. */
/* Chat-owned map tool. Never writes gameplay, location or message state. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports={create:factory};else root.CxxAtlasToolFactory={create:factory};})(globalThis,function(options){
 'use strict';
 const {window:win,api,runtime,maps,content,base,styles}=options;
 const doc=win.document,off=[];let scope='',dialog=null,shell=null,active=null,subscription=null,style=null,stopped=false,pendingFocus=null,viewState={},stamp='',lastData=null,terminalReturn=null;
 const stats={created:0,opened:0,detailUpdates:0,scopeReleases:0};let records=null,motion=null;
 const city=()=>win.CxxCity;
 const css=globalThis.CxxAtlasToolStyle||'';let customDisplay=null;const viewListeners=new Set();
 
 // 唯一读取入口：Cxx236State 内部按「数据库表 → 变量」给出权威状态，这里不再自己扫聊天。
 function readStat(){const live=win.Cxx236State||api.Cxx236State;if(live&&typeof live.stat==='function'){try{const value=live.stat();if(value&&value.terminal)return value;}catch(error){}}return {};}
 function readView(){try{return JSON.parse(win.sessionStorage.getItem('cxx-atlas-view:'+scope)||win.sessionStorage.getItem('cxx-terminal-view:'+scope)||'{}');}catch{return {};}}
 function saveView(){if(!scope)return;try{win.sessionStorage.setItem('cxx-atlas-view:'+scope,JSON.stringify({mapId:viewState.mapId,mapViews:viewState.mapViews}));}catch{}}
 function settings(){let local={};try{local=JSON.parse(win.localStorage.getItem('tokyo2051-terminal-v1')||'{}').prefs||{};}catch{}return {font:Math.max(14,Math.min(22,+local.font||16)),restore:local.restore!==false,motion:win.matchMedia('(prefers-reduced-motion: reduce)').matches?'off':({low:'off',medium:'reduced',high:'full'})[win.Cxx236Preferences?.read().level]||'reduced'};}
 function preferences(){if(!dialog)return;const p=settings();dialog.dataset.motion=p.motion;const inner=dialog.querySelector('#cxx-independent-atlas')?.contentDocument;if(inner){inner.documentElement.dataset.motion=p.motion;inner.documentElement.style.setProperty('--read-size',p.font+'px');if(!inner.getElementById('cxx-atlas-reading')){const style=inner.createElement('style');style.id='cxx-atlas-reading';style.textContent=styles.reading;inner.head.append(style);}}}
 function data(){const sd=readStat(),installed=content?.readHost?.(),signature=JSON.stringify([sd.terminal?.quests,installed?.contentRevision,installed?.subscriptions,content?.chatPins?.()]);if(signature===stamp&&lastData)return lastData;stamp=signature;
  const current=installed?content.view(base,installed.registry,sd.terminal?.quests||{},{subscriptions:installed.subscriptions,pins:content.chatPins(),mediaPreferences:installed.mediaPreferences,initialContent:installed.initialContent,initialAvatars:installed.initialAvatars}):base;
  const state=id=>sd.terminal?.quests?.[id]?.state||'已发布',completed=(current.quests||[]).filter(q=>q.id!=='q_heist'&&state(q.id)==='完成').length;
  const all=[...new Map([...(current.quests||[]),...(win.CxxPlot?.definitions||[]).filter(q=>q.placeId)].map(q=>[q.id,q])).values()];
  return lastData={quests:all.filter(q=>state(q.id)!=='已发布'||((q.id!=='q_heist'||completed>=2)&&!(q.prerequisites||[]).some(id=>state(id)!=='完成'))).map(q=>({...q,status:state(q.id)})),notes:current.workshopNotes||[]};
 }
 function place(mapId,id){return mapId==='tokyo-central'&&city()?.place(readStat(),id)||base.locationMaps.find(m=>m.id===mapId)?.places.find(p=>p.id===id);}
 function visible(id){return !city()||city().known(readStat(),id);}
 function openRecords(page='police'){refreshScope();if(!scope)throw Error('当前聊天尚未就绪。');records||=win.CxxCivicUI.create({window:win,read:readStat,scope:()=>runtime.key(),focus:(mapId,placeId)=>open({mapId,placeId})});records.open(page);}
 function render(view,body){if(!body)return;const old=body.querySelector('[data-terminal-location-links]');if(view?.state?.selection?.kind!=='node'){old?.remove();return;}const id=view.state.selection.id,record=place(view.mapId,id),current=data(),quests=current.quests.filter(q=>q.placeId===id&&(q.mapId||'tokyo-central')===view.mapId),notes=current.notes.filter(n=>n.placeId===id&&n.mapId===view.mapId),actions=view.mapId==='tokyo-central'?city()?.actions(readStat(),id)||[]:[],next=JSON.stringify([id,record,actions,quests.map(q=>[q.id,q.title,q.status]),notes]);if(old?.dataset.stamp===next)return;old?.remove();stats.detailUpdates++;
  const d=body.ownerDocument,group=d.createElement('section');group.dataset.terminalLocationLinks='true';group.dataset.stamp=next;
  if(record?.desc&&!body.textContent.includes(record.desc)){const h=d.createElement('h2'),p=d.createElement('p');h.textContent='地点档案';p.textContent=record.desc;p.style.whiteSpace='pre-wrap';group.append(h,p);}
  if(actions.length){const h=d.createElement('h2'),status=d.createElement('p');h.textContent='此处行动';status.textContent=({open:'营业／可访问',closed:'已停业',destroyed:'已损毁'}[record.status||record.defaultStatus]||'')+(record.owner?' · '+record.owner:'');group.append(h,status);for(const a of actions){const b=d.createElement('button');b.className='node-button';b.textContent=a.label+' ↗';b.onclick=()=>{try{win.CxxWebPlayer.draft(a.draft);close();win.Cxx233Terminal?.close();}catch(e){status.textContent=e.message;}};group.append(b);}const hint=d.createElement('p');hint.textContent='加入聊天草稿后可自由修改。';group.append(hint);}
  for(const q of quests){const b=d.createElement('button');b.className='node-button';b.textContent='任务：'+q.title+' · '+q.status+' ↗';b.onclick=()=>openQuest(q.id);group.append(b);}
  for(const note of notes){const details=d.createElement('details'),summary=d.createElement('summary'),p=d.createElement('p');summary.textContent='玩家投稿资料：'+note.title;p.textContent=note.body;p.style.whiteSpace='pre-wrap';details.append(summary,p);if(note.source?.publisherId){const credit=d.createElement('small');credit.textContent=[note.source.creditName,'作者编号：'+note.source.publisherId].filter(Boolean).join(' · ');details.append(credit);}group.append(details);}body.append(group);
 }
 function close(){customDisplay?.close();if(!dialog)return;shell?.setVisible(false);if(dialog.open)dialog.close();saveView();}
 function returnToTerminal(){const restore=terminalReturn;terminalReturn=null;close();if(scope&&runtime.key()===scope)try{restore?.();}catch(e){win.toastr?.warning(e.message,'终端');}}
 function release(){terminalReturn=null;records?.destroy();records=null;close();subscription?.();subscription=null;active=null;shell?.destroy();shell=null;motion?.dispose();motion=null;dialog?.remove();dialog=null;pendingFocus=null;stamp='';lastData=null;}
 function refreshScope(){if(stopped)return;const next=runtime.key();if(scope!==next){if(scope)stats.scopeReleases++;release();scope=next;viewState=readView();viewState.mapViews||={};}}
 // One bar (DESIGN.md 10.14): title, the shell's region tabs and status, city records, back to the terminal.
 function ensure(){if(dialog)return;maps.install(win);dialog=doc.createElement('dialog');dialog.className='cxx-atlas-tool';dialog.setAttribute('aria-label','东京都城市地图');const header=doc.createElement('header'),title=doc.createElement('div'),strong=doc.createElement('strong'),small=doc.createElement('small'),controls=doc.createElement('div'),exit=doc.createElement('button'),main=doc.createElement('main');header.className='atlas-tool-bar';title.className='atlas-tool-title';controls.className='atlas-tool-controls';strong.textContent='城市地图';small.textContent='CITY LINK / TOKYO 2051';title.append(small,strong);exit.type='button';exit.textContent='返回终端';exit.onclick=returnToTerminal;const recordsButton=doc.createElement('button');recordsButton.type='button';recordsButton.textContent='城市记录';recordsButton.onclick=()=>openRecords('police');header.append(title,controls,recordsButton,exit);dialog.append(header,main);doc.body.append(dialog);motion=globalThis.CxxMotion?.mount(dialog);dialog.addEventListener('cancel',e=>{e.preventDefault();if(!active?.escape())returnToTerminal();});dialog.addEventListener('keydown',e=>shell?.regionKey(e));
  shell=win.TOKYO_ATLAS_SHELL.mount(main,maps.documents,{frameId:'cxx-independent-atlas',controls,initialMapId:viewState.mapId,visible:false,savedView:id=>viewState.mapViews[id],restoreView:()=>settings().restore,onViewSaved(id,view){viewState.mapViews[id]=view;saveView();},onMapChange(id){viewState.mapId=id;saveView();},onRelease(){subscription?.();subscription=null;active=null;},onReady(value){active=value;preferences();mountHud();subscription=value.subscribe(render);if(pendingFocus){const p=pendingFocus;pendingFocus=null;value.focus(p.placeId);}},onEscape:returnToTerminal});stats.created++;
 }
 // Map document layer added after each load (DESIGN.md 10.14): the index rail, the tracked
 // commission, the key hints and, on phones, the scrim behind the index drawer.
 function mountHud(){
  const d=dialog?.querySelector('#cxx-independent-atlas')?.contentDocument,root=d?.getElementById('atlas');if(!root||root.querySelector('.hud-rail'))return;
  const n=(tag,className,parent,text)=>{const node=d.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;parent.append(node);return node;};
  const rail=n('nav','hud-rail',root);rail.setAttribute('aria-label','地图索引');
  const parts=[['索引','⌕','atlas-search'],['筛选','⚑','filter-panel'],['地点','◈','node-list'],['轨道','⇄','tram-panel']];
  for(const [label,icon,id] of parts){const b=n('button','',rail);b.type='button';b.dataset.part=label;b.setAttribute('aria-pressed','false');n('span','',b,icon).setAttribute('aria-hidden','true');b.append(label);b.onclick=()=>openPart(label,d.getElementById(id));}
  function openPart(label,target){
   const open=root.classList.contains('index-open');
   if(open&&rail.dataset.active===label){d.getElementById('index-close').click();return;}
   if(!open)d.getElementById('index-toggle').click();
   rail.dataset.active=label;for(const b of rail.children)b.setAttribute('aria-pressed',String(b.dataset.part===label));
   if(target?.tagName==='DETAILS')target.open=true;
   if(target&&label!=='索引')target.scrollIntoView({block:'start'});
  }
  // The rail follows the index however it closes (its own ×, Escape, a chosen place).
  new d.defaultView.MutationObserver(()=>{if(root.classList.contains('index-open'))return;rail.dataset.active='';for(const b of rail.children)b.setAttribute('aria-pressed','false');}).observe(root,{attributes:true,attributeFilter:['class']});
  const track=n('aside','hud-track',root);track.setAttribute('aria-label','追踪目标');n('p','hud-label',track,'追踪目标');n('h2','',track);n('p','hud-goal',track);n('small','hud-meta',track);
  const locate=n('button','hud-locate',track,'定位任务地点');locate.type='button';locate.onclick=()=>{const q=tracked();if(q?.placeId)open({mapId:q.mapId||'tokyo-central',placeId:q.placeId});};
  const hint=n('p','hud-hint',root);hint.setAttribute('aria-hidden','true');
  for(const [key,text] of [['拖动','平移'],['滚轮','缩放'],['双击','居中'],['Q / E','切换区域'],['Esc','返回']]){const item=n('span','',hint);n('kbd','',item,key);item.append(text);}
  const scrim=n('div','hud-scrim',root);scrim.onclick=()=>d.getElementById('index-close').click();
  updateHud();
 }
 function tracked(){const id=readStat().terminal?.questJournal?.tracked;return id?data().quests.find(q=>q.id===id):null;}
 function updateHud(){
  const track=dialog?.querySelector('#cxx-independent-atlas')?.contentDocument?.querySelector('.hud-track');if(!track)return;
  const q=tracked(),record=q?readStat().terminal?.quests?.[q.id]||{}:{},mapId=q?.mapId||'tokyo-central',spot=q?.placeId&&visible(q.placeId)?place(mapId,q.placeId):null,pay=Number(record.agreedYen??q?.pay);
  track.hidden=!q;if(!q)return;
  track.querySelector('h2').textContent=q.title;track.querySelector('.hud-goal').textContent=record.objective||q.goal||'查看委托中的当前目标。';
  track.querySelector('.hud-meta').textContent=[q.fixer,spot?.name||q.district,Number.isFinite(pay)&&pay>0?'¥ '+pay.toLocaleString('en-US'):''].filter(Boolean).join(' · ');
  track.querySelector('.hud-locate').hidden=!spot;
 }
 function open(options={}){refreshScope();if(customDisplay){terminalReturn=win.Cxx233Terminal?.captureReturn?.()||(()=>win.Cxx233Terminal?.openPage('city'));win.Cxx233Terminal?.close();return customDisplay.open(options);}if(!scope)throw Error('当前聊天尚未就绪。');if(options.placeId&&(!place(options.mapId||'tokyo-central',options.placeId)||!visible(options.placeId)))return false;ensure();if(options.placeId)pendingFocus=options;
  if(!dialog.open){terminalReturn=win.Cxx233Terminal?.captureReturn?.()||(()=>win.Cxx233Terminal?.openPage('city'));win.Cxx233Terminal?.close();dialog.showModal();void motion?.presence(dialog,true,{distance:8});}preferences();if(options.mapId)shell.switchMap(options.mapId);shell.setVisible(true);if(pendingFocus&&active?.read()?.mapId===(options.mapId||'tokyo-central')){const p=pendingFocus;pendingFocus=null;active.focus(p.placeId);}stats.opened++;return true;
 }
 async function openQuest(id){const expected=scope;if(!data().quests.some(q=>q.id===id))return;terminalReturn=null;close();const terminal=win.Cxx233Terminal;if(!terminal){win.toastr?.warning('终端尚未就绪，请稍后再试。');return;}terminal.openPage('operations');const until=Date.now()+5000;while(!stopped&&runtime.key()===expected&&Date.now()<until){const links=terminal.frame?.contentWindow?.TOKYO_TERMINAL_MAP_LINKS;if(links){links.openQuest(id);return;}await new Promise(resolve=>win.setTimeout(resolve,40));}}
 function relevant(){refreshScope();records?.refresh();for(const fn of viewListeners)fn();if(dialog?.open&&active){active.refresh?.();render(active.read(),dialog.querySelector('#cxx-independent-atlas')?.contentDocument?.getElementById('detail-body'));updateHud();}}
 function event(name,fn){if(!name)return;api.eventOn(name,fn);off.push(()=>api.eventRemoveListener(name,fn));}
 function start(){style=doc.createElement('style');style.textContent=css+styles.shell;doc.head.append(style);
  const events={};event(events.CHAT_CHANGED,refreshScope);for(const key of ['GENERATION_ENDED','MESSAGE_SWIPED','MESSAGE_DELETED'])event(events[key],()=>{refreshScope();relevant();});if(api.getButtonEvent)event(api.getButtonEvent('城市地图'),()=>open());
  for(const [name,fn]of [['cxx-content-changed',relevant],['cxx-ui-preferences-changed',preferences]]){win.addEventListener(name,fn);off.push(()=>win.removeEventListener(name,fn));}
  const launch=()=>{try{open();}catch(e){win.toastr?.warning(e.message,'地图');}};doc.addEventListener('cxx:open-native-map',launch);off.push(()=>doc.removeEventListener('cxx:open-native-map',launch));refreshScope();return service;
 }
 function destroy(){if(stopped)return;stopped=true;off.splice(0).forEach(fn=>fn());release();customDisplay?.destroy();customDisplay=null;viewListeners.clear();style?.remove();}
 const service={start,open,openRecords,visible,close,returnToTerminal,renderDetail:render,subscribe(fn){viewListeners.add(fn);return()=>viewListeners.delete(fn);},setDisplay(value){customDisplay?.destroy();customDisplay=value;return()=>{if(customDisplay===value){customDisplay.destroy();customDisplay=null;}};},location:place,focus:(mapId,placeId)=>open({mapId,placeId}),refresh:relevant,preferences,destroy,read:()=>({scope,visible:Boolean(dialog?.open||customDisplay?.isVisible()),...stats,shell:shell?.read()}),get frame(){return dialog?.querySelector('#cxx-independent-atlas');}};return service;
});
