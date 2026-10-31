// M9 concept road network. Geometry is in map units, not surveyed metres.
// This builder never mutates old streets, buildings, sites, or its input data.
import {contains,roadDistance,plotsOverlap} from './atlas-source.mjs';
import {detailFootprint} from './city-detail.mjs';

const round=n=>Math.round(n*100)/100;
const copy=x=>structuredClone(x);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix=(a,b,t)=>a.map((v,i)=>round(v+(b[i]-v)*t));
const bounds=points=>[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
const overlap=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const length=points=>points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);

// Shared junctions define ring/radial topology before any obstacle detour.
const anchors={
  cNorth:[1939,1072],cEast:[2140,1210],cSouth:[1973,1644],cWest:[1772,1272],
  cNortheast:[2142,1095],cSoutheast:[2127,1435],cSouthwest:[1785,1537],
  mSouthwest:[1450,1613],mWest:[1375,1120],mNorthwest:[1562,1018],mNorth:[2003,682],mNortheast:[2374,962],mEast:[2710,1340],mSoutheast:[2720,1570],mSouth:[2206,2026],
  gSouth:[1310,2166],gWest:[932,1396],gNorthwest:[1051,864],gNorth:[1646,745],gNortheast:[2108,640],gEast:[2549,1060],gBay:[2860,1550],
  kSouthwest:[1100,2680],tomeiOuter:[750,2450],kWestSouth:[500,2100],kWest:[450,1400],kNorthwest:[620,580],kNorth:[1200,-280],kNortheast:[2050,-480],kTsukuba:[2930,-100],kNarita:[3480,700],kChiba:[3630,1450],kBoso:[3430,2170],kKimitsu:[3080,2560],
  ryomo:[650,-1180],northGate:[2230,-1220],northExit:[2280,-1660],saitamaNorth:[1980,-150],mito:[3800,-1120],oarai:[4350,-1070],tsukuba:[3160,-330],kashiwa:[2770,600],
  westExit:[-620,1290],tama:[741.6,1376.4],tomei:[1280,1780],tanzawa:[500,2470],southwestExit:[-350,2390],
  narita:[3630,750],kashima:[4380,550],choshi:[4840,1030],chiba:[3070,1450],togane:[4070,1640],kujukuri:[4260,1780],bosoInland:[3550,2420],pacific:[3970,2660],katsuura:[3590,3190],
  kawasaki:[1912,2180],yokohama:[2000,2550],yokosuka:[2130,3000],miura:[2050,3250],kisarazu:[2860,2230],kimitsu:[3130,2480],futtsu:[2860,2880],bosoSouth:[3090,3210],
  midWest:[2200,2320],midEast:[2670,2340],lowerWest:[2190,2820],lowerEast:[2670,2845]
};
// Routes share exact junction vertices; the bay has two east-west bridges and no X.
const definitions=[
  ['c1-core','都心环线','将皇核和内城的短距离通勤分配到各放射路，减轻中心穿行。',4.4,'ring',['cNorth','cNortheast','cEast','cSoutheast','cSouth','cSouthwest','cWest','cNorth']],
  ['c2-central','中央环线','沿内城外围分流，在湾北两端接湾岸干线。',5.8,'ring',['mSouth','mSouthwest','mWest','mNorthwest','mNorth','mNortheast','mEast','mSoutheast']],
  ['c3-gaikan','外环都市联络','连接西部、埼玉和千叶门户，减少跨区车流穿过旧中心。',6.2,'ring',['gSouth','gWest','gNorthwest','gNorth','gNortheast','gEast','gBay']],
  ['c4-keno','圈央都市绕行','山前—北平原—成田—房总的外围货运与绕行通道。',6.4,'ring',['kSouthwest','tomeiOuter','kWestSouth','kWest','kNorthwest','kNorth','kNortheast','kTsukuba','kNarita','kChiba','kBoso','kKimitsu']],
  ['b-bayshore','湾岸港城干线','沿湾西、湾北和湾东组织港口货运；不把货流拉到湾中央交叉。',6.8,'coastal',['yokosuka','yokohama','kawasaki','mSouth','cSouth','cSoutheast','mEast','mSoutheast','gBay','chiba','kisarazu','kimitsu','kKimitsu','futtsu','bosoSouth']],
  ['e20-chuo','中央—多摩山前线','联系内城、多摩与西部谷口，并预留西部独立图入口。',5.6,'radial',['cWest','gWest','tama','kWest','westExit']],
  ['e1-tomei','东名—丹泽山前线','联系霓环、世田谷、相模山前与西南门户。',5.6,'radial',['cSouthwest','mSouthwest','tomei','gSouth','tomeiOuter','tanzawa','southwestExit']],
  ['e17-kanetsu','关越—两毛线','西北通勤及制造业运输，由所泽向高崎前桥方向延伸。',6,'radial',['cWest','mWest','gNorthwest','kNorthwest','kNorth','ryomo']],
  ['e4-tohoku','东北—北向门户线','由埼玉连接北部站城与小山／宇都宫南缘。',6.4,'radial',['cNorth','mNorth','gNortheast','saitamaNorth','kNortheast','northGate','northExit']],
  ['e6-joban','常磐—筑波水户线','东北方向生活、研究与产业联系，绕行霞浦西侧。',6.2,'radial',['cNortheast','mNortheast','gEast','kashiwa','kTsukuba','tsukuba','mito','oarai']],
  ['e51-higashi-kanto','东关东—成田鹿岛线','从湾岸向北总、成田和鹿岛港分流货运。',6.2,'radial',['mSoutheast','gBay','chiba','kChiba','narita','kashima']],
  ['e50-kita-kanto','北关东横向联络','两毛—北向门户—水户之间的横向运输，避免全部回绕东京。',6,'cross-region',['ryomo','northGate','mito']],
  ['keiyo-togane','京叶—东金线','联系千叶旧城、东部城市带、东金与九十九里。',5.8,'radial',['mEast','chiba','kChiba','togane','kujukuri']],
  ['pacific-coast','太平洋沿海联系','连接鹿岛、銚子、九十九里和外房城镇，保留海岸开放面。',5.2,'coastal',['oarai','kashima','choshi','kujukuri','pacific','katsuura','bosoSouth']],
  ['boso-inland','房总内陆联络','由木更津经丘陵谷口到外房，为生活和设施后勤提供横向接入。',5.4,'cross-region',['kisarazu','kBoso','bosoInland','pacific']],
  ['yokohama-miura','横滨—三浦联系','承接横滨副中心、横须贺与三浦聚落，形成湾西南北联系。',5.4,'radial',['gSouth','kawasaki','yokohama','lowerWest','yokosuka','miura']],
  ['bay-mid-west-approach','中湾桥西引道','由川崎干线平缓接入中湾桥。',7.2,'bridge-approach',['kawasaki','midWest']],
  ['bay-mid-east-approach','中湾桥东引道','由中湾桥接木更津湾岸干线。',7.2,'bridge-approach',['midEast','kisarazu']],
  ['bay-lower-west-approach','下湾桥西引道','由横滨／横须贺联系路接下湾桥。',7.2,'bridge-approach',['yokohama','lowerWest']],
  ['bay-lower-east-approach','下湾桥东引道','由下湾桥接富津湾岸干线。',7.2,'bridge-approach',['lowerEast','futtsu']]
];

