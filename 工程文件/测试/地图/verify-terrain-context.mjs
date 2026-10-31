import fs from 'node:fs';
import assert from 'node:assert/strict';
import {contains,inPolygon,plotsOverlap,project} from "../../卡片源码/地图/atlas-source.mjs";
import {detailFootprint} from "../../卡片源码/地图/city-detail.mjs";
import {buildTerrainContext} from "../../卡片源码/地图/terrain-context.mjs";
const text=fs.readFileSync(new URL('atlas-data.js',import.meta.url),'utf8'),data=JSON.parse(text.slice(text.indexOf('=')+1).replace(/;\s*$/,''));
const before=JSON.stringify(data),result=buildTerrainContext(data),groups=[];
const check=(name,fn)=>{fn();groups.push(name);};
const onLand=p=>data.landmass.some(poly=>contains(p,poly))||data.regions.some(r=>r.polygons.some(poly=>inPolygon(p,poly)));
const samples=points=>points.flatMap((p,i)=>{const q=points[(i+1)%points.length],n=Math.max(1,Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/2));return Array.from({length:n},(_,j)=>p.map((v,k)=>v+(q[k]-v)*j/n));});
check('构建确定且不写入原地点、旧楼体或地面高度',()=>{assert.equal(JSON.stringify(data),before);assert.deepEqual(buildTerrainContext(data),result);assert.deepEqual(result.places,[]);});
check('四组有界概念等高线，颜色与青色道路区分且全部在陆地',()=>{
 assert.equal(new Set(result.contours.map(c=>c.region)).size,4);assert.equal(result.contours.length,14);assert.equal(new Set(result.contours.map(c=>c.id)).size,14);
 for(const c of result.contours){assert.ok(c.points.length<=50);assert.deepEqual(c.points[0],c.points.at(-1));assert.ok(c.height>=0&&c.height<=3);assert.ok(c.level>=0&&c.level<=3);assert.notEqual(c.color.toLowerCase(),data.mapStyle.road.toLowerCase());assert.ok(c.points.flat().every(Number.isFinite));assert.ok(samples(c.points).every(onLand),c.id+'跨海');}
 assert.match(result.metrics.terrainBasis,/非真实DEM/);
});
check('RiNG原节点身份、坐标与维护地志来源保持',()=>{
 const n=data.nodes.find(n=>n.id==='ring-community'),live=data.nodes.find(n=>n.id==='ring-live');assert.deepEqual(n.at,project(n.lon,n.lat));assert.deepEqual(live.at,project(live.lon,live.lat));assert.equal(n.group,'underpool');assert.equal(live.group,'underpool');assert.equal(result.complexes.length,1);assert.deepEqual(result.complexes[0].at,n.at);assert.match(result.metrics.communityBasis,/003\/036\/042/);
});
check('显式复用原棚屋足迹，绘制池排除后没有双份建筑',()=>{
 const c=result.complexes[0],indices=result.reusedMicroIndices,set=new Set(indices);assert.equal(set.size,indices.length);assert.ok(indices.length>=4&&indices.length<=10);assert.equal(c.parts.length,indices.length+1);assert.equal(c.footprints.length,c.parts.length);
 indices.forEach((index,i)=>{const old=data.cityDetail.micro[index].b,b=c.parts[i];for(const k of [0,1,2,3,5,6,7])assert.equal(b[k],old[k]);assert.deepEqual(c.footprints[i],data.cityDetail.microFootprints[index]);});
 const remaining=data.cityDetail.microFootprints.filter((_,i)=>!set.has(i)),queue=[...remaining,...c.footprints];assert.equal(queue.length,data.cityDetail.microFootprints.length+1);const identities=queue.map(fp=>JSON.stringify(fp));assert.equal(new Set(identities).size,identities.length);assert.ok(c.parts.every(b=>b.length===9&&b.every(Number.isFinite)));
});
check('新增单入口完整足迹避旧楼、原微楼、道路、水系、专属设施与港后保留',()=>{
 const c=result.complexes[0],fp=c.footprints.at(-1),expansion=data.districtExpansion;assert.deepEqual(fp,detailFootprint(c.parts.at(-1)));assert.ok(samples(fp).every(onLand));assert.ok(samples(c.points).every(onLand));
 const solids=[...data.footprints.map(points=>({points,gap:1.4})),...data.specialSites.map(s=>({points:s.points,gap:s.setback+1})),...data.complexes.map(s=>({points:s.points,gap:2})),...data.cityDetail.microFootprints.map(points=>({points,gap:1.2})),...data.cityDetail.harborPlots.map(s=>({points:s.points,gap:3})),...data.grounds.filter(g=>g.type==='park').map(g=>({points:g.points,gap:1})),...(expansion?.footprints||[]).map(points=>({points,gap:1.4})),...(expansion?.microFootprints||[]).map(points=>({points,gap:1.2})),...(expansion?.landmarks||[]).map(s=>({points:s.points,gap:3}))];
 for(const s of solids)assert.ok(!plotsOverlap(fp,s.points,s.gap),'新增入口压既有用地');
 for(const line of [...data.roads,...data.streets,...data.rivers.map(r=>({...r,width:r.width+8})),...data.cityDetail.harborLanes,...(expansion?.roads||[])])for(let i=1;i<line.points.length;i++)assert.ok(!plotsOverlap(fp,[line.points[i-1],line.points[i]],line.width/2+1),'新增入口压道路/水系');
 assert.ok(Math.hypot(c.parts.at(-1)[0]-c.at[0],c.parts.at(-1)[1]-c.at[1])<48);assert.ok(c.parts.at(-1)[4]<=5);
});
check('入口铺地短线不穿社区屋顶或旧楼',()=>{
 const c=result.complexes[0];assert.equal(c.forecourt.length,2);assert.ok(c.forecourt.flat().every(Number.isFinite));for(const fp of [...data.footprints,...data.cityDetail.microFootprints,...c.footprints])assert.ok(!plotsOverlap(c.forecourt,fp,.3),'铺地线穿楼');
});
if(data.terrainContext)check('整合产物与当前维护生成器一致',()=>assert.deepEqual(data.terrainContext,result));
console.log(JSON.stringify({passed:groups.length,groups,metrics:result.metrics,entrance:result.complexes[0].parts.at(-1),reusedMicroIndices:result.reusedMicroIndices},null,2));
