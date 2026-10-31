// M8 capacity specimens, built independently of the frozen M7 city.
// Coordinates describe original concept geography, not surveyed administrative boundaries.
import {contains,inPolygon,plotsOverlap,roadDistance} from './atlas-source.mjs';
import {detailFootprint} from './city-detail.mjs';

const round=n=>Math.round(n*100)/100;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix=(a,b,t)=>a.map((v,i)=>round(v+(b[i]-v)*t));
const bounds=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const area=p=>Math.abs(p.reduce((s,v,i)=>{const q=p[(i+1)%p.length];return s+v[0]*q[1]-q[0]*v[1];},0))/2;
const edgeSamples=p=>p.flatMap((v,i)=>{const q=p[(i+1)%p.length],n=Math.max(1,Math.ceil(distance(v,q)/4));return Array.from({length:n},(_,j)=>mix(v,q,j/n));});
const footprint=b=>{
  const [x,y,w,d,,angle,kind]=b,a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  let p=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
  if(kind===3)p=[[-.5,-.5],[.5,-.5],[.5,-.1],[-.05,-.1],[-.05,.5],[-.5,.5]];
  if(kind===4)p=[[-.5,-.5],[.5,-.5],[.5,.5],[.22,.5],[.22,-.12],[-.22,-.12],[-.22,.5],[-.5,.5]];
  return p.map(([u,v])=>[round(x+u*w*c-v*d*s),round(y+u*w*s+v*d*c)]);
};
const segmentList=roads=>roads.flatMap(r=>r.points.slice(1).map((p,i)=>({points:[r.points[i],p],gap:(r.width||1.4)/2+2})));

