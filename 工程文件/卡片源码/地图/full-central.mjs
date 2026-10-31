// Full M8 center: concept geography and actual built-up corridors, never a real cadastral map.
// Frozen M7 street/building/landmark records are copied, not regenerated.
import {world,sectors,geography} from './central-layout.mjs';
import {contains,inPolygon,plotsOverlap,roadDistance} from './atlas-source.mjs';
import {detailFootprint} from './city-detail.mjs';

const copy=v=>structuredClone(v),round=v=>Math.round(v*100)/100;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix=(a,b,t)=>a.map((v,i)=>round(v+(b[i]-v)*t));
const bounds=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const edgeSamples=p=>p.flatMap((a,i)=>{const b=p[(i+1)%p.length],n=Math.max(1,Math.ceil(dist(a,b)/4));return Array.from({length:n},(_,j)=>mix(a,b,j/n));});
const parentIds={'saitama-north':'saitama','tone-south':'chiba','narita-hokuso':'chiba','chiba-extension':'chiba',okutama:'kai',tanzawa:'fuji','boso-kisarazu':'docks','boso-kimitsu':'docks','boso-futtsu':'docks','boso-interior':'docks','boso-pacific':'docks'};
const modes={ryomo:'industry','north-gateway':'station','mito-oarai':'port','saitama-north':'station','tsukuba-north':'campus','tone-south':'mixed','kashima-kamisu':'industry','narita-hokuso':'logistics','chiba-extension':'urban',choshi:'port',kujukuri:'coast',okutama:'mountain',tanzawa:'mountain','yokohama-miura':'urban','boso-kisarazu':'urban','boso-kimitsu':'industry','boso-futtsu':'coast','boso-interior':'hill','boso-pacific':'coast'};
const districtText={
  ryomo:['北部制造镇与农地','厂院、制造镇与货运街坊','高崎、前桥方向的北部工业走廊。厂院和制造镇沿交通轴成串分布，农地在城镇之间展开。'],
  'north-gateway':['北向门户 · 密集站城','站城塔群与外围农田','小山与宇都宫南缘的北向门户。居住塔群、配送设施和传统聚落在道路旁汇聚，外侧展开大片农田。'],
  'mito-oarai':['太平洋岸 · 港城与绿地','港城街坊与仓储院落','面向太平洋的水户、大洗港城带。居住街区与仓储厂院向海岸靠拢，外围绿地隔开不同的城镇组团。'],
  'saitama-north':['北部通勤带 · 站城与村镇','板楼住区、工场与农地','从埼玉向北延展的通勤带。密集站城与本地工场接续，外围逐渐过渡为农田和村镇。'],
  'tsukuba-north':['湖西研究城 · 园区与住区','研究院区与生活街坊','筑波、土浦方向的研究城镇。研究院区与生活街坊沿道路相连，城镇边缘接入农地和湖畔绿地。'],
  'tone-south':['利根南岸 · 厂住与旧镇','旧镇、厂住街坊与换装场','柏、松户方向的城市联系带。旧镇、厂住街坊和换装场沿水道展开，田地在聚落之间穿行。'],
  'kashima-kamisu':['外海工业港 · 港后住区','炼化储罐、长厂房与作业院落','太平洋岸的重工业港城。长厂房、储罐和港后住区分开成组，宽阔作业院落隔开不同厂区。'],
  'narita-hokuso':['北总台地 · 航空物流与站城','物流仓库与密集站城','成田、北总台地上的航空物流带。仓库、换装厂院和密集站城相接，外围保留田地与低层聚落。'],
  'chiba-extension':['湾东城市带 · 居住与物流','高层住区、混合街坊与物流园','东京湾东岸向内陆延续的城市带。高层住区、混合街坊和物流园沿通勤道路延伸，南侧接入房总。'],
  choshi:['利根河口 · 滨水港镇','河港市场、仓库与滨水住区','利根川与太平洋相接的河口城镇。市场、仓库和滨水居住组团沿河岸靠拢，边缘留出开阔水岸。'],
  kujukuri:['太平洋滨海带 · 加工与聚落','滨海加工场与沿路聚落','九十九里的狭长滨海平原。加工場与生活聚落沿海岸道路成串，内陆一侧展开平缓田野。'],
  okutama:['西部山林 · 谷地与多摩山前','山脊、谷口聚落与台地住区','奥多摩山林环绕谷地聚落，多摩山前连接八王子与青梅方向。房屋和道路沿谷口展开，西侧山脊留下大块林地。'],
  tanzawa:['丹泽水源山地 · 相模山前','林地、山麓村落与观测院落','丹泽水源山地与相模山前相接。村落沿谷地道路分散，观测设施和稀疏院落隐在山麓林地之间。'],
  'yokohama-miura':['东京湾西岸 · 南部城市与半岛','高层副中心、坡地住区与工场','沿东京湾西岸向三浦半岛延伸的南部城市带。高层副中心、坡地住区和工场交错，海岸与绿地为街坊留下间隔。'],
  'boso-kisarazu':['房总西北 · 旧港城','港城生活街坊与物流厂院','木更津的旧港城生活带。居住街坊、厂院和港口物流相邻，沿湾道路连接君津方向。'],
  'boso-kimitsu':['房总湾岸 · 重件产业带','总装厂房与港工院落','君津的沿湾工业带。重件总装库、长厂房和港工院落沿运输道路展开，住区分布在厂院外缘。'],
  'boso-futtsu':['东京湾口 · 渔港与丘陵','换装场、滨海住区与丘陵','富津的湾口海岸聚落。换装场、渔业厂院和住区沿岸展开，背后逐渐转为丘陵绿地。'],
  'boso-interior':['房总内陆 · 丘陵与水源绿地','谷口城镇、农地与连续林地','房总内陆的丘陵与水源地。城镇收在谷口，村落和农地沿山前窄路相连，腹地保留连续林地。'],
  'boso-pacific':['外房海岸 · 聚落与航天用地','海岸城镇与独立航天院落','面向太平洋的外房沿海带。海岸聚落与航天勤务用地分开布置，厂房和发射设施沿专属入口接入内陆道路。']
};
const centerSiteNames={'valley-terraces':'多摩山前阶庭','fuji-observatory':'丹泽边境观测站'};
function renameCenterDisplay(data){
  for(const p of data.services)if(['kai','fuji'].includes(p.group)){
    const prefix=p.group==='kai'?'奥多摩':'丹泽';
    if(centerSiteNames[p.id])p.name=centerSiteNames[p.id];
    else p.name=p.name.replace(/^(?:山梨|甲斐|富士山域|富士)(?=\s*·)/,prefix);
    if(p.desc)p.desc=p.desc.replace(p.group==='kai'?/^山梨的/:/^富士山域的/,prefix+'的');
  }
  for(const c of data.complexes)if(centerSiteNames[c.id]){c.name=centerSiteNames[c.id];if(c.access)c.access.name=c.name+'入口';}
  const tram=data.cityDetail.tram.stops.find(s=>s.id==='tram-t1-0');if(tram?.name==='山梨东口')tram.name='奥多摩东口';
  const valleys={'hachioji-valley':'八王子谷口连接多摩山前的生活与生产街坊。沿谷小镇和台地入口顺着地面道路展开，山林与公共绿地留在街坊外侧。','ashigara-foothill':'足柄山麓位于丹泽方向的林地边缘。村落和小型院落沿山前道路分散，绿地延伸到台地与谷口之间。'};
  for(const d of data.districtExpansion.districts)if(valleys[d.id])d.desc=valleys[d.id];
  const roads={'甲斐阶庭中心入口':'多摩山前阶庭入口','富士边境观测站入口':'丹泽边境观测站入口','山梨联络线':'奥多摩联络线','富士联络线':'丹泽联络线'};
  for(const r of data.roads)if(roads[r.name])r.name=roads[r.name];
}

