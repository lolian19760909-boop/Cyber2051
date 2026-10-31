import fs from 'node:fs';
import assert from 'node:assert/strict';
import {contains,inPolygon,roadDistance,plotsOverlap} from "../../卡片源码/地图/atlas-source.mjs";
import {detailFootprint} from "../../卡片源码/地图/city-detail.mjs";
import {buildRailNetwork} from "../../卡片源码/地图/rail-network.mjs";

const data=JSON.parse(fs.readFileSync(new URL('atlas-data.js',import.meta.url),'utf8').slice(19).replace(/;\s*$/,''));
// Optional sibling work is loaded for the final collision check without generating atlas outputs.
for(const [file,key,fn] of [['district-expansion.mjs','districtExpansion','buildDistrictExpansion'],['terrain-context.mjs','terrainContext','buildTerrainContext']]){
  if(!data[key]&&fs.existsSync(new URL(file,import.meta.url))){const module=await import("../../卡片源码/地图"+file);if(module[fn])data[key]=module[fn](data);}
}
const before=JSON.stringify(data),network=buildRailNetwork(data),groups=[];
const check=(name,fn)=>{fn();groups.push(name);};
const onLand=p=>data.landmass.some(poly=>contains(p,poly))||data.regions.some(r=>r.polygons.some(poly=>inPolygon(p,poly)));
const square=(at,r)=>[[at[0]-r,at[1]-r],[at[0]+r,at[1]-r],[at[0]+r,at[1]+r],[at[0]-r,at[1]+r]];
const built=[...data.footprints,...data.complexes.flatMap(c=>c.footprints),...data.cityDetail.microFootprints,...data.cityDetail.harbor.map(detailFootprint),...(data.districtExpansion?.footprints||[]),...(data.districtExpansion?.microFootprints||[]),...(data.terrainContext?.complexes||[]).flatMap(c=>c.footprints)];
const reserved=[...data.specialSites.map(s=>({points:s.points,gap:s.setback})),...data.cityDetail.harborPlots.map(p=>({points:p.points,gap:2})),...data.grounds.filter(g=>g.type==='park').map(g=>({points:g.points,gap:1})),...(data.districtExpansion?.landmarks||[]).map(l=>({points:l.points,gap:2})),...(data.terrainContext?.complexes||[]).map(c=>({points:c.points,gap:2}))];

