'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),source=file=>fs.readFileSync(path.join(root,'卡片源码',file),'utf8'),D=require('../../卡片源码/地图/document-style.js'),data=require('../../卡片源码/地图/place-build.cjs').load(source);
const registry=JSON.parse(source('地图/resources.json')),read=ref=>{const bytes=fs.readFileSync(path.join(root,'网站/atlas',ref.path));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),ref.sha256);return ref.path.endsWith('.gz')?zlib.gunzipSync(bytes).toString():bytes.toString();},index=JSON.parse(read(registry.manifest));
function definitions(html){const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)][0][1],scope={window:{}};vm.runInNewContext(script,scope);return scope.window;}
function geometries(value,result={}){if(!value||typeof value!=='object')return result;if(value.id&&(value.at||value.points||value.bounds))result[value.id]=JSON.parse(JSON.stringify(Object.fromEntries(['at','points','bounds','x','y','z','w','d','h'].filter(k=>k in value).map(k=>[k,value[k]]))));for(const child of Object.values(value))if(child&&typeof child==='object')geometries(child,result);return result;}
test('39 district places have actionable details and the original verified map geometry is preserved',()=>{
 const raw=read(index.documents['tokyo-central'].page).replace('/*CXX_ATLAS_SHARED_RUNTIME*/',()=>read(index.shared)),html=D.prepare(raw,['atlas.css','detail.css','map-labels.css'].map(f=>source('地图/'+f)),data.places,{atlas:source('地图/atlas.js'),api:source('地图/map-api.js')}),before=definitions(raw),after=definitions(html);
 assert.equal(data.places.length,39);assert.equal(data.regions.length,2);for(const p of data.places){assert(p.actions.length);assert(p.desc.length>15,p.id+' details');}
 assert.deepEqual(geometries(after.TOKYO_ATLAS),geometries(before.TOKYO_ATLAS));
 for(const key of Object.keys(before.TOKYO_ATLAS_PACKETS))assert.deepEqual(geometries(JSON.parse(after.TOKYO_ATLAS_PACKETS[key])),geometries(JSON.parse(before.TOKYO_ATLAS_PACKETS[key])));
 const places=[...after.TOKYO_ATLAS.nodes,...after.TOKYO_ATLAS.services,...after.TOKYO_ATLAS.districtExpansion.places,...after.TOKYO_ATLAS.terrainContext.places];
 for(const p of data.places){const installed=places.find(row=>row.id===p.id);assert(installed,p.id+' is present in the actual map');assert.equal(installed.group,p.group);assert.equal(installed.desc,p.desc);}
 for(const p of data.places.filter(p=>p.questId)){const installed=places.find(row=>row.id===p.id);assert.equal(installed.acceptsQuest,true);assert.equal(installed.questId,p.id);}
 assert(html.includes(source('地图/atlas.js')));assert(html.includes(source('地图/map-api.js')));
 for(const block of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi))require('acorn').parse(block[1],{ecmaVersion:'latest'});
});
test('district detail edits are the single source read by the card and map preparation',()=>{
 const revised=require('../../卡片源码/地图/place-build.cjs').load(file=>file.endsWith('166-地区地点-暗池.txt')?source(file).replace('RiNG社区：','作者手改地点简介：'):source(file));
 assert(revised.places.find(p=>p.id==='ring-community').desc.includes('作者手改地点简介：'));
});
