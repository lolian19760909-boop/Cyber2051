import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(file,import.meta.url),'utf8');
const raw=read('atlas-data.js'),actual=JSON.parse(raw.slice(raw.indexOf('=')+1).replace(/;\s*$/,''));
const data={...actual,mapId:'tokyo-central',mapVersion:'m8-sample-1'};
const context=vm.createContext({window:{}});vm.runInContext(read('atlas-view-state.js'),context);
const {normalize,snapshot}=context.window.TOKYO_ATLAS_STATE,plain=v=>JSON.parse(JSON.stringify(v));
const groups=[],failures=[],check=(name,fn)=>{try{fn();groups.push(name);}catch(error){failures.push(name);console.error(name+'\n'+error.stack);}};
const defaults={camera:{x:1828,y:1424,z:.35,mode:'auto'},state:{region:null,node:null,poi:true,selection:null,type:'all',tram:true,route:null,filterRegion:null},query:'',viewName:'都市核心与湾岸'};
const withMeta=view=>({...view,mapId:data.mapId,mapVersion:data.mapVersion});
const places=[...data.nodes,...data.services,...data.districtExpansion.places,...data.terrainContext.places];
const baseline=normalize(null,data,defaults);

check('合法中心地图视图往返，明确只输出浏览字段且不修改输入',()=>{
 const input=withMeta({camera:{x:1900,y:1350,z:2.5,mode:'depth'},state:{...defaults.state,poi:false,type:'weapon',node:'tsurumaki-tower',region:'imperial',selection:{kind:'node',id:'tsurumaki-tower'},extra:'discard'},query:'  ToKYO  ',viewName:'旧标题',mvu:{credits:99}});
 const before=JSON.stringify(input),result=normalize(input,data,defaults);
 assert.equal(JSON.stringify(input),before);assert.deepEqual(Object.keys(result).sort(),['camera','mapId','mapVersion','query','state','viewName']);
 assert.deepEqual(Object.keys(result.state).sort(),Object.keys(defaults.state).sort());assert.equal(result.query,'tokyo');assert.equal(result.viewName,places.find(n=>n.id==='tsurumaki-tower').name);
 assert.equal(result.state.poi,false);assert.equal(result.state.type,'weapon');assert.equal(result.state.node,'tsurumaki-tower');
 assert.deepEqual(plain(snapshot(result,data)),plain(result));result.camera.x=99;assert.equal(input.camera.x,1900);
});

check('mapId与版本隔离，旧无mapId只迁入中心，显式缺版本不偷迁移',()=>{
 const old={...defaults,camera:{x:2100,y:1800,z:1.8,mode:'flat'}};
 assert.equal(normalize(old,data,defaults).camera.x,2100);
 for(const wrong of [{mapId:'tokyo-west',mapVersion:data.mapVersion},{mapId:data.mapId,mapVersion:'m7'},{mapId:data.mapId},{mapId:null,mapVersion:data.mapVersion}])assert.deepEqual(plain(normalize({...old,...wrong},data,defaults)),plain(baseline));
 const west={...data,mapId:'tokyo-west'};assert.deepEqual(plain(normalize(old,west,defaults)),plain(normalize(null,west,defaults)));
 const matching=normalize({...old,mapId:west.mapId,mapVersion:west.mapVersion},west,defaults);assert.equal(matching.camera.x,2100);assert.equal(matching.mapId,'tokyo-west');
});

check('坏数值按字段回默认，缩放边界与负坐标世界保持一致',()=>{
 for(const bad of [NaN,Infinity,-Infinity,'2',null,{},[],undefined]){
  const n=normalize(withMeta({camera:{x:bad,y:bad,z:bad,mode:'perspective'}}),data,defaults);assert.deepEqual(plain(n.camera),defaults.camera);
 }
 for(const [key,value] of [['x',99],['x',3601],['y',99],['y',3201],['z',.024],['z',9.01]])assert.equal(normalize(withMeta({camera:{[key]:value}}),data,defaults).camera[key],defaults.camera[key]);
 const mobile=withMeta({...defaults,camera:{...defaults.camera,z:.0743,mode:'flat'}});assert.equal(normalize(snapshot(mobile,data),data,defaults).camera.z,.0743);
 const west={...data,world:{...data.world,minX:-3600,minY:-1200,width:7200,height:4400}};
 const edge=normalize(withMeta({camera:{x:-3500,y:-1100,z:9,mode:'flat'}}),west,defaults);assert.deepEqual(plain(edge.camera),{x:-3500,y:-1100,z:9,mode:'flat'});
 const badEdge=normalize(withMeta({camera:{x:-3501,y:-1101,z:.1}}),west,defaults);assert.equal(badEdge.camera.x,defaults.camera.x);assert.equal(badEdge.camera.y,defaults.camera.y);assert.equal(badEdge.camera.z,.1);
});

