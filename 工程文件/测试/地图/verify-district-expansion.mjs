import fs from 'node:fs';
import assert from 'node:assert/strict';
import {contains,inPolygon,plotsOverlap,roadDistance} from "../../卡片源码/地图/atlas-source.mjs";
import {detailFootprint} from "../../卡片源码/地图/city-detail.mjs";
import {buildDistrictExpansion} from "../../卡片源码/地图/district-expansion.mjs";

const data=JSON.parse(fs.readFileSync(new URL('atlas-data.js',import.meta.url),'utf8').slice(19).replace(/;\s*$/,''));
const before=JSON.stringify(data),groups=[];
const freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
freeze(data);
const generated=buildDistrictExpansion(data),e=data.districtExpansion||generated;
const check=(name,fn)=>{fn();groups.push(name);};
const onLand=p=>data.landmass.some(poly=>contains(p,poly))||data.regions.some(r=>r.polygons.some(poly=>inPolygon(p,poly)));
const samples=points=>points.flatMap((p,i)=>{const q=points[(i+1)%points.length],steps=Math.max(1,Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/4));return Array.from({length:steps},(_,j)=>p.map((v,k)=>v+(q[k]-v)*j/steps));});
const bounds=points=>[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
const near=(a,b,g)=>a[0]<=b[2]+g&&a[2]>=b[0]-g&&a[1]<=b[3]+g&&a[3]>=b[1]-g;
const solid=[...data.footprints.map(points=>({points,gap:1})),...data.specialSites.map(s=>({points:s.points,gap:s.setback})),...data.grounds.filter(g=>g.type==='park').map(g=>({points:g.points,gap:.5})),...data.cityDetail.microFootprints.map(points=>({points,gap:1})),...data.cityDetail.harborPlots.map(s=>({points:s.points,gap:2}))];
for(const r of data.rivers)for(let i=1;i<r.points.length;i++)solid.push({points:[r.points[i-1],r.points[i]],gap:r.width/2+4});
solid.forEach(o=>o.bounds=bounds(o.points));
const ground=[...data.roads.filter(r=>!r.elevation&&!r.name.includes('入口')&&!r.name.includes('广场')),...data.streets,...data.cityDetail.harborLanes];
const allRoads=[...data.roads,...data.streets,...data.cityDetail.harborLanes,...e.roads];
const roadSegments=allRoads.flatMap(r=>r.points.slice(1).map((p,i)=>({points:[r.points[i],p],gap:(r.width||1.4)/2+1})));
roadSegments.forEach(o=>o.bounds=bounds(o.points));
const all=[...e.footprints,...e.microFootprints,...e.landmarks.map(l=>l.points)],boxes=all.map(bounds);

check('输入完全不变、确定性构建与已装配数据一致',()=>{
  assert.equal(JSON.stringify(data),before);
  assert.deepEqual(buildDistrictExpansion(data),generated);
  assert.deepEqual(e,generated,'atlas-data.js 的子区数据需要重新构建');
});
check('12 个概念子区字段完整，边界仅覆盖现有陆地',()=>{
  assert.equal(e.districts.length,12);assert.equal(new Set(e.districts.map(d=>d.id)).size,12);
  for(const d of e.districts){
    for(const k of ['id','name','en','parent','ri','at','points','bounds','desc','kind','theme'])assert.ok(k in d,d.id+' missing '+k);
    assert.equal(d.kind,'subdistrict');assert.equal(data.regions[d.ri].id,d.parent);
    assert.deepEqual(d.bounds,bounds(d.points));assert.ok(samples(d.points).every(onLand),d.id+'边界超出既有陆地');
    assert.ok(contains(d.at,d.points),d.id+'中心不在子区内');
  }
});
check('详细楼和简化楼预算有效，港北优先且外围递减',()=>{
  assert.ok(e.buildings.length>180&&e.buildings.length<=320);assert.ok(e.micro.length>400&&e.micro.length<=1000);
  assert.equal(e.buildings.length,e.footprints.length);assert.equal(e.micro.length,e.microFootprints.length);
  e.buildings.forEach((b,i)=>{assert.equal(b.length,9);assert.ok(b.every(Number.isFinite));assert.deepEqual(e.footprints[i],detailFootprint(b));});
  e.micro.forEach((m,i)=>{assert.equal(m.b.length,9);assert.ok(m.b.every(Number.isFinite));assert.ok(m.b[2]<=8&&m.b[3]<=7&&m.b[4]<=1.5);assert.deepEqual(e.microFootprints[i],detailFootprint(m.b));});
  assert.ok(e.metrics.harborNorth>=150,'港北补充未形成足够街坊');
  const count=id=>e.metrics.counts.find(c=>c.id===id);assert.ok(count('toyosu-ariake').buildings>count('ashigara-foothill').buildings*3);
  for(const c of e.metrics.counts)assert.ok(c.buildings>=5&&c.micro>=15,c.id+'没有可见的发展带');
});
check('全部新增楼与塔用地避开旧楼、公园、河流、港后设施及通道',()=>{
  all.forEach((fp,i)=>{
    assert.ok(samples(fp).every(onLand),'建筑完整足迹跨海岸 '+i);
    for(const o of [...solid,...roadSegments])if(near(boxes[i],o.bounds,o.gap))assert.ok(!plotsOverlap(fp,o.points,o.gap),'建筑碰既有用地或通道 '+i);
  });
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)if(near(boxes[i],boxes[j],.8))assert.ok(!plotsOverlap(all[i],all[j],.8),'新增体块互穿 '+i+'/'+j);
});
check('每条新增路按生成顺序接到地面路网，没有孤岛或穿楼过河',()=>{
  const connected=[...ground];
  for(const r of e.roads){
    assert.ok(r.name&&Number.isInteger(r.ri)&&r.width>0);assert.ok(r.points.every(p=>p.length===2&&p.every(Number.isFinite)));
    assert.ok(connected.some(old=>roadDistance(r.points[0],old.points)<.04),r.name+'未接地面街路');
    for(let k=1;k<r.points.length;k++){
      const segment=[r.points[k-1],r.points[k]],box=bounds(segment);assert.ok(samples(segment).every(onLand),r.name+'跨海');
      for(const o of solid)if(near(box,o.bounds,o.gap+r.width/2))assert.ok(!plotsOverlap(segment,o.points,o.gap+r.width/2),r.name+'穿过既有用地');
      for(let i=0;i<all.length;i++)if(near(box,boxes[i],r.width/2+.3))assert.ok(!plotsOverlap(segment,all[i],r.width/2+.3),r.name+'穿过新增建筑');
    }
    connected.push(r);
  }
});
check('天空塔独立保留用地、高度、地点数据与入口一致',()=>{
  const tower=e.landmarks.find(l=>l.id==='tokyo-skytree'),place=e.places.find(p=>p.id===tower.id);
  assert.equal(tower.meters,634);assert.equal(tower.height,42.27);assert.equal(tower.variant,'skytree');assert.deepEqual(tower.size,[40,36]);
  assert.ok(data.regions.find(r=>r.id==='lowtown').polygons.some(p=>inPolygon(tower.at,p)));
  assert.equal(place.group,'lowtown');assert.equal(place.type,'landmark');assert.equal(place.site,true);assert.equal(place.proposal,true);assert.deepEqual(place.at,tower.at);
  assert.equal(tower.provenance.position,'押上意象概念位置');assert.deepEqual(tower.provenance.projectedAt,[2255.41,1189.58]);assert.deepEqual(tower.provenance.conceptAt,tower.at);
  assert.ok(place.desc.includes('押上意象概念位置')&&place.desc.includes('简化河道')&&place.desc.includes('并非精确复原'));assert.deepEqual(place.provenance,tower.provenance);
  assert.ok(!data.services.some(p=>p.id===tower.id),'不得直接追加旧 services');
  const gate=e.roads.find(r=>r.name==='东京天空塔入口');assert.ok(gate);assert.ok(roadDistance(gate.points.at(-1),[...tower.points,tower.points[0]])<2);
});
check('贫民街区短巷有数量和长度上限，仅连接旧街与原有小楼空隙',()=>{
  const alleys=e.roads.filter(r=>r.name.includes('小巷'));assert.equal(alleys.length,e.metrics.alleys);assert.ok(alleys.length>0&&alleys.length<=24);
  for(const r of alleys){
    assert.ok(['underpool','lowtown'].includes(data.regions[r.ri].id));assert.equal(r.points.length,2);assert.ok(Math.hypot(r.points[0][0]-r.points[1][0],r.points[0][1]-r.points[1][1])<=38.03);
    assert.ok(data.streets.filter(s=>s.ri===r.ri).some(s=>roadDistance(r.points[0],s.points)<.04));
    assert.ok(data.cityDetail.micro.filter(m=>m.b[7]===r.ri&&Math.hypot(m.b[0]-r.points[1][0],m.b[1]-r.points[1][1])<14).length>=2,'小巷末端不在原小楼空隙');
  }
});
console.log(JSON.stringify({passed:groups.length,groups,source:data.districtExpansion?'assembled':'direct-build',metrics:e.metrics,tower:e.landmarks[0].at},null,2));
