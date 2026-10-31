(()=>{
 'use strict';
 const instances=new WeakMap();
 function mount(container,documents,options={}){
  instances.get(container)?.destroy();
  const ids=new Set(),maps=documents.filter(d=>d&&typeof d.id==='string'&&typeof d.name==='string'&&(typeof d.html==='string'||typeof d.resource==='string')&&!ids.has(d.id)&&(ids.add(d.id),true));
  if(!maps.length)throw new Error('地图目录为空');
  const shell=document.createElement('section'),bar=document.createElement('header'),tabs=document.createElement('nav'),status=document.createElement('span'),stage=document.createElement('div');
  shell.className='atlas-map-shell';bar.className='atlas-map-selector';tabs.className='atlas-map-regions';tabs.setAttribute('aria-label','地图区域');status.className='atlas-map-load-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');stage.className='atlas-map-stage';
  // Region tabs (DESIGN.md 10.14): the "大区" half of a map name is the tab, the rest its note.
  maps.forEach(m=>{const parts=m.name.split(' · '),main=parts.find(p=>p.includes('大区'))||parts[0],note=parts.filter(p=>p!==main).join(' · '),tab=document.createElement('button');tab.type='button';tab.dataset.mapId=m.id;tab.setAttribute('aria-label',m.name);tab.append(main);if(note){const small=document.createElement('small');small.textContent=note;tab.append(small);}tab.onclick=()=>switchMap(m.id);tabs.append(tab);});
  bar.append(tabs,status);if(options.controls)options.controls.append(bar);else shell.append(bar);shell.append(stage);container.append(shell);
  const motion=globalThis.CxxMotion?.mount(shell);let retired=null;
  function clearRetired(){const old=retired;if(!old)return;retired=null;old.session?.abort();try{old.frame.contentWindow?.TOKYO_ATLAS_API?.destroy();}catch{}old.frame.__cxxAtlasRead=null;old.frame.__cxxMotion=null;old.frame.remove();}
  const loading=document.createElement('div');loading.className='atlas-map-loading';loading.hidden=true;stage.append(loading);let boot=null,backdrop=null;
  // Wide screens show an ASCII city flight behind the loading log; phones and reduced motion do not animate it.
  function startBackdrop(){backdrop?.stop();backdrop=null;const host=loading.querySelector('.cxx-boot-log-frame');if(!host||!window.CxxAsciiBackdrop||window.innerWidth<=700)return;host.dataset.ascii='true';backdrop=window.CxxAsciiBackdrop.mount(host,{piece:'wireframe-city',still:window.matchMedia('(prefers-reduced-motion: reduce)').matches||window.Cxx236Preferences?.read?.().level==='low'});}
  const savedViews=new Map();let activeId=maps.some(m=>m.id===options.initialMapId)?options.initialMapId:maps[0].id,frame=null,readyFrame=null,visible=options.visible!==false,disposed=false,visibilitySet=false,renderListener=null,resourceSession=null;
  function stopWaiting(){if(boot){const finished=boot,art=backdrop;boot=null;backdrop=null;finished.read().stages.forEach((_,i)=>finished.stage(i,'done'));finished.log('map','prepare',activeId,'已就绪');void finished.done().then(()=>{art?.stop();if(!boot)loading.hidden=true;});}else loading.hidden=true;stage.setAttribute('aria-busy','false');}
  function failed(current,message){if(disposed||frame!==current)return;if(!boot){loading.hidden=false;boot=window.CxxBootLoader.mount({doc:document,parent:loading,title:'正在载入城市地图',stages:['准备地图']});boot.stage(0,'now');}const index=boot.read().stages.findIndex(s=>s.state==='now');boot.log('map','load',activeId,message||'组件未就绪','bad');boot.fail(Math.max(0,index),{title:'地图载入失败',message:message||'地图组件没有就绪，请重新载入。',onRetry:retryLoad,onBack:()=>options.onEscape?.()});status.textContent='等待重试';stage.setAttribute('aria-busy','false');}
  function renderStatus(current,value){if(disposed||frame!==current)return;const phase=value?.phase||'ready';if(phase==='failed'){failed(current,value.error);return;}if(phase==='ready'||phase==='fallback'||value?.usable){stopWaiting();if(!current.dataset.revealed){current.dataset.revealed='true';void motion?.animate(current,[{opacity:.2},{opacity:1}],{channel:'map-entry',duration:220});}status.textContent=phase==='fallback'?'兼容绘制 / Canvas':'已载入';status.dataset.renderer=phase==='fallback'?'canvas2d':'webgl2';return;}if(boot){if(boot.read().stages.length===3){boot.stage(0,'done');boot.stage(1,phase==='uploading'?'done':'now');if(phase==='uploading')boot.stage(2,'now');}else boot.stage(0,'now');boot.log('map',phase==='uploading'?'upload':'decode',activeId,phase==='uploading'?'正在绘制':'正在读取');}stage.setAttribute('aria-busy','true');status.textContent=phase==='uploading'?'绘制场景':'解码城区';}
  function downloadStatus(current,value){if(disposed||frame!==current||!visible||!boot)return;const index=Math.min(readyFrame===current?1:0,boot.read().stages.length-1);boot.count(index,value.loaded,value.total,(value.loaded/1048576).toFixed(1)+' / '+(value.total/1048576).toFixed(1)+' MiB');status.textContent='接收城市档案';stage.setAttribute('aria-busy','true');}
  const markTabs=()=>{for(const tab of tabs.children)tab.setAttribute('aria-pressed',String(tab.dataset.mapId===activeId));};markTabs();
  function syncMotion(){try{if(frame?.contentDocument?.documentElement)frame.contentDocument.documentElement.dataset.motion=document.getElementById('t2051x-root')?.dataset.motion||document.documentElement.dataset.motion||'full';}catch{/* A child being replaced has no accessible root. */}}
  function rememberView(){if(frame!==readyFrame||!frame)return;try{const view=frame.contentWindow?.TOKYO_ATLAS_VIEW?.read?.();if(view&&(view.mapId===activeId||view.mapId===undefined&&activeId==='tokyo-central')){savedViews.set(activeId,view);options.onViewSaved?.(activeId,view);}}catch{/* An unloaded frame has no view to preserve. */}}
  function release(remember=true,transition=false){
   clearRetired();const fade=transition&&motion?.available&&frame&&frame===readyFrame;const oldSession=resourceSession;
   backdrop?.stop();backdrop=null;boot?.destroy();boot=null;loading.hidden=true;stage.setAttribute('aria-busy','false');if(!fade)resourceSession?.abort();resourceSession=null;const current=frame;if(!current)return;if(remember)rememberView();frame=null;readyFrame=null;
   options.onRelease?.();try{if(renderListener)current.contentWindow.removeEventListener('atlas-render-status',renderListener);renderListener=null;if(fade)current.contentWindow?.TOKYO_ATLAS_API?.pause(true);else current.contentWindow?.TOKYO_ATLAS_API?.destroy();}catch{}if(fade){current.removeAttribute('id');current.inert=true;current.style.cssText='position:absolute;inset:0;pointer-events:none';retired={frame:current,session:oldSession};void motion.animate(current,[{opacity:1},{opacity:0}],{channel:'map-exit',duration:140}).then(()=>{if(retired?.frame===current)clearRetired();});}else{current.__cxxAtlasRead=null;current.__cxxMotion=null;current.remove();}
  }
  function load(){
   if(disposed||!visible||frame)return;
   const record=maps.find(m=>m.id===activeId),current=document.createElement('iframe');frame=current;current.id=options.frameId||'atlas-map-document';current.title=record.name;current.dataset.mapId=record.id;current.__cxxMotion=globalThis.CxxMotion;current.setAttribute('allow','fullscreen');status.textContent='载入中';shell.dataset.mapId=record.id;
   loading.hidden=false;void motion?.animate(loading,[{opacity:0},{opacity:1}],{channel:'loader',duration:160});boot=window.CxxBootLoader.mount({doc:document,parent:loading,title:'正在载入城市地图',stages:['载入地图组件','读取地图资料','准备地图']});boot.stage(0,'now');startBackdrop();stage.setAttribute('aria-busy','true');
   current.addEventListener('load',()=>{
    if(disposed||frame!==current||activeId!==record.id)return;
    try{if(typeof current.contentWindow?.TOKYO_ATLAS_VIEW?.read!=='function'){failed(current);return;}}catch{failed(current);return;}
    boot.stage(0,'done');boot.log('map','load',record.name,'组件已载入');boot.stage(1,'now');
    renderListener=event=>renderStatus(current,event.detail);current.contentWindow.addEventListener('atlas-render-status',renderListener);
    clearRetired();syncMotion();const saved=savedViews.get(record.id)||options.savedView?.(record.id);
    if(saved&&options.restoreView?.()!==false)try{current.contentWindow?.TOKYO_ATLAS_VIEW?.restore?.(saved);}catch{/* The map will retain its own validated default view. */}
    readyFrame=current;current.dataset.viewReady='true';options.onReady?.(current.contentWindow.TOKYO_ATLAS_API);const inner=current.contentDocument;inner.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();options.onEscape?.();}else regionKey(event);});current.contentWindow?.TOKYO_ATLAS_API?.pause(!visible);status.textContent='已载入';if(refocus){refocus=false;inner.getElementById('map')?.focus({preventScroll:true});}
    renderStatus(current,current.contentWindow.CxxAtlasGPU?.read());
   },{once:true});
   current.addEventListener('error',()=>failed(current),{once:true});
   const attach=html=>{if(disposed||!visible||frame!==current)return;const prepared=window.CXX_MAP_DOCUMENT_PREPARE?window.CXX_MAP_DOCUMENT_PREPARE(html):html;current.srcdoc=prepared.replace('<head>','<head><script>window.CxxMotion=frameElement.__cxxMotion;</script>');stage.append(current);};
   if(record.resource){
    try{const session=window.CXX_ATLAS_RESOURCES.open(value=>downloadStatus(current,value));resourceSession=session;current.__cxxAtlasRead=ref=>session.read(ref);
     session.document(record.id).then(html=>attach(html.replace('<head>','<head><script>window.CXX_ATLAS_RESOURCE_READ=ref=>frameElement.__cxxAtlasRead(ref);</script>'))).catch(e=>{if(e.name!=='AbortError')failed(current,e.message);});
    }catch(e){failed(current,e.message);}
   }else attach(record.html);
  }
  function switchMap(id){if(disposed||id===activeId||!maps.some(m=>m.id===id))return;release(true,true);activeId=id;markTabs();options.onMapChange?.(id);load();}
  function cycle(step){const index=maps.findIndex(m=>m.id===activeId);switchMap(maps[(index+step+maps.length)%maps.length].id);}
  // Q and E step through the regions unless the key is being typed into a field.
  // The old map document goes away on a switch, so a key switch hands focus to the new map once ready.
  let refocus=false;
  function regionKey(event){const target=event.target,key=event.key?.toLowerCase();if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||(key!=='q'&&key!=='e')||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName||'')||target?.isContentEditable)return false;event.preventDefault();refocus=true;cycle(key==='q'?-1:1);return true;}
  function retryLoad(){if(disposed||!visible)return;release();load();}
  function setVisible(value){if(disposed)return;const next=Boolean(value);if(visibilitySet&&next===visible)return;visibilitySet=true;visible=next;shell.hidden=!visible;if(!visible){motion?.finish();clearRetired();}if(visible)load();else{rememberView();const render=frame?.contentWindow?.CxxAtlasGPU?.read();if(frame!==readyFrame||!render?.usable&&!['ready','fallback'].includes(render?.phase))release();}try{frame?.contentWindow?.TOKYO_ATLAS_API?.pause(!visible);}catch{}if(visible&&readyFrame)renderStatus(frame,frame.contentWindow.CxxAtlasGPU?.read());else status.textContent=visible?'载入中':'已收起';}
  function destroy(){if(disposed)return;disposed=true;motion?.dispose();clearRetired();backdrop?.stop();backdrop=null;const bootClosing=boot?.destroy();boot=null;release();savedViews.clear();bar.remove();shell.hidden=true;if(bootClosing)bootClosing.then(()=>shell.remove());else shell.remove();if(instances.get(container)===api)instances.delete(container);}
  const api={switchMap,cycle,regionKey,setVisible,syncMotion,destroy,read:()=>({mapId:activeId,loaded:Boolean(frame),retiring:Boolean(retired),motion:motion?.diagnostics(),savedMapIds:[...savedViews.keys()]})};instances.set(container,api);setVisible(visible);return api;
 }
 window.TOKYO_ATLAS_SHELL=Object.freeze({mount});
})();