export function metropolitanRoadObstacles(data){
  const entries=[];
  const add=(points,label,gap=0)=>{if(points?.length>=3)entries.push({points,label,gap,bounds:bounds(points)});};
  for(const [key,list] of [['buildings',data.footprints],['micro',data.cityDetail?.microFootprints],['expansion',data.districtExpansion?.footprints],['expansionMicro',data.districtExpansion?.microFootprints]])(list||[]).forEach((p,i)=>add(p,key+':'+i,.6));
  (data.cityDetail?.harbor||[]).forEach((b,i)=>add(detailFootprint(b),'harbor:'+i,.6));
  for(const c of [...(data.complexes||[]),...(data.terrainContext?.complexes||[])]){add(c.points,c.id,4);}
  for(const s of data.specialSites||[])add(s.points,s.id,s.setback||4);
  for(const s of data.districtExpansion?.landmarks||[])add(s.points,s.id,6);
  for(const g of data.grounds||[])if(g.type==='park')add(g.points,'park',1);
  return entries;
}

function routePlanner(data){
  const obstacles=metropolitanRoadObstacles(data),cells=new Map(),cellSize=70;
  obstacles.forEach(o=>{const b=o.bounds,g=o.gap+12;for(let y=Math.floor((b[1]-g)/cellSize);y<=Math.floor((b[3]+g)/cellSize);y++)for(let x=Math.floor((b[0]-g)/cellSize);x<=Math.floor((b[2]+g)/cellSize);x++){const k=x+','+y;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(o);}});
  const nearby=(a,b)=>{const out=new Set();for(let y=Math.floor(a[1]/cellSize);y<=Math.floor(b[1]/cellSize);y++)for(let x=Math.floor(a[0]/cellSize);x<=Math.floor(b[0]/cellSize);x++)for(const o of cells.get(x+','+y)||[])out.add(o);return out;};
  const land=p=>(data.landmass||[]).some(r=>contains(p,r))&&!(data.waterBodies||[]).some(r=>contains(p,r.points));
  const clear=(a,b,width,water=false)=>{
    const radius=width/2+.8,bb=[Math.min(a[0],b[0])-radius,Math.min(a[1],b[1])-radius,Math.max(a[0],b[0])+radius,Math.max(a[1],b[1])+radius];
    for(const o of nearby(bb.slice(0,2),bb.slice(2)))if(overlap(bb,[o.bounds[0]-o.gap,o.bounds[1]-o.gap,o.bounds[2]+o.gap,o.bounds[3]+o.gap])&&(contains(a,o.points)||roadDistance(a,[...o.points,o.points[0]])<=radius+o.gap||plotsOverlap([a,b],o.points,radius+o.gap)))return false;
    if(!water){const len=distance(a,b),n=Math.max(1,Math.ceil(len/12)),nx=len?-(b[1]-a[1])/len:1,ny=len?(b[0]-a[0])/len:0;for(let i=0;i<=n;i++){const p=mix(a,b,i/n);if(!land(p)||!land([p[0]+nx*radius,p[1]+ny*radius])||!land([p[0]-nx*radius,p[1]-ny*radius]))return false;}}
    return true;
  };
  const snap=(at,width=7.2)=>{if(clear(at,at,width))return at.slice();for(let radius=4;radius<=128;radius+=4)for(let k=0;k<32;k++){const a=k*Math.PI/16,p=[round(at[0]+Math.cos(a)*radius),round(at[1]+Math.sin(a)*radius)];if(clear(p,p,width))return p;}throw Error('No protected road junction near '+at);};
  const stats={detours:0,expanded:0};
  const segment=(start,end,width)=>{
    if(clear(start,end,width))return [start,end];stats.detours++;
    const step=6;
    const gridAt=p=>[Math.round(p[0]/step),Math.round(p[1]/step)];
    const nearest=(p,other)=>{const g=gridAt(p),candidates=[];for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++){const at=[(g[0]+x)*step,(g[1]+y)*step];if(clear(p,at,width))candidates.push({g:[g[0]+x,g[1]+y],at,cost:distance(p,at)+distance(at,other)*.01});}candidates.sort((a,b)=>a.cost-b.cost);if(!candidates.length)throw Error('Junction has no road exit '+p);return candidates[0];};
    const first=nearest(start,end),last=nearest(end,start),key=g=>g[0]+','+g[1];
    for(const margin of [90,220,450]){
      const b=[Math.min(start[0],end[0])-margin,Math.min(start[1],end[1])-margin,Math.max(start[0],end[0])+margin,Math.max(start[1],end[1])+margin];
      const open=[],seen=new Map(),visited=new Set(),edgeMemo=new Map();
      const push=n=>{open.push(n);let i=open.length-1;while(i){const j=(i-1)>>1;if(open[j].f<=n.f)break;open[i]=open[j];i=j;}open[i]=n;};
      const pop=()=>{const v=open[0],last=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let j=i*2+1;if(j+1<open.length&&open[j+1].f<open[j].f)j++;if(open[j].f>=last.f)break;open[i]=open[j];i=j;}open[i]=last;}return v;};
      const head={g:first.g,at:first.at,cost:0,f:distance(first.at,last.at),parent:null};push(head);seen.set(key(head.g),head);let found=null;
      while(open.length&&visited.size<90000){const cur=pop(),ck=key(cur.g);if(visited.has(ck))continue;visited.add(ck);if(ck===key(last.g)){found=cur;break;}
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const g=[cur.g[0]+dx,cur.g[1]+dy],at=g.map(v=>v*step),k=key(g);if(visited.has(k)||at[0]<b[0]||at[1]<b[1]||at[0]>b[2]||at[1]>b[3])continue;
          const ek=ck+'>'+k;if(!edgeMemo.has(ek))edgeMemo.set(ek,clear(cur.at,at,width));if(!edgeMemo.get(ek))continue;
          const detour=roadDistance(at,[start,end]),turn=cur.parent?1-((cur.at[0]-cur.parent.at[0])*dx+(cur.at[1]-cur.parent.at[1])*dy)/(distance(cur.at,cur.parent.at)*Math.hypot(dx,dy)):0;
          const cost=cur.cost+Math.hypot(dx,dy)*step*(1+Math.min(2,detour/500))+(turn||0)*2;
          if(seen.has(k)&&seen.get(k).cost<=cost)continue;const next={g,at,cost,f:cost+distance(at,last.at),parent:cur};seen.set(k,next);push(next);
        }
      }
      stats.expanded+=visited.size;
      if(found){const points=[end];for(let n=found;n;n=n.parent)points.push(n.at);points.push(start);points.reverse();const simplified=[points[0]];let at=0;while(at<points.length-1){let next=points.length-1;while(next>at+1&&!clear(points[at],points[next],width))next--;simplified.push(points[next]);at=next;}return simplified.filter((p,i,a)=>!i||distance(p,a[i-1])>.03);}
    }
    throw Error('No clear metropolitan corridor '+start+' → '+end+' width '+width);
  };
  const smooth=(points,width)=>{
    if(points.length<3)return points;const out=[points[0]];
    for(let i=1;i<points.length-1;i++){const a=points[i-1],b=points[i],c=points[i+1];let cut=Math.min(36,distance(a,b)*.18,distance(b,c)*.18),curve=null;
      for(let attempt=0;attempt<5;attempt++,cut/=2){const u=mix(b,a,cut/distance(a,b)),v=mix(b,c,cut/distance(b,c)),candidate=[];for(let j=0;j<=8;j++){const t=j/8;candidate.push([round((1-t)**2*u[0]+2*(1-t)*t*b[0]+t*t*v[0]),round((1-t)**2*u[1]+2*(1-t)*t*b[1]+t*t*v[1])]);}if(candidate.every((p,j)=>!j||clear(candidate[j-1],p,width))){curve=candidate;break;}}
      if(curve)out.push(...curve);else out.push(b);
    }out.push(points.at(-1));return out.filter((p,i,a)=>!i||distance(p,a[i-1])>.03);
  };
  const ease=(points,width)=>{
    const handles=points.map((p,i)=>{if(!i||i===points.length-1)return [0,0];const a=points[i-1],b=points[i+1],d=distance(a,b),h=Math.min(90,distance(a,p)*.2,distance(p,b)*.2);return d?[(b[0]-a[0])/d*h,(b[1]-a[1])/d*h]:[0,0];}),out=[points[0]];
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],h=handles[i-1],k=handles[i];let accepted=null;
      for(const scale of [1,.5,.25,.125,0]){const u=[a[0]+h[0]*scale,a[1]+h[1]*scale],v=[b[0]-k[0]*scale,b[1]-k[1]*scale],steps=Math.max(2,Math.ceil(distance(a,b)/18)),curve=[];for(let j=0;j<=steps;j++){const t=j/steps,s=1-t;curve.push([round(s*s*s*a[0]+3*s*s*t*u[0]+3*s*t*t*v[0]+t*t*t*b[0]),round(s*s*s*a[1]+3*s*s*t*u[1]+3*s*t*t*v[1]+t*t*t*b[1])]);}if(curve.every((p,j)=>!j||clear(curve[j-1],p,width))){accepted=curve;break;}}
      out.push(...(accepted?accepted.slice(1):[b]));
    }return out.filter((p,i,a)=>!i||distance(p,a[i-1])>.03);
  };
  return {clear,snap,segment,smooth,ease,stats,obstacles};
}