export function buildCentralSamples(data){
  let seed=205108;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const ri=id=>{const n=data.regions.findIndex(r=>r.id===id);if(n<0)throw new Error('Missing M7 parent '+id);return n;};
  const eastPoints=[[3300,975],[3440,908],[3700,924],[3875,1038],[3858,1305],[3760,1438],[3480,1408],[3300,1345]];
  const northPoints=[[1450,185],[1458,-290],[1568,-475],[1875,-495],[2140,-450],[2280,-285],[2300,185],[2050,195],[1760,195]];
  // These two narrow patches join the old artificial canvas closure, not a real shore.
  const eastEdge=y=>round(3298+(3256-3298)*(y-1032)/1820);
  const northEdge=x=>round(276+(206-276)*(x-792)/(2136-792));
  const seamPatches=[
    {id:'m8-east-cut-seam',points:[[eastEdge(1050)-10,1050],[3310,1050],[3310,1450],[eastEdge(1450)-10,1450]],maxInwardGap:15,reason:'东侧旧陆底闭合裁边的局部接续；仅 y1050–1450，原裁边外且旧包围范围内的薄带不超过15单位。实际湾岸、河流、港池保持。'},
    {id:'m8-north-cut-seam',points:[[1450,185],[2080,185],[2080,northEdge(2080)+18],[1450,northEdge(1450)+18]],maxInwardGap:60,reason:'北侧旧陆底闭合裁边的局部接续；仅 x1450–2300，旧裁边外且旧包围范围内的薄带不超过60单位。宽面接续北平原，不造针形地桥。'}
  ];
  const landmass=[eastPoints,northPoints,...seamPatches.map(s=>s.points)];
  const onLand=p=>[...data.landmass,...landmass].some(poly=>contains(p,poly))||data.regions.some(r=>r.polygons.some(poly=>inPolygon(p,poly)));
  const districts=[
    {id:'narita-hokuso-sample',name:'成田北总样带',en:'NARITA HOKUSO SAMPLE',parent:'chiba',ri:ri('chiba'),at:[3540,1150],points:eastPoints,bounds:bounds(eastPoints),kind:'subdistrict',theme:'密集站城、混合街坊与内陆物流',desc:'M8首批容量样板：北总台地的站城与物流混合带。概念位置接千叶现有街路，不是机场运营、现实市界或完成全东部扩图的声明。',openSpaces:[]},
    {id:'saitama-north-sample',name:'埼玉北缘样带',en:'SAITAMA NORTH SAMPLE',parent:'saitama',ri:ri('saitama'),at:[1880,-115],points:northPoints,bounds:bounds(northPoints),kind:'subdistrict',theme:'密集站城—农地—村镇',desc:'M8首批容量样板：旧埼玉街口向北延伸，近站集中建设，田地之间保留分离村镇。属于概念北平原，不是北关东行政归并或全域完工。',openSpaces:[
      {id:'north-west-fields',type:'field',points:[[1510,-220],[1710,-242],[1750,-164],[1700,-132],[1530,-155]]},
      {id:'north-east-fields',type:'field',points:[[2045,-225],[2205,-208],[2240,-124],[2060,-142]]},
      {id:'north-wood-edge',type:'green',points:[[1480,108],[1635,98],[1650,154],[1495,167]]}
    ]}
  ];
  const bins=new Map(),cells=(p,gap=0)=>{const b=bounds(p),keys=[];for(let y=Math.floor((b[1]-gap)/64);y<=Math.floor((b[3]+gap)/64);y++)for(let x=Math.floor((b[0]-gap)/64);x<=Math.floor((b[2]+gap)/64);x++)keys.push(x+','+y);return keys;};
  const reserve=(points,gap=1)=>{const o={points,gap};for(const k of cells(points,gap)){if(!bins.has(k))bins.set(k,[]);bins.get(k).push(o);}};
  const blocked=(points,gap=0)=>[...new Set(cells(points,gap).flatMap(k=>bins.get(k)||[]))].some(o=>plotsOverlap(points,o.points,o.gap+gap));
  const oldSolids=[
    ...data.footprints.map(points=>({points,gap:1.5})),
    ...data.cityDetail.microFootprints.map(points=>({points,gap:1})),
    ...data.districtExpansion.footprints.map(points=>({points,gap:1.5})),
    ...data.districtExpansion.microFootprints.map(points=>({points,gap:1})),
    ...data.specialSites.map(s=>({points:s.points,gap:s.setback+1})),
    ...data.grounds.filter(g=>g.type==='park').map(g=>({points:g.points,gap:1})),
    ...data.cityDetail.harborPlots.map(s=>({points:s.points,gap:2})),
    ...data.complexes.map(s=>({points:s.points,gap:1})),
    ...data.terrainContext.complexes.map(s=>({points:s.points,gap:1})),
    ...data.districtExpansion.landmarks.map(s=>({points:s.points,gap:2}))
  ];
  for(const pier of data.railNetwork.piers)oldSolids.push({points:detailFootprint([...pier.at,2,2,0,0]),gap:1});
  for(const river of data.rivers)for(let i=1;i<river.points.length;i++)oldSolids.push({points:[river.points[i-1],river.points[i]],gap:river.width/2+5});
  oldSolids.forEach(o=>reserve(o.points,o.gap));
  const oldRoads=[...data.roads,...data.streets,...data.districtExpansion.roads,...data.cityDetail.harborLanes];
  const roadBins=new Map();
  const addSegments=r=>{for(const o of segmentList([r]))for(const k of cells(o.points,o.gap)){if(!roadBins.has(k))roadBins.set(k,[]);roadBins.get(k).push(o);}};
  oldRoads.forEach(addSegments);
  const roadBlocked=points=>[...new Set(cells(points).flatMap(k=>roadBins.get(k)||[]))].some(o=>plotsOverlap(points,o.points,o.gap));
  const corridorLand=(points,width)=>points.slice(1).every((p,i)=>{const a=points[i],n=Math.max(1,Math.ceil(distance(a,p)/3)),len=distance(a,p),nx=-(p[1]-a[1])/len,ny=(p[0]-a[0])/len;return Array.from({length:n+1},(_,j)=>mix(a,p,j/n)).every(q=>[-1,0,1].every(side=>onLand([q[0]+nx*side*(width/2+2),q[1]+ny*side*(width/2+2)])));});
  const clearRoad=(points,width)=>corridorLand(points,width)&&points.slice(1).every((p,i)=>!blocked([points[i],p],width/2+.5));
  const roads=[],buildings=[],footprints=[],micro=[],microFootprints=[],sites=[];
  const addRoad=(d,points,width,purpose,entry,required=false)=>{
    if(!clearRoad(points,width)){if(required)throw new Error('Blocked sample road '+purpose);return null;}
    const r={id:d.id+'-road-'+(roads.filter(r=>r.ri===d.ri).length+1),name:d.name+'·'+purpose,ri:d.ri,points,width,elevation:0,purpose,entry};
    roads.push(r);addSegments(r);return r;
  };
  const joined=(d,points,width,purpose,required=false)=>{
    const parent=roads.find(r=>roadDistance(points[0],r.points)<.04);if(!parent){if(required)throw new Error('No road entry '+purpose);return null;}
    return addRoad(d,points,width,purpose,{kind:'sample-road',roadId:parent.id,at:points[0]},required);
  };
  const oldEntry=(d,index,vertex,tail,width,purpose)=>{const old=data.streets[index],at=old?.points[vertex];if(!at||old.ri!==d.ri)throw new Error('Invalid frozen street outlet');return addRoad(d,[at.map(round),...tail],width,purpose,{kind:'old-street',collection:'streets',index,vertex,at:at.slice()},true);};
  const east=districts[0],north=districts[1];
  oldEntry(east,423,4,[[3170,1192],[3250,1178],[3330,1160]],3.4,'千叶旧街接续');
  joined(east,[[3330,1160],[3400,1138],[3480,1134],[3560,1158],[3650,1150],[3750,1175],[3830,1230]],3.4,'站城物流主街',true);
  joined(east,[[3400,1138],[3380,1075],[3415,1000],[3500,963],[3580,988],[3670,970],[3770,1020],[3800,1115]],2.4,'北站城联络街',true);
  joined(east,[[3480,1134],[3455,1210],[3495,1310],[3590,1344],[3700,1330],[3780,1300],[3830,1230]],2.4,'南混合住区环街',true);
  joined(east,[[3750,1175],[3725,1240],[3700,1330]],2.6,'物流换装联络',true);
  joined(east,[[3560,1158],[3590,1230],[3590,1344]],1.8,'旧街与南院连接',true);
  oldEntry(north,291,0,[[1890,280],[1880,180]],2.6,'埼玉北侧旧街接续');
  joined(north,[[1880,180],[1848,110],[1870,35],[1900,-40],[1862,-125],[1895,-215],[1865,-305],[1905,-395],[1880,-450]],3,'北缘站城乡镇主街',true);
  joined(north,[[1848,110],[1750,75],[1690,5],[1745,-55],[1810,-72],[1900,-40]],2.1,'近站西住区联络',true);
  joined(north,[[1870,35],[1960,76],[2070,40],[2110,-20],[2040,-68],[1900,-40]],2.1,'近站东住区联络',true);
  joined(north,[[1895,-215],[1840,-262],[1740,-292],[1620,-312],[1530,-358]],1.2,'西村与农地通行',true);
  joined(north,[[1865,-305],[2000,-310],[2100,-348],[2190,-320],[2240,-270]],1.2,'东村与农地通行',true);
  joined(north,[[1905,-395],[1805,-420],[1700,-395],[1620,-312]],1.3,'北村旧街连接',true);
  // Local streets branch from measured chain points; unequal spacing and bending retain a street grain.
  const growStreets=(d,count,urban)=>{
    const local=roads.filter(r=>r.ri===d.ri&&!r.purpose.includes('旧街接续')),nodes=local.flatMap(r=>r.points.slice(1,-1).map(at=>({at,degree:0})));
    for(let attempt=0;attempt<count*90&&roads.filter(r=>r.ri===d.ri).length<count;attempt++){
      const node=nodes[Math.floor(rnd()*nodes.length)];if(node.degree>=2)continue;
      const farm=!urban&&node.at[1]<-130&&node.at[1]>-280;if(farm)continue;
      const angle=rnd()*Math.PI*2,length=urban?35+rnd()*72:30+rnd()*62;
      const elbow=[round(node.at[0]+Math.cos(angle)*length*.6),round(node.at[1]+Math.sin(angle)*length*.6)],end=[round(elbow[0]+Math.cos(angle+(rnd()-.5)*.6)*length*.4),round(elbow[1]+Math.sin(angle+(rnd()-.5)*.6)*length*.4)];
      if(![elbow,end].every(p=>contains(p,d.points))||d.openSpaces.some(s=>plotsOverlap([node.at,elbow,end],s.points,5)))continue;
      const other=roads.filter(r=>r.ri===d.ri),startIncident=other.filter(r=>r.points.some(p=>distance(p,node.at)<.1));
      if(other.some(r=>roadDistance(end,r.points)<16)||startIncident.some(r=>r.points.some((p,i)=>i&&plotsOverlap([node.at,elbow],[r.points[i-1],p],0)&&roadDistance(elbow,[r.points[i-1],p])<7)))continue;
      const road=joined(d,[node.at,elbow,end],urban?1.5+rnd()*.5:1.15+rnd()*.4,urban?'混合街坊支街':'站城或村镇支街');
      if(road){node.degree++;nodes.push({at:elbow,degree:0},{at:end,degree:0});}
    }
  };
  const clearPlot=(fp,d)=>edgeSamples(fp).every(p=>contains(p,d.points)&&onLand(p))&&!blocked(fp)&&!roadBlocked(fp)&&!d.openSpaces.some(s=>plotsOverlap(fp,s.points,2));
  const addBuilding=(b,d,small=false)=>{
    const envelope=detailFootprint(b),fp=small?envelope:footprint(b);if(!clearPlot(envelope,d))return -1;
    const index=small?micro.length:buildings.length;
    if(small){micro.push({b});microFootprints.push(fp);}else{buildings.push(b);footprints.push(fp);}
    reserve(envelope,small?1.1:1.8);return index;
  };
  // Composite ground silhouettes: independent wings leave entrances and courtyards open.
  const addSite=(d,id,name,at,parts,type)=>{
    const indices=[];
    for(const part of parts){const index=addBuilding([...part.slice(0,7),d.ri,part[7]],d);if(index<0)throw new Error('Blocked specimen facility '+id);indices.push(index);}
    sites.push({id,name,at,ri:d.ri,parts:indices,type});
  };
  addSite(east,'hokuso-station-court','北总站城复合街区',[3470,1060],[
    [3470,1047,48,22,18,-9,3,.68],[3448,1092,17,21,25,-9,0,.46],[3490,1090,22,17,12,-9,0,.72]
  ],'transit');
  addSite(east,'hokuso-logistics-court','北总内陆物流院',[3760,1374],[
    [3756,1365,54,24,8,8,1,.42],[3800,1355,20,29,5,8,1,.66],[3760,1401,30,12,4,8,0,.5]
  ],'drop');
  addSite(north,'saitama-north-station-court','埼玉北站复合街区',[1970,15],[
    [1980,8,46,24,16,-12,4,.62],[1948,-15,18,22,24,-12,0,.42],[2010,-21,24,14,7,-12,1,.72]
  ],'transit');
  for(const site of sites){
    const d=districts.find(d=>d.ri===site.ri),gates=site.parts.flatMap(i=>{const b=buildings[i],p=detailFootprint([b[0],b[1],b[2]+12,b[3]+12,0,b[5]]);return p.map((v,k)=>mix(v,p[(k+1)%p.length],.5));}),options=[];
    for(const gate of gates)for(const road of roads.filter(r=>r.ri===site.ri))for(let i=1;i<road.points.length;i++){
      const a=road.points[i-1],q=road.points[i],dx=q[0]-a[0],dy=q[1]-a[1],t=Math.max(0,Math.min(1,((gate[0]-a[0])*dx+(gate[1]-a[1])*dy)/(dx*dx+dy*dy))),anchor=mix(a,q,t),dist=distance(anchor,gate);
      if(dist>4&&dist<120&&clearRoad([anchor,gate],1))options.push({anchor,gate,dist});
    }
    const option=options.sort((a,b)=>a.dist-b.dist)[0];if(!option)throw new Error('No specimen facility entrance '+site.id);
    site.entry=joined(d,[option.anchor,option.gate],1,site.name+'入口',true).id;
  }
  growStreets(east,53,true);growStreets(north,43,false);
  const counts=[];
  for(const d of districts){
    const eastward=d===east,detailBudget=eastward?95:65,microBudget=eastward?550:330,candidates=[];
    for(const road of roads.filter(r=>r.ri===d.ri))for(let k=1;k<road.points.length;k++){
      const a=road.points[k-1],q=road.points[k],len=distance(a,q),dx=(q[0]-a[0])/len,dy=(q[1]-a[1])/len,angle=Math.atan2(dy,dx)*180/Math.PI;
      for(let step=6+rnd()*5;step<len-3;step+=6+rnd()*9)for(const side of [-1,1]){
        const p=mix(a,q,step/len),farm=!eastward&&p[1]<-130&&p[1]>-280,nearStation=distance(p,eastward?[3470,1070]:[1880,35])<155;
        if(farm&&rnd()<.88)continue;
        const village=!eastward&&p[1]<-280,logistics=eastward&&p[0]>3650&&p[1]>1220;
        const w=logistics?18+rnd()*17:village?8+rnd()*9:9+rnd()*15,dep=logistics?12+rnd()*13:village?7+rnd()*9:8+rnd()*13;
        const baseOffset=road.width/2+3+dep/2+rnd()*5;
        for(let row=0;row<(nearStation?7:logistics?5:village?3:5);row++){
          const small=row>0,offset=baseOffset+row*(7+rnd()*4),at=[round(p[0]-dy*offset*side),round(p[1]+dx*offset*side)];
          const height=logistics?4+rnd()*6:village?3+rnd()*4:nearStation?8+rnd()*16:4+rnd()*10;
          const b=[...at,round(small?3.3+rnd()*4:w),round(small?3.1+rnd()*3.8:dep),small?1.5:round(height),round(angle+(rnd()-.5)*9),small?0:logistics?1:rnd()<.3?3:rnd()<.3?4:0,d.ri,round(.25+rnd()*.55)];
          candidates.push({b,small,priority:rnd()+(nearStation?0:village?1.1:1.5)+row*.04});
        }
      }
    }
    let detailed=buildings.filter(b=>b[7]===d.ri).length,smallCount=0;
    const smallZones={station:0,logistics:0,mixed:0,'farm-transition':0,village:0};
    const zoneFor=b=>eastward?distance(b,[3470,1070])<155?'station':b[0]>3650&&b[1]>1220?'logistics':'mixed':b[1]>=-130?'station':b[1]>-280?'farm-transition':'village';
    const smallCaps=eastward?{station:350,logistics:110,mixed:220}:{station:245,'farm-transition':18,village:100};
    const detailZones={station:0,logistics:0,mixed:0,'farm-transition':0,village:0};
    buildings.filter(b=>b[7]===d.ri).forEach(b=>detailZones[zoneFor(b)]++);
    const detailCaps=eastward?{station:65,logistics:28,mixed:45}:{station:52,'farm-transition':3,village:18};
    // Reserve substantial buildings before filling their surrounding streets with small roofs.
    const ordered=[...candidates.filter(c=>!c.small).sort((a,b)=>a.priority-b.priority),...candidates.filter(c=>c.small).sort((a,b)=>a.priority-b.priority)];
    for(const c of ordered){
      if(c.small?smallCount>=microBudget:detailed>=detailBudget)continue;
      const zone=zoneFor(c.b);if(c.small&&smallZones[zone]>=smallCaps[zone])continue;
      if(!c.small&&detailZones[zone]>=detailCaps[zone])continue;
      if(addBuilding(c.b,d,c.small)>=0){if(c.small){smallCount++;smallZones[zone]++;}else{detailed++;detailZones[zone]++;}}
    }
    const localDetailed=buildings.filter(b=>b[7]===d.ri),localMicro=micro.filter(m=>m.b[7]===d.ri),all=[...localDetailed,...localMicro.map(m=>m.b)];
    const zones=eastward?[['station',b=>distance(b,[3470,1070])<155],['logistics',b=>b[0]>3650&&b[1]>1220],['mixed',b=>distance(b,[3470,1070])>=155&&!(b[0]>3650&&b[1]>1220)]]:[['station',b=>b[1]>=-130],['farm-transition',b=>b[1]<-130&&b[1]>-280],['village',b=>b[1]<=-280]];
    const roofArea=buildings.reduce((sum,b,i)=>sum+(b[7]===d.ri?area(footprints[i]):0),0)+micro.reduce((sum,m,i)=>sum+(m.b[7]===d.ri?area(microFootprints[i]):0),0);
    counts.push({id:d.id,roads:roads.filter(r=>r.ri===d.ri).length,buildings:detailed,micro:smallCount,area:round(area(d.points)),roofArea:round(roofArea),zones:zones.map(([id,predicate])=>{const list=all.filter(predicate);return {id,objects:list.length,details:localDetailed.filter(predicate).length,meanHeight:round(list.length?list.reduce((n,b)=>n+b[4],0)/list.length:0)};})});
  }
  const places=sites.map(s=>({id:s.id,name:s.name,cat:s.type==='transit'?'交通设施提案':'物流设施提案',type:s.type,group:data.regions[s.ri].id,at:s.at,site:true,proposal:true,siteParts:s.parts,entryRoadId:s.entry,desc:s.type==='transit'?'M8概念站城样板；地面复合建筑、公共前场与住区街路共同构成轮廓。仅供地图查看，不启动线路运营、旅行或任务。':'M8内陆物流用地样板；长厂房、勤务附楼与场院分开，接地面换装道路。仅供地图查看，不启动交易或任务。'}));
  return {districts,roads,buildings,footprints,micro,microFootprints,places,landmass,seamPatches,metrics:{seed:205108,districts:districts.length,roads:roads.length,buildings:buildings.length,micro:micro.length,objects:buildings.length+micro.length,counts,connections:roads.filter(r=>r.entry.kind==='old-street').map(r=>({roadId:r.id,entry:r.entry,width:r.width,minimumLandMargin:2})),seamPatches:seamPatches.map(s=>({id:s.id,area:round(area(s.points)),maxInwardGap:s.maxInwardGap}))}};
}