export function buildFullCentralGeography(frozenM7){
  const data=copy(frozenM7);
  data.world={...data.world,...copy(world)};
  data.mapId='tokyo-central';data.mapVersion='full-1';data.displayName='东京都 · 中心大区';
  // The ocean boundary expands; the existing compressed bay shore is retained vertex-for-vertex.
  data.landmass=[copy(geography.land)];
  data.waterBodies=[{id:'kasumigaura',name:'霞浦',kind:'lake',points:copy(geography.lake.points)}];
  data.rivers.push({id:'m8-tone',name:'利根川',width:12,points:copy(geography.rivers[0].points),provenance:'原创概念水系；非实测河道'},
    {id:'m8-kasumi-outlet',name:'霞浦出水联系',width:8,points:copy(geography.rivers[1].points),provenance:'概念出水联系'});
  const rename={kai:['奥多摩山地','OKUTAMA','西部山林、谷地与多摩山前'],fuji:['丹泽山地','TANZAWA','丹泽山林、足柄村镇与相模山前'],docks:['房总','BOSO','木更津、君津、内陆丘陵与外房海岸']};
  for(const r of data.regions)if(rename[r.id]){[r.name,r.en,r.cover]=rename[r.id];r.previousName=frozenM7.regions.find(v=>v.id===r.id).name;}
  renameCenterDisplay(data);
  data.fullCentral={id:'m8-full-center',status:'implemented-geography',sectors:[],ridges:copy(geography.ridges),contours:[],naturalAreas:[],buildings:[],footprints:[],micro:[],microFootprints:[],roads:[],grounds:[],places:[],complexes:[],metrics:{},provenance:'2051原创概念扩图；保留旧城；不等于GIS测绘或世界书行政断言'};
  for(const s of sectors){
    const parent=parentIds[s.id]||s.id;let ri=data.regions.findIndex(r=>r.id===parent);
    if(ri<0){ri=data.regions.length;data.regions.push({id:parent,name:s.name,en:parent.toUpperCase().replaceAll('-',' '),color:s.color,cover:districtText[s.id][0],at:copy(s.at),angle:0,density:.65,kind:'new',dims:[{k:'地貌',v:districtText[s.id][0],d:districtText[s.id][2]}],polygons:[],bounds:bounds(s.points),art:{theme:districtText[s.id][1],shapes:[0,1,3,4],street:'curved'},provenance:{planningBasis:s.purpose}});}
    const r=data.regions[ri];r.polygons.push([copy(s.points)]);
    r.bounds=bounds(r.polygons.flatMap(p=>p[0]));
    if(['kai','fuji'].includes(parent))r.art.theme=districtText[s.id][1];
    const district={id:'m8-'+s.id,name:s.name,en:s.id.toUpperCase().replaceAll('-',' '),parent,ri,at:copy(s.at),points:copy(s.points),bounds:bounds(s.points),kind:'subdistrict',theme:districtText[s.id][1],desc:districtText[s.id][2],mode:modes[s.id],openSpaces:[],provenance:{planningBasis:s.purpose,densityBasis:s.density}};
    data.fullCentral.sectors.push(district);
  }
  // Shaded hills/contours are concept relief only; they do not lift the existing city or claim DEM data.
  const ridges=[{id:'okutama',region:'kai',at:[-230,560],radii:[410,620],color:'#817e99'},
    {id:'tanzawa',region:'fuji',at:[-20,1960],radii:[430,320],color:'#9a876d'},
    {id:'boso',region:'docks',at:[3550,2410],radii:[180,340],color:'#7d9277'}];
  for(const ridge of ridges)for(let level=0;level<4;level++){
    const scale=1-level*.19,points=Array.from({length:26},(_,i)=>{
      const a=i*Math.PI*2/26,k=1+Math.sin(a*3+.6)*.09+Math.cos(a*5-.2)*.05;
      return [round(ridge.at[0]+Math.cos(a)*ridge.radii[0]*scale*k),round(ridge.at[1]+Math.sin(a)*ridge.radii[1]*scale*k)];
    });
    if(!edgeSamples(points).every(p=>data.landmass.some(r=>contains(p,r))&&!data.waterBodies.some(w=>contains(p,w.points))))continue;
    const c={id:'m8-contour-'+ridge.id+'-'+level,points,level,height:1+level*.8,region:ridge.region,color:ridge.color,provenance:'原创概念等高线；不是真实DEM，不抬升楼体'};
    data.fullCentral.contours.push(c);
    if(!level)data.fullCentral.naturalAreas.push({id:'m8-forest-'+ridge.id,region:ridge.region,ri:data.regions.findIndex(r=>r.id===ridge.region),points:copy(points),kind:'forest',color:ridge.color});
  }
  data.geographyContours=copy(data.fullCentral.contours);data.geographyNatural=copy(data.fullCentral.naturalAreas);
  return data;
}

