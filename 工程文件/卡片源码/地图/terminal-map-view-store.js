// Candidate display preferences only; never share keys with game variables or ledgers.
(()=>{
 'use strict';
 const key='tokyo2051-metropolitan-preview-view-v1',ids=new Set(window.TOKYO_ATLAS_DOCUMENTS.map(m=>m.id));let saved={activeId:'tokyo-central',views:{}};
 try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&ids.has(value.activeId)&&value.views&&typeof value.views==='object'&&!Array.isArray(value.views))saved={activeId:value.activeId,views:value.views};}catch{/* Invalid or unavailable preference storage starts at the default view. */}
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify(saved));}catch{/* Current-session views still work. */}};
 const enabled=()=>document.querySelector('#restore-view')?.checked!==false;
 window.TOKYO_TERMINAL_MAP_STORE={
  mapId:()=>enabled()?saved.activeId:'tokyo-central',
  read:id=>enabled()&&ids.has(id)?saved.views[id]:null,
  select:id=>{if(ids.has(id)){saved.activeId=id;persist();}},
  save:(id,view)=>{if(ids.has(id)&&view?.mapId===id){saved.activeId=id;saved.views[id]=view;persist();}}
 };
 window.addEventListener('pagehide',()=>{const frame=document.querySelector('#metropolitan-atlas');if(frame?.dataset.viewReady!=='true')return;const view=frame.contentWindow.TOKYO_ATLAS_VIEW.read();window.TOKYO_TERMINAL_MAP_STORE.save(view.mapId,view);});
})();