check('地区、子区、地点选择以实际目录校正关联地区，移除失效ID',()=>{
 const district=data.districtExpansion.districts[0],node=places.find(n=>n.id==='tokyo-skytree');
 for(const [selection,region,nodeId] of [[{kind:'region',id:'imperial'},'imperial',null],[{kind:'subdistrict',id:district.id},district.parent,null],[{kind:'node',id:node.id},node.group,node.id]]){
  const n=normalize(withMeta({state:{region:'docks',node:'plaza',selection}}),data,defaults);assert.equal(n.state.region,region);assert.equal(n.state.node,nodeId);assert.deepEqual(plain(n.state.selection),selection);
 }
 for(const selection of [{kind:'region',id:'deleted'},{kind:'node',id:'deleted'},{kind:'subdistrict',id:'deleted'},{kind:'__proto__',id:'imperial'},{kind:'mvu',id:'plaza'},'plaza',[]]){
  const n=normalize(withMeta({state:{region:'deleted',node:'deleted',selection,type:'future-type',route:'deleted'}}),data,defaults);assert.deepEqual(plain(n.state),defaults.state);
 }
 const closed=normalize(withMeta({state:{node:node.id,region:'docks',selection:null}}),data,defaults);assert.equal(closed.state.selection,null);assert.equal(closed.state.region,node.group);
});

check('地区筛选独立于所选地区，旧快照与失效地区保持兼容',()=>{
 const input=withMeta({state:{...defaults.state,selection:{kind:'region',id:'imperial'},filterRegion:'underpool'},camera:{...defaults.camera,mode:'flat'}});
 const result=normalize(input,data,defaults);assert.equal(result.state.region,'imperial');assert.equal(result.state.filterRegion,'underpool');assert.equal(result.camera.mode,'flat');assert.deepEqual(plain(snapshot(result,data)),plain(result));
 for(const bad of ['deleted','west-yamanashi',{},[]])assert.equal(normalize(withMeta({state:{filterRegion:bad}}),data,defaults).state.filterRegion,null);
 const old=withMeta({state:{type:'apartment',region:'imperial'}});assert.equal(normalize(old,data,defaults).state.filterRegion,null);assert.equal(normalize(old,data,defaults).state.type,'apartment');
});

check('原有电车与环线/站点可恢复，交通选择不会留下错误地区或不相干线路',()=>{
 for(const route of [...data.cityDetail.tram.routes,...data.railNetwork.routes]){
  const n=normalize(withMeta({state:{tram:false,region:'imperial',node:'plaza',selection:{kind:'tram-route',id:route.id},route:'missing'}}),data,defaults);
  assert.equal(n.state.route,route.id);assert.equal(n.state.tram,true);assert.equal(n.state.region,null);assert.equal(n.state.node,null);assert.equal(n.viewName,route.name);
 }
 for(const stop of [...data.cityDetail.tram.stops,...data.railNetwork.stops]){
  const route=(stop.lines||stop.routeIds)[0],selection={kind:'tram-stop',id:stop.id};
  const valid=normalize(withMeta({state:{selection,route,tram:false}}),data,defaults);assert.equal(valid.state.route,route);assert.equal(valid.state.tram,true);assert.equal(valid.viewName,stop.name);
  const other=[...data.cityDetail.tram.routes,...data.railNetwork.routes].find(r=>!(stop.lines||stop.routeIds).includes(r.id));
  if(other)assert.equal(normalize(withMeta({state:{selection,route:other.id}}),data,defaults).state.route,null);
 }
});

