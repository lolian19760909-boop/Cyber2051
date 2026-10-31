(()=>{
 'use strict';
 const base=window.TOKYO_ATLAS,packets=window.TOKYO_ATLAS_PACKETS;
 const definitions=base.sectorDefinitions,ids=new Set(definitions.map(s=>s.id));
 const places=[...base.nodes,...base.services,...base.districtExpansion.places,...base.terrainContext.places];
 const oldSector=Object.fromEntries(definitions.flatMap(s=>s.members.map(id=>[id,s.id])));
 const packetCache=new Map();let parses=0;
 function packet(id){const key=(base.mapVersion||"central")+":"+(id||"overview");if(packetCache.has(key)){const v=packetCache.get(key);packetCache.delete(key);packetCache.set(key,v);return v;}const v=JSON.parse(packets[id||"overview"]);v.centralNight=JSON.parse(base.sectorNightEdges[id==="central-core"?"core":"outer"]);parses++;packetCache.set(key,v);while(packetCache.size>2)packetCache.delete(packetCache.keys().next().value);return v;}
 let active,sceneView,views={},switchCount=0,released=0,lastLoadMs=0,opening=false;
 function targetSector(target){
  if(target.kind==='node')return places.find(p=>p.id===target.id)?.sectorId;
  if(target.kind==='subdistrict')return base.districtExpansion.districts.find(d=>d.id===target.id)?.sectorId;
  if(target.kind==='region')return ids.has(target.id)?target.id:oldSector[target.id];
 }
 const snapshot=()=>({...sceneView.read(),sectorId:active,sectorViews:structuredClone(views)});
 function expose(){
  window.TOKYO_ATLAS_VIEW={read:snapshot,restore:saved=>{
   if(saved.mapId&&saved.mapId!==base.mapId)return;
   const selection=saved.state?.selection;
   const id=Object.hasOwn(saved,'sectorId')?(ids.has(saved.sectorId)?saved.sectorId:null):targetSector(selection||{kind:'region',id:saved.state?.region})??null;
   if(saved.sectorViews&&typeof saved.sectorViews==='object')views=Object.fromEntries(Object.entries(saved.sectorViews).filter(([k])=>ids.has(k)||k==='overview'));
   open(id,{saved});
  }};
 }
 function open(id,{target,saved}={}){
  if(id!==null&&!ids.has(id))return;
  if(active===id&&sceneView){if(saved)sceneView.restore(saved);else if(target)window.TOKYO_ATLAS_NAV[{region:'focusRegion',node:'focusNode',subdistrict:'focusSubdistrict'}[target.kind]](target.id);return;}
  const start=performance.now(),previous=sceneView?.read();
  if(sceneView){views[active||'overview']=previous;window.TOKYO_ATLAS_UNMOUNT();released++;}
  active=id;opening=true;
  const scene=packet(id);
  window.TOKYO_ATLAS={...base,...scene,
   cityDetail:{...base.cityDetail,...scene.cityDetail},districtExpansion:{...base.districtExpansion,...scene.districtExpansion},terrainContext:{...base.terrainContext,...scene.terrainContext},
   sectorView:{id,definitions:base.sectorDefinitions,oldSector:base.sectorRouting},centralNight:scene.centralNight};
  window.TOKYO_ATLAS_MOUNT();sceneView=window.TOKYO_ATLAS_VIEW;switchCount++;
  const remembered=saved||views[id||'overview'];
  if(remembered)sceneView.restore(saved?remembered:{...remembered,state:{...remembered.state,names:previous?.state.names??false}});
  else{
   if(previous){const initial=sceneView.read();initial.camera=previous.camera;initial.state.type=previous.state.type;initial.state.poi=previous.state.poi;initial.state.names=previous.state.names;initial.state.tram=previous.state.tram;initial.query=previous.query;sceneView.restore(initial);}
   if(id===null)window.TOKYO_ATLAS_NAV.fit();else window.TOKYO_ATLAS_NAV.focusRegion(id);
  }
  opening=false;
  // Returning via the sector button restores its previous camera; search targets still focus.
  if(target&&(!remembered||target.kind!=='region'||target.id!==id))window.TOKYO_ATLAS_NAV[{region:'focusRegion',node:'focusNode',subdistrict:'focusSubdistrict'}[target.kind]](target.id);
  expose();lastLoadMs=performance.now()-start;window.dispatchEvent(new CustomEvent("atlas-scene-ready"));
 }
 window.TOKYO_ATLAS_SECTORS={open,navigate:target=>{if(opening)return false;const next=targetSector(target);if(next===undefined||next===active)return false;open(next,{target});return true;},read:()=>({active,switchCount,released,lastLoadMs,parses,cachedPackets:packetCache.size,liveScenes:sceneView?1:0,loaded:window.TOKYO_ATLAS_DEBUG?.snapshot(),savedSectors:Object.keys(views)})};
 open('central-core');
})();
