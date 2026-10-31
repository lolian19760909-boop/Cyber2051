(()=>{
 'use strict';
 const CENTRAL_MAP='tokyo-central',modes=new Set(['auto','flat','depth']);
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v:{};
 const list=v=>Array.isArray(v)?v:[];
 const text=(v,fallback,max)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):fallback;
 const number=(v,min,max,fallback)=>Number.isFinite(v)&&v>=min&&v<=max?v:fallback;
 const identity=data=>({mapId:data.mapId||CENTRAL_MAP,mapVersion:data.mapVersion??null});
 const viewport=value=>{const v=object(value);return Number.isFinite(v.width)&&v.width>0&&Number.isFinite(v.height)&&v.height>0?{width:v.width,height:v.height}:null;};

 // Only transient UI fields leave this boundary; no story variables or host storage.
 function normalize(saved,data,defaults={}){
  const meta=identity(data),world=data.world,minX=world.minX??0,minY=world.minY??0;
  const limits={x:[minX+100,minX+world.width-100],y:[minY+100,minY+world.height-100]};
  const regions=new Map(list(data.regions).map(r=>[r.id,r]));
  const places=new Map([...list(data.nodes),...list(data.services),...list(data.districtExpansion?.places),...list(data.terrainContext?.places)].map(n=>[n.id,n]));
  const districts=new Map(list(data.districtExpansion?.districts).map(d=>[d.id,d]));
  const routes=new Map([...list(data.cityDetail?.tram?.routes),...list(data.railNetwork?.routes)].map(r=>[r.id,r]));
  const stops=new Map([...list(data.cityDetail?.tram?.stops),...list(data.railNetwork?.stops)].map(s=>[s.id,s]));
  const types=new Set(['all','legacy',...list(data.serviceTypes).map(t=>t.id)]);
  const empty={camera:{x:minX+world.width/2,y:minY+world.height/2,z:.35,mode:'auto'},state:{region:null,node:null,poi:true,names:false,selection:null,type:'all',tram:true,route:null,filterRegion:null},query:'',viewName:'都市全域'};
  function selection(value){
   const s=object(value);
   if(s.kind==='cluster'){
    const ids=[...new Set(list(s.ids).slice(0,places.size).filter(id=>places.has(id)))];
    return ids.length?{kind:'cluster',ids}:null;
   }
   const catalog={region:regions,node:places,subdistrict:districts,'tram-route':routes,'tram-stop':stops}[s.kind];
   return catalog instanceof Map&&catalog.has(s.id)?{kind:s.kind,id:s.id}:null;
  }
  function clean(input,fallback){
   const v=object(input),c=object(v.camera),s=object(v.state),f=fallback.state,size=viewport(v.viewport)||viewport(fallback.viewport);
   const state={region:regions.has(s.region)?s.region:s.region===null?null:f.region,node:places.has(s.node)?s.node:s.node===null?null:f.node,
    poi:typeof s.poi==='boolean'?s.poi:f.poi,names:typeof s.names==='boolean'?s.names:f.names,selection:selection(s.selection===undefined?f.selection:s.selection),
    type:types.has(s.type)?s.type:f.type,tram:typeof s.tram==='boolean'?s.tram:f.tram,route:routes.has(s.route)?s.route:s.route===null?null:f.route,
    filterRegion:regions.has(s.filterRegion)?s.filterRegion:s.filterRegion===undefined?f.filterRegion:null};
   const chosen=state.selection;
   if(chosen?.kind==='node'){state.node=chosen.id;state.region=places.get(chosen.id).group;}
   else if(chosen?.kind==='region'){state.node=null;state.region=chosen.id;}
   else if(chosen?.kind==='subdistrict'){state.node=null;state.region=districts.get(chosen.id).parent;}
   else if(chosen?.kind==='tram-route'){state.node=null;state.region=null;state.tram=true;state.route=chosen.id;}
   else if(chosen?.kind==='tram-stop'){
    state.node=null;state.region=null;state.tram=true;
    const stop=stops.get(chosen.id);if(!list(stop.lines||stop.routeIds).includes(state.route))state.route=null;
   }
   else if(state.node)state.region=places.get(state.node).group;
   const item=chosen&&({node:places,region:regions,subdistrict:districts,'tram-route':routes,'tram-stop':stops}[chosen.kind])?.get(chosen.id);
   return {...meta,...(size?{viewport:size}:{}),camera:{x:number(c.x,...limits.x,fallback.camera.x),y:number(c.y,...limits.y,fallback.camera.y),z:number(c.z,.025,9,fallback.camera.z),mode:modes.has(c.mode)?c.mode:fallback.camera.mode},state,
    query:text(v.query,fallback.query,200).toLocaleLowerCase(),viewName:item?.name||text(v.viewName,fallback.viewName,80)};
  }
  const base=clean(defaults,empty),v=object(saved);
  // Pre-M8 snapshots have no map identity and belong only to the original center.
  const legacy=v.mapId===undefined;
  if((legacy&&meta.mapId!==CENTRAL_MAP)||(!legacy&&(v.mapId!==meta.mapId||v.mapVersion!==meta.mapVersion)))return base;
  return clean(v,base);
 }
 function snapshot(view,data){return normalize({...object(view),...identity(data)},data);}
 window.TOKYO_ATLAS_STATE=Object.freeze({normalize,snapshot});
})();
