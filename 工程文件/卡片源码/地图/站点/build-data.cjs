'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const mapRoot=path.resolve(__dirname,'..'),eng=path.resolve(mapRoot,'../..'),root=path.dirname(eng),out=path.join(eng,'网站/map');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>fs.readFileSync(path.join(eng,'卡片源码',f),'utf8');
function literal(text,marker){
 let i=text.indexOf(marker);if(i<0)throw Error('地图数据缺少 '+marker);i+=marker.length;while(/\s/.test(text[i]))i++;
 const start=i;let depth=0,quoted=false,escaped=false;
 for(;i<text.length;i++){const c=text[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if((c==='}'||c===']')&&!--depth)return JSON.parse(text.slice(start,i+1));}
 throw Error('地图数据未闭合 '+marker);
}
function loadCurrentMaps(){
 const resource=JSON.parse(read('地图/resources.json')),refs=[],atlas=path.join(eng,'网站/atlas');
 function verified(ref){const bytes=fs.readFileSync(path.join(atlas,ref.path));if(bytes.length!==ref.bytes||sha(bytes)!==ref.sha256)throw Error('地图资源摘要变化 '+ref.path);refs.push(ref);return ref.path.endsWith('.gz')?zlib.gunzipSync(bytes).toString():bytes.toString();}
 const index=JSON.parse(verified(resource.manifest)),shared=verified(index.shared),patches=require('../place-build.cjs').load(read).places;
 const styles=['atlas.css','detail.css','map-labels.css'].map(f=>read('地图/'+f)),modules={atlas:read('地图/atlas.js'),api:read('地图/map-api.js')},industrial=JSON.parse(read('地图/industrial-parks.json'));
 const maps=Object.entries(index.documents).map(([id,doc])=>{
  const raw=verified(doc.page).replace('/*CXX_ATLAS_SHARED_RUNTIME*/',()=>shared);
  const html=require('../document-style.js').prepare(raw,styles,patches,modules,industrial),data=literal(html,'window.TOKYO_ATLAS=');
  const packets=html.includes('window.TOKYO_ATLAS_PACKETS=')?Object.values(literal(html,'window.TOKYO_ATLAS_PACKETS=')).map(p=>typeof p==='string'?JSON.parse(p):p):[];
  // The published document separates heavy geometry into sectors. Reconstitute
  // those arrays at build time, never shipping the old renderer to the new site.
  for(const key of ['buildings','footprints','streets','grounds','features','portSites','landmarks','specialSites','parcels','complexes']){
   const rows=[...(data[key]||[]),...packets.flatMap(p=>p[key]||[])];data[key]=[...new Map(rows.map(v=>[v.id||JSON.stringify(v),v])).values()];
  }
  for(const group of ['cityDetail','districtExpansion','terrainContext']){const parts=[data[group]||{},...packets.map(p=>p[group]||{})],target={...parts[0]};for(const key of new Set(parts.flatMap(p=>Object.keys(p)))){const arrays=parts.map(p=>p[key]).filter(Array.isArray);if(arrays.length)target[key]=[...new Map(arrays.flat().map(v=>[v?.id||JSON.stringify(v),v])).values()];}data[group]=target;}
  const all=[...data.nodes||[],...data.services||[],...data.districtExpansion?.places||[],...data.terrainContext?.places||[],...packets.flatMap(p=>[...p.districtExpansion?.places||[],...p.terrainContext?.places||[]])];
  data.allPlaces=[...new Map(all.map(p=>{const patch=patches.find(v=>v.id===p.id),value={...p,...patch};if(patch){delete value.worldbookAnchor;delete value.dims;value.source='当前世界书地点维护正文';}return[p.id,value];})).values()].filter(p=>p.at?.length===2&&p.at.every(Number.isFinite));
  data.mapId=id;return data;
 });
 return{maps,refs,patches};
}
function catalogue(data){
 const routes=[...data.cityDetail?.tram?.routes||[],...data.railNetwork?.routes||[]];
 const stops=[...data.cityDetail?.tram?.stops||[],...data.railNetwork?.stops||[]];
 const regions=data.regions.map(r=>({id:r.id,name:r.name,color:r.color||'#82aeb3',cover:r.cover||'',desc:r.desc||'',dims:r.dims||[],kind:r.kind,polygons:r.polygons||[],path:r.selectionPath||r.path||'',bounds:r.selectionBounds||r.bounds}));
 return{id:data.mapId,name:data.displayName||(data.mapId==='tokyo-central'?'东京都':'山梨与富士'),bounds:data.overviewBounds||data.bounds,regions,
  places:data.allPlaces.map(p=>({...p,mapId:data.mapId,category:p.cat||p.type||'地点',aliases:[...new Set([...(Array.isArray(p.aliases)?p.aliases:[]),p.id==='a-yang-clinic'?'阿杨诊所':'',p.id==='ring-live'?'RiNG':''].filter(Boolean))]})),
  routes:routes.map(r=>({...r,mapId:data.mapId,segments:r.segments||[{points:r.points,mode:'surface'}]})),stops:stops.map(s=>({...s,mapId:data.mapId,lines:s.lines||s.routeIds||[]}))};
}
function build(){
 const current=loadCurrentMaps(),maps=current.maps.map(catalogue);fs.mkdirSync(path.join(out,'data'),{recursive:true});
 const manifest={schema:'cyber2051.map-catalog/1',revision:sha(JSON.stringify(maps)),maps};
 fs.writeFileSync(path.join(out,'data/catalog.json'),JSON.stringify(manifest));
 const work=path.join(root,'.cache/map-site-20261029');fs.mkdirSync(work,{recursive:true});
 fs.writeFileSync(path.join(work,'current-maps.json'),JSON.stringify(current.maps));
 const receipt={revision:manifest.revision,sourceResources:current.refs,maps:maps.map(m=>({id:m.id,regions:m.regions.length,places:m.places.length,routes:m.routes.length,stops:m.stops.length})),currentTextPlaces:current.patches.length};
 fs.writeFileSync(path.join(work,'catalog-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt.maps));return manifest;
}
if(require.main===module)build();
module.exports={loadCurrentMaps,catalogue,build,out,root,eng,mapRoot,sha,literal};