check('附近地点列表去重并清除失效ID，筛选开关与查询有长度类型边界',()=>{
 const ids=[places[0].id,'deleted',places[0].id,places[1].id],selection={kind:'cluster',ids};
 const n=normalize(withMeta({state:{selection,poi:false,tram:false,type:'weapon'},query:'  Ａ\u0000BC '+ 'x'.repeat(250),viewName:'v'.repeat(200)}),data,defaults);
 assert.deepEqual(plain(n.state.selection),{kind:'cluster',ids:[places[0].id,places[1].id]});assert.equal(n.state.poi,false);assert.equal(n.state.tram,false);assert.equal(n.state.type,'weapon');assert.equal(n.query.length,200);assert.ok(!n.query.includes('\u0000'));assert.equal(n.viewName.length,80);
 const bad=normalize(withMeta({state:{selection:{kind:'cluster',ids:['deleted']},poi:'false',tram:0},query:{},viewName:[]}),data,defaults);assert.deepEqual(plain(bad.state),defaults.state);assert.equal(bad.query,'');assert.equal(bad.viewName,defaults.viewName);
});

check('缺失、数组、原始值、破损嵌套输入安全回默认，恶意额外属性不外传',()=>{
 for(const saved of [null,undefined,false,1,'text',[],{},withMeta({camera:[],state:42}),JSON.parse('{"__proto__":{"polluted":true}}')])assert.deepEqual(plain(normalize(saved,data,defaults)),plain(baseline));
 const input=withMeta({camera:{x:NaN,y:Infinity,z:-9},state:{selection:{kind:'cluster',ids:null}},extra:'bad'});assert.doesNotThrow(()=>snapshot(input,data));assert.equal({}.polluted,undefined);
});

// Execute the maintained bridge with a minimal host: asynchronous load order is explicit.
function bridgeHost({restore=true}={}){
 const city={hidden:true,children:[],append(frame){this.children.push(frame);}},terminal={hidden:false},root={dataset:{motion:'full'}},checkbox={checked:restore};
 const frames=[],observers=[],events=new Map(),document={documentElement:root,querySelector:s=>({'#page-city':city,'#terminal':terminal,'#restore-view':checkbox})[s],createElement(tag){assert.equal(tag,'iframe');const handlers=new Map();const frame={contentDocument:{documentElement:{dataset:{}}},contentWindow:{},addEventListener(type,fn){handlers.set(type,fn);},remove(){city.children=city.children.filter(n=>n!==this);},load(){handlers.get('load')?.();}};frames.push(frame);return frame;}};
 class MutationObserver{constructor(fn){this.callback=fn;this.connected=true;observers.push(this);}observe(){this.connected=true;}disconnect(){this.connected=false;}}
 const window={addEventListener:(type,fn,options)=>events.set(type,options?.once?e=>{events.delete(type);fn(e);}:fn),removeEventListener:type=>events.delete(type)},ctx=vm.createContext({document,window,MutationObserver});
 vm.runInContext(read('terminal-map-preview.js').replace('/*ATLAS_DOCUMENT*/',JSON.stringify('<html></html>')),ctx);
 return {city,terminal,root,checkbox,frames,observers,events,show(){city.hidden=false;observers[0].callback();return frames.at(-1);},hide(){city.hidden=true;observers[0].callback();},sync(){observers[0].callback();},pagehide(persisted=false){events.get('pagehide')?.({persisted});},pageshow(persisted=true){events.get('pageshow')?.({persisted});}};
}

check('终端仅保留一张frame，离开卸载后恢复同图已校验视图与动效偏好',()=>{
 const h=bridgeHost(),saved=snapshot({...defaults,camera:{...defaults.camera,z:2}},data),first=h.show();
 first.contentWindow.TOKYO_ATLAS_VIEW={read:()=>saved};first.load();h.hide();assert.equal(h.city.children.length,0);
 const second=h.show(),restored=[];second.contentWindow.TOKYO_ATLAS_VIEW={restore:v=>restored.push(v)};h.root.dataset.motion='reduced';second.load();
 assert.equal(h.city.children.length,1);assert.equal(restored.length,1);assert.deepEqual(plain(restored[0]),plain(saved));assert.equal(second.contentDocument.documentElement.dataset.motion,'reduced');
 for(let i=0;i<5;i++)h.sync();assert.equal(h.frames.length,2);assert.equal(h.city.children.length,1);
});