const footprint=b=>{
  const [x,y,w,d,,angle,kind]=b,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  let p=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
  if(kind===3)p=[[-.5,-.5],[.5,-.5],[.5,-.1],[-.05,-.1],[-.05,.5],[-.5,.5]];
  if(kind===4)p=[[-.5,-.5],[.5,-.5],[.5,.5],[.22,.5],[.22,-.12],[-.22,-.12],[-.22,.5],[-.5,.5]];
  if(kind===5)p=Array.from({length:12},(_,i)=>[Math.cos(i*Math.PI/6)*.5,Math.sin(i*Math.PI/6)*.5]);
  return p.map(([u,v])=>[round(x+u*w*c-v*d*s),round(y+u*w*s+v*d*c)]);
};

function spatialIndex(){
  const bins=new Map(),cells=(p,gap=0)=>{const b=bounds(p),keys=[];for(let y=Math.floor((b[1]-gap)/64);y<=Math.floor((b[3]+gap)/64);y++)for(let x=Math.floor((b[0]-gap)/64);x<=Math.floor((b[2]+gap)/64);x++)keys.push(x+','+y);return keys;};
  return {add(points,gap=0,meta={}){const o={points,gap,...meta};for(const k of cells(points,gap)){if(!bins.has(k))bins.set(k,[]);bins.get(k).push(o);}return o;},query(points,gap=0){return [...new Set(cells(points,gap).flatMap(k=>bins.get(k)||[]))];},blocked(points,gap=0){return this.query(points,gap).some(o=>plotsOverlap(points,o.points,gap+o.gap));}};
}

