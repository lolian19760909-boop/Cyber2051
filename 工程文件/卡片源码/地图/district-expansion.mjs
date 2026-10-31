// M7 build-time geometry. These are conceptual development belts, not administrative boundaries.
import {contains,inPolygon,plotsOverlap,roadDistance} from './atlas-source.mjs';
import {detailFootprint} from './city-detail.mjs';

const round=n=>Math.round(n*100)/100;
const mix=(a,b,t)=>a.map((v,i)=>round(v+(b[i]-v)*t));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const bounds=points=>[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
const samples=points=>points.flatMap((p,i)=>{const q=points[(i+1)%points.length],steps=Math.max(1,Math.ceil(distance(p,q)/5));return Array.from({length:steps},(_,j)=>mix(p,q,j/steps));});
const definitions=[
 ['koto-old','江东旧街','KOTO OLD STREETS','keihin',[[2198,1328],[2320,1340],[2390,1448],[2358,1538],[2220,1525],[2182,1440]],48,145,'旧街排屋与沿河小工场',12],
 ['toyosu-ariake','丰洲有明','TOYOSU ARIAKE','keihin',[[2170,1518],[2298,1536],[2365,1587],[2300,1696],[2172,1708],[2150,1608]],48,150,'滨湾街坊与物流住区',-8],
 ['wakasu-backport','若洲港后','WAKASU BACKPORT','keihin',[[2178,1705],[2280,1715],[2266,1790],[2320,1895],[2210,1910],[2162,1812]],40,115,'港后仓储与低层支街',18],
 ['kawasaki-lower','川崎下城','KAWASAKI LOWER TOWN','sagami',[[1480,2365],[1790,2376],[2078,2402],[2110,2460],[1690,2492],[1455,2523]],28,95,'产业南缘与低层住区',10],
 ['setagaya-south','世田谷南缘','SETAGAYA SOUTH','tsurumaki',[[1320,1680],[1490,1740],[1695,1815],[1720,1940],[1478,1960],[1310,1860]],32,120,'曲街宅院与渐疏住宅',15],
 ['sayama-fringe','狭山外缘','SAYAMA FRINGE','hokuen',[[582,782],[766,762],[800,1000],[685,1110],[556,1005]],15,50,'机造城外缘与林间住区',-12],
 ['niiza','新座','NIIZA','saitama',[[1240,468],[1450,483],[1500,647],[1402,718],[1256,640]],18,65,'台地街镇与通勤住区',7],
 ['matsudo-kashiwa','松户柏','MATSUDO KASHIWA','chiba',[[2680,750],[2918,712],[3062,858],[3050,950],[2790,925],[2660,850]],20,70,'北岸通勤街镇与院落',-8],
 ['ichihara-east','市原东缘','ICHIHARA EAST','chiba',[[3100,1470],[3224,1525],[3222,1930],[3105,1898],[3082,1710]],18,65,'港湾工业外缘与缓坡住区',82],
 ['kimitsu-south','君津南','KIMITSU SOUTH','docks',[[2820,2510],[3090,2486],[3200,2630],[3165,2815],[2970,2825],[2828,2700]],15,55,'外港南缘与稀疏工住街镇',10],
 ['hachioji-valley','八王子谷口','HACHIOJI VALLEY','kai',[[575,1590],[752,1690],[852,1788],[793,1890],[578,1870],[510,1740]],10,35,'沿谷小镇与台地入口',-15],
 ['ashigara-foothill','足柄山麓','ASHIGARA FOOTHILL','fuji',[[555,2200],[710,2250],[792,2410],[712,2502],[618,2430],[525,2310]],8,30,'山林边缘与零散村落',18]
];

export function buildDistrictExpansion(data){
  const {regions,cityDetail}=data;
  let seed=205107;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  const onLand=p=>data.landmass.some(poly=>contains(p,poly))||regions.some(r=>r.polygons.some(poly=>inPolygon(p,poly)));
  const districts=definitions.map(([id,name,en,parent,points,,,theme])=>({id,name,en,parent,ri:regions.findIndex(r=>r.id===parent),at:points.reduce((s,p)=>[s[0]+p[0]/points.length,s[1]+p[1]/points.length],[0,0]).map(round),points,bounds:bounds(points),desc:name+'作为'+regions.find(r=>r.id===parent).name+'周边的概念发展带，保留既有行政范围与公共绿地。'+theme+'沿地面街路延伸。',kind:'subdistrict',theme}));
  // The same modest build-time index used by M6; all returned values are plain geometry.
  const bins=new Map();
  const cells=(points,gap=0)=>{const b=bounds(points),keys=[];for(let y=Math.floor((b[1]-gap)/64);y<=Math.floor((b[3]+gap)/64);y++)for(let x=Math.floor((b[0]-gap)/64);x<=Math.floor((b[2]+gap)/64);x++)keys.push(x+','+y);return keys;};
  const reserve=(points,gap=1)=>{const o={points,gap};for(const k of cells(points,gap)){if(!bins.has(k))bins.set(k,[]);bins.get(k).push(o);}};
  const blocked=(points,gap=0)=>[...new Set(cells(points,gap).flatMap(k=>bins.get(k)||[]))].some(o=>plotsOverlap(points,o.points,o.gap+gap));
  const solid=[...data.footprints.map(points=>({points,gap:2})),...data.specialSites.map(s=>({points:s.points,gap:s.setback+2})),...data.grounds.filter(g=>g.type==='park').map(g=>({points:g.points,gap:1})),...cityDetail.microFootprints.map(points=>({points,gap:1.6})),...cityDetail.harborPlots.map(s=>({points:s.points,gap:3}))];
  for(const o of solid)reserve(o.points,o.gap);
  for(const r of data.rivers)for(let i=1;i<r.points.length;i++)reserve([r.points[i-1],r.points[i]],r.width/2+5);
  const ground=[...data.roads.filter(r=>!r.elevation&&!r.name.includes('入口')&&!r.name.includes('广场')),...data.streets,...cityDetail.harborLanes];
  const allLines=[...data.roads,...data.streets,...data.rivers.map(r=>({...r,width:r.width+10})),...cityDetail.harborLanes];
  const lineSegments=lines=>lines.flatMap(r=>r.points.slice(1).map((p,i)=>({points:[r.points[i],p],width:r.width||1.4})));
  const roadObstacles=lineSegments(allLines);
  const clearPlot=points=>samples(points).every(onLand)&&!blocked(points)&&!roadObstacles.some(r=>plotsOverlap(points,r.points,r.width/2+3));
  const towerAt=[2370,1100],towerPoints=detailFootprint([...towerAt,40,36,0,0]);
  if(!clearPlot(towerPoints))throw new Error('Tokyo Skytree reserved plot is occupied');
  const towerProvenance={position:'押上意象概念位置',projectedAt:[2255.41,1189.58],conceptAt:towerAt,reason:'真实位置的投影点会碰到当前简化河道，因此在概念地图中向近邻空地移位；不是精确复原。'};
  const landmarks=[{id:'tokyo-skytree',name:'东京天空塔',at:towerAt,ri:regions.findIndex(r=>r.id==='lowtown'),points:towerPoints,size:[40,36],height:42.27,meters:634,variant:'skytree',provenance:towerProvenance}];
  const roads=[],buildings=[],footprints=[],micro=[],microFootprints=[],counts=[];
  const clearRoad=(points,width=2)=>points.slice(1).every((p,i)=>samples([points[i],p]).every(onLand)&&!blocked([points[i],p],width/2+.5));
  const nearest=(p,segment)=>{const [a,b]=segment,dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return mix(a,b,t);};
  const addRoad=(points,d,name)=>{const road={name,points,width:2,ri:d.ri};roads.push(road);roadObstacles.push(...lineSegments([road]));return road;};
  const connections=(targets,limit)=>{
    const segments=lineSegments([...ground,...roads]),options=[];
    for(const at of targets)for(const s of segments){const anchor=nearest(at,s.points),dist=distance(at,anchor);if(dist>5&&dist<limit)options.push({at,anchor,dist});}
    return options.sort((a,b)=>a.dist-b.dist);
  };
  // Gate reaches the edge of the tower setback; it never runs through the base.
  const towerGates=samples(detailFootprint([...towerAt,43,39,0,0]));
  const towerLink=connections(towerGates,240).find(o=>clearRoad([o.anchor,o.at],.8)&&!plotsOverlap([o.anchor,o.at],towerPoints,.5));
  if(!towerLink)throw new Error('Tokyo Skytree has no clear ground-road entrance');
  const towerRoad={name:'东京天空塔入口',points:[towerLink.anchor,towerLink.at],width:.8,ri:landmarks[0].ri};roads.push(towerRoad);roadObstacles.push(...lineSegments([towerRoad]));
  reserve(towerPoints,1);
  for(const [di,d] of districts.entries()){
    const spec=definitions[di],detailBudget=spec[5],microBudget=spec[6],axis=spec[8]*Math.PI/180,targets=[];
    for(let y=d.bounds[1]+12;y<d.bounds[3]-10;y+=32)for(let x=d.bounds[0]+12;x<d.bounds[2]-10;x+=32){const p=[round(x+rnd()*17),round(y+rnd()*17)];if(contains(p,d.points)&&onLand(p)&&!blocked(detailFootprint([...p,4,4,0,0]),1))targets.push(p);}
    const options=connections(targets,420),link=options.find(o=>clearRoad([o.anchor,o.at]));
    if(!link)throw new Error('No ground-road access for '+d.id);
    const local=[addRoad([link.anchor,link.at],d,d.name+'联络街')],nodes=[{at:link.at,degree:1}];
    if(di<3)for(const o of options){
      if(nodes.length>=4)break;
      if(nodes.some(n=>distance(n.at,o.at)<65)||!clearRoad([o.anchor,o.at]))continue;
      local.push(addRoad([o.anchor,o.at],d,d.name+'接续街'+nodes.length));nodes.push({at:o.at,degree:1});
    }
    const area=Math.abs(d.points.reduce((sum,p,i)=>{const q=d.points[(i+1)%d.points.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
    const streetBudget=Math.max(8,Math.min(34,Math.ceil(area/(di<3?1300:3600))));
    // Branches follow a loose local grain; staggered lengths and turns prevent a uniform grid.
    for(let attempt=0;attempt<streetBudget*100&&local.length<streetBudget;attempt++){
      const start=nodes[Math.floor(rnd()*nodes.length)];if(start.degree>=3)continue;
      const angle=axis+Math.floor(rnd()*4)*Math.PI/2+(rnd()-.5)*.58,len=di<3?29+rnd()*46:38+rnd()*57;
      const elbow=[round(start.at[0]+Math.cos(angle)*len*.55),round(start.at[1]+Math.sin(angle)*len*.55)],end=[round(elbow[0]+Math.cos(angle+(rnd()-.5)*.42)*len*.45),round(elbow[1]+Math.sin(angle+(rnd()-.5)*.42)*len*.45)];
      if(![elbow,end].every(p=>contains(p,d.points))||nodes.some(n=>distance(n.at,end)<(di<3?23:31))||local.some(r=>roadDistance(end,r.points)<9))continue;
      const incident=local.filter(r=>r.points.some(p=>distance(p,start.at)<.1));
      if(incident.some(r=>{const other=distance(r.points[0],start.at)<.1?r.points[1]:r.points.at(-2),a=Math.atan2(other[1]-start.at[1],other[0]-start.at[0]);return Math.cos(a-angle)>.82;}))continue;
      const points=[start.at,elbow,end];if(!clearRoad(points))continue;
      local.push(addRoad(points,d,d.name+'支街'+local.length));start.degree++;nodes.push({at:end,degree:1});
    }
    // Existing street frontage inside the belt also contributes; it is never an isolated housing grid.
    const frontages=[...local,...ground.filter(r=>r.points.some(p=>contains(p,d.points)))];
    const candidates=[];
    for(const r of frontages)for(let k=1;k<r.points.length;k++){
      const a=r.points[k-1],b=r.points[k],length=distance(a,b);if(length<6)continue;
      const dx=(b[0]-a[0])/length,dy=(b[1]-a[1])/length,angle=Math.atan2(dy,dx)*180/Math.PI;
      for(let step=7+rnd()*9;step<length;step+=(di<3?6:10)+rnd()*10)for(const side of [-1,1]){
        const p=mix(a,b,step/length),industrial=['wakasu-backport','ichihara-east','kawasaki-lower'].includes(d.id),w=industrial?14+rnd()*11:di<3?8+rnd()*8:10+rnd()*11,depth=industrial?8+rnd()*9:di<3?6+rnd()*7:8+rnd()*10;
        for(let row=0;row<(di<3?5:3);row++){
          const offset=(r.width||2)/2+5+depth/2+row*(depth+8+rnd()*8),at=[round(p[0]-dy*offset*side),round(p[1]+dx*offset*side)];
          const b=[...at,round(w*(row? .55:1)),round(depth*(row? .5:1)),row?1.5:round(4+rnd()*(di<3?9:5)),round(angle+(rnd()-.5)*12),industrial?1:rnd()>.65?3:0,d.ri,round(.28+rnd()*.4)];
          candidates.push({b,small:row>0,priority:rnd()+row});
        }
      }
    }
    let detailed=0,small=0;
    for(const c of candidates.sort((a,b)=>a.priority-b.priority)){
      const b=c.b;if(c.small){if(small>=microBudget||micro.length>=1000)continue;b[2]=Math.min(8,b[2]);b[3]=Math.min(7,b[3]);b[4]=1.5;b[6]=0;}else if(detailed>=detailBudget||buildings.length>=320)continue;
      const fp=detailFootprint(b);if(!samples(fp).every(p=>contains(p,d.points)&&onLand(p))||blocked(fp)||roadObstacles.some(r=>plotsOverlap(fp,r.points,r.width/2+2)))continue;
      if(c.small){micro.push({b});microFootprints.push(fp);small++;}else{buildings.push(b);footprints.push(fp);detailed++;}reserve(fp,c.small?1.5:2.5);
    }
    counts.push({id:d.id,roads:local.length,buildings:detailed,micro:small});
  }
  // Short pedestrian alleys occupy measured gaps between existing M6 small houses.
  // They connect to old surface streets and add no housing, parcels or land.
  const alleys=[];
  for(const id of ['underpool','lowtown']){
    const ri=regions.findIndex(r=>r.id===id),localMicro=cityDetail.micro.filter(m=>m.b[7]===ri&&m.b[2]<10),localStreets=lineSegments(data.streets.filter(r=>r.ri===ri)),candidates=[];
    for(let i=0;i<localMicro.length;i++)for(let j=i+1;j<localMicro.length;j++){
      const a=localMicro[i].b,b=localMicro[j].b,separation=distance(a,b);if(separation<9||separation>27)continue;
      const at=mix(a.slice(0,2),b.slice(0,2),.5);if(!regions[ri].polygons.some(p=>inPolygon(at,p)))continue;
      for(const s of localStreets){const anchor=nearest(at,s.points),dist=distance(at,anchor);if(dist>=9&&dist<=38)candidates.push({at,anchor,dist});}
    }
    let count=0;
    for(const c of candidates.sort((a,b)=>a.dist-b.dist)){
      if(count>=12)break;
      if(alleys.some(r=>distance(r.points.at(-1),c.at)<48)||!clearRoad([c.anchor,c.at],.6))continue;
      const r={name:regions[ri].name+'小巷'+(++count),points:[c.anchor,c.at],width:.6,ri};roads.push(r);alleys.push(r);
    }
  }
  const places=[{id:'tokyo-skytree',name:'东京天空塔',cat:'城市地标',type:'landmark',group:'lowtown',site:true,proposal:true,at:towerAt,desc:'634米高的东京天空塔，350米与450米观景台环绕塔身。此处采用押上意象概念位置：真实位置的投影点碰到当前简化河道，因此移至近邻空地，保留塔基入口与步行前场，并非精确复原。',provenance:towerProvenance}];
  return {districts,roads,buildings,footprints,micro,microFootprints,landmarks,places,metrics:{districts:districts.length,buildings:buildings.length,micro:micro.length,roads:roads.length,alleys:alleys.length,counts,harborNorth:counts.slice(0,3).reduce((n,c)=>n+c.buildings+c.micro,0)}};
}