check('旧frame迟到load不能访问新frame，pagehide之后排队回调不能重建',()=>{
 const h=bridgeHost(),saved=snapshot(defaults,data),a=h.show();a.contentWindow.TOKYO_ATLAS_VIEW={read:()=>saved};a.load();h.hide();
 const b=h.show();h.hide();const c=h.show(),restored=[];c.contentWindow.TOKYO_ATLAS_VIEW={restore:v=>restored.push(v)};
 assert.doesNotThrow(()=>{a.load();b.load();});assert.equal(restored.length,0);c.load();assert.equal(restored.length,1);
 h.pagehide();assert.equal(h.city.children.length,0);assert.equal(h.observers[0].connected,false);const count=h.frames.length;
 assert.doesNotThrow(()=>{c.load();h.sync();});assert.equal(h.frames.length,count);assert.equal(h.city.children.length,0);
});

check('关闭恢复开关与错误地图快照不恢复，未就绪或销毁中的子页不抛错',()=>{
 const h=bridgeHost({restore:false}),a=h.show();a.contentWindow.TOKYO_ATLAS_VIEW={read:()=>snapshot(defaults,data)};a.load();h.hide();const b=h.show();let calls=0;b.contentWindow.TOKYO_ATLAS_VIEW={restore:()=>calls++};b.load();assert.equal(calls,0);
 const wrong=bridgeHost(),c=wrong.show();c.contentWindow.TOKYO_ATLAS_VIEW={read:()=>({...snapshot(defaults,data),mapId:'tokyo-west'})};c.load();wrong.hide();const d=wrong.show();d.contentWindow.TOKYO_ATLAS_VIEW={restore:()=>calls++};d.load();assert.equal(calls,0);
 d.contentWindow.TOKYO_ATLAS_VIEW={read(){throw new Error('child unloaded');}};assert.doesNotThrow(()=>wrong.hide());const pending=wrong.show();pending.contentDocument=null;pending.contentWindow=null;assert.doesNotThrow(()=>{pending.load();wrong.hide();});
});

check('旧单图桥快速离开未就绪重载页，仍保留此前已完成的视角快照',()=>{
 const h=bridgeHost(),saved=snapshot({...defaults,camera:{...defaults.camera,x:1234},query:'诊所'},data),a=h.show();a.contentWindow.TOKYO_ATLAS_VIEW={read:()=>saved};a.load();h.hide();
 const pending=h.show();pending.contentWindow.TOKYO_ATLAS_VIEW={read:()=>snapshot(defaults,data)};h.hide();pending.load();
 const restored=h.show();let got;restored.contentWindow.TOKYO_ATLAS_VIEW={restore:v=>got=v};restored.load();assert.deepEqual(plain(got),plain(saved));
});

check('旧单图桥重复BFCache恢复、隐藏期不挂载、最终真实卸载清理监听',()=>{
 const h=bridgeHost(),saved=snapshot({...defaults,query:'诊所'},data);let current=h.show();
 for(let i=0;i<3;i++){
  current.contentWindow.TOKYO_ATLAS_VIEW={read:()=>saved};current.load();h.pagehide(true);assert.equal(h.city.children.length,0);assert.equal(h.observers[0].connected,false);h.sync();current.load();assert.equal(h.city.children.length,0);
  h.pageshow();assert.equal(h.city.children.length,1);assert.equal(h.observers[0].connected,true);current=h.frames.at(-1);let got;current.contentWindow.TOKYO_ATLAS_VIEW={restore:v=>got=v,read:()=>saved};current.load();assert.deepEqual(plain(got),plain(saved));h.pageshow();assert.equal(h.city.children.length,1);
 }
 h.hide();h.pagehide(true);h.pageshow();assert.equal(h.city.children.length,0);current=h.show();h.pagehide(false);const created=h.frames.length;h.pageshow();h.sync();current.load();assert.equal(h.frames.length,created);assert.equal(h.city.children.length,0);assert.equal(h.events.size,0);assert.equal(h.observers[0].connected,false);
});

assert.deepEqual(failures,[],'状态与旧桥生命周期回归失败');

console.log(JSON.stringify({passed:groups.length,groups,places:places.length,regions:data.regions.length,subdistricts:data.districtExpansion.districts.length,routes:data.cityDetail.tram.routes.length+data.railNetwork.routes.length,stops:data.cityDetail.tram.stops.length+data.railNetwork.stops.length,boundary:'执行纯状态模块、实际地图目录与终端桥接；iframe/DOM采用替身验证回调次序，不代表真实酒馆、浏览器或手机验收。'},null,2));