check('双环闭合、段落接续、沿用既有道路且不改电车或原数据',()=>{
  assert.equal(network.routes.length,2);assert.equal(JSON.stringify(data),before);
  assert.deepEqual(buildRailNetwork(data),network);
  for(const r of network.routes){assert.deepEqual(r.points[0],r.points.at(-1));for(let i=1;i<r.segments.length;i++)assert.deepEqual(r.segments[i-1].points.at(-1),r.segments[i].points[0]);for(const s of r.segments){assert.ok(['elevated','tunnel','surface'].includes(s.mode));if(s.roadName){const road=data.roads.find(road=>road.name===s.roadName);for(const at of s.points)assert.ok(roadDistance(at,road.points)<.03);}}}
  assert.ok(network.metrics.roadAlignedLength>network.metrics.modeLengths.tunnel);
});
check('12站点位于轨迹和陆地，站序完整且没有借用传送机制',()=>{
  assert.equal(network.stops.length,12);assert.equal(new Set(network.stops.map(s=>s.id)).size,12);
  for(const stop of network.stops){assert.equal(stop.kind,'rail');assert.ok(square(stop.at,2.2).every(onLand));for(const id of stop.routeIds){const r=network.routes.find(r=>r.id===id);assert.ok(r.stops.includes(stop.id));assert.ok(roadDistance(stop.at,r.points)<.03);}assert.ok(!data.rivers.some(r=>roadDistance(stop.at,r.points)<r.width/2+5.2));for(const fp of built)assert.ok(!plotsOverlap(square(stop.at,2.2),fp,1.5));for(const o of reserved)assert.ok(!plotsOverlap(square(stop.at,2.2),o.points,o.gap));}
  for(const r of network.routes){assert.equal(new Set(r.stops).size,6);let previous=-1;for(const id of r.stops){const stop=network.stops.find(s=>s.id===id);let distance=0;for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i];if(roadDistance(stop.at,[a,b])<.03){distance+=Math.hypot(stop.at[0]-a[0],stop.at[1]-a[1]);break;}distance+=Math.hypot(b[0]-a[0],b[1]-a[1]);}assert.ok(distance>previous);previous=distance;}}
});
check('高架墩数量受控且避开所有现有和M7新增建筑、河道与保留地',()=>{
  assert.ok(network.piers.length>=30&&network.piers.length<=60,'actual piers '+network.piers.length);
  for(const pier of network.piers){const fp=square(pier.at,1.2),r=network.routes.find(r=>r.id===pier.routeId);assert.ok(r.segments.some(s=>s.mode==='elevated'&&roadDistance(pier.at,s.points)<.03));assert.ok(fp.every(onLand));assert.ok(!data.rivers.some(r=>roadDistance(pier.at,r.points)<r.width/2+4.2));for(const b of built)assert.ok(!plotsOverlap(fp,b,1.5));for(const o of reserved)assert.ok(!plotsOverlap(fp,o.points,o.gap));assert.ok(!(data.districtExpansion?.roads||[]).some(lane=>roadDistance(pier.at,lane.points)<lane.width/2+2.5));}
});
check('湾底接续明确为地下示意，高架轨道不会穿现有楼体和专属场地',()=>{
  const outer=network.routes.find(r=>r.id==='R2');assert.equal(outer.segments[8].mode,'tunnel');
  for(const s of network.routes.flatMap(r=>r.segments)){if(s.mode!=='elevated')continue;assert.equal(s.height,6);for(const fp of built)assert.ok(!plotsOverlap(fp,s.points,1.2));for(const o of reserved)assert.ok(!plotsOverlap(o.points,s.points,o.gap));}
});
check('高架与地下接缝降至地面，坡度连续且桥墩顶面与轨面一致',()=>{
  for(const route of network.routes)for(let i=0;i<route.segments.length;i++){
    const s=route.segments[i],next=route.segments[(i+1)%route.segments.length];assert.equal(s.points.length,s.heights.length);assert.equal(s.heights.at(-1),next.heights[0]);
    for(let j=1;j<s.points.length;j++){assert.ok(s.heights[j]>=0&&s.heights[j]<=6);const dist=Math.hypot(s.points[j][0]-s.points[j-1][0],s.points[j][1]-s.points[j-1][1]);assert.ok(Math.abs(s.heights[j]-s.heights[j-1])/dist<=.0501);}
    if(s.mode!=='elevated')assert.ok(s.heights.every(height=>height===0));
  }
  for(const pier of network.piers){const route=network.routes.find(r=>r.id===pier.routeId);let matched=false;for(const s of route.segments.filter(s=>s.mode==='elevated'))for(let i=1;i<s.points.length;i++){const a=s.points[i-1],b=s.points[i];if(roadDistance(pier.at,[a,b])>.03)continue;const t=Math.hypot(pier.at[0]-a[0],pier.at[1]-a[1])/Math.hypot(b[0]-a[0],b[1]-a[1]),height=s.heights[i-1]+(s.heights[i]-s.heights[i-1])*t;assert.ok(Math.abs(height-pier.height)<.011);matched=true;}assert.ok(matched);}
});
console.log(JSON.stringify({passed:groups.length,groups,metrics:network.metrics,stationList:network.stops.map(s=>({name:s.name,group:s.group,mode:s.mode})),crossChecked:{districtExpansion:!!data.districtExpansion,terrainContext:!!data.terrainContext}},null,2));
