// Candidate-only bridge: preserve current terminal task and workshop-note entrances.
(()=>{
 'use strict';
 const city=document.querySelector('#page-city');let frame=null,detailObserver=null,removeKeys=null,dispose=false,pendingFocus=null;
 const clear=()=>{detailObserver?.disconnect();removeKeys?.();detailObserver=null;removeKeys=null;frame=null;};
 function focusReady(){
  if(!pendingFocus||frame?.dataset.mapId!==pendingFocus.mapId)return;
  const doc=frame.contentDocument,search=doc.querySelector('#atlas-search');doc.querySelector('#filter-reset').click();search.value=window.TOKYO_TERMINAL_MAP_LINKS.placeName(pendingFocus.mapId,pendingFocus.placeId);search.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
  const button=[...doc.querySelectorAll('#node-list [data-node]')].find(b=>b.dataset.node===pendingFocus.placeId);if(!button)return;button.click();doc.querySelector('#filter-reset').click();pendingFocus=null;
 }
 window.TOKYO_TERMINAL_MAP_CONTROL={
  focus:(mapId,placeId)=>{if(!window.TOKYO_TERMINAL_MAP_LINKS.placeName(mapId,placeId))return false;pendingFocus={mapId,placeId};const select=city.querySelector('.atlas-map-selector select');if(select.value!==mapId){select.value=mapId;select.dispatchEvent(new Event('change',{bubbles:true}));}focusReady();return true;},
  escape:()=>{if(!frame)return false;frame.contentDocument.querySelector('#atlas').dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));return true;}
 };
 function render(){
  const current=frame,doc=current?.contentDocument,view=current?.contentWindow?.TOKYO_ATLAS_VIEW?.read?.();if(!doc||!view)return;
  const body=doc.querySelector('#detail-body');if(!body)return;
  const selected=view.state.selection,old=body.querySelector('[data-terminal-location-links]');
  const content=selected?.kind==='node'?window.TOKYO_TERMINAL_MAP_LINKS.read(view.mapId,selected.id):{quests:[],notes:[]};
  const stamp=JSON.stringify({mapId:view.mapId,selected,content});if(old?.dataset.stamp===stamp)return;
  old?.remove();if(!content.quests.length&&!content.notes.length)return;
  const group=doc.createElement('section');group.dataset.terminalLocationLinks='true';group.dataset.stamp=stamp;
  for(const q of content.quests){const button=doc.createElement('button');button.className='node-button';button.dataset.questId=q.id;button.textContent='任务：'+q.title+' ↗';button.addEventListener('click',()=>window.TOKYO_TERMINAL_MAP_LINKS.openQuest(q.id));group.append(button);}
  for(const note of content.notes){const card=doc.createElement('details'),summary=doc.createElement('summary'),text=doc.createElement('p');card.dataset.noteId=note.id;summary.textContent='玩家投稿资料：'+note.title;text.textContent=note.body;text.style.whiteSpace='pre-wrap';card.append(summary,text);if(note.source?.publisherId){const credit=doc.createElement('p');credit.textContent=(note.source.creditName?'署名：'+note.source.creditName+' · ':'')+'作者编号：'+note.source.publisherId;card.append(credit);}group.append(card);}
  body.append(group);
 }
 function attach(){
  if(dispose)return;const current=city.querySelector('#metropolitan-atlas');if(current===frame)return;clear();if(!current?.contentWindow?.TOKYO_ATLAS_VIEW)return;
  frame=current;const doc=current.contentDocument,body=doc.querySelector('#detail-body');detailObserver=new MutationObserver(render);detailObserver.observe(body,{childList:true,subtree:true});
  let handled=false;const capture=e=>{if(e.key==='Escape')handled=doc.querySelector('#atlas').classList.contains('index-open')||!doc.querySelector('#detail').hidden;};const back=e=>{if(e.key==='Escape'&&!handled&&!e.defaultPrevented){e.preventDefault();window.TOKYO_TERMINAL_MAP_LINKS.closeTerminal();}};
  doc.addEventListener('keydown',capture,true);doc.addEventListener('keydown',back);removeKeys=()=>{doc.removeEventListener('keydown',capture,true);doc.removeEventListener('keydown',back);};focusReady();render();
 }
 const frameObserver=new MutationObserver(attach);frameObserver.observe(city,{childList:true,subtree:true});
 const load=event=>{if(event.target?.id==='metropolitan-atlas')setTimeout(attach,0);};city.addEventListener('load',load,true);window.addEventListener('tokyo-terminal-content-changed',render);
 function pagehide(event){clear();if(event.persisted)return;dispose=true;frameObserver.disconnect();city.removeEventListener('load',load,true);window.removeEventListener('tokyo-terminal-content-changed',render);window.removeEventListener('pagehide',pagehide);window.removeEventListener('pageshow',pageshow);}
 function pageshow(event){if(event.persisted)attach();}
 window.addEventListener('pagehide',pagehide);window.addEventListener('pageshow',pageshow);attach();
})();
