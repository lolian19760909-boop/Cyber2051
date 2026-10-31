export const recordSchema='cyber2051.map-records/1';
export const keyOf=p=>p.mapId+':'+p.id;
const norm=s=>String(s||'').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,'');
export function searchPlaces(maps,query){
 const q=norm(query),all=maps.flatMap(m=>m.places.map(p=>({...p,mapName:m.name})));if(!q)return all;
 return all.filter(p=>norm([p.name,...p.aliases||[],p.category,p.group].join(' ')).includes(q)).sort((a,b)=>(norm(b.name)===q)-(norm(a.name)===q)||a.name.localeCompare(b.name,'zh-CN'));
}
export function visiblePlaces(map,{region='',categories=[],recordFilter='all'}={},records={}){
 return map.places.filter(p=>(!region||p.group===region||p.sectorId===region)&&(!categories.length||categories.includes(p.category))&&(recordFilter==='all'||records[keyOf(p)]?.[recordFilter]));
}
export function emptyRecords(){return{schema:recordSchema,records:{},pins:[]};}
export function validateRecords(value){
 if(!value||value.schema!==recordSchema||!value.records||Array.isArray(value.records)||typeof value.records!=='object'||!Array.isArray(value.pins))throw Error('不是有效的地图记录文件。');
 const records={};for(const [key,r]of Object.entries(value.records)){
  if(!key.includes(':')||!r||typeof r!=='object'||typeof r.note!=='string'||r.note.length>20000||typeof r.favorite!=='boolean'||typeof r.visited!=='boolean')throw Error('地点记录格式不正确。');
  Object.defineProperty(records,key,{value:{favorite:r.favorite,visited:r.visited,note:r.note},enumerable:true,writable:true,configurable:true});
 }
 const pins=value.pins.map(p=>{if(!p||typeof p.id!=='string'||!p.id.startsWith('pin-')||typeof p.mapId!=='string'||typeof p.name!=='string'||!p.name.trim()||typeof p.note!=='string'||!Array.isArray(p.at)||p.at.length!==2||!p.at.every(Number.isFinite))throw Error('个人标记格式不正确。');return{id:p.id,mapId:p.mapId,name:p.name.slice(0,150),note:p.note.slice(0,20000),at:p.at.slice()};});
 if(new Set(pins.map(keyOf)).size!==pins.length)throw Error('个人标记编号重复。');return{schema:recordSchema,records,pins};
}
export function previewImport(current,incoming,maps){
 const known=new Set([...maps.flatMap(m=>m.places.map(keyOf)),...current.pins.map(keyOf),...incoming.pins.map(keyOf)]),conflicts=Object.keys(incoming.records).filter(k=>current.records[k]&&JSON.stringify(current.records[k])!==JSON.stringify(incoming.records[k]));
 return{records:Object.keys(incoming.records).length,pins:incoming.pins.length,conflicts,unknown:Object.keys(incoming.records).filter(k=>!known.has(k))};
}
export function mergeRecords(current,incoming,mode='merge'){
 if(mode==='replace')return structuredClone(incoming);
 // Import wins only after the conflict preview explicitly confirms a merge.
 return{schema:recordSchema,records:{...current.records,...incoming.records},pins:[...new Map([...current.pins,...incoming.pins].map(p=>[keyOf(p),p])).values()]};
}
export function createRecordStore({storage=globalThis.localStorage,scope='public'}={}){
 const key='cxx-map-records-v1:'+scope;
 return{read(){const text=storage.getItem(key);return text?validateRecords(JSON.parse(text)):emptyRecords();},raw(){return storage.getItem(key);},write(value){const checked=validateRecords(value);storage.setItem(key,JSON.stringify(checked));return checked;},key};
}
export function readLink(search,maps){
 const q=new URLSearchParams(search),map=maps.find(m=>m.id===q.get('map'))||maps[0],id=q.get('place'),point=id&&map.places.find(p=>p.id===id);
 const view=['x','y','z'].map(k=>q.has(k)?Number(q.get(k)):NaN);
 return{mapId:map.id,placeId:point?.id||null,missingPlace:Boolean(id&&!point),view:view.every(Number.isFinite)&&view[2]>0?{center:view.slice(0,2),zoom:view[2]}:null,mode:q.get('base')==='roads'?'roads':'city'};
}
export function shareLink(base,{mapId,placeId,center,zoom,mode='city'}){
 const url=new URL(base);url.search='';url.hash='';url.searchParams.set('map',mapId);if(placeId)url.searchParams.set('place',placeId);
 if(center&&Number.isFinite(zoom)){url.searchParams.set('x',center[0].toFixed(3));url.searchParams.set('y',center[1].toFixed(3));url.searchParams.set('z',zoom.toFixed(4));}if(mode==='roads')url.searchParams.set('base','roads');return url.href;
}