export function buildFullCentral(frozenM7,{reservedRoads=[]}={}){
  const data=buildFullCentralGeography(frozenM7),out=data.fullCentral;
  let seed=20510819;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const solids=spatialIndex(),roadIndex=spatialIndex(),waterIndex=spatialIndex();
  const onLand=p=>data.landmass.some(r=>contains(p,r))&&!data.waterBodies.some(w=>contains(p,w.points));
  for(const w of data.waterBodies)waterIndex.add(w.points,4);
  for(const r of data.rivers)for(let i=1;i<r.points.length;i++)waterIndex.add([r.points[i-1],r.points[i]],r.width/2+3);
  const landClear=points=>edgeSamples(points).every(onLand)&&!waterIndex.blocked(points);
  const oldSolids=[...data.footprints,...data.cityDetail.microFootprints,...data.districtExpansion.footprints,...data.districtExpansion.microFootprints,
    ...data.specialSites.map(s=>s.points),...data.complexes.map(s=>s.points),...data.terrainContext.complexes.map(s=>s.points),
    ...data.districtExpansion.landmarks.map(s=>s.points),...data.cityDetail.harborPlots.map(s=>s.points),...data.grounds.filter(g=>g.type==='park').map(g=>g.points)];
  oldSolids.forEach(p=>solids.add(p,1.5,{old:true}));
  data.specialSites.forEach(s=>solids.add(s.points,s.setback||2,{old:true}));
  for(const p of data.railNetwork.piers)solids.add(detailFootprint([...p.at,2,2,0,0]),2,{old:true});
  const retainedRoads=[...data.streets,...data.districtExpansion.roads,...data.cityDetail.harborLanes];
  const mainRoads=reservedRoads.length?copy(reservedRoads):copy(data.roads);
  const allRoads=[...mainRoads,...retainedRoads];
  const indexRoad=r=>{for(let i=1;i<r.points.length;i++)roadIndex.add([r.points[i-1],r.points[i]],(r.width||1.4)/2+(mainRoads.includes(r)?4:1.5),{road:r});};
  allRoads.forEach(indexRoad);
  for(const r of data.railNetwork.routes||[])if(r.points)for(let i=1;i<r.points.length;i++)roadIndex.add([r.points[i-1],r.points[i]],2,{rail:true});
  const nearest=(p,roads)=>{
    let best=null;for(const r of roads)for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;if(!len)continue;
      const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)),at=mix(a,b,t),distance=dist(p,at);
      if(!best||distance<best.distance)best={road:r,at,distance,angle:Math.atan2(dy,dx),segment:i-1};
    }return best;
  };
  const corridorLand=(points,width)=>points.slice(1).every((b,i)=>{
    const a=points[i],len=dist(a,b);if(len<.1)return false;const nx=-(b[1]-a[1])/len,ny=(b[0]-a[0])/len,n=Math.ceil(len/4);
    return Array.from({length:n+1},(_,j)=>mix(a,b,j/n)).every(p=>[-1,0,1].every(side=>onLand([p[0]+nx*side*(width/2+1),p[1]+ny*side*(width/2+1)])))&&!waterIndex.blocked([a,b],width/2);
  });
  const roadClear=(points,width)=>corridorLand(points,width)&&points.slice(1).every((p,i)=>!solids.blocked([points[i],p],width/2+.7));
  const addRoad=(d,points,width,purpose,entry)=>{
    if(points.length<2||!roadClear(points,width))return null;
    const r={id:d.id+'-street-'+(out.roads.length+1),name:d.name+'·'+purpose,ri:d.ri,points:points.map(p=>p.map(round)),width:round(width),elevation:0,purpose,entry,kind:'local-street',provenance:'M8新增城镇街路；不改M7小路'};
    out.roads.push(r);allRoads.push(r);indexRoad(r);return r;
  };
  const growthNodes=new Map();
  // Urban islands grow from road intersections, not from an evenly spaced world grid.
  const growDistrict=d=>{
    const anchors=[];
    for(const r of mainRoads)for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],n=Math.max(1,Math.ceil(dist(a,b)/90));
      for(let j=0;j<=n;j++){const at=mix(a,b,j/n);if(contains(at,d.points)&&onLand(at)&&!waterIndex.blocked([at,[at[0]+.01,at[1]]],3))anchors.push({at,road:r,angle:Math.atan2(b[1]-a[1],b[0]-a[0])});}
    }
    const order=anchors.sort((a,b)=>dist(a.at,d.at)-dist(b.at,d.at));
    const chosen=[];for(const a of order)if(chosen.every(v=>dist(v.at,a.at)>125)&&chosen.length<7)chosen.push(a);
    // A sector lacking a through-road attaches to the nearest actual roadway, never its label.
    if(!chosen.length){const q=nearest(d.at,allRoads);if(q&&q.distance<450&&roadClear([q.at,d.at],2)){
      const r=addRoad(d,[q.at,d.at],2,'城镇入口',{kind:'road',roadId:q.road.id||q.road.name,at:q.at});if(r)chosen.push({at:d.at,road:r,angle:q.angle});
    }}
    const nodes=[];
    for(const a of chosen)for(const side of [-1,1]){
      const angle=a.angle+side*Math.PI/2+(rnd()-.5)*.4,len=90+rnd()*100;
      const elbow=[round(a.at[0]+Math.cos(angle)*len*.53),round(a.at[1]+Math.sin(angle)*len*.53)];
      const end=[round(elbow[0]+Math.cos(angle+side*.2)*len*.47),round(elbow[1]+Math.sin(angle+side*.2)*len*.47)];
      if(![elbow,end].every(p=>contains(p,d.points)))continue;
      const r=addRoad(d,[a.at,elbow,end],['industry','logistics','port'].includes(d.mode)?3:2.2,'组团接驳街',{kind:'road',roadId:a.road.id||a.road.name,at:a.at});
      if(r)nodes.push({at:elbow,road:r,angle:angle+side*.2,degree:0},{at:end,road:r,angle:angle+side*.2,degree:0});
    }
    growthNodes.set(d.id,nodes);
    d.mainRoadIds=[...new Set(chosen.map(a=>a.road.id||a.road.name))];
  };
  const branchDistrict=d=>{
    const nodes=growthNodes.get(d.id)||[],target=['mountain','hill'].includes(d.mode)?28:['coast','port'].includes(d.mode)?42:54;
    for(let attempt=0;attempt<target*45&&out.roads.filter(r=>r.ri===d.ri&&r.id.startsWith(d.id+'-')).length<target&&nodes.length;attempt++){
      const node=nodes[Math.floor(rnd()*nodes.length)];if(node.degree>=2)continue;
      const angle=node.angle+(rnd()<.35?0:(rnd()<.5?1:-1)*(1.0+rnd()*.4))+(rnd()-.5)*.35,len=55+rnd()*95;
      const p1=[round(node.at[0]+Math.cos(angle)*len*.5),round(node.at[1]+Math.sin(angle)*len*.5)];
      const p2=[round(p1[0]+Math.cos(angle+(rnd()-.5)*.45)*len*.5),round(p1[1]+Math.sin(angle+(rnd()-.5)*.45)*len*.5)];
      if(![p1,p2].every(p=>contains(p,d.points))||allRoads.some(r=>r!==node.road&&roadDistance(p2,r.points)<10))continue;
      const width=['industry','logistics','port'].includes(d.mode)?2.0:['mountain','hill','coast'].includes(d.mode)?1.2:1.5;
      const r=addRoad(d,[node.at,p1,p2],width,d.mode==='mountain'?'谷地村镇支路':d.mode==='industry'?'厂住接驳街':'居住与生活支街',{kind:'road',roadId:node.road.id||node.road.name,at:node.at});
      if(r){node.degree++;nodes.push({at:p1,road:r,angle,degree:0},{at:p2,road:r,angle,degree:0});}
    }
    d.entryRoadIds=out.roads.filter(r=>r.id.startsWith(d.id+'-')).map(r=>r.id);
  };
  out.sectors.forEach(growDistrict);
  const facilityNames={ryomo:'两毛制造联合厂','north-gateway':'北门户综合站城','mito-oarai':'水户大洗港城中心','saitama-north':'北埼玉轨道生活组团','tsukuba-north':'筑波研究园','tone-south':'利根南岸换装场','kashima-kamisu':'鹿岛港后炼化厂','narita-hokuso':'北总航空物流组团','chiba-extension':'千叶东部复合站城',choshi:'銚子河港市场',kujukuri:'九十九里滨海加工场',okutama:'奥多摩谷口站城',tanzawa:'丹泽山前院落中心','yokohama-miura':'横滨湾岸复合中心','boso-kisarazu':'木更津港城生活组团','boso-kimitsu':'君津重件总装厂','boso-futtsu':'富津渔港换装场','boso-interior':'房总谷地水源园','boso-pacific':'外房航天勤务中心'};
  const addFacility=d=>{
    const sectorId=d.id.slice(3),local=out.roads.filter(r=>r.id.startsWith(d.id+'-'));
    const industrial=['industry','logistics','port'].includes(d.mode),space=sectorId==='boso-pacific';
    local.push(...mainRoads.filter(r=>r.points.some(p=>contains(p,d.points))));
    const size=space?[112,100]:industrial?[86,68]:['mountain','hill'].includes(d.mode)?[54,48]:[74,66];
    let candidate=null;
    for(let attempt=0;attempt<2200&&!candidate&&local.length;attempt++){
      const r=local[Math.floor(rnd()*local.length)],i=1+Math.floor(rnd()*(r.points.length-1)),a=r.points[i-1],b=r.points[i],p=mix(a,b,.2+rnd()*.6),side=rnd()<.5?-1:1;
      const len=dist(a,b),nx=-(b[1]-a[1])/len*side,ny=(b[0]-a[0])/len*side,offset=Math.hypot(...size)/2+10;
      const at=[round(p[0]+nx*offset),round(p[1]+ny*offset)],plot=detailFootprint([...at,...size,0,0]);
      if(space&&dist(at,[4010,2570])>230)continue;
      if(!plot.every(q=>contains(q,d.points))||!landClear(plot)||solids.blocked(plot,2)||roadIndex.blocked(plot,2))continue;
      const hit=nearest(at,local);if(!hit||hit.distance>100)continue;
      const dx=hit.at[0]-at[0],dy=hit.at[1]-at[1],t=1/Math.max(Math.abs(dx)/(size[0]/2),Math.abs(dy)/(size[1]/2)),gate=[round(at[0]+dx*t),round(at[1]+dy*t)];
      if(!roadClear([hit.at,gate],2))continue;candidate={at,plot,gate,hit};
    }
    // A busy old port can exhaust frontage samples. Search only real vacant land with a clear
    // short service connection; never relocate its old buildings or count an unbuilt reservation.
    if(!candidate&&local.length){
      const bb=d.bounds;let score=Infinity;
      for(let y=bb[1]+size[1]/2+4;y<bb[3]-size[1]/2-4;y+=18)for(let x=bb[0]+size[0]/2+4;x<bb[2]-size[0]/2-4;x+=18){
        const at=[round(x),round(y)];if(space&&dist(at,[4010,2570])>230)continue;
        const hit=nearest(at,local);if(!hit||hit.distance>190)continue;
        const value=hit.distance+dist(at,space?[4010,2570]:d.at)*.015;if(value>=score)continue;
        const plot=detailFootprint([...at,...size,0,0]);
        if(!plot.every(q=>contains(q,d.points))||!landClear(plot)||solids.blocked(plot,2)||roadIndex.blocked(plot,2))continue;
        const dx=hit.at[0]-at[0],dy=hit.at[1]-at[1],t=1/Math.max(Math.abs(dx)/(size[0]/2),Math.abs(dy)/(size[1]/2)),gate=[round(at[0]+dx*t),round(at[1]+dy*t)];
        if(!roadClear([hit.at,gate],2))continue;candidate={at,plot,gate,hit};score=value;
      }
    }
    if(!candidate)return;
    const {at,plot,gate,hit}=candidate,id='m8-site-'+sectorId;
    let partSpecs;
    if(space)partSpecs=[[-30,-21,34,23,11,0,1],[28,-24,30,30,.6,0,5],[-30,22,27,28,7,0,3],[27,23,26,26,.6,0,5],[5,0,8,11,24,0,0]];
    else if(industrial)partSpecs=[[-20,-15,34,16,7,0,1],[20,-14,26,18,9,0,1],[-20,17,25,19,5,0,3],[22,16,20,23,12,0,0]];
    else if(d.mode==='campus')partSpecs=[[-18,-16,22,18,12,0,3],[18,-14,23,19,9,0,4],[-17,17,22,18,7,0,1],[20,17,18,18,8,0,5]];
    else if(['mountain','hill'].includes(d.mode))partSpecs=[[-12,-9,19,15,5,0,3],[13,-9,17,15,4,0,0],[1,13,24,12,3,0,1]];
    else partSpecs=[[-19,-16,22,18,28,0,3],[19,-15,22,20,21,0,4],[-18,18,22,18,14,0,1],[18,19,24,17,8,0,0]];
    const distinct={
      'kashima-kamisu':[[-20,-14,30,17,7,0,1],[22,-17,18,18,8,0,5],[23,12,20,20,9,0,5],[-21,16,18,24,19,0,0]],
      'narita-hokuso':[[-20,-17,32,17,8,0,1],[19,-16,26,19,8,0,1],[-20,17,32,17,6,0,1],[23,16,17,22,15,0,0]],
      'mito-oarai':[[-20,-17,35,17,6,0,1],[20,-14,25,20,8,0,3],[-19,17,29,17,5,0,1],[24,17,17,21,13,0,0]],
      'boso-kimitsu':[[-23,-14,28,21,13,0,1],[19,-17,29,16,9,0,1],[-20,18,31,16,6,0,3],[24,17,15,20,16,0,0]],
      'choshi':[[-19,-17,25,17,7,0,3],[19,-16,24,18,6,0,1],[-18,18,22,18,4,0,1],[19,18,24,17,9,0,0]],
      'kujukuri':[[-19,-14,25,20,5,0,1],[18,-14,24,18,7,0,3],[-18,18,22,18,4,0,1],[19,19,23,16,4,0,0]],
      'boso-futtsu':[[-19,-15,27,17,5,0,1],[19,-15,25,17,4,0,1],[-18,18,23,17,6,0,3],[18,19,20,18,7,0,0]],
      'boso-interior':[[-12,-10,17,17,4,0,5],[13,-10,17,17,4,0,5],[1,13,25,12,5,0,1]],
      'yokohama-miura':[[-19,-16,22,18,45,0,3],[19,-15,22,20,32,0,4],[-18,18,22,18,18,0,1],[18,19,24,17,10,0,0]],
      'north-gateway':[[-20,-16,21,19,32,0,4],[18,-16,23,19,27,0,3],[-17,18,26,17,7,0,1],[20,19,19,17,15,0,0]]
    };
    if(distinct[sectorId])partSpecs=distinct[sectorId];
    const parts=partSpecs.map((v,i)=>[round(at[0]+v[0]),round(at[1]+v[1]),...v.slice(2),d.ri,round(.21+i*.17)]),fps=parts.map(footprint);
    const r=addRoad(d,[hit.at,gate],2,'设施入口',{kind:'road',roadId:hit.road.id,at:hit.at});if(!r)return;
    const siteDesc=space?'总装厂房与两处分开的圆形发射设施围绕勤务院落布置，专属入口接入外房沿海道路。':industrial?'长厂房、设备楼与作业院落分据入口两侧，外缘道路连接附近的产业街坊。':d.mode==='campus'?'研究楼围绕低层院区分散布置，步行庭院留在各楼之间，入口连接周边生活街坊。':['mountain','hill'].includes(d.mode)?'低层楼房与小型院落收在山前谷口，入口连到沿谷道路，外围留出林地与绿地。':'多座高低错落的楼体围绕公共庭院布置，入口接入附近的住区与通勤道路。';
    const site={id,name:facilityNames[sectorId],region:d.parent,ri:d.ri,type:space?'spaceport':industrial?'factory':d.mode==='campus'?'research':'transit',size,at,points:plot,parts,footprints:fps,
      access:{name:facilityNames[sectorId]+'入口',elevation:0,width:2,points:[gate,hit.at],dist:hit.distance},forecourt:[gate,mix(gate,at,.045)],desc:siteDesc,provenance:'M8全域新增地标'};
    out.complexes.push(site);solids.add(plot,2,{site:true});
    out.places.push({id,name:site.name,cat:'地标',type:'landmark',group:d.parent,at:copy(at),site:true,proposal:true,desc:site.desc});
  };
  out.sectors.forEach(addFacility);
  out.sectors.forEach(branchDistrict);
  const caps={ryomo:[82,280],'north-gateway':[96,350],'mito-oarai':[82,310],'saitama-north':[100,390],'tsukuba-north':[78,250],'tone-south':[60,250],'kashima-kamisu':[100,370],'narita-hokuso':[96,350],'chiba-extension':[100,410],choshi:[72,270],kujukuri:[58,240],okutama:[45,130],tanzawa:[45,140],'yokohama-miura':[104,390],'boso-kisarazu':[60,260],'boso-kimitsu':[92,280],'boso-futtsu':[58,220],'boso-interior':[42,130],'boso-pacific':[72,260]};
  const tryBuilding=(d,b,isMicro)=>{
    const fp=footprint(b),envelope=detailFootprint(b),gap=isMicro?1.1:2;
    if(!envelope.every(p=>contains(p,d.points))||!landClear(envelope)||solids.blocked(envelope,gap)||roadIndex.blocked(envelope,.8))return false;
    solids.add(envelope,gap,{new:true});
    if(isMicro){out.micro.push({b,subdistrict:d.id});out.microFootprints.push(fp);}else{out.buildings.push(b);out.footprints.push(fp);}return true;
  };
  const fillDistrict=(d,isMicro)=>{
    const cap=caps[d.id.slice(3)][isMicro?1:0],local=out.roads.filter(r=>r.id.startsWith(d.id+'-')&&!r.purpose.includes('设施入口'));
    const frontage=local.flatMap(r=>r.points.slice(1).map((p,i)=>({r,a:r.points[i],b:p,length:dist(r.points[i],p)}))).filter(v=>v.length>12);
    let made=0,attempt=0;
    while(made<cap&&attempt++<cap*180&&frontage.length){
      const f=frontage[Math.floor(rnd()*frontage.length)],p=mix(f.a,f.b,.06+rnd()*.88),angle=Math.atan2(f.b[1]-f.a[1],f.b[0]-f.a[0]),side=rnd()<.5?-1:1;
      const industrial=['industry','logistics','port'].includes(d.mode),sparse=['mountain','hill'].includes(d.mode),urban=['station','urban','mixed','campus'].includes(d.mode);
      let w,depth,h,kind;
      if(isMicro){w=3.6+rnd()*4.5;depth=4+rnd()*5.5;h=sparse?1.3+rnd()*3:urban?3+rnd()*8:1.5+rnd()*5;kind=rnd()<.4?1:0;}
      else if(industrial){w=17+rnd()*23;depth=12+rnd()*17;h=4+rnd()*12;kind=rnd()<.65?1:rnd()<.5?3:0;}
      else if(sparse){w=9+rnd()*9;depth=8+rnd()*10;h=3+rnd()*7;kind=rnd()<.5?1:3;}
      else{w=10+rnd()*14;depth=11+rnd()*15;h=urban?12+rnd()*28:4+rnd()*10;kind=rnd()<.3?4:rnd()<.5?3:0;}
      // Unequal setbacks, a rear row and mixed frontage depths avoid identical parallel strings.
      const row=isMicro&&rnd()<.63?1:0,offset=(f.r.width/2)+depth/2+3+(isMicro?12+rnd()*12:3+rnd()*7)+row*(12+rnd()*13);
      const at=[round(p[0]-Math.sin(angle)*side*offset),round(p[1]+Math.cos(angle)*side*offset)];
      if(sparse){const valley=dist(at,d.at);if(valley>380&&rnd()<.6)continue;}
      const b=[...at,round(w),round(depth),round(h),round(angle*180/Math.PI+(rnd()-.5)*8),kind,d.ri,round(rnd())];
      if(tryBuilding(d,b,isMicro))made++;
    }
    d[isMicro?'microCount':'detailCount']=made;
  };
  out.sectors.forEach(d=>fillDistrict(d,false));
  out.sectors.forEach(d=>fillDistrict(d,true));
  // Rural fields and woodland fragments occupy real unused ground, not giant sector-colored plates.
  for(const d of out.sectors){
    const rural=['mountain','hill','coast','industry','station'].includes(d.mode),target=rural?8:3,bb=d.bounds;
    for(let attempt=0;attempt<300&&d.openSpaces.length<target;attempt++){
      const x=bb[0]+rnd()*(bb[2]-bb[0]),y=bb[1]+rnd()*(bb[3]-bb[1]),w=30+rnd()*65,h=20+rnd()*50;
      const points=[[x-w*.5,y-h*.43],[x+w*.45,y-h*.5],[x+w*.5,y+h*.2],[x+w*.24,y+h*.5],[x-w*.44,y+h*.4]].map(p=>p.map(round));
      if(!points.every(p=>contains(p,d.points))||!landClear(points)||solids.blocked(points,5)||roadIndex.blocked(points,3))continue;
      const g={id:d.id+'-open-'+(d.openSpaces.length+1),ri:d.ri,type:['mountain','hill'].includes(d.mode)?'park':'field',points};d.openSpaces.push(g);out.grounds.push(g);solids.add(points,1);
    }
  }
  // Keep new pools addressable for verification, append them once to the existing renderer schema.
  data.roads=mainRoads;
  renameCenterDisplay(data);
  data.districtExpansion.districts.push(...copy(out.sectors));data.districtExpansion.roads.push(...copy(out.roads));
  data.districtExpansion.buildings.push(...copy(out.buildings));data.districtExpansion.footprints.push(...copy(out.footprints));
  data.districtExpansion.micro.push(...copy(out.micro));data.districtExpansion.microFootprints.push(...copy(out.microFootprints));
  data.districtExpansion.places.push(...copy(out.places));data.complexes.push(...copy(out.complexes));data.grounds.push(...copy(out.grounds));
  const oldEffectiveMicro=frozenM7.cityDetail.micro.length+frozenM7.districtExpansion.micro.length-(frozenM7.terrainContext.reusedMicroIndices||[]).length;
  const oldOther=frozenM7.complexes.reduce((n,s)=>n+s.parts.length,0)+frozenM7.terrainContext.complexes.reduce((n,s)=>n+s.parts.length,0)+frozenM7.cityDetail.harbor.length+frozenM7.portSites.reduce((n,s)=>n+s.buildings.length+(s.gantry?3:0),0)+frozenM7.landmarks.filter(s=>s.type!=='holo').length+frozenM7.districtExpansion.landmarks.length;
  out.metrics={seed:20510819,sectors:out.sectors.length,newRegions:data.regions.length-frozenM7.regions.length,newDetailed:out.buildings.length,newMicro:out.micro.length,newFacilityParts:out.complexes.reduce((n,s)=>n+s.parts.length,0),newFacilities:out.complexes.length,newLocalRoads:out.roads.length,newOpenGrounds:out.grounds.length,reservedMainRoads:mainRoads.length,oldDetailed:frozenM7.buildings.length+frozenM7.districtExpansion.buildings.length,oldEffectiveMicro,oldOther,removedOldBuildings:[],movedOldBuildings:[],geography:'连续北西大陆、太平洋岸与房总半岛；旧东京湾岸线保留；霞浦/利根水系保留水面',budgetMeaning:'地图绘制对象，非现实栋数或人口单位'};
  out.metrics.totalBuildingObjects=out.metrics.oldDetailed+oldEffectiveMicro+oldOther+out.metrics.newDetailed+out.metrics.newMicro+out.metrics.newFacilityParts;
  out.status='implemented-full-geometry';
  out.indices={buildings:[frozenM7.districtExpansion.buildings.length,out.buildings.length],micro:[frozenM7.districtExpansion.micro.length,out.micro.length],roads:[frozenM7.districtExpansion.roads.length,out.roads.length],districts:[frozenM7.districtExpansion.districts.length,out.sectors.length],places:[frozenM7.districtExpansion.places.length,out.places.length],complexes:[frozenM7.complexes.length,out.complexes.length],grounds:[frozenM7.grounds.length,out.grounds.length]};
  // Full product stores each entity once. The index ranges reconstruct all new pools in the verifier.
  for(const key of ['buildings','footprints','micro','microFootprints','roads','grounds','places','complexes','contours','naturalAreas'])delete out[key];
  return data;
}