export function buildMetropolitanRoads(data){
  const planner=routePlanner(data),nodes=Object.fromEntries(Object.entries(anchors).map(([id,p])=>[id,planner.snap(p)])),roads=[];
  // Parallel bay spans may shift slightly along shore to preserve existing port buildings.
  for(const [west,east] of [['midWest','midEast'],['lowerWest','lowerEast']]){
    let pair=null;const offsets=[0,...Array.from({length:12},(_,i)=>[(i+1)*8,-(i+1)*8]).flat()];
    for(const dy of offsets){const a=[anchors[west][0],anchors[west][1]+dy],b=[anchors[east][0],anchors[east][1]+dy];if(planner.clear(a,a,7.2)&&planner.clear(b,b,7.2)&&planner.clear(a,b,7.2,true)){pair=[a,b];break;}}
    if(!pair)throw Error('No protected straight bridge corridor '+west);[nodes[west],nodes[east]]=pair;
  }
  for(const [id,name,purpose,width,kind,keys] of definitions){let points=[];for(let i=1;i<keys.length;i++){const leg=planner.smooth(planner.segment(nodes[keys[i-1]],nodes[keys[i]],width),width);points.push(...(i>1?leg.slice(1):leg));}
    points=planner.ease(points,width);
    const sampled=[points[0]];for(let i=1;i<points.length;i++){const steps=Math.max(1,Math.ceil(distance(points[i-1],points[i])/12));for(let j=1;j<=steps;j++)sampled.push(mix(points[i-1],points[i],j/steps));}points=sampled;
    // Rivers retain water below short raised crossings; ordinary road surfaces stay at zero.
    const heights=points.map(p=>round(Math.max(0,...data.rivers.map(r=>Math.max(0,3-roadDistance(p,r.points)*.045)))));
    roads.push({id,name,purpose,kind,width,points,heights,elevation:0,junctionIds:keys,reference:'real-network-topology / concept geometry 2051'});
  }
  const bridges=[];
  for(const spec of [
    {id:'bay-mid-bridge',name:'中湾跨海大桥',from:'midWest',to:'midEast',west:'bay-mid-west-approach',east:'bay-mid-east-approach',deck:15,tower:38,desc:'2051川崎—木更津全桥概念；现实Aqua-Line为桥隧组合，不是本桥的竣工依据。'},
    {id:'bay-lower-bridge',name:'下湾跨海大桥',from:'lowerWest',to:'lowerEast',west:'bay-lower-west-approach',east:'bay-lower-east-approach',deck:18,tower:43,desc:'2051横滨／横须贺—富津概念新桥，现实中不存在本图所示跨湾公路桥。'}
  ]){
    const a=nodes[spec.from],b=nodes[spec.to],points=Array.from({length:25},(_,i)=>mix(a,b,i/24)),heights=points.map(()=>spec.deck),width=7.2;
    if(!planner.clear(a,b,width,true))throw Error(spec.id+' bridge hits protected geometry: '+JSON.stringify({a,b,hits:planner.obstacles.filter(o=>plotsOverlap([a,b],o.points,width/2+.8+o.gap)).map(o=>({label:o.label,bounds:o.bounds}))}));
    const road={id:spec.id,name:spec.name,purpose:'湾两岸直接联系和货运绕行；湾中不设交叉口。',kind:'bay-bridge',width,points,heights,elevation:spec.deck,junctionIds:[spec.from,spec.to],reference:'author-concept-2051',desc:spec.desc};roads.push(road);
    for(const [id,endHigh] of [[spec.west,true],[spec.east,false]]){const r=roads.find(r=>r.id===id),total=length(r.points);let run=0;r.heights=r.points.map((p,i)=>{if(i)run+=distance(r.points[i-1],p);const t=run/total;return round(spec.deck*(endHigh?t:1-t));});}
    const towers=[.27,.73].map(t=>({at:mix(a,b,t),height:spec.tower,deckHeight:spec.deck}));
    bridges.push({id:spec.id,name:spec.name,roadId:spec.id,kind:'suspension',status:'future-concept-2051',points:copy(points),heights:copy(heights),width,deckHeight:spec.deck,towers,anchorages:[a.slice(),b.slice()],spans:[{from:a.slice(),to:towers[0].at.slice(),length:round(distance(a,towers[0].at))},{from:towers[0].at.slice(),to:towers[1].at.slice(),length:round(distance(towers[0].at,towers[1].at))},{from:towers[1].at.slice(),to:b.slice(),length:round(distance(towers[1].at,b))}],desc:spec.desc});
  }
  const retainedIndices=[5,6,8,9,...Array.from({length:13},(_,i)=>i+17)];
  for(const i of retainedIndices){const r=data.roads[i];if(r)roads.push({...copy(r),id:'m7-local-access-'+i,kind:'retained-access',purpose:'保留已认可设施的原入口或短接道路。',heights:r.points.map(()=>r.elevation||0),sourceIndex:i});}
  const junctions=Object.entries(nodes).map(([id,at])=>({id,name:id,at,roadIds:roads.filter(r=>r.junctionIds?.includes(id)).map(r=>r.id),kind:'concept-junction'})).filter(j=>j.roadIds.length>1);
  return {roads,bridges,junctions,metrics:{roads:roads.length,newArterials:definitions.length+bridges.length,replacedOriginalArterials:13,retainedAccessRoads:retainedIndices.length,bridges:bridges.length,junctions:junctions.length,length:round(roads.reduce((n,r)=>n+length(r.points),0)),...planner.stats,ordinaryBuildingMoves:[],protectedFootprints:planner.obstacles.length,notes:['概念道路几何，不是现实里程或通行导航。','旧小路和建筑数据不变；地形生成器须为主路完整宽度与路肩避让。','保留现有轨交数据，湾底地下轨道不是跨湾公路桥。']}};
}
