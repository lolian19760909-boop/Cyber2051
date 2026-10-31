(()=>{
 const atlasDocument=/*ATLAS_DOCUMENT*/;
 const city=document.querySelector('#page-city'),terminal=document.querySelector('#terminal');
 if(Array.isArray(window.TOKYO_ATLAS_DOCUMENTS)&&window.TOKYO_ATLAS_DOCUMENTS.length&&window.TOKYO_ATLAS_SHELL){
  const shell=window.TOKYO_ATLAS_SHELL.mount(city,window.TOKYO_ATLAS_DOCUMENTS,{frameId:'metropolitan-atlas',initialMapId:window.TOKYO_TERMINAL_MAP_STORE?.mapId(),savedView:id=>window.TOKYO_TERMINAL_MAP_STORE?.read(id),onViewSaved:(id,view)=>window.TOKYO_TERMINAL_MAP_STORE?.save(id,view),onMapChange:id=>window.TOKYO_TERMINAL_MAP_STORE?.select(id),visible:!city.hidden&&!terminal.hidden,restoreView:()=>document.querySelector('#restore-view')?.checked!==false});
  let suspended=false,disposed=false;
  const sync=()=>{if(suspended||disposed)return;shell.setVisible(!city.hidden&&!terminal.hidden);shell.syncMotion();},observer=new MutationObserver(sync);
  const observe=()=>{observer.observe(city,{attributes:true,attributeFilter:['hidden']});observer.observe(terminal,{attributes:true,attributeFilter:['hidden']});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});};
  function pagehide(event){
   observer.disconnect();
   if(event.persisted){suspended=true;shell.setVisible(false);return;}
   disposed=true;shell.destroy();window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);
  }
  function pageshow(event){if(!event.persisted||!suspended||disposed)return;suspended=false;observe();sync();}
  observe();window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);return;
 }
 const mapId='tokyo-central',savedViews=new Map();
 let frame=null,readyFrame=null,disposed=false,suspended=false;
 function syncMotion(current=frame){if(current!==frame||disposed)return;if(current?.contentDocument?.documentElement)current.contentDocument.documentElement.dataset.motion=document.documentElement.dataset.motion||'full';}
 function release(remember){
   const current=frame;if(!current)return;const ready=current===readyFrame;frame=null;readyFrame=null;
   if(remember&&ready){try{const view=current.contentWindow?.TOKYO_ATLAS_VIEW?.read?.();if(view&&(view.mapId===undefined||view.mapId===mapId))savedViews.set(mapId,view);}catch{/* An unloaded child has no view to preserve. */}}
   current.remove();
 }
 function sync(){
   if(disposed||suspended)return;
   if(city.hidden||terminal.hidden){try{frame?.contentWindow?.CxxMapActivity?.pause(true);}catch{}return;}
   try{frame?.contentWindow?.CxxMapActivity?.pause(false);}catch{}
   if(!frame){
     const current=document.createElement('iframe');frame=current;current.id='metropolitan-atlas';current.title='东京都全域地图';
     current.addEventListener('load',()=>{
       if(disposed||frame!==current||city.hidden||terminal.hidden)return;
       syncMotion(current);const saved=savedViews.get(mapId);
       if(saved&&document.querySelector('#restore-view')?.checked){try{current.contentWindow?.TOKYO_ATLAS_VIEW?.restore?.(saved);}catch{/* A replaced child keeps its own default view. */}}
       readyFrame=current;
     },{once:true});current.srcdoc=window.CXX_MAP_DOCUMENT_PREPARE?window.CXX_MAP_DOCUMENT_PREPARE(atlasDocument):atlasDocument;city.append(current);
   }
   syncMotion();
 }
 const observer=new MutationObserver(sync);
 const observe=()=>{observer.observe(city,{attributes:true,attributeFilter:['hidden']});observer.observe(terminal,{attributes:true,attributeFilter:['hidden']});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});};
 function pagehide(event){
  observer.disconnect();
  if(event.persisted){suspended=true;release(true);return;}
  disposed=true;release(false);savedViews.clear();window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);
 }
 function pageshow(event){if(!event.persisted||!suspended||disposed)return;suspended=false;observe();sync();}
 observe();window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);
 sync();
})();
