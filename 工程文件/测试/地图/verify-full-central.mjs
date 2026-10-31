import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {contains,inPolygon,plotsOverlap,roadDistance} from "../../卡片源码/地图/atlas-source.mjs";
import {detailFootprint} from "../../卡片源码/地图/city-detail.mjs";
import {buildFullCentralGeography,buildFullCentral} from "../../卡片源码/地图/full-central.mjs";
import {buildMetropolitanRoads} from "../../卡片源码/地图/metropolitan-roads.mjs";

// Generates in memory only; no product, baseline, worldbook or accepted status is written.
const baseline=process.argv[2]||new URL('历史/M8-首批实施前-M7/atlas-data.js',import.meta.url);
const old=JSON.parse(fs.readFileSync(baseline,'utf8').slice(19).replace(/;\s*$/,''));
const original=JSON.stringify(old),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
freeze(old);
const geography=buildFullCentralGeography(old),network=buildMetropolitanRoads(geography),data=buildFullCentral(old,{reservedRoads:network.roads});
const range=(array,key)=>{const [start,count]=data.fullCentral.indices[key];return array.slice(start,start+count);};
const e={...data.fullCentral,buildings:range(data.districtExpansion.buildings,'buildings'),footprints:range(data.districtExpansion.footprints,'buildings'),micro:range(data.districtExpansion.micro,'micro'),microFootprints:range(data.districtExpansion.microFootprints,'micro'),roads:range(data.districtExpansion.roads,'roads'),places:range(data.districtExpansion.places,'places'),complexes:range(data.complexes,'complexes'),grounds:range(data.grounds,'grounds')};
const groups=[],check=(name,fn)=>{fn();groups.push(name);};
const bbox=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const near=(a,b,gap=0)=>a[0]<=b[2]+gap&&a[2]>=b[0]-gap&&a[1]<=b[3]+gap&&a[3]>=b[1]-gap;
const segmentSamples=(a,b,step=3)=>{const n=Math.max(1,Math.ceil(distance(a,b)/step));return Array.from({length:n+1},(_,i)=>a.map((v,k)=>v+(b[k]-v)*i/n));};
const edgeSamples=p=>p.flatMap((v,i)=>segmentSamples(v,p[(i+1)%p.length]));
const onLand=p=>data.landmass.some(r=>contains(p,r))&&!data.waterBodies.some(w=>contains(p,w.points));
const simple=p=>{
  const area=Math.abs(p.reduce((n,v,i)=>{const q=p[(i+1)%p.length];return n+v[0]*q[1]-q[0]*v[1];},0))/2;assert.ok(area>.02,'zero-area polygon');
  for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){if(j===i+1||(i===0&&j===p.length-1))continue;assert.ok(!plotsOverlap([p[i],p[(i+1)%p.length]],[p[j],p[(j+1)%p.length]],0),'self-intersection');}
};
check('冻结输入无变更，原ID/坐标/几何保留，仅授权的中心地名文字迁移',()=>{
  assert.equal(JSON.stringify(old),original);
  for(const key of ['buildings','footprints','streets','nodes','serviceTypes','features','portSites','landmarks','plaza','tower','specialSites','terrainContext','railNetwork'])assert.deepEqual(data[key],old[key],key);
  const comparableServices=rows=>rows.map(p=>{const c=structuredClone(p);if(['kai','fuji'].includes(c.group)){delete c.name;delete c.desc;}return c;});
  assert.deepEqual(comparableServices(data.services),comparableServices(old.services),'仅已授权地名文字可改变，服务ID/坐标及其他字段严格不变');
  const cityExpected=structuredClone(old.cityDetail);cityExpected.tram.stops.find(s=>s.id==='tram-t1-0').name='奥多摩东口';assert.deepEqual(data.cityDetail,cityExpected);
  for(const key of ['roads','buildings','footprints','micro','microFootprints','places','landmarks'])assert.deepEqual(data.districtExpansion[key].slice(0,old.districtExpansion[key].length),old.districtExpansion[key],key);
  const comparableDistricts=rows=>rows.map(p=>{const c=structuredClone(p);if(['hachioji-valley','ashigara-foothill'].includes(c.id))delete c.desc;return c;});
  assert.deepEqual(comparableDistricts(data.districtExpansion.districts.slice(0,old.districtExpansion.districts.length)),comparableDistricts(old.districtExpansion.districts));
  const comparableComplexes=rows=>rows.map(s=>{const c=structuredClone(s);if(['valley-terraces','fuji-observatory'].includes(c.id)){delete c.name;delete c.access.name;}return c;});
  assert.deepEqual(comparableComplexes(data.complexes.slice(0,old.complexes.length)),comparableComplexes(old.complexes));assert.deepEqual(data.rivers.slice(0,old.rivers.length),old.rivers);
  assert.deepEqual(e.metrics.removedOldBuildings,[]);assert.deepEqual(e.metrics.movedOldBuildings,[]);
});
check('中心地名逐项迁移与玩家文案完整；不改ID，不泄露施工说明',()=>{
  const names={'valley-terraces':'多摩山前阶庭','fuji-observatory':'丹泽边境观测站'};
  for(const s of data.services.filter(s=>['kai','fuji'].includes(s.group))){
    assert.ok(!/山梨|甲斐|富士/.test(s.name+' '+s.desc),s.id+'残留西部旧地名');
    if(names[s.id])assert.equal(s.name,names[s.id]);else assert.ok(s.name.startsWith(s.group==='kai'?'奥多摩 · ':'丹泽 · '));
  }
  for(const [id,name] of Object.entries(names)){const c=data.complexes.find(s=>s.id===id);assert.equal(c.name,name);assert.equal(c.access.name,name+'入口');}
  const engineering=/样板|人口尚未|未分配|不能重复归属|既有fuji|仅提出|不平移|本图为|概念地理|候选|待定|待审|提案|工程|保留为审阅/;
  for(const d of e.sectors){assert.ok(!engineering.test(d.desc+' '+d.theme),d.id+'施工文案进入产品');assert.ok(d.desc.length>15&&d.provenance.planningBasis);}
  for(const r of data.regions.slice(15))assert.ok(!engineering.test(r.cover+' '+r.art.theme+' '+r.dims.map(v=>v.v+v.d).join(' ')),r.id);
  for(const r of data.regions.filter(r=>['kai','fuji','docks'].includes(r.id)))assert.ok(!engineering.test(r.cover+' '+r.art.theme),r.id);
  assert.ok(data.districtExpansion.districts.find(d=>d.id==='hachioji-valley').desc.includes('多摩山前'));
  assert.ok(data.districtExpansion.districts.find(d=>d.id==='ashigara-foothill').desc.includes('丹泽'));
  assert.ok(data.roads.every(r=>!/甲斐|山梨|富士/.test(r.name)));
});
check('19分带全部实际铺设且父区索引覆盖，不以规划框冒称施工',()=>{
  assert.equal(e.sectors.length,19);assert.equal(data.regions.length,23);
  assert.deepEqual(data.regions.slice(0,15).map(r=>r.id),old.regions.map(r=>r.id));
  const rename={kai:'奥多摩山地',fuji:'丹泽山地',docks:'房总'};
  for(const [id,name] of Object.entries(rename))assert.equal(data.regions.find(r=>r.id===id).name,name);
  for(const d of e.sectors){
    simple(d.points);assert.equal(data.regions[d.ri].id,d.parent);assert.ok(d.detailCount>=12&&d.microCount>=35,d.id+'实际楼体不足');
    assert.ok(d.entryRoadIds.length>=3,d.id+'无实际路网');assert.ok(d.mainRoadIds.length,d.id+'未接骨干');
    assert.ok(data.regions[d.ri].polygons.some(p=>JSON.stringify(p[0])===JSON.stringify(d.points)),d.id+'父范围漏子区');
  }
  assert.equal(e.complexes.length,19,'每带特色设施未完成 '+e.sectors.filter(s=>!e.complexes.some(c=>c.id==='m8-site-'+s.id.slice(3))).map(s=>s.id).join(','));
  assert.ok(e.metrics.totalBuildingObjects>=8000&&e.metrics.totalBuildingObjects<=11000,'容量目标未达到 '+e.metrics.totalBuildingObjects);
});
check('稳定ID不串原点、未来富士和山梨DLC；新池只追加一次',()=>{
  const previous=new Set([...old.regions,...old.nodes,...old.services,...old.districtExpansion.districts,...old.districtExpansion.places,...old.complexes].map(v=>v.id));
  const ids=[...e.sectors,...e.roads,...e.places].map(v=>v.id);assert.equal(new Set(ids).size,ids.length);ids.forEach(id=>assert.ok(!previous.has(id),id));
  assert.ok(!data.regions.some(r=>['fuji-south','yamanashi-north'].includes(r.id)));
  assert.equal(data.districtExpansion.buildings.length,old.districtExpansion.buildings.length+e.buildings.length);
  assert.equal(data.districtExpansion.micro.length,old.districtExpansion.micro.length+e.micro.length);
});
check('连续大陆与霞浦水面完整，海湾岸线/双跨湾端点关系正确',()=>{
  data.landmass.forEach(simple);data.waterBodies.forEach(w=>simple(w.points));
  assert.equal(data.waterBodies[0].id,'kasumigaura');assert.ok(!onLand([3810,-80]),'霞浦被填');
  for(const p of [[2530,2220],[2480,2650],[3300,3530],[4800,2200]])assert.ok(!onLand(p),'海面被填 '+p);
  for(const p of [[2210,2200],[2870,2230],[2190,2820],[2860,2880],[2000,-1100],[4300,400],[3900,2100]])assert.ok(onLand(p),'陆地/桥端不连续 '+p);
  const originalBay=[...old.landmass[0].slice(5,11),...old.landmass[1].slice(5,10)];
  for(const p of originalBay)assert.ok(data.landmass[0].some(v=>distance(v,p)<.01),'旧湾岸节点漂移 '+p);
});
check('新增山地/丘陵有原创等高线与林地，不抬升旧城或冒充实测高程',()=>{
  assert.equal(data.geographyNatural.length,3);assert.ok(data.geographyContours.length>=10);
  for(const c of data.geographyContours){simple(c.points);assert.ok(edgeSamples(c.points).every(onLand));assert.ok(c.height<=3.5&&c.provenance.includes('不是真实DEM'));}
  for(const g of data.geographyNatural){assert.ok(['kai','fuji','docks'].includes(g.region));assert.ok(data.regions[g.ri].id===g.region);simple(g.points);}
  assert.equal(data.mapVersion,'full-1');assert.equal(data.displayName,'东京都 · 中心大区');
  for(const key of ['buildings','footprints','micro','microFootprints','roads','grounds','places','complexes'])assert.ok(!(key in data.fullCentral),'重复实体池 '+key);
});
const all=e.buildings.concat(e.micro.map(m=>m.b)),fps=e.footprints.concat(e.microFootprints),envelopes=all.map(detailFootprint),boxes=envelopes.map(bbox);
check('新增全部完整足迹简单、在正确地区陆地内，避河/湖不靠中心判定',()=>{
  assert.equal(all.length,fps.length);
  for(let i=0;i<all.length;i++){
    const b=all[i];assert.equal(b.length,9);assert.ok(b.every(Number.isFinite));assert.ok(b[2]>0&&b[3]>0&&b[4]>0);simple(fps[i]);
    assert.ok(edgeSamples(envelopes[i]).every(onLand),'越海/湖足迹 '+i);
    assert.ok(data.regions[b[7]].polygons.some(p=>fps[i].every(v=>inPolygon(v,p))),'地区不包含楼 '+i);
    for(const river of data.rivers)for(let k=1;k<river.points.length;k++)if(near(boxes[i],bbox([river.points[k-1],river.points[k]]),river.width/2+2))assert.ok(!plotsOverlap(envelopes[i],[river.points[k-1],river.points[k]],river.width/2+2),'压河 '+river.name);
    for(const w of data.waterBodies)assert.ok(!plotsOverlap(envelopes[i],w.points,3),'跨湖 '+i);
  }
  assert.ok(new Set(e.footprints.map(p=>p.length)).size>=3,'详细楼轮廓单一');
});
check('新增建筑完整轮廓避所有旧楼/公园/设施，与新增相互留巷道',()=>{
  const prior=[...old.footprints,...old.cityDetail.microFootprints,...old.districtExpansion.footprints,...old.districtExpansion.microFootprints,...old.specialSites.map(s=>s.points),...old.complexes.map(s=>s.points),...old.terrainContext.complexes.map(s=>s.points),...old.districtExpansion.landmarks.map(s=>s.points),...old.cityDetail.harborPlots.map(s=>s.points),...old.grounds.filter(g=>g.type==='park').map(g=>g.points)],pb=prior.map(bbox);
  const bins=new Map(),cells=b=>{const keys=[];for(let y=Math.floor((b[1]-4)/64);y<=Math.floor((b[3]+4)/64);y++)for(let x=Math.floor((b[0]-4)/64);x<=Math.floor((b[2]+4)/64);x++)keys.push(x+','+y);return keys;};
  prior.forEach((p,i)=>cells(pb[i]).forEach(k=>{if(!bins.has(k))bins.set(k,[]);bins.get(k).push({p,b:pb[i]});}));
  for(let i=0;i<envelopes.length;i++){
    const found=new Set(cells(boxes[i]).flatMap(k=>bins.get(k)||[]));for(const o of found)if(near(boxes[i],o.b,1))assert.ok(!plotsOverlap(envelopes[i],o.p,1),'楼体相撞 '+i);
    for(const k of cells(boxes[i])){if(!bins.has(k))bins.set(k,[]);bins.get(k).push({p:envelopes[i],b:boxes[i]});}
  }
});
const roads=[...network.roads,...old.streets,...old.districtExpansion.roads,...old.cityDetail.harborLanes,...e.roads];
check('全部新楼避主路全宽+肩带及实际小路，替换骨干不洗旧城',()=>{
  assert.deepEqual(data.roads,network.roads);
  const segments=roads.flatMap(r=>r.points.slice(1).map((p,i)=>({p:[r.points[i],p],gap:(r.width||1.4)/2+(network.roads.includes(r)?3.9:1.2),name:r.name}))).map(o=>({...o,b:bbox(o.p)}));
  for(let i=0;i<envelopes.length;i++)for(const s of segments)if(near(boxes[i],s.b,s.gap))assert.ok(!plotsOverlap(envelopes[i],s.p,s.gap),'压道路 '+s.name+' / '+i);
});
check('每条新街入口接真实线段、完整线宽在陆地，不造虚假道路连通',()=>{
  const connected=[...network.roads,...old.streets,...old.districtExpansion.roads,...old.cityDetail.harborLanes];
  for(const r of e.roads){
    assert.ok(r.id&&r.name&&r.purpose&&r.width>0&&r.entry);assert.deepEqual(r.points[0],r.entry.at);
    assert.ok(connected.some(p=>(p.id||p.name)===r.entry.roadId&&roadDistance(r.entry.at,p.points)<.08),'入口悬空 '+r.id);
    for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],len=distance(a,b);assert.ok(len>.1);const nx=-(b[1]-a[1])/len,ny=(b[0]-a[0])/len;
      for(const p of segmentSamples(a,b))for(const side of [-1,0,1])assert.ok(onLand([p[0]+nx*side*(r.width/2+.9),p[1]+ny*side*(r.width/2+.9)]),'新街跨水/出陆 '+r.id);
    }connected.push(r);
  }
});
check('新增设施有地块、入口与不相交独立轮廓，功能类型不借交易行为',()=>{
  for(const s of e.complexes){
    simple(s.points);assert.ok(edgeSamples(s.points).every(onLand),s.id);assert.ok(s.access&&s.access.points.length===2&&s.forecourt.length===2);
    assert.ok(roads.some(r=>roadDistance(s.access.points[1],r.points)<.08),'设施入口不接路 '+s.id);
    s.footprints.forEach(simple);for(let i=0;i<s.footprints.length;i++)for(let j=i+1;j<s.footprints.length;j++)assert.ok(!plotsOverlap(s.footprints[i],s.footprints[j],.5),'设施部件相撞 '+s.id);
    for(const fp of s.footprints)assert.ok(!plotsOverlap(fp,s.forecourt,1),'庭内线穿楼 '+s.id);
    assert.ok(e.places.some(p=>p.id===s.id&&p.proposal&&p.type==='landmark'));
  }
});
check('城镇/厂房/山区形态与留白有实际差异，非全世界均匀撒楼',()=>{
  const means=mode=>{const rows=e.buildings.filter(b=>e.sectors.some(d=>d.ri===b[7]&&d.mode===mode&&contains([b[0],b[1]],d.points)));return rows.reduce((n,b)=>n+b[4],0)/rows.length;};
  assert.ok(means('urban')>means('mountain')*1.6);assert.ok(means('station')>means('mountain')*1.6);
  assert.ok(e.grounds.filter(g=>g.type==='park').length>=15,'山林留白不足');assert.ok(e.grounds.some(g=>g.type==='field'),'缺少农地');
  assert.ok(e.micro.length>e.buildings.length*2,'外围小楼未简化');
});
check('同一冻结输入与同一道路结果完全重现，原输入无写入',()=>{
  assert.equal(hash(buildFullCentral(old,{reservedRoads:network.roads})),hash(data));assert.equal(JSON.stringify(old),original);
});
console.log(JSON.stringify({ok:true,groups:groups.length,checks:groups,metrics:e.metrics,sectors:e.sectors.map(d=>({id:d.id,detail:d.detailCount,micro:d.microCount,roads:d.entryRoadIds.length})),dataBytes:Buffer.byteLength(JSON.stringify(data)),hash:hash(data),evidence:'纯离线生成/几何验证，不是浏览器、性能或真实宿主验收'},null,2));
